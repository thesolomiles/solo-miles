"""One-time Strava webhook subscription setup.

Strava pushes an event to our callback whenever an activity is created/updated. This registers
that subscription. Run it once after the app is deployed at a public HTTPS URL. Strava allows
only one subscription per API application.

Usage (from the coach/ directory, with .env populated):

    python -m scripts.create_strava_webhook            # create the subscription
    python -m scripts.create_strava_webhook --view     # show the current subscription
    python -m scripts.create_strava_webhook --delete    # remove the current subscription

The callback URL is WEB_BASE_URL + /strava/webhook and STRAVA_VERIFY_TOKEN is the shared
secret Strava echoes back during the handshake - both come from .env.
"""
from __future__ import annotations

import sys

import requests

from app.config import settings

SUBSCRIPTION_URL = "https://www.strava.com/api/v3/push_subscriptions"


def _creds() -> dict:
    if not settings.strava_client_id or not settings.strava_client_secret:
        sys.exit("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set in .env")
    return {
        "client_id": settings.strava_client_id,
        "client_secret": settings.strava_client_secret,
    }


def view() -> None:
    resp = requests.get(SUBSCRIPTION_URL, params=_creds(), timeout=30)
    print(resp.status_code, resp.text)


def delete() -> None:
    resp = requests.get(SUBSCRIPTION_URL, params=_creds(), timeout=30)
    resp.raise_for_status()
    subs = resp.json()
    if not subs:
        print("No subscription to delete.")
        return
    for sub in subs:
        d = requests.delete(
            f"{SUBSCRIPTION_URL}/{sub['id']}", data=_creds(), timeout=30
        )
        print(f"Deleted subscription {sub['id']}: {d.status_code}")


def create() -> None:
    if not settings.strava_verify_token:
        sys.exit("STRAVA_VERIFY_TOKEN is not set in .env")
    callback_url = f"{settings.web_base_url.rstrip('/')}/strava/webhook"
    payload = {
        **_creds(),
        "callback_url": callback_url,
        "verify_token": settings.strava_verify_token,
    }
    print(f"Registering callback: {callback_url}")
    resp = requests.post(SUBSCRIPTION_URL, data=payload, timeout=30)
    print(resp.status_code, resp.text)
    if resp.ok:
        print("Subscription created. Strava will now push activity events to the webhook.")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--view":
        view()
    elif arg == "--delete":
        delete()
    else:
        create()
