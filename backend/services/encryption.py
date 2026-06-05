"""Symmetric encryption for messages at rest (Fernet / AES-128-CBC + HMAC).

Key is loaded from MESSAGE_ENC_KEY env var. If absent or invalid, the
helpers transparently fall through (return text as-is) so the app keeps
working — but a warning is logged.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("encryption")

_PREFIX = "enc::"  # marker so we know which strings were ever encrypted
_KEY = os.environ.get("MESSAGE_ENC_KEY")


def _load_fernet(secret: Optional[str]) -> Optional[Fernet]:
    """Build a Fernet from the configured secret. Accepts a ready 44-char
    Fernet key, or derives a valid key from ANY non-empty secret (so a random
    value from the host's secret manager works out of the box)."""
    if not secret:
        return None
    try:
        return Fernet(secret)  # already a valid Fernet key
    except Exception:
        pass
    try:
        digest = hashlib.sha256(secret.encode("utf-8")).digest()
        return Fernet(base64.urlsafe_b64encode(digest))
    except Exception:
        logger.warning("MESSAGE_ENC_KEY could not be loaded; messages will NOT be encrypted at rest")
        return None


_F: Optional[Fernet] = _load_fernet(_KEY)


def encryption_enabled() -> bool:
    return _F is not None


def encrypt_text(plain: Optional[str]) -> Optional[str]:
    if plain is None or plain == "":
        return plain
    if _F is None:
        return plain
    token = _F.encrypt(plain.encode("utf-8")).decode("utf-8")
    return f"{_PREFIX}{token}"


def decrypt_text(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return value
    if not isinstance(value, str):
        return value
    if not value.startswith(_PREFIX):
        return value  # legacy plaintext (pre-encryption)
    if _F is None:
        return value  # can't decrypt — surface raw so dev sees the problem
    try:
        return _F.decrypt(value[len(_PREFIX):].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.warning("Could not decrypt a message (wrong key or tampered)")
        return ""
