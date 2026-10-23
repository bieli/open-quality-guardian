from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, SessionLocal, engine, ensure_schema
from app.api import router
from app.seed import ensure_vacuum_configuration, seed_if_empty

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    if settings.seed_on_start:
        db = SessionLocal()
        try:
            seed_if_empty(db)
            ensure_vacuum_configuration(db)
        finally:
            db.close()


@app.get("/api/health")
def health():
    return {"ok": True, "name": settings.app_name}
