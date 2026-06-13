"""Author-batching in feed hydration (routes.posts._hydrate_many / _hydrate_post).

_hydrate_many prefetches authors in one users query and passes the map down;
_hydrate_post uses it but falls back to a direct lookup for anyone not present
(e.g. a repost original's author), so results are identical either way.
"""
from datetime import datetime, timezone

import pytest

from routes import posts
from tests._fakedb import FakeDB


@pytest.fixture
def env(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(posts, "db", db)
    db.users.docs = [
        {"user_id": "u1", "name": "Ada", "username": "ada"},
        {"user_id": "u2", "name": "Bo", "username": "bo"},
    ]
    return db


def _post(pid, uid):
    return {"id": pid, "user_id": uid, "text": "hi",
            "created_at": datetime.now(timezone.utc)}


@pytest.mark.asyncio
async def test_hydrate_many_resolves_authors_in_order(env):
    out = await posts._hydrate_many([_post("p1", "u1"), _post("p2", "u2")], None)
    assert [p.id for p in out] == ["p1", "p2"]          # order preserved
    assert [p.author.name for p in out] == ["Ada", "Bo"]


@pytest.mark.asyncio
async def test_authors_map_is_used_without_a_query(env):
    # Empty the users table; only the passed map can resolve the author.
    env.users.docs = []
    authors = {"u1": {"user_id": "u1", "name": "Mapped", "username": "m"}}
    p = await posts._hydrate_post(_post("p1", "u1"), None, authors)
    assert p.author.name == "Mapped"


@pytest.mark.asyncio
async def test_falls_back_to_query_when_not_in_map(env):
    # u2 isn't in the map → falls back to the users lookup (still resolves).
    p = await posts._hydrate_post(_post("p2", "u2"), None, {"u1": {"user_id": "u1"}})
    assert p.author.name == "Bo"


@pytest.mark.asyncio
async def test_missing_author_is_unknown(env):
    env.users.docs = []
    p = await posts._hydrate_post(_post("p9", "ghost"), None)
    assert p.author.name == "Unknown"
