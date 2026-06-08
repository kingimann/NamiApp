"""Outbound SMS — provider-agnostic.

Supports Vonage, Plivo and Twilio. The active provider is whichever one is
configured (checked Vonage → Plivo → Twilio, so you can pick the cheapest), or
force one with `SMS_PROVIDER=vonage|plivo|twilio`. When none is configured,
sending is a no-op and callers fall back to a dev flow (the code is returned to
the client so phone verification can still be tested).

Env vars per provider:
  Vonage:  VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_FROM   (sender id or number)
  Plivo:   PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_FROM
  Twilio:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
"""
import os

import httpx

SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "").strip().lower()

VONAGE_KEY = os.environ.get("VONAGE_API_KEY", "")
VONAGE_SECRET = os.environ.get("VONAGE_API_SECRET", "")
VONAGE_FROM = os.environ.get("VONAGE_FROM", "") or os.environ.get("VONAGE_FROM_NUMBER", "")

PLIVO_ID = os.environ.get("PLIVO_AUTH_ID", "")
PLIVO_TOKEN = os.environ.get("PLIVO_AUTH_TOKEN", "")
PLIVO_FROM = os.environ.get("PLIVO_FROM", "") or os.environ.get("PLIVO_FROM_NUMBER", "")

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "")


def _vonage_ok() -> bool:
    return bool(VONAGE_KEY and VONAGE_SECRET and VONAGE_FROM)


def _plivo_ok() -> bool:
    return bool(PLIVO_ID and PLIVO_TOKEN and PLIVO_FROM)


def _twilio_ok() -> bool:
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)


def active_provider() -> str:
    """The provider that will be used, or "" if none is configured."""
    forced = {
        "vonage": _vonage_ok,
        "plivo": _plivo_ok,
        "twilio": _twilio_ok,
    }.get(SMS_PROVIDER)
    if forced and forced():
        return SMS_PROVIDER
    if _vonage_ok():
        return "vonage"
    if _plivo_ok():
        return "plivo"
    if _twilio_ok():
        return "twilio"
    return ""


def sms_enabled() -> bool:
    return bool(active_provider())


async def send_sms(to: str, body: str) -> bool:
    """Send an SMS via the active provider. Returns True if accepted."""
    provider = active_provider()
    if not provider:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if provider == "vonage":
                r = await client.post(
                    "https://rest.nexmo.com/sms/json",
                    data={
                        "api_key": VONAGE_KEY,
                        "api_secret": VONAGE_SECRET,
                        "to": to.lstrip("+"),
                        "from": VONAGE_FROM,
                        "text": body,
                        "type": "text" if body.isascii() else "unicode",
                    },
                )
                if r.status_code != 200:
                    return False
                msgs = (r.json().get("messages") or [{}])
                return msgs[0].get("status") == "0"

            if provider == "plivo":
                r = await client.post(
                    f"https://api.plivo.com/v1/Account/{PLIVO_ID}/Message/",
                    auth=(PLIVO_ID, PLIVO_TOKEN),
                    json={"src": PLIVO_FROM, "dst": to, "text": body},
                )
                return r.status_code in (200, 201, 202)

            # twilio
            r = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json",
                auth=(TWILIO_SID, TWILIO_TOKEN),
                data={"To": to, "From": TWILIO_FROM, "Body": body},
            )
            return r.status_code in (200, 201)
    except Exception:
        return False
