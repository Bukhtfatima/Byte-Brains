import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app import database
from app.database import engine, Base, SessionLocal
from app.api.api_router import api_router
from app.services.seed_service import seed_database
from app.services.automation_service import run_periodic_automation

logger = logging.getLogger("bloodbridge.startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and seed demo dataset. A database failure is logged
    # instead of crashing, so /health can still report the error.
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
    except Exception as exc:
        logger.exception("Database initialization failed")
        database.DATABASE_INIT_ERROR = database.DATABASE_INIT_ERROR or f"{type(exc).__name__}: {exc}"

    # Launch background automation loop (runs silently in background)
    auto_task = asyncio.create_task(run_periodic_automation(interval_seconds=1800, initial_delay=5))
    yield
    # Shutdown
    auto_task.cancel()
    try:
        await auto_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="BloodBridge AI-Powered Blood Inventory, Prediction & Emergency Coordination Platform Backend",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include primary API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "platform": "BloodBridge",
        "tagline": "Predict. Coordinate. Respond.",
        "version": settings.VERSION,
        "docs_url": f"{settings.API_V1_STR}/docs",
        "health_url": f"{settings.API_V1_STR}/health",
    }
