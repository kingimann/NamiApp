"""Behavioural tests for self-thread surfacing in the feed (routes.posts).

`_hydrate_many` runs one extra query per feed page to detect threads: a post is
a thread head when its OWN author has replied to it. Replies by other people
(ordinary comments) must not count. Pins that distinction and the per-post tally
that drives the client's "Show this thread" affordance.
"""
import pytest

from routes import posts
from tests._fakedb import FakeDB


@pytest.fixture
def env(monkeypatch):
    db = FakeDB()

    async def fake_hydrate(doc, viewer_id, authors=None, thread_count=0):
        # Passthrough: surface just what we assert on so the test pins the
        # batch thread-count logic, not the full hydration internals.
        return {"id": doc["id"], "thread_count": thread_count}

    monkeypatch.setattr(posts, "db", db)
    monkeypatch.setattr(posts, "_hydrate_post", fake_hydrate)
    return db


@pytest.mark.asyncio
async def test_self_reply_marks_thread(env):
    db = env
    db.seed(posts=[
        {"id": "r1", "user_id": "alice", "parent_id": None},
        # Alice continues her own post — this is the thread.
        {"id": "c1", "user_id": "alice", "parent_id": "r1"},
        # Bob's reply is an ordinary comment, not part of Alice's thread.
        {"id": "c2", "user_id": "bob", "parent_id": "r1"},
    ])
    out = await posts._hydrate_many([db.posts.docs[0]], "viewer")
    assert out[0]["thread_count"] == 1


@pytest.mark.asyncio
async def test_replies_by_others_dont_count(env):
    db = env
    db.seed(posts=[
        {"id": "r1", "user_id": "alice", "parent_id": None},
        {"id": "c1", "user_id": "bob", "parent_id": "r1"},
        {"id": "c2", "user_id": "carol", "parent_id": "r1"},
    ])
    out = await posts._hydrate_many([db.posts.docs[0]], "viewer")
    assert out[0]["thread_count"] == 0


@pytest.mark.asyncio
async def test_multiple_self_replies_tally(env):
    db = env
    db.seed(posts=[
        {"id": "r1", "user_id": "alice", "parent_id": None},
        {"id": "c1", "user_id": "alice", "parent_id": "r1"},
        {"id": "c2", "user_id": "alice", "parent_id": "r1"},
    ])
    out = await posts._hydrate_many([db.posts.docs[0]], "viewer")
    assert out[0]["thread_count"] == 2


@pytest.mark.asyncio
async def test_thread_counts_are_per_post(env):
    db = env
    db.seed(posts=[
        {"id": "r1", "user_id": "alice", "parent_id": None},
        {"id": "r2", "user_id": "alice", "parent_id": None},
        {"id": "c1", "user_id": "alice", "parent_id": "r1"},
    ])
    docs = [db.posts.docs[0], db.posts.docs[1]]
    out = await posts._hydrate_many(docs, "viewer")
    by_id = {o["id"]: o["thread_count"] for o in out}
    assert by_id == {"r1": 1, "r2": 0}
