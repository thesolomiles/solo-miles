from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta, timezone

from app.intervals_client import IntervalsClient
from app.strava_client import StravaClient


def sync_intervals(conn: sqlite3.Connection, days_back: int = 14, days_forward: int = 7) -> dict:
    oldest = (date.today() - timedelta(days=days_back)).isoformat()
    newest = (date.today() + timedelta(days=days_forward)).isoformat()

    client = IntervalsClient.from_profile(conn)

    activities = client.get_activities(oldest, newest)
    wellness = client.get_wellness(oldest, newest)
    events = client.get_events(oldest, newest)

    for a in activities:
        if "_note" in a:
            # Stub row for a Strava-sourced activity - intervals.icu doesn't expose
            # full detail for these; app.strava_client covers per-ride data instead.
            continue
        conn.execute(
            """
            INSERT INTO activities (id, source, start_date, type, name, duration_secs,
                                     distance_m, load, avg_power, np_power, raw_json, synced_at)
            VALUES (:id, 'intervals', :start_date, :type, :name, :duration_secs, :distance_m,
                    :load, :avg_power, :np_power, :raw_json, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                start_date=excluded.start_date, type=excluded.type, name=excluded.name,
                duration_secs=excluded.duration_secs, distance_m=excluded.distance_m,
                load=excluded.load, avg_power=excluded.avg_power, np_power=excluded.np_power,
                raw_json=excluded.raw_json, synced_at=datetime('now')
            """,
            {
                "id": f"icu:{a.get('id')}",
                "start_date": a.get("start_date_local") or a.get("start_date"),
                "type": a.get("type"),
                "name": a.get("name"),
                "duration_secs": a.get("moving_time") or a.get("elapsed_time"),
                "distance_m": a.get("distance"),
                "load": a.get("icu_training_load"),
                "avg_power": a.get("icu_average_watts"),
                "np_power": a.get("icu_weighted_avg_watts"),
                "raw_json": json.dumps(a),
            },
        )

    for w in wellness:
        conn.execute(
            """
            INSERT INTO wellness (date, hrv, sleep_secs, fatigue, ctl, atl, ramp_rate,
                                   raw_json, synced_at)
            VALUES (:date, :hrv, :sleep_secs, :fatigue, :ctl, :atl, :ramp_rate,
                    :raw_json, datetime('now'))
            ON CONFLICT(date) DO UPDATE SET
                hrv=excluded.hrv, sleep_secs=excluded.sleep_secs, fatigue=excluded.fatigue,
                ctl=excluded.ctl, atl=excluded.atl, ramp_rate=excluded.ramp_rate,
                raw_json=excluded.raw_json, synced_at=datetime('now')
            """,
            {
                "date": w.get("id"),
                "hrv": w.get("hrv"),
                "sleep_secs": w.get("sleepSecs"),
                "fatigue": w.get("fatigue"),
                "ctl": w.get("ctl"),
                "atl": w.get("atl"),
                "ramp_rate": w.get("rampRate"),
                "raw_json": json.dumps(w),
            },
        )

    for e in events:
        conn.execute(
            """
            INSERT INTO planned_workouts (id, date, name, description, planned_duration_secs,
                                           planned_load, raw_json, synced_at)
            VALUES (:id, :date, :name, :description, :planned_duration_secs,
                    :planned_load, :raw_json, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                date=excluded.date, name=excluded.name, description=excluded.description,
                planned_duration_secs=excluded.planned_duration_secs,
                planned_load=excluded.planned_load, raw_json=excluded.raw_json,
                synced_at=datetime('now')
            """,
            {
                "id": e.get("id"),
                "date": e.get("start_date_local") or e.get("date"),
                "name": e.get("name"),
                "description": e.get("description"),
                "planned_duration_secs": e.get("moving_time"),
                "planned_load": e.get("icu_training_load"),
                "raw_json": json.dumps(e),
            },
        )

    return {
        "oldest": oldest,
        "newest": newest,
        "activities_synced": len(activities),
        "wellness_synced": len(wellness),
        "events_synced": len(events),
    }


def sync_strava(conn: sqlite3.Connection, days_back: int = 14) -> dict:
    after = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())
    before = int(datetime.now(timezone.utc).timestamp())

    client = StravaClient.from_profile(conn)
    activities = client.get_activities(after=after, before=before)

    for a in activities:
        conn.execute(
            """
            INSERT INTO activities (id, source, start_date, type, name, duration_secs,
                                     distance_m, load, avg_power, np_power, raw_json, synced_at)
            VALUES (:id, 'strava', :start_date, :type, :name, :duration_secs, :distance_m,
                    :load, :avg_power, :np_power, :raw_json, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                start_date=excluded.start_date, type=excluded.type, name=excluded.name,
                duration_secs=excluded.duration_secs, distance_m=excluded.distance_m,
                load=excluded.load, avg_power=excluded.avg_power, np_power=excluded.np_power,
                raw_json=excluded.raw_json, synced_at=datetime('now')
            """,
            {
                "id": f"strava:{a.get('id')}",
                "start_date": a.get("start_date_local") or a.get("start_date"),
                "type": a.get("type"),
                "name": a.get("name"),
                "duration_secs": a.get("moving_time") or a.get("elapsed_time"),
                "distance_m": a.get("distance"),
                "load": None,
                "avg_power": a.get("average_watts"),
                "np_power": a.get("weighted_average_watts"),
                "raw_json": json.dumps(a),
            },
        )

    return {"activities_synced": len(activities)}
