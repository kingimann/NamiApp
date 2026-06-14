"""Behavioural tests for live location sharing (routes.live_location).

A member starts a share (which drops a `live_location` message), pushes position
updates, and stops it. Pins membership guards, owner-only updates, the 410 once
stopped/expired, and lazy expiry on read.
"""
from datetime import datetime, timezone, timedelta

import pytest
from fastapi import HTTPException

from routes import live_location as live
from models import LiveLocationCreate, LiveLocationUpdate
from tests._fakedb import FakeDB


@pytest.fixture
def env(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(live, "db", db)

    async def noop_notify(**kwargs):
        return None

    monkeypatch.setattr(live, "emit_notification", noop_notify)
    db.conversations.docs = [
        {"id": "c1", "kind": "dm", "participant_ids": ["alice", "bob"]}
    ]
    return db, monkeypatch


def _as(monkeypatch, uid):
    async def _get(_a):
        return {"user_id": uid, "name": uid.title()}
    monkeypatch.setattr(live, "get_current_user", _get)


@pytest.mark.asyncio
async def test_start_creates_share_and_message(env):
    db, mp = env
    _as(mp, "alice")
    msg = await live.start_live_location(
        "c1", LiveLocationCreate(minutes=30, latitude=43.6, longitude=-79.3))
    assert msg.type == "live_location" and msg.live_active is True
    assert msg.live_share_id
    # A share row and a chat message both exist.
    assert await db.live_shares.count_documents({"share_id": msg.live_share_id}) == 1
    assert await db.messages.count_documents(
        {"live_share_id": msg.live_share_id, "type": "live_location"}) == 1


@pytest.mark.asyncio
async def test_non_member_cannot_start(env):
    db, mp = env
    _as(mp, "carol")  # not in c1
    with pytest.raises(HTTPException) as ei:
        await live.start_live_location(
            "c1", LiveLocationCreate(minutes=30, latitude=1, longitude=1))
    assert ei.value.status_code == 404


@pytest.mark.asyncio
async def test_update_moves_point_owner_only(env):
    db, mp = env
    _as(mp, "alice")
    msg = await live.start_live_location(
        "c1", LiveLocationCreate(minutes=30, latitude=43.6, longitude=-79.3))
    sid = msg.live_share_id
    out = await live.update_live_location(
        sid, LiveLocationUpdate(latitude=44.0, longitude=-79.0))
    assert out.latitude == 44.0 and out.longitude == -79.0
    # Bob isn't the owner — can't push updates.
    _as(mp, "bob")
    with pytest.raises(HTTPException) as ei:
        await live.update_live_location(
            sid, LiveLocationUpdate(latitude=0, longitude=0))
    assert ei.value.status_code == 404


@pytest.mark.asyncio
async def test_stop_ends_share_and_message_and_blocks_updates(env):
    db, mp = env
    _as(mp, "alice")
    msg = await live.start_live_location(
        "c1", LiveLocationCreate(minutes=30, latitude=43.6, longitude=-79.3))
    sid = msg.live_share_id
    stopped = await live.stop_live_location(sid)
    assert stopped.active is False
    # The chat message is flagged inactive too.
    m = await db.messages.find_one({"live_share_id": sid})
    assert m["live_active"] is False
    # Further updates 410.
    with pytest.raises(HTTPException) as ei:
        await live.update_live_location(
            sid, LiveLocationUpdate(latitude=1, longitude=1))
    assert ei.value.status_code == 410


@pytest.mark.asyncio
async def test_member_can_read_and_expiry_is_lazy(env):
    db, mp = env
    _as(mp, "alice")
    msg = await live.start_live_location(
        "c1", LiveLocationCreate(minutes=30, latitude=43.6, longitude=-79.3))
    sid = msg.live_share_id
    # Force the share into the past.
    await db.live_shares.update_one(
        {"share_id": sid},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    # Bob (a member) reads it — and the read lazily expires it.
    _as(mp, "bob")
    view = await live.get_live_location(sid)
    assert view.active is False


@pytest.mark.asyncio
async def test_non_member_cannot_read(env):
    db, mp = env
    _as(mp, "alice")
    msg = await live.start_live_location(
        "c1", LiveLocationCreate(minutes=30, latitude=43.6, longitude=-79.3))
    _as(mp, "carol")
    with pytest.raises(HTTPException) as ei:
        await live.get_live_location(msg.live_share_id)
    assert ei.value.status_code == 404
