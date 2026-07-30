from __future__ import annotations

import sqlite3

import requests

from app.profile import get_profile

BASE_URL = "https://intervals.icu/api/v1"


class IntervalsClientError(RuntimeError):
    pass


class IntervalsClient:
    def __init__(self, api_key: str, athlete_id: str = "0"):
        if not api_key:
            raise IntervalsClientError("intervals.icu API key is not set")
        self.api_key = api_key
        self.athlete_id = athlete_id

    @classmethod
    def from_profile(cls, conn: sqlite3.Connection) -> "IntervalsClient":
        row = get_profile(conn)
        if row is None or not row["intervals_api_key"]:
            raise IntervalsClientError(
                "No intervals.icu credential on the profile row. "
                "Run scripts/seed_intervals_credential.py first."
            )
        return cls(api_key=row["intervals_api_key"], athlete_id=row["intervals_athlete_id"] or "0")

    def _get(self, path: str, params: dict | None = None) -> dict | list:
        url = f"{BASE_URL}{path}"
        resp = requests.get(url, auth=("API_KEY", self.api_key), params=params, timeout=30)
        if not resp.ok:
            raise IntervalsClientError(
                f"GET {url} failed: {resp.status_code} {resp.text[:500]}"
            )
        return resp.json()

    def get_athlete(self) -> dict:
        return self._get(f"/athlete/{self.athlete_id}")

    def get_activities(self, oldest: str, newest: str) -> list:
        """oldest/newest are date strings like '2026-07-01'."""
        return self._get(
            f"/athlete/{self.athlete_id}/activities",
            params={"oldest": oldest, "newest": newest},
        )

    def get_wellness(self, oldest: str, newest: str) -> list:
        return self._get(
            f"/athlete/{self.athlete_id}/wellness",
            params={"oldest": oldest, "newest": newest},
        )

    def get_events(self, oldest: str, newest: str) -> list:
        """Calendar events, includes planned workouts."""
        return self._get(
            f"/athlete/{self.athlete_id}/events",
            params={"oldest": oldest, "newest": newest},
        )
