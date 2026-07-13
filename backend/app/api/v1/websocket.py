"""
WebSocket API routes for real-time sync
Enables bidirectional real-time communication for multi-device synchronization
"""

from typing import Dict, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import json
import asyncio

from app.api.deps import get_db as get_db_session, get_current_active_user
from app.core.logging import logger
from app.core.exceptions import AfiaException


class ConnectionManager:
    """Manages WebSocket connections for clinic-specific real-time sync."""

    def __init__(self):
        # clinic_id -> {device_id -> WebSocket}
        self.clinic_connections: Dict[str, Dict[str, WebSocket]] = {}
        # device_id -> clinic_id mapping
        self.device_to_clinic: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, clinic_id: str, device_id: str):
        """Accept a WebSocket connection and register it."""
        await websocket.accept()
        
        if clinic_id not in self.clinic_connections:
            self.clinic_connections[clinic_id] = {}
        
        self.clinic_connections[clinic_id][device_id] = websocket
        self.device_to_clinic[device_id] = clinic_id
        
        logger.info(f"WebSocket connected: device={device_id}, clinic={clinic_id}")
        
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "device_id": device_id,
            "clinic_id": clinic_id,
            "timestamp": asyncio.get_event_loop().time()
        })

    def disconnect(self, device_id: str):
        """Remove a WebSocket connection."""
        if device_id in self.device_to_clinic:
            clinic_id = self.device_to_clinic[device_id]
            
            if clinic_id in self.clinic_connections and device_id in self.clinic_connections[clinic_id]:
                del self.clinic_connections[clinic_id][device_id]
                logger.info(f"WebSocket disconnected: device={device_id}, clinic={clinic_id}")
            
            # Clean up empty clinic mappings
            if clinic_id in self.clinic_connections and not self.clinic_connections[clinic_id]:
                del self.clinic_connections[clinic_id]
            
            del self.device_to_clinic[device_id]

    async def broadcast_to_clinic(self, clinic_id: str, message: dict, exclude_device: str = None):
        """Broadcast a message to all devices in a clinic."""
        if clinic_id not in self.clinic_connections:
            logger.debug(f"No connections for clinic {clinic_id}")
            return

        disconnected_devices = []
        
        for device_id, websocket in self.clinic_connections[clinic_id].items():
            if exclude_device and device_id == exclude_device:
                continue
            
            try:
                await websocket.send_json(message)
                logger.debug(f"Broadcast to device {device_id} in clinic {clinic_id}")
            except Exception as e:
                logger.error(f"Failed to send to device {device_id}: {e}")
                disconnected_devices.append(device_id)
        
        # Clean up failed connections
        for device_id in disconnected_devices:
            self.disconnect(device_id)

    async def send_to_device(self, device_id: str, message: dict):
        """Send a message to a specific device."""
        if device_id not in self.device_to_clinic:
            logger.warning(f"Device {device_id} not connected")
            return False

        clinic_id = self.device_to_clinic[device_id]
        
        if clinic_id not in self.clinic_connections or device_id not in self.clinic_connections[clinic_id]:
            logger.warning(f"Device {device_id} not found in clinic {clinic_id}")
            return False

        try:
            websocket = self.clinic_connections[clinic_id][device_id]
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"Failed to send to device {device_id}: {e}")
            self.disconnect(device_id)
            return False

    def get_clinic_devices(self, clinic_id: str) -> Set[str]:
        """Get all connected devices for a clinic."""
        if clinic_id not in self.clinic_connections:
            return set()
        return set(self.clinic_connections[clinic_id].keys())

    def get_connection_count(self, clinic_id: str = None) -> int:
        """Get total connection count (optionally per clinic)."""
        if clinic_id:
            return len(self.clinic_connections.get(clinic_id, {}))
        return sum(len(devices) for devices in self.clinic_connections.values())


# Global connection manager
manager = ConnectionManager()

router = APIRouter()


@router.websocket("/sync")
async def websocket_sync_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    device_id: str = Query(...),
    db: AsyncSession = Depends(get_db_session)
):
    """
    WebSocket endpoint for real-time synchronization.
    
    Query parameters:
    - token: JWT access token for authentication
    - device_id: Unique device identifier
    
    Messages received:
    - {"type": "ping"} - Keepalive
    - {"type": "sync_request"} - Request pending changes
    
    Messages sent:
    - {"type": "connected"} - Connection established
    - {"type": "sync_update", "data": {...}} - Data update from another device
    - {"type": "sync_response", "changes": [...]} - Response to sync request
    - {"type": "pong"} - Keepalive response
    - {"type": "error", "message": "..."} - Error message
    """
    # Authenticate user from token
    try:
        from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
        security = HTTPBearer(auto_error=False)
        credentials = HTTPAuthorizationCredentials(scheme="bearer", credentials=token)
        from app.api.deps import get_current_user
        user = await get_current_user(websocket, credentials, db)
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        await websocket.close(code=1008, reason="Authentication failed")
        return

    clinic_id = str(user.clinic_id) if user.clinic_id else "default"
    
    # Register connection
    await manager.connect(websocket, clinic_id, device_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            message_type = message.get("type")
            
            if message_type == "ping":
                # Respond to keepalive
                await websocket.send_json({"type": "pong"})
            
            elif message_type == "sync_request":
                # Client requesting pending changes
                # This would typically query the sync service
                await websocket.send_json({
                    "type": "sync_response",
                    "changes": [],
                    "timestamp": asyncio.get_event_loop().time()
                })
            
            elif message_type == "data_update":
                # Client broadcasting data update to other devices
                update_data = message.get("data", {})
                await manager.broadcast_to_clinic(
                    clinic_id,
                    {
                        "type": "sync_update",
                        "data": update_data,
                        "source_device": device_id,
                        "timestamp": asyncio.get_event_loop().time()
                    },
                    exclude_device=device_id
                )
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
    
    except WebSocketDisconnect:
        manager.disconnect(device_id)
        logger.info(f"WebSocket disconnected normally: device={device_id}")
    
    except Exception as e:
        logger.error(f"WebSocket error for device {device_id}: {e}")
        manager.disconnect(device_id)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass


@router.get("/connections")
async def get_connection_info(
    clinic_id: str = None,
    current_user = Depends(get_current_active_user)
):
    """
    Get information about active WebSocket connections.
    
    Requires authentication via Authorization header.
    """
    user_clinic_id = str(current_user.clinic_id) if current_user.clinic_id else None
    
    # Users can only see their own clinic's connections
    if clinic_id and clinic_id != user_clinic_id:
        # Super admins can see all clinics
        if current_user.role != "super_admin":
            raise AfiaException(
                status_code=403,
                detail="You can only view connections for your own clinic"
            )
    
    target_clinic_id = clinic_id or user_clinic_id
    
    if not target_clinic_id:
        raise AfiaException(
            status_code=400,
            detail="Clinic ID required"
        )
    
    devices = manager.get_clinic_devices(target_clinic_id)
    
    return {
        "clinic_id": target_clinic_id,
        "connected_devices": list(devices),
        "connection_count": len(devices)
    }


# Helper function to broadcast sync updates from other API endpoints
async def broadcast_sync_update(clinic_id: str, update_data: dict, source_device: str = None):
    """
    Broadcast a sync update to all connected devices in a clinic.
    Call this from other API endpoints after data changes.
    """
    await manager.broadcast_to_clinic(
        clinic_id,
        {
            "type": "sync_update",
            "data": update_data,
            "timestamp": asyncio.get_event_loop().time()
        },
        exclude_device=source_device
    )
