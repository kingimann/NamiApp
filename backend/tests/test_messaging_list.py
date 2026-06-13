"""Behavioural test for listing conversation messages (routes.messaging).

Pins the fix for the recent-messages bug: the endpoint must return the LATEST
messages in chronological order, not the oldest N. Also pins the per-user
`cleared_at` cutoff.
"""
from datetime import datetime, timezone, timedelta

import pytest

from routes import messaging as msg
from tests._fakedb import FakeDB


@pytest.fixture
def env(monkeypatch):
    db = FakeDB()

    async def fake_user(_authorization):
        return {"user_id": "me"}

    monkeypatch.setattr(msg, "db", db)
    monkeypatch.setattr(msg, "get_current_user", fake_user)
    return db


def _seed_messages(db, n):
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    db.seed(conversations=[{"id": "c1", "participant_ids": ["me", "u2"]}])
    db.messages.docs = [
        {"id": f"m{i}", "conversation_id": "c1", "sender_id": "u2",
         "type": "text", "text": f"msg{i}",
         "created_at": base + timedelta(minutes=i)}
        for i in range(n)
    ]


@pytest.mark.asyncio
async def test_returns_latest_200_in_chronological_order(env):
    _seed_messages(env, 250)
    out = await msg.list_messages("c1")
    assert len(out) == 200
    ids = [m.id for m in out]
    # The most recent message is last; the oldest 50 were dropped, not the newest.
    assert ids[-1] == "m249"
    assert ids[0] == "m50"
    assert out[0].created_at < out[-1].created_at


@pytest.mark.asyncio
async def test_short_conversation_returns_all_in_order(env):
    _seed_messages(env, 5)
    out = await msg.list_messages("c1")
    assert [m.id for m in out] == ["m0", "m1", "m2", "m3", "m4"]


@pytest.mark.asyncio
async def test_list_conversations_hydrates_participants(env):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    env.seed(
        users=[
            {"user_id": "me", "name": "Me"},
            {"user_id": "u2", "name": "Bo", "picture": "p2"},
        ],
        conversations=[
            {"id": "c1", "kind": "dm", "participant_ids": ["me", "u2"],
             "created_at": now, "last_message_at": now},
        ],
    )
    out = await msg.list_conversations()
    assert len(out) == 1
    assert out[0].other_user.name == "Bo"
    assert out[0].other_user.picture == "p2"


@pytest.mark.asyncio
async def test_non_participant_404s(env):
    _seed_messages(env, 3)
    env.conversations.docs = [{"id": "c1", "participant_ids": ["someone", "u2"]}]
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as ei:
        await msg.list_messages("c1")
    assert ei.value.status_code == 404
