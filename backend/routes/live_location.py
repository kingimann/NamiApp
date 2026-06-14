"""Live location sharing inside a conversation.

A member shares their real-time position for a chosen duration; the position
updates in place until it expires or they stop it. Modeled on ETA sharing but
scoped to a chat and surfaced as a `live_location` message. Polling-based:
clients GET the share to read the latest point (the chat already polls), and the
sharer POSTs periodic updates.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from core import db, get_current_user, _norm_dt
from models import LiveLocationCreate, LiveLocationUpdate, LiveLocationView, Message
from routes.messaging import _decrypt_msg
from routes.notifications import emit_notification

router = APIRouter()

_MIN_MINUTES = 1
_MAX_MINUTES = 60 * 24


async def _conv_or_404(conv_id: str, user: dict) -> dict:
    conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not conv or user["user_id"] not in conv.get("participant_ids", []):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def _view(share: dict) -> LiveLocationView:
    return LiveLocationView(
        share_id=share["share_id"],
        user_id=share["user_id"],
        name=share.get("name"),
        latitude=share["current_latitude"],
        longitude=share["current_longitude"],
        active=share.get("active", True),
        expires_at=share["expires_at"],
        updated_at=share["updated_at"],
    )


async def _end(share_id: str) -> None:
    """Stop a share and flag its chat message inactive."""
    await db.live_shares.update_one(
        {"share_id": share_id}, {"$set": {"active": False}})
    await db.messages.update_many(
        {"live_share_id": share_id}, {"$set": {"live_active": False}})


@router.post("/conversations/{conv_id}/live-location", response_model=Message)
async def start_live_location(
    conv_id: str, body: LiveLocationCreate, authorization: Optional[str] = Header(None)
):
    """Begin sharing live location in a conversation. Drops a `live_location`
    message everyone in the chat can watch update."""
    user = await get_current_user(authorization)
    conv = await _conv_or_404(conv_id, user)
    minutes = max(_MIN_MINUTES, min(int(body.minutes), _MAX_MINUTES))
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=minutes)
    share_id = str(uuid.uuid4())
    share = {
        "id": str(uuid.uuid4()),
        "share_id": share_id,
        "conversation_id": conv_id,
        "user_id": user["user_id"],
        "name": user.get("name", "Friend"),
        "current_latitude": body.latitude,
        "current_longitude": body.longitude,
        "active": True,
        "expires_at": expires,
        "updated_at": now,
        "created_at": now,
    }
    await db.live_shares.insert_one(share.copy())
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": user["user_id"],
        "type": "live_location",
        "text": "",
        "place_latitude": body.latitude,
        "place_longitude": body.longitude,
        "live_share_id": share_id,
        "live_expires_at": expires,
        "live_active": True,
        "deleted": False,
        "reactions": {},
        "created_at": now,
    }
    await db.messages.insert_one(msg.copy())
    # Re-verify membership atomically and resurface the conv for anyone who'd
    # soft-deleted it (mirrors the normal send path).
    await db.conversations.update_one(
        {"id": conv_id, "participant_ids": user["user_id"]},
        {"$set": {"last_message_at": now},
         "$pull": {"deleted_by": {"$in": conv["participant_ids"]}}},
    )
    is_group = conv.get("kind") == "group"
    for pid in conv["participant_ids"]:
        if pid == user["user_id"]:
            continue
        try:
            await emit_notification(
                user_id=pid, actor_id=user["user_id"],
                ntype="group_message" if is_group else "message",
                conversation_id=conv_id, message="📍 Live location")
        except Exception:
            pass
    return Message(**_decrypt_msg(msg))


@router.post("/live-location/{share_id}/update", response_model=LiveLocationView)
async def update_live_location(
    share_id: str, body: LiveLocationUpdate, authorization: Optional[str] = Header(None)
):
    """The sharer pushes a new position. 410 once the share has ended/expired."""
    user = await get_current_user(authorization)
    share = await db.live_shares.find_one({"share_id": share_id}, {"_id": 0})
    if not share or share["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Share not found")
    now = datetime.now(timezone.utc)
    if not share.get("active", True):
        raise HTTPException(status_code=410, detail="Share ended")
    if _norm_dt(share["expires_at"]) < now:
        await _end(share_id)
        raise HTTPException(status_code=410, detail="Share expired")
    await db.live_shares.update_one(
        {"share_id": share_id},
        {"$set": {"current_latitude": body.latitude,
                  "current_longitude": body.longitude, "updated_at": now}},
    )
    updated = await db.live_shares.find_one({"share_id": share_id}, {"_id": 0})
    return _view(updated)


@router.post("/live-location/{share_id}/stop", response_model=LiveLocationView)
async def stop_live_location(
    share_id: str, authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    share = await db.live_shares.find_one({"share_id": share_id}, {"_id": 0})
    if not share or share["user_id"] != user["user_id"]:
        raise HTTPException(status_code=404, detail="Share not found")
    await _end(share_id)
    updated = await db.live_shares.find_one({"share_id": share_id}, {"_id": 0})
    return _view(updated)


@router.get("/live-location/{share_id}", response_model=LiveLocationView)
async def get_live_location(
    share_id: str, authorization: Optional[str] = Header(None)
):
    """Any conversation member reads the latest position. Lazily expires."""
    user = await get_current_user(authorization)
    share = await db.live_shares.find_one({"share_id": share_id}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    await _conv_or_404(share["conversation_id"], user)
    if share.get("active", True) and \
            _norm_dt(share["expires_at"]) < datetime.now(timezone.utc):
        await _end(share_id)
        share["active"] = False
    return _view(share)
