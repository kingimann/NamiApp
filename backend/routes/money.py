"""Peer-to-peer money: send money (gated by the sender's security question)
and request money (the other person pays or declines).

Transfers are recorded the same way tips are (db.tips + db.earnings) so they
appear in the Wallet's Sent/Received lists automatically.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import bcrypt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from core import db, get_current_user, _public_user
from routes.notifications import emit_notification

router = APIRouter()


def _hash(s: str) -> str:
    return bcrypt.hashpw(s.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")


def _verify(s: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(s.encode("utf-8")[:72], h.encode("utf-8"))
    except Exception:
        return False


def _norm(answer: Optional[str]) -> str:
    return (answer or "").strip().lower()


async def _require_answer(user_doc: dict, answer: Optional[str]):
    """Enforce the sender's security question before money leaves their account."""
    h = user_doc.get("transfer_answer_hash")
    if not h:
        raise HTTPException(status_code=400, detail={
            "code": "security_not_set",
            "message": "Set up your transfer security question first",
        })
    if not _verify(_norm(answer), h):
        raise HTTPException(status_code=403, detail={
            "code": "wrong_answer",
            "message": "Incorrect security answer",
        })


async def _do_transfer(sender: dict, to_id: str, amount: float, note: str):
    """Move money sender -> recipient. Mirrors a tip so the Wallet shows it."""
    now = datetime.now(timezone.utc)
    name = sender.get("name", "Someone")
    await db.tips.insert_one({
        "id": str(uuid.uuid4()),
        "from_user_id": sender["user_id"], "from_name": name,
        "to_user_id": to_id, "amount": amount, "currency": "USD",
        "message": (note or "")[:200], "source": "transfer", "created_at": now,
    })
    await db.earnings.insert_one({
        "id": str(uuid.uuid4()), "user_id": to_id, "amount": amount, "kind": "tip",
        "from_user_id": sender["user_id"], "from_name": name,
        "source": "transfer", "created_at": now,
    })
    return now


async def _notify_money(to_id: str, actor_id: str, ntype: str, message: str):
    try:
        await emit_notification(user_id=to_id, actor_id=actor_id, ntype=ntype, message=message)
    except Exception:
        pass


# ── Security question (sender's secret) ──────────────────────────────────────
class SecuritySet(BaseModel):
    question: str
    answer: str
    current_answer: Optional[str] = None   # required when changing an existing one


