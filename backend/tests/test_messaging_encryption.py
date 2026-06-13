"""Pins that message content fields beyond `text` are encrypted at rest and
decrypted on read: voice notes, files, transcripts, place/contact details and
polls. `decrypt_text` is a no-op on legacy plaintext, so old messages still
read fine.
"""
import base64
import hashlib

import pytest
from cryptography.fernet import Fernet

from services import encryption
from routes import messaging as msg


@pytest.fixture
def enc(monkeypatch):
    key = base64.urlsafe_b64encode(hashlib.sha256(b"testkey").digest())
    monkeypatch.setattr(encryption, "_F", Fernet(key))
    return encryption.encrypt_text


def test_decrypt_msg_covers_all_content_fields(enc):
    doc = {
        "id": "m1", "conversation_id": "c1", "sender_id": "u1", "type": "voice",
        "text": enc("hello"),
        "audio_base64": enc("AUDIODATA"),
        "file_base64": enc("FILEDATA"),
        "file_name": enc("secret.pdf"),
        "place_name": enc("Cafe"),
        "place_address": enc("1 Main St"),
        "contact_name": enc("Ada"),
        "poll_question": enc("Lunch?"),
        "poll_options": [enc("Pizza"), enc("Tacos")],
        "transcript": enc("the spoken words"),
        "created_at": None,
    }
    out = msg._decrypt_msg(doc)
    assert out["text"] == "hello"
    assert out["audio_base64"] == "AUDIODATA"
    assert out["file_base64"] == "FILEDATA"
    assert out["file_name"] == "secret.pdf"
    assert out["place_name"] == "Cafe"
    assert out["place_address"] == "1 Main St"
    assert out["contact_name"] == "Ada"
    assert out["poll_question"] == "Lunch?"
    assert out["poll_options"] == ["Pizza", "Tacos"]
    assert out["transcript"] == "the spoken words"


def test_ciphertext_is_actually_encrypted(enc):
    # The stored value must not be the plaintext.
    token = enc("AUDIODATA")
    assert token != "AUDIODATA"
    assert token.startswith("enc::")


def test_legacy_plaintext_passes_through(enc):
    # A pre-encryption message (no enc:: prefix) reads back unchanged.
    doc = {"id": "m2", "type": "text", "text": "old plain message",
           "audio_base64": None, "created_at": None}
    out = msg._decrypt_msg(doc)
    assert out["text"] == "old plain message"
