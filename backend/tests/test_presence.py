"""Behavioural test for conversation typing-presence (routes.messaging).

The "writing…" indicator is driven off a `typing` bool, but older app builds
send {state: "typing"|"idle"}. This pins that the handler derives typing from
either shape (regression guard for the presence field mismatch).
"""
import pytest

from routes import messaging
from tests._fakedb import FakeDB


@pytest.fixture
def env(monkeypatch):
    db = FakeDB()

    async def fake_user(_authorization):
        return {"user_id": "me"}

    monkeypatch.setattr(messaging, "db", db)
    monkeypatch.setattr(messaging, "get_current_user", fake_user)
    db.conversations.docs = [{"id": "c1", "participant_ids": ["me", "you"]}]
    return db


def _typing_at(db):
    conv = db.conversations.docs[0]
    return conv.get("typing_at", {}).get("me")


@pytest.mark.asyncio
async def test_state_typing_sets_typing(env):
    await messaging.update_presence("c1", messaging.PresenceUpdate(state="typing"))
    assert _typing_at(env) is not None


@pytest.mark.asyncio
async def test_state_idle_clears_typing(env):
    await messaging.update_presence("c1", messaging.PresenceUpdate(state="idle"))
    assert _typing_at(env) is None


@pytest.mark.asyncio
async def test_typing_bool_still_works(env):
    await messaging.update_presence("c1", messaging.PresenceUpdate(typing=True))
    assert _typing_at(env) is not None
