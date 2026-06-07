"""Claude (Anthropic) vision fallback for roadside photo checks.

Used when no local Ollama vision model is configured (``OLLAMA_HOST`` unset).
Calls the Anthropic Messages API with the captured photo and asks whether it
shows a motor vehicle or the relevant problem, so non-automotive photos still
get flagged on hosted deployments where Ollama isn't available.

Disabled unless ``ANTHROPIC_API_KEY`` is set (the same key the Claude bot uses).
Best-effort: fails open (``ok``) when unconfigured or on any API/parse error —
the deterministic blank/black check in ``ollama.py`` runs first regardless.

Configure with:
  ANTHROPIC_API_KEY     enables the check
  CLAUDE_VISION_MODEL   vision-capable model id (default: claude-haiku-4-5 —
                        the cheapest model for a simple yes/no classification)
"""
import json
import logging
import os
import re

import httpx

logger = logging.getLogger("claude_vision")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_VISION_MODEL = os.environ.get("CLAUDE_VISION_MODEL", "claude-haiku-4-5")

_PROMPT = (
    "This is a photo from a roadside-assistance request. Does it clearly show a "
    "motor vehicle, or a part of one relevant to the problem (e.g. a flat or "
    "damaged tyre, engine bay, dead battery, a locked door/window, fuel cap)? "
    "Answer false for an unrelated subject (a person, a room, food, a screenshot, "
    "random objects) or a blank/black/too-dark image.\n"
    'Reply with ONLY JSON: {"shows_vehicle": true|false, "reason": "<one short sentence>"}'
)


def claude_vision_enabled() -> bool:
    return bool(ANTHROPIC_API_KEY)


def _media_type(b64: str) -> str:
    m = re.match(r"data:(image/[a-zA-Z0-9.+-]+);base64,", b64 or "")
    return m.group(1) if m else "image/jpeg"


def _raw_b64(s: str) -> str:
    return re.sub(r"^data:[^;]+;base64,", "", (s or "").strip())


def _extract_json(text: str) -> str:
    """Pull the JSON object out of the model reply, tolerating code fences or
    a stray sentence around it."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    if not text.startswith("{"):
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return m.group(0)
    return text


async def classify_vehicle_photo(b64: str) -> dict:
    """Return ``{"ok": bool, "reason": str}``. ``ok`` is False only when Claude
    confidently says the photo isn't a vehicle/the problem; fails open (ok=True)
    when not configured or on any error so a hiccup never hard-blocks a user."""
    if not claude_vision_enabled():
        return {"ok": True, "reason": ""}
    payload = {
        "model": CLAUDE_VISION_MODEL,
        "max_tokens": 200,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": _media_type(b64), "data": _raw_b64(b64)}},
                {"type": "text", "text": _PROMPT},
            ],
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
            if r.status_code >= 400:
                logger.warning("Anthropic vision API %s: %s", r.status_code, r.text[:300])
                return {"ok": True, "reason": ""}
            data = r.json()
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        parsed = json.loads(_extract_json(text))
    except Exception as e:
        logger.warning("Claude vision check failed: %s", e)
        return {"ok": True, "reason": ""}
    if isinstance(parsed, dict) and parsed.get("shows_vehicle") is False:
        reason = str(parsed.get("reason") or "").strip()[:200]
        return {"ok": False, "reason": reason or "That photo doesn't look like your vehicle or the problem. Take a clear photo of the car or the issue."}
    return {"ok": True, "reason": ""}