@router.get("/money/security")
async def get_security(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    return {"is_set": bool(me.get("transfer_answer_hash")), "question": me.get("transfer_question")}


@router.post("/money/security")
async def set_security(body: SecuritySet, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    question = (body.question or "").strip()[:200]
    answer = (body.answer or "").strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail="Question and answer are required")
    if me.get("transfer_answer_hash") and not _verify(_norm(body.current_answer), me["transfer_answer_hash"]):
        raise HTTPException(status_code=403, detail="Current security answer is incorrect")
    await db.users.update_one({"user_id": me["user_id"]}, {"$set": {
        "transfer_question": question,
        "transfer_answer_hash": _hash(_norm(answer)),
    }})
    return {"ok": True, "question": question}


# ── Send money ───────────────────────────────────────────────────────────────
class SendMoney(BaseModel):
    to_user_id: str
    amount: float
    note: Optional[str] = ""
    answer: str


@router.post("/money/send")
async def send_money(body: SendMoney, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    if body.to_user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="You can't send money to yourself")
    to = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0, "user_id": 1, "name": 1})
    if not to:
        raise HTTPException(status_code=404, detail="Recipient not found")
    amount = round(float(body.amount or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    await _require_answer(me, body.answer)
    # Money isn't credited until the recipient accepts it (Cash App-style).
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "from_user_id": me["user_id"], "from_name": me.get("name", "Someone"),
        "to_user_id": body.to_user_id, "amount": amount, "note": (body.note or "")[:200],
        "status": "pending", "created_at": now,
    }
    await db.money_transfers.insert_one(doc.copy())
    await _notify_money(body.to_user_id, me["user_id"], "money_received",
                        f"sent you ${amount:.2f} — accept it")
    return {"ok": True, "amount": amount, "status": "pending"}


async def _hydrate_transfer(t: dict, viewer_id: str) -> dict:
    other_id = t["to_user_id"] if t["from_user_id"] == viewer_id else t["from_user_id"]
    other = await _public_user(other_id, viewer_id)
    return {
        "id": t["id"], "from_user_id": t["from_user_id"], "to_user_id": t["to_user_id"],
        "amount": round(float(t.get("amount", 0) or 0), 2), "note": t.get("note") or "",
        "status": t.get("status", "pending"),
        "direction": "outgoing" if t["from_user_id"] == viewer_id else "incoming",
        "other_user": {
            "user_id": other.user_id, "name": other.name,
            "username": other.username, "picture": other.picture, "verified": other.verified,
        },
        "created_at": t.get("created_at"),
    }


@router.get("/money/transfers")
async def list_transfers(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    uid = me["user_id"]
    incoming = await db.money_transfers.find(
        {"to_user_id": uid, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    outgoing = await db.money_transfers.find(
        {"from_user_id": uid}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {
        "incoming": [await _hydrate_transfer(t, uid) for t in incoming],
        "outgoing": [await _hydrate_transfer(t, uid) for t in outgoing],
    }


@router.post("/money/transfers/{tid}/accept")
async def accept_transfer(tid: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    t = await db.money_transfers.find_one(
        {"id": tid, "to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    amount = round(float(t.get("amount", 0) or 0), 2)
    sender = await db.users.find_one({"user_id": t["from_user_id"]}, {"_id": 0, "user_id": 1, "name": 1}) \
        or {"user_id": t["from_user_id"], "name": t.get("from_name", "Someone")}
    await _do_transfer(sender, me["user_id"], amount, t.get("note") or "")
    await db.money_transfers.update_one(
        {"id": tid}, {"$set": {"status": "accepted", "resolved_at": datetime.now(timezone.utc)}}
    )
    await _notify_money(t["from_user_id"], me["user_id"], "money_accepted",
                        f"accepted your ${amount:.2f}")
    return {"ok": True, "amount": amount}


@router.post("/money/transfers/{tid}/decline")
async def decline_transfer(tid: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    t = await db.money_transfers.find_one(
        {"id": tid, "to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    await db.money_transfers.update_one(
        {"id": tid}, {"$set": {"status": "declined", "resolved_at": datetime.now(timezone.utc)}}
    )
    await _notify_money(t["from_user_id"], me["user_id"], "money_declined",
                        "declined your money")
    return {"ok": True}


# ── Request money ────────────────────────────────────────────────────────────
class RequestMoney(BaseModel):
    to_user_id: str         # who is asked to pay
    amount: float
    note: Optional[str] = ""


class PayRequest(BaseModel):
    answer: str


async def _hydrate_request(r: dict, viewer_id: str) -> dict:
    other_id = r["to_user_id"] if r["from_user_id"] == viewer_id else r["from_user_id"]
    other = await _public_user(other_id, viewer_id)
    return {
        "id": r["id"],
        "from_user_id": r["from_user_id"],
        "to_user_id": r["to_user_id"],
        "amount": round(float(r.get("amount", 0) or 0), 2),
        "note": r.get("note") or "",
        "status": r.get("status", "pending"),
        "direction": "outgoing" if r["from_user_id"] == viewer_id else "incoming",
        "other_user": {
            "user_id": other.user_id, "name": other.name,
            "username": other.username, "picture": other.picture,
            "verified": other.verified,
        },
        "created_at": r.get("created_at"),
    }


@router.post("/money/request")
async def request_money(body: RequestMoney, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    if body.to_user_id == me["user_id"]:
        raise HTTPException(status_code=400, detail="You can't request money from yourself")
    payer = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0, "user_id": 1, "name": 1})
    if not payer:
        raise HTTPException(status_code=404, detail="User not found")
    amount = round(float(body.amount or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "from_user_id": me["user_id"], "from_name": me.get("name", "Someone"),
        "to_user_id": body.to_user_id,
        "amount": amount, "note": (body.note or "")[:200],
        "status": "pending", "created_at": now,
    }
    await db.money_requests.insert_one(doc.copy())
    await _notify_money(body.to_user_id, me["user_id"], "money_request",
                        f"requested ${amount:.2f}")
    return await _hydrate_request(doc, me["user_id"])


@router.get("/money/requests")
async def list_requests(authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    uid = me["user_id"]
    incoming = await db.money_requests.find(
        {"to_user_id": uid, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    outgoing = await db.money_requests.find(
        {"from_user_id": uid}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return {
        "incoming": [await _hydrate_request(r, uid) for r in incoming],
        "outgoing": [await _hydrate_request(r, uid) for r in outgoing],
    }


@router.post("/money/requests/{rid}/pay")
async def pay_request(rid: str, body: PayRequest, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    req = await db.money_requests.find_one(
        {"id": rid, "to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    amount = round(float(req.get("amount", 0) or 0), 2)
    await _require_answer(me, body.answer)
    await _do_transfer(me, req["from_user_id"], amount, req.get("note") or "")
    await db.money_requests.update_one(
        {"id": rid}, {"$set": {"status": "paid", "resolved_at": datetime.now(timezone.utc)}}
    )
    await _notify_money(req["from_user_id"], me["user_id"], "money_request_paid",
                        f"paid your ${amount:.2f} request")
    return {"ok": True, "amount": amount}


@router.post("/money/requests/{rid}/decline")
async def decline_request(rid: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    req = await db.money_requests.find_one(
        {"id": rid, "to_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.money_requests.update_one(
        {"id": rid}, {"$set": {"status": "declined", "resolved_at": datetime.now(timezone.utc)}}
    )
    await _notify_money(req["from_user_id"], me["user_id"], "money_request_declined",
                        "declined your money request")
    return {"ok": True}


@router.post("/money/requests/{rid}/cancel")
async def cancel_request(rid: str, authorization: Optional[str] = Header(None)):
    me = await get_current_user(authorization)
    req = await db.money_requests.find_one(
        {"id": rid, "from_user_id": me["user_id"], "status": "pending"}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.money_requests.update_one(
        {"id": rid}, {"$set": {"status": "cancelled", "resolved_at": datetime.now(timezone.utc)}}
    )
    return {"ok": True}
