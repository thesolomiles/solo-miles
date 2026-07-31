from __future__ import annotations

import sqlite3


def get_profile(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM profile WHERE id = 1").fetchone()


def upsert_intervals_credentials(conn: sqlite3.Connection, api_key: str, athlete_id: str) -> None:
    conn.execute(
        """
        INSERT INTO profile (id, intervals_api_key, intervals_athlete_id)
        VALUES (1, :api_key, :athlete_id)
        ON CONFLICT(id) DO UPDATE SET
            intervals_api_key=excluded.intervals_api_key,
            intervals_athlete_id=excluded.intervals_athlete_id
        """,
        {"api_key": api_key, "athlete_id": athlete_id},
    )


def upsert_strava_tokens(
    conn: sqlite3.Connection, access_token: str, refresh_token: str, expires_at: int
) -> None:
    conn.execute(
        """
        INSERT INTO profile (id, strava_access_token, strava_refresh_token, strava_expires_at)
        VALUES (1, :access_token, :refresh_token, :expires_at)
        ON CONFLICT(id) DO UPDATE SET
            strava_access_token=excluded.strava_access_token,
            strava_refresh_token=excluded.strava_refresh_token,
            strava_expires_at=excluded.strava_expires_at
        """,
        {"access_token": access_token, "refresh_token": refresh_token, "expires_at": expires_at},
    )


def is_onboarding_complete(conn: sqlite3.Connection) -> bool:
    row = get_profile(conn)
    return row is not None and row["onboarding_completed_at"] is not None


def upsert_onboarding_profile(conn: sqlite3.Connection, data: dict) -> None:
    columns = list(data.keys())
    col_list = ", ".join(["id", *columns, "onboarding_completed_at"])
    placeholders = ", ".join(["1", *(f":{c}" for c in columns), "datetime('now')"])
    set_clause = ", ".join(f"{c}=excluded.{c}" for c in columns)
    conn.execute(
        f"""
        INSERT INTO profile ({col_list})
        VALUES ({placeholders})
        ON CONFLICT(id) DO UPDATE SET
            {set_clause},
            onboarding_completed_at=excluded.onboarding_completed_at
        """,
        data,
    )


def clear_onboarding(conn: sqlite3.Connection) -> None:
    conn.execute("UPDATE profile SET onboarding_completed_at = NULL WHERE id = 1")


def save_profile_summary(conn: sqlite3.Connection, summary: str) -> None:
    conn.execute(
        """
        INSERT INTO profile (id, profile_summary)
        VALUES (1, :summary)
        ON CONFLICT(id) DO UPDATE SET profile_summary=excluded.profile_summary
        """,
        {"summary": summary},
    )


def set_telegram_chat_id(conn: sqlite3.Connection, chat_id: str) -> None:
    conn.execute(
        """
        INSERT INTO profile (id, telegram_chat_id)
        VALUES (1, :chat_id)
        ON CONFLICT(id) DO UPDATE SET telegram_chat_id=excluded.telegram_chat_id
        """,
        {"chat_id": chat_id},
    )
