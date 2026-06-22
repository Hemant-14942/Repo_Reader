# Repo Reader

Turn a public GitHub repository into LLM-ready context, with optional AI chat.

## Stack

- **Frontend:** Next.js (`frontend/`)
- **Backend:** FastAPI (`backend/`)

## Local development

### Backend

```bash
cd backend
cp .env.example .env
cp .env.example .env.local
uv venv
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`.env` holds shared local defaults. Use `.env.local` for machine-specific overrides (both are gitignored).

### Frontend

```bash
cd frontend
cp .env.example .env
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local API URL is set in `frontend/.env` and `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

`frontend/.env.development` is also committed as a fallback for dev mode.

## Environment variables

### Frontend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | No | `http://localhost:8000` | Repo Reader backend URL |

Set this in your frontend host (Vercel, Netlify, etc.) for production.

### Backend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ENVIRONMENT` | No | `development` | Runtime environment label |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated frontend URLs allowed to call the API |
| `API_HOST` | No | `0.0.0.0` | Uvicorn bind host |
| `API_PORT` | No | `8000` | Uvicorn bind port |

Copy `backend/.env.example` to `backend/.env` and `backend/.env.local` for local overrides.

## Production deployment

Typical split deployment:

1. Deploy FastAPI backend (Railway, Render, Fly.io, etc.)
2. Deploy Next.js frontend (Vercel, Netlify, etc.)
3. Set frontend env:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
   ```
4. Set backend env:
   ```env
   ENVIRONMENT=production
   CORS_ORIGINS=https://app.your-domain.com
   ```

Restart/redeploy both services after changing environment variables.

## Notes

- User LLM API keys are sent per request and are not stored by Repo Reader.
- Ingest results are kept in browser `sessionStorage` only.
