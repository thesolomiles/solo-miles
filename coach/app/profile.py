from __future__ import annotations

import sqlite3

# The intake fields the coach collects during onboarding (Telegram-driven). These map 1:1 to
# profile columns; everything else on the row is infra (credentials, telegram_chat_id, etc.).
ONBOARDING_FIELDS = [
    "name", "age", "goal_event", "goal_date", "event_demand_type", "ftp",
    "ftp_test_method", "ftp_test_date", "power_curve_json", "experience_level",
    "recent_weekly_hours", "recent_structure_notes", "available_hours",
    "hours_distribution", "training_setup", "power_source", "constraints", "sex",
    "height_cm", "weight_kg", "weight_goal", "lifestyle_activity_level",
    "dietary_restrictions", "eating_pattern", "timezone", "wake_time", "checkin_intensity",
]


def get_profile(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM profile WHERE id = 1").fetchone()


def get_onboarding_draft(conn: sqlite3.Connection) -> dict:
    """The intake fields collected so far (non-null), for feeding back as CURRENT KNOWN PROFILE."""
    row = get_profile(conn)
    if row is None:
        return {}
    return {f: row[f] for f in ONBOARDING_FIELDS if row[f] is not None}


def save_onboarding_draft(conn: sqlite3.Connection, fields: dict) -> None:
    """Persist partial intake fields as they're learned, WITHOUT marking onboarding complete."""
    data = {k: v for k, v in fields.items() if k in ONBOARDING_FIELDS and v not in (None, "")}
    if not data:
        return
    columns = list(data.keys())
    col_list = ", ".join(["id", *columns])
    placeholders = ", ".join(["1", *(f":{c}" for c in columns)])
    set_clause = ", ".join(f"{c}=excluded.{c}" for c in columns)
    conn.execute(
        f"INSERT INTO profile ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT(id) DO UPDATE SET {set_clause}",
        data,
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
