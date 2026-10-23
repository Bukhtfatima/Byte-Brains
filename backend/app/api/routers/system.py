import json
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db, require_admin
from app.models.entities import SystemSetting, User
from app.config import settings

router = APIRouter(tags=["System"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify database and API readiness."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/system/settings")
def get_system_settings(
    db: Session = Depends(get_db),
):
    """Retrieve operational thresholds and configuration."""
    rows = db.query(SystemSetting).all()
    result = {}
    for r in rows:
        try:
            result[r.key] = json.loads(r.value)
        except Exception:
            result[r.key] = r.value
    return result


@router.put("/system/settings/{key}")
def update_system_setting(
    key: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: Update system thresholds."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=json.dumps(payload.get("value", "")))
        db.add(setting)
    else:
        val = payload.get("value")
        setting.value = json.dumps(val) if not isinstance(val, str) else val

    db.commit()
    db.refresh(setting)
    return {"key": setting.key, "status": "updated"}
