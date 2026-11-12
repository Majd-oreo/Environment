"""Be'ati (بيئتي) — FastAPI application entry point.

Serves the JSON API under /api and the static Arabic frontend at /.
Run locally:  uvicorn app.main:app --reload   (from the backend/ folder)
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .schemas import AnalysisResponse, ChatRequest, ChatResponse
from .services.ai_service import AIService
from .services.errors import AppError
from .services.image_validation import prepare_image
from .services.rate_limit import analyze_limiter, chat_limiter, client_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("beati")

settings = get_settings()
ai = AIService(settings)

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"

app = FastAPI(
    title="Be'ati API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
    return response


# ----------------------------------------------------------------- error handlers
@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message, "code": exc.code})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"error": "البيانات المرسلة غير صالحة.", "code": "validation"})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"error": "حدث خطأ غير متوقع. حاول مرة أخرى.", "code": "internal"})


# --------------------------------------------------------------------------- API
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "ai_configured": settings.ai_enabled,
        "demo": ai.is_demo,
        "max_upload_mb": settings.max_upload_mb,
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    request: Request,
    image: UploadFile = File(...),
    note: str = Form("", max_length=300),
):
    analyze_limiter.check(client_key(request))

    # Read at most limit+1 bytes so huge uploads are rejected without buffering them fully.
    data = await image.read(settings.max_upload_bytes + 1)
    data_url = prepare_image(data, image.content_type, settings)

    report = await ai.analyze_image(data_url, note.strip())
    return AnalysisResponse(
        id=uuid.uuid4().hex[:12],
        report=report,
        model="demo" if ai.is_demo else settings.openai_model,
        demo=ai.is_demo,
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest):
    chat_limiter.check(client_key(request))
    if body.messages[-1].role != "user":
        raise AppError("يجب أن تنتهي المحادثة برسالة من المستخدم.", "validation", 422)
    reply = await ai.chat(body.messages, body.context)
    return ChatResponse(reply=reply, demo=ai.is_demo)


# ---------------------------------------------------------------------- frontend
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon():
        return FileResponse(FRONTEND_DIR / "assets" / "img" / "favicon.svg", media_type="image/svg+xml")
