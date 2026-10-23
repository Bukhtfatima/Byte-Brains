from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_authenticated
from app.models.entities import User
from app.services.chat_service import handle_chat_message, execute_confirmed_action

router = APIRouter(prefix="/chat", tags=["BloodBridge Assistant"])


class ChatMessageRequest(BaseModel):
    message: str


class ChatConfirmActionRequest(BaseModel):
    action_type: str
    parameters: Dict[str, Any]


@router.post("")
def chat_with_assistant(
    req: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    Grounded BloodBridge Assistant:
    Answers inventory, expiry, risk, and request queries strictly
    based on live database facts and ML models.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be blank")

    result = handle_chat_message(
        db=db,
        user=current_user,
        message=req.message,
    )
    return result


@router.post("/confirm")
def confirm_assistant_action(
    req: ChatConfirmActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
):
    """
    Explicit Human Confirmation Layer:
    Executes controlled actions prepared by the assistant (e.g. creating emergency blood requests).
    Strictly safeguards clinical and inventory operations.
    """
    result = execute_confirmed_action(
        db=db,
        user=current_user,
        action_type=req.action_type,
        parameters=req.parameters,
    )
    return result
