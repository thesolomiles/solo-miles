from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from app.strava_client import StravaClient

_UPSERT_ACTIVITY_SQL = """
INSERT INTO activities (id, source, start_date, type, name, duration_secs,
                         distance_m, load, avg_power, np_power, avg_hr, raw_json, synced_at)
VALUES (:id, 'strava', :start_date, :type, :name, :duration_secs, :distance_m,
        :load, :avg_power, :np_power, :avg_hr, :raw_json, datetime('now'))
ON CONFLICT(id) DO UPDATE SET
    start_date=excluded.start_date, type=excluded.type, name=excluded.name,
    duration_secs=excluded.duration_secs, distance_m=excluded.distance_m,
    load=excluded.load, avg_power=excluded.avg_power, np_power=excluded.np_power,
    avg_hr=excluded.avg_hr, raw_json=excluded.raw_json, synced_at=datetime('now')
"""


def _activity_params(a: dict) -> dict:
    return {
        "id": f"strava:{a.get('id')}",
        "start_date": a.get("start_date_local") or a.get("start_date"),
        "type": a.get("type"),
        "name": a.get("name"),
        "duration_secs": a.get("moving_time") or a.get("elapsed_time"),
        "distance_m": a.get("distance"),
        "load": None,
        "avg_power": a.get("average_watts"),
        "np_power": a.get("weighted_average_watts"),
        "avg_hr": a.get("average_heartrate"),
        "raw_json": json.dumps(a),
    }


def sync_strava(conn: sqlite3.Connection, days_back: int = 14) -> dict:
    after = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())
    before = int(datetime.now(timezone.utc).timestamp())

    client = StravaClient.from_profile(conn)
    activities = client.get_activities(after=after, before=before)

    for a in activities:
        conn.execute(_UPSERT_ACTIVITY_SQL, _activity_params(a))

    return {"activities_synced": len(activities)}


def sync_one_strava_activity(conn: sqlite3.Connection, activity_id: int | str) -> dict | None:
    """Fetch and upsert a single Strava activity (used by the webhook). Returns the stored
    row as a dict, or None if it couldn't be fetched."""
    client = StravaClient.from_profile(conn)
    activity = client.get_activity(activity_id)
    params = _activity_params(activity)
    conn.execute(_UPSERT_ACTIVITY_SQL, params)
    row = conn.execute("SELECT * FROM activities WHERE id = ?", (params["id"],)).fetchone()
    return dict(row) if row else None
