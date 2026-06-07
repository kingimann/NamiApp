"""Local AI document check via Ollama (a vision model).

Used to auto-verify a roadside requester's insurance + proof of ownership: the
model confirms the docs look genuine and that the vehicle/owner are consistent
across both (and match what the user entered). Images are passed through in
memory and never persisted here.

Configure with:
  OLLAMA_HOST           e.g. http://localhost:11434  (unset → verifier disabled)
  OLLAMA_VISION_MODEL   e.g. llama3.2-vision (default)

Note: the backend is Python, so we call Ollama's HTTP API directly. The Vercel
AI SDK is a JavaScript library — a Node sidecar using it would hit this same
Ollama endpoint, so the result is identical.
"""
import json
import os
import re
from typing import Optional

import httpx

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "").rstrip("/")
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "llama3.2-vision")


def ollama_enabled() -> bool:
    return bool(OLLAMA_HOST)


def _raw_b64(s: str) -> str:
    """Ollama wants bare base64 (no `data:image/...;base64,` prefix)."""
    s = (s or "").strip()
    if s.startswith("data:") and "," in s:
        return s.split(",", 1)[1]
    return s


async def verify_documents(
    insurance_b64: str,
    ownership_b64: str,
    vehicle: Optional[str],
    name: Optional[str],
) -> dict:
    """Returns {"decision": "approve"|"reject"|"unavailable", "reason": str}.
    `unavailable` means the caller should fall back (e.g. manual review)."""
    if not ollama_enabled():
        return {"decision": "unavailable", "reason": "AI verifier not configured"}

    prompt = (
        "You verify members for a peer-to-peer roadside assistance app, to stop "
        "bots and fraud. Image 1 is the member's AUTO INSURANCE document. Image 2 "
        "is their PROOF OF VEHICLE OWNERSHIP (registration or title).\n"
        f"Member-entered vehicle: {vehicle or 'not provided'}\n"
        f"Member-entered name: {name or 'not provided'}\n\n"
        "Approve ONLY if: both images are legible, real documents; image 1 is auto "
        "insurance; image 2 is a vehicle registration or title; and the owner name "
        "and the vehicle are consistent across both documents (and match the "
        "member-entered details when those are provided). Reject blurry, edited, "
        "mismatched, expired, or wrong-type documents.\n"
        'Reply with ONLY JSON: {"match": true|false, "reason": "<one short sentence>"}'
    )
    payload = {
        "model": OLLAMA_VISION_MODEL,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0},
        "messages": [{
            "role": "user",
            "content": prompt,
            "images": [_raw_b64(insurance_b64), _raw_b64(ownership_b64)],
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        content = ((data or {}).get("message") or {}).get("content") or ""
    except Exception as e:
        return {"decision": "unavailable", "reason": f"verifier error: {e}"[:200]}

    parsed = None
    try:
        parsed = json.loads(content)
    except Exception:
        m = re.search(r"\{.*\}", content, re.S)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception:
                parsed = None
    if not isinstance(parsed, dict):
        return {"decision": "unavailable", "reason": "verifier returned an unreadable response"}

    match = bool(parsed.get("match"))
    reason = str(parsed.get("reason") or "")[:300]
    return {"decision": "approve" if match else "reject", "reason": reason}
