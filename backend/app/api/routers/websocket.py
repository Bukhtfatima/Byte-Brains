from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.database import SessionLocal
from app.models.entities import User
from app.services.auth_service import decode_access_token
from app.services.websocket_manager import ws_manager
import logging

logger = logging.getLogger("bloodbridge.websocket_router")

router = APIRouter(tags=["Real-time WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    """
    Real-time push channel for BloodBridge notifications, alerts, and live updates.
    Expects JWT token as query parameter ?token=<jwt>.
    """
    if not token:
        await websocket.close(code=4001, reason="Authentication token missing")
        return

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=4002, reason="Invalid or expired token")
        return

    email = payload.get("sub")
    db = SessionLocal()
    user = None
    try:
        user = db.query(User).filter(User.email == email).first()
    finally:
        db.close()

    if not user or not user.is_active:
        await websocket.close(code=4003, reason="User unauthorized or inactive")
        return

    # Register active connection
    user_id = user.id
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    await ws_manager.connect(websocket, user_id=user_id, role=role)

    # Send initial welcome / handshake confirmation
    try:
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "title": "Connected to Live Stream",
            "message": f"Real-time notifications active for {user.name}",
            "role": role,
            "timestamp": "now"
        })

        while True:
            # Keep socket open and receive client pings/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket unexpected error: {e}")
        ws_manager.disconnect(websocket)
