"""Standalone sanity check for the intervals.icu integration, no FastAPI needed.

Usage: python scripts/test_intervals.py
Requires the profile row to have an intervals.icu credential saved -
run scripts/seed_intervals_credential.py first.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import db_session  # noqa: E402
from app.intervals_client import IntervalsClient, IntervalsClientError  # noqa: E402


def main():
    try:
        with db_session() as conn:
            client = IntervalsClient.from_profile(conn)
    except IntervalsClientError as e:
        print(f"Config error: {e}")
        sys.exit(1)

    oldest = (date.today() - timedelta(days=14)).isoformat()
    newest = date.today().isoformat()

    print(f"Athlete ID: {client.athlete_id}")

    try:
        athlete = client.get_athlete()
        print(f"Authenticated as: {athlete.get('name', '(no name field)')}")
    except IntervalsClientError as e:
        print(f"FAILED get_athlete: {e}")
        sys.exit(1)

    try:
        activities = client.get_activities(oldest, newest)
        print(f"Activities ({oldest} to {newest}): {len(activities)} found")
        for a in activities[:3]:
            print(f"  - {a.get('start_date_local')} {a.get('type')} {a.get('name')}")
    except IntervalsClientError as e:
        print(f"FAILED get_activities: {e}")

    try:
        wellness = client.get_wellness(oldest, newest)
        print(f"Wellness records: {len(wellness)} found")
        for w in wellness[:3]:
            print(f"  - {w.get('id')} hrv={w.get('hrv')} sleep={w.get('sleepSecs')}")
    except IntervalsClientError as e:
        print(f"FAILED get_wellness: {e}")

    try:
        events = client.get_events(newest, (date.today() + timedelta(days=7)).isoformat())
        print(f"Upcoming planned events: {len(events)} found")
        for ev in events[:3]:
            print(f"  - {ev.get('start_date_local') or ev.get('date')} {ev.get('name')}")
    except IntervalsClientError as e:
        print(f"FAILED get_events: {e}")


if __name__ == "__main__":
    main()
