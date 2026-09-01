from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import get_settings
from app.core.database import Base, engine
import app.models.entities  # noqa: F401 - registers model metadata

settings = get_settings()
app = FastAPI(title="Rail Block Planner API", version="0.1.0", description="Human-approved maintenance block planning API")
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
    Base.metadata.create_all(bind=engine)
