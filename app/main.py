from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from app.api.routes import router
from app.core.config import get_settings
from app.core.database import Base, engine
import app.models.entities  # noqa: F401 - registers model metadata

settings = get_settings()

# Track server start time for uptime reporting
SERVER_START_TIME: datetime | None = None

app = FastAPI(
    title="RAILOPT — Rail Block Planner API",
    version="1.0.0",
    description="AI-assisted maintenance block planning for Indian Railways. SIH 2026.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1", tags=["planner"])


@app.on_event("startup")
def startup() -> None:
    global SERVER_START_TIME
    Base.metadata.create_all(bind=engine)
    SERVER_START_TIME = datetime.now(timezone.utc)
