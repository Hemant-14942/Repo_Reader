from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.llm import router as llm_router


app = FastAPI(
    title="Repo Reader API",
    version="0.1.0",
    description="Backend API for generating repository context from GitHub URLs.",
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(llm_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Repo Reader API is running"}
