from fastapi import APIRouter
from app.api.routers import (
    auth,
    users,
    organizations,
    audit,
    system,
    inventory,
    requests,
    dashboards,
    notifications,
    risk,
    analytics,
    automation,
    chat,
    donors,
    websocket,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(inventory.router)
api_router.include_router(requests.router)
api_router.include_router(dashboards.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
api_router.include_router(system.router)
api_router.include_router(risk.router)
api_router.include_router(analytics.router)
api_router.include_router(automation.router)
api_router.include_router(chat.router)
api_router.include_router(donors.router)
api_router.include_router(websocket.router)
