from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=True, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    """Add columns that create_all will not attach to existing tables."""
    statements = [
        "ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS effectivity JSON DEFAULT '{}'::json",
        "ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS effectivity JSON DEFAULT '{}'::json",
    ]
    try:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
    except Exception:
        # Fresh sqlite/tests or tables not yet created; create_all already defines the columns.
        pass
