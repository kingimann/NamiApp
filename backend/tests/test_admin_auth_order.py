"""The admin registration/invite routes must resolve auth BEFORE validating the
request body, so an unauthenticated call returns 401 (auth required) rather than
a 422 that would leak the body schema (API guide §5). Auth is wired as a
dependency (_require_admin), which FastAPI resolves before body parsing.

Pure unit test — no database or running server (the no-token branch of
get_current_user raises before any DB access).
"""
import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from routes import auth


@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(auth.router)
    return TestClient(app)


# Bodied admin POSTs: with no token AND no body, auth must win (401), not 422.
BODIED_ADMIN_POSTS = [
    "/admin/registration",
    "/admin/invites",
]


@pytest.mark.parametrize("path", BODIED_ADMIN_POSTS)
def test_unauthenticated_admin_post_is_401_not_422(client, path):
    resp = client.post(path)   # no Authorization header, no body
    assert resp.status_code == 401, (
        f"{path} returned {resp.status_code}; admin auth must resolve before body "
        "validation so an unauthenticated call 401s instead of 422"
    )


def test_unauthenticated_admin_get_is_401(client):
    assert client.get("/admin/registration").status_code == 401
    assert client.get("/admin/invites").status_code == 401


def test_unauthenticated_admin_delete_is_401(client):
    assert client.delete("/admin/invites/ABC123").status_code == 401
