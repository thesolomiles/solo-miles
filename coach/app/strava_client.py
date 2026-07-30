from __future__ import annotations

import sqlite3
import time
import urllib.parse

import requests

from app.config import settings
from app.profile import get_profile, upsert_strava_tokens

AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
API_BASE = "https://www.strava.com/api/v3"


class StravaClientError(RuntimeError):
    pass


def build_authorize_url() -> str:
    params = {
        "client_id": settings.strava_client_id,
        "redirect_uri": settings.strava_redirect_uri,
        "response_type": "code",
        "scope": "activity:read_all",
        "approval_prompt": "auto",
    }
    return f"{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(conn: sqlite3.Connection, code: str) -> None:
    resp = requests.post(
        TOKEN_URL,
        data={
            "client_id": settings.strava_client_id,
            "client_secret": settings.strava_client_secret,
            "code": code,
            "grant_type": "authorization_code",
        },
        timeout=30,
    )
    if not resp.ok:
        raise StravaClientError(f"Token exchange failed: {resp.status_code} {resp.text[:500]}")
    data = resp.json()
    upsert_strava_tokens(
        conn,
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        expires_at=data["expires_at"],
    )


class StravaClient:
    def __init__(self, access_token: str):
        self.access_token = access_token

    @classmethod
    def from_profile(cls, conn: sqlite3.Connection) -> "StravaClient":
        row = get_profile(conn)
        if row is None or not row["strava_refresh_token"]:
            raise StravaClientError(
                "No Strava credential on the profile row. Visit /strava/authorize first."
            )

        if row["strava_expires_at"] and row["strava_expires_at"] > time.time() + 60:
            return cls(access_token=row["strava_access_token"])

        resp = requests.post(
            TOKEN_URL,
            data={
                "client_id": settings.strava_client_id,
                "client_secret": settings.strava_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": row["strava_refresh_token"],
            },
            timeout=30,
        )
        if not resp.ok:
            raise StravaClientError(f"Token refresh failed: {resp.status_code} {resp.text[:500]}")
        data = resp.json()
        upsert_strava_tokens(
            conn,
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            expires_at=data["expires_at"],
        )
        return cls(access_token=data["access_token"])

    def get_activities(self, after: int, before: int) -> list:
        """after/before are unix timestamps."""
        resp = requests.get(
            f"{API_BASE}/athlete/activities",
            headers={"Authorization": f"Bearer {self.access_token}"},
            params={"after": after, "before": before, "per_page": 200},
            timeout=30,
        )
        if not resp.ok:
            raise StravaClientError(f"get_activities failed: {resp.status_code} {resp.text[:500]}")
        return resp.json()
