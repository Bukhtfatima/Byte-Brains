import logging
from typing import Dict, List, Any
from fastapi import WebSocket

logger = logging.getLogger("bloodbridge.websocket")


class WebSocketManager:
    """
    Manages active WebSocket connections for BloodBridge.
    Supports user-specific notifications and system-wide broadcast.
    """
    def __init__(self):
        # user_id -> list of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # connection -> metadata (user_id, role)
        self.connection_meta: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, role: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.connection_meta[websocket] = {"user_id": user_id, "role": role}
        logger.info(f"WebSocket connected for user {user_id} ({role}). Total user sockets: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket):
        meta = self.connection_meta.pop(websocket, None)
        if meta:
            user_id = meta["user_id"]
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_to_user(self, user_id: int, message: dict):
        """Send message to all sockets of a specific user."""
        if user_id not in self.active_connections:
            return
        dead_sockets = []
        for socket in self.active_connections[user_id]:
            try:
                await socket.send_json(message)
            except Exception as e:
                logger.warning(f"Error sending to user {user_id}: {e}")
                dead_sockets.append(socket)
        for s in dead_sockets:
            self.disconnect(s)

    async def send_to_role(self, role: str, message: dict):
        """Send message to all connected users with a given role (e.g. blood_bank_staff)."""
        dead_sockets = []
        for socket, meta in list(self.connection_meta.items()):
            if meta.get("role") == role or meta.get("role") == "admin":
                try:
                    await socket.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending to role {role}: {e}")
                    dead_sockets.append(socket)
        for s in dead_sockets:
            self.disconnect(s)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        dead_sockets = []
        for socket in list(self.connection_meta.keys()):
            try:
                await socket.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting message: {e}")
                dead_sockets.append(socket)
        for s in dead_sockets:
            self.disconnect(s)


ws_manager = WebSocketManager()
