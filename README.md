# بيئتي · Be'ati — AI Environmental Intelligence Platform

> **افهم أثرك البيئي، وغيّر العالم بخطوة.**
>
> منصة عربية مدعومة بالذكاء الاصطناعي: صوّر أي منتج أو عبوة أو مادة، واحصل على تقرير بيئي علمي يحدد المواد، ومستوى الضرر، وطريقة التخلص الصحيحة، وأفكار إعادة الاستخدام والبدائل — مع مساعد محادثة للمتابعة.

Be'ati is an Arabic-first (RTL) web app. A user uploads or takes a photo of an object. A vision AI model (OpenAI) returns a **structured JSON environmental report**. The server validates the report and the app shows it as a polished Arabic report. A follow-up chat assistant, «نبتة» (Nabta), answers questions in the context of that analysis.

---

## Features

- **Image analysis.** Drag and drop, file picker, paste from clipboard, or camera (the native camera on phones, a live camera window on desktop). Images are downscaled and re-encoded in the browser and validated again on the server.
- **Structured Arabic report** with these sections: اسم العنصر · نوع المادة · التصنيف البيئي · مستوى الضرر البيئي · لماذا يؤثر على البيئة؟ · هل يمكن إعادة تدويره؟ · كيف أتخلص منه بطريقة صحيحة؟ · أفكار لإعادة استخدامه · بدائل صديقة للبيئة · كيف أقلل استخدامه؟ · نصائح بيئية إضافية
- **Scientific guardrails** in the system prompt:
  - recyclability, actual local availability, toxicity and biodegradability are treated as separate questions
  - plastics are never assumed to be recyclable
  - no made-up decomposition times or statistics
  - uncertainty is stated explicitly
  - safety warnings appear for batteries, chemicals, e-waste and medicines
  - guidance is Jordan-aware and tells the user to check local availability
- **Follow-up assistant chat** that keeps the analysis as context, with suggested questions.
- **Session history.** Kept in `sessionStorage` in the browser; nothing is stored on the server.
- **Animated SVG mascot «نبتة»** with these states: idle (blink, breathing, sway, eyes follow the pointer), excited (image uploaded), thinking (orbit and scan line), happy (result ready) and confused (error or unclear image). It honours `prefers-reduced-motion`.
- **Security:**
  - the API key stays on the server only
  - file type is checked by its real content (signature), not its name
  - size limit and decompression-bomb guard
  - EXIF and GPS metadata are stripped before the image is sent to the AI provider
  - per-IP rate limiting
  - safe Arabic error messages that hide internal details
  - security headers
  - the model's output is validated with Pydantic before it is shown

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app: /api routes + serves the frontend
│   │   ├── config.py            # Settings from environment variables
│   │   ├── schemas.py           # Pydantic models + strict JSON schema for the model
│   │   ├── prompts.py           # Environmental expert system prompts (Arabic)
│   │   └── services/
│   │       ├── ai_service.py    # OpenAI vision + chat, error mapping, validation
│   │       ├── image_validation.py
│   │       ├── rate_limit.py
│   │       ├── demo_data.py     # Sample output for DEMO_MODE
│   │       └── errors.py
│   └── tests/test_api.py
├── frontend/
│   ├── index.html               # RTL single-page app
│   └── assets/
│       ├── css/styles.css       # Design system (brand tokens, components, responsive)
│       ├── img/favicon.svg
│       └── js/
│           ├── app.js           # Router, upload/analyze flow, camera, history
│           ├── api.js           # Backend client
│           ├── report.js        # Report renderer
│           ├── chat.js          # Assistant chat
│           ├── mascot.js        # Animated SVG mascot
│           ├── image.js         # Client-side resize/re-encode
│           ├── store.js         # Session storage
│           └── ui.js            # DOM helpers, safe mini-markdown
├── requirements.txt
├── requirements-dev.txt
├── .env.example
├── render.yaml                  # Render Blueprint (one-click deploy)
└── Procfile                     # For Railway / Heroku-style hosts
```

## Run locally

Requirements: **Python 3.10+** and an **OpenAI API key** from <https://platform.openai.com/api-keys>.

```bash
python -m venv .venv
```

Activate it. On Windows:

```bash
.venv\Scripts\activate
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`:

```bash
cp .env.example .env
```

```bash
cd backend
uvicorn app.main:app --reload
```

Open <http://localhost:8000>. API docs are at <http://localhost:8000/api/docs>.

**Preview the interface without a key:** set `DEMO_MODE=true` and leave `OPENAI_API_KEY` empty. The app then returns a clearly labelled sample analysis.

### Tests

```bash
pip install -r requirements-dev.txt
```

```bash
pytest backend/tests -q
```

## Deploy and get a public URL (Render)

GitHub Pages can only host static files. It cannot run the Python backend, and the backend is required to keep the API key secret. Render runs the API and the frontend together as one service, so you get a single public URL.

1. **Push to GitHub.** Make sure `.env` is *not* committed; `.gitignore` already excludes it.
   ```bash
   git init
   ```
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Be'ati: initial release"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/<you>/beati.git
   ```
   ```bash
   git push -u origin main
   ```
2. Sign in at <https://render.com>, then go to **New → Blueprint** and select the repository. Render reads `render.yaml`.
3. When asked, paste your **`OPENAI_API_KEY`**. It is stored as a Render secret and never appears in git.
4. Click **Apply**. After the build finishes, your public URL looks like `https://beati.onrender.com`. Share it as is, or add a custom domain under **Settings → Custom Domains**.

Manual alternative: **New → Web Service**, then:
- Build command: `pip install -r requirements.txt`
- Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`
- Environment variables: the ones in `.env.example`

> On Render's free plan the service sleeps after a period without traffic, so the first request after that can take about 30–50 seconds. Use a paid instance for a product that is always on.

Other hosts such as Railway, Fly.io or Azure App Service also work: use the `Procfile` start command and set the same environment variables.

### Hosting the frontend separately (optional)

To serve `frontend/` from a CDN (for example Netlify):
1. Before `app.js` in `index.html`, add: `<script>window.BEATI_API_BASE = "https://your-api.onrender.com"</script>`
2. On the API, set `ALLOWED_ORIGINS=https://your-frontend-domain`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required** for real analysis |
| `OPENAI_MODEL` | `gpt-4o` | Vision model; must support `json_schema` structured outputs |
| `OPENAI_CHAT_MODEL` | same as `OPENAI_MODEL` | Model for the follow-up chat |
| `DEMO_MODE` | `false` | Sample results when no key is set |
| `MAX_UPLOAD_MB` | `8` | Upload size limit |
| `MAX_IMAGE_SIDE_PX` | `1600` | Longest side after server-side downscale |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS` | `20` / `600` | Per-IP analyses per window (chat allows 3×) |
| `ALLOWED_ORIGINS` | empty | CORS origins, only for a split frontend |

## API

- `GET /api/health` → `{status, ai_configured, demo, max_upload_mb}`
- `POST /api/analyze` (multipart: `image`, optional `note`) → `{id, report, model, demo}`
- `POST /api/chat` (JSON: `{messages:[{role,content}], context?: report}`) → `{reply}`

Errors always come back as `{error: "<Arabic message>", code: "<machine code>"}` with a matching HTTP status.

## Notes on accuracy

The AI's recommendations are guidance, not regulation. The prompt tells the model to separate material type from recyclability and from local acceptance, and to say when it is unsure. Users should still confirm local collection with their municipality or with local initiatives. For hazardous waste they should follow official instructions.

The in-memory rate limiter works for a single instance. If you scale to several instances, switch to a shared store such as Redis.
