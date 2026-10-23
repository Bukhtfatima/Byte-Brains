import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("bloodbridge.database")

# Set when the configured database can't be used; surfaced by /health
DATABASE_INIT_ERROR = None


def _connect_args(url: str) -> dict:
    # SQLite requires check_same_thread=False
    return {"check_same_thread": False} if url.startswith("sqlite") else {}


try:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=_connect_args(settings.DATABASE_URL),
        pool_pre_ping=True,
    )
except Exception as exc:
    # Keep the app bootable so the error can be diagnosed instead of crashing at import
    DATABASE_INIT_ERROR = f"{type(exc).__name__}: {exc}"
    logger.exception("Could not create database engine; falling back to temporary SQLite")
    fallback_url = "sqlite:////tmp/bloodbridge.db"
    engine = create_engine(fallback_url, connect_args=_connect_args(fallback_url))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
