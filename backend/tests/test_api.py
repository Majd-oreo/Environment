"""API tests. Run from the repository root:  pytest backend/tests -q

They run in DEMO_MODE with no API key, so no OpenAI calls are made.
"""
import io
import os
import sys
from pathlib import Path

os.environ["OPENAI_API_KEY"] = ""
os.environ["DEMO_MODE"] = "true"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402
from app.schemas import ANALYSIS_JSON_SCHEMA, AnalysisReport  # noqa: E402
from app.services.demo_data import sample_report  # noqa: E402

client = TestClient(app)


def _png(size=(200, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 220, 180)).save(buf, format="PNG")
    return buf.getvalue()


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["demo"] is True


def test_index_served():
    r = client.get("/")
    assert r.status_code == 200
    assert 'dir="rtl"' in r.text


def test_analyze_demo_ok():
    r = client.post("/api/analyze", files={"image": ("a.png", _png(), "image/png")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["demo"] is True
    AnalysisReport.model_validate(body["report"])


def test_rejects_non_image():
    r = client.post("/api/analyze", files={"image": ("a.png", b"not an image", "image/png")})
    assert r.status_code == 415
    assert "error" in r.json()


def test_rejects_wrong_type():
    r = client.post("/api/analyze", files={"image": ("a.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 415


def test_rejects_tiny_image():
    r = client.post("/api/analyze", files={"image": ("a.png", _png((20, 20)), "image/png")})
    assert r.status_code == 400


def test_chat_demo():
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "كيف أدوّر الكرتون؟"}]})
    assert r.status_code == 200
    assert r.json()["reply"]


def test_chat_must_end_with_user():
    r = client.post("/api/chat", json={"messages": [{"role": "assistant", "content": "مرحبا"}]})
    assert r.status_code == 422


def test_schema_strict_shape():
    """Every object in the strict schema must list all properties as required."""
    def walk(node):
        if node.get("type") == "object":
            assert node["additionalProperties"] is False
            assert set(node["required"]) == set(node["properties"])
            for child in node["properties"].values():
                walk(child)
        if node.get("type") == "array":
            walk(node["items"])
    walk(ANALYSIS_JSON_SCHEMA)
    # And the schema fields match the pydantic model.
    assert set(ANALYSIS_JSON_SCHEMA["properties"]) == set(AnalysisReport.model_fields)


def test_sample_report_valid():
    assert sample_report().is_analyzable
