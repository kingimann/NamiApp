"""Unit tests for the post `kind` field logic (routes.posts).

`_post_kind` reports a post's media kind for the API response; `_resolve_create_kind`
decides what to store at create time. Both are pure functions, so these run with
no database — they pin the "titled video → video, untitled video → reel, else post"
heuristic and the rule that an explicit reel/video label needs a real video.
"""
from routes.posts import _post_kind, _resolve_create_kind

VIDEO = [{"type": "video", "url": "https://cdn.example.com/v.mp4"}]
IMAGE = [{"type": "image", "url": "https://cdn.example.com/p.jpg"}]
DEAD_VIDEO = [{"type": "video", "base64": "file:///tmp/x.mp4"}]   # not playable


# ── _post_kind: stored value wins, otherwise derive ─────────────────────────
def test_kind_uses_stored_value():
    assert _post_kind({"kind": "video", "media": IMAGE}) == "video"
    assert _post_kind({"kind": "reel"}) == "reel"
    assert _post_kind({"kind": "post", "media": VIDEO}) == "post"


def test_kind_derives_titled_video_as_video():
    assert _post_kind({"media": VIDEO, "title": "My trip"}) == "video"


def test_kind_derives_untitled_video_as_reel():
    assert _post_kind({"media": VIDEO, "title": ""}) == "reel"
    assert _post_kind({"media": VIDEO}) == "reel"


def test_kind_derives_non_video_as_post():
    assert _post_kind({"media": IMAGE, "title": "hi"}) == "post"
    assert _post_kind({"media": DEAD_VIDEO, "title": "hi"}) == "post"
    assert _post_kind({}) == "post"


def test_kind_ignores_unknown_stored_value():
    # A junk stored kind falls back to derivation rather than echoing garbage.
    assert _post_kind({"kind": "spam", "media": VIDEO, "title": "t"}) == "video"


# ── _resolve_create_kind: honor explicit only when consistent ───────────────
def test_create_kind_honors_explicit_video_with_video():
    assert _resolve_create_kind("video", VIDEO, "Trip") == "video"
    assert _resolve_create_kind("reel", VIDEO, None) == "reel"


def test_create_kind_rejects_reel_video_without_video():
    # A text/image post can't be labeled a reel/video — derive instead.
    assert _resolve_create_kind("reel", IMAGE, None) == "post"
    assert _resolve_create_kind("video", [], "Trip") == "post"
    assert _resolve_create_kind("video", DEAD_VIDEO, "Trip") == "post"


def test_create_kind_allows_explicit_post_over_video():
    # An author may keep a video as a plain post if they ask for it explicitly.
    assert _resolve_create_kind("post", VIDEO, "Trip") == "post"


def test_create_kind_derives_when_omitted():
    assert _resolve_create_kind(None, VIDEO, "Trip") == "video"
    assert _resolve_create_kind(None, VIDEO, None) == "reel"
    assert _resolve_create_kind("", IMAGE, None) == "post"
