"""One-time bootstrap: copy the intervals.icu API key from .env into the profile row.

The app reads the credential from the DB (per-profile), not from env, at runtime -
this keeps credential storage shaped for multiple users later (e.g. swapping in
OAuth tokens per profile) instead of a single global env var. .env is just the
seed input for this first profile.

Usage: python scripts/seed_intervals_credential.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.db import db_session, init_db  # noqa: E402
from app.profile import upsert_intervals_credentials  # noqa: E402


def main():
    if not settings.intervals_api_key:
        print("INTERVALS_API_KEY is not set in .env")
        sys.exit(1)

    init_db()
    with db_session() as conn:
        upsert_intervals_credentials(
            conn,
            api_key=settings.intervals_api_key,
            athlete_id=settings.intervals_athlete_id,
        )
    print(f"Saved intervals.icu credential to profile (athlete_id={settings.intervals_athlete_id})")


if __name__ == "__main__":
    main()
