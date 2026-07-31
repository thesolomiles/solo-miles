import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    -- Coach onboarding
    name TEXT,
    age INTEGER,
    goal_event TEXT,
    goal_date TEXT,
    event_demand_type TEXT,
    ftp INTEGER,
    ftp_test_method TEXT,
    ftp_test_date TEXT,
    power_curve_json TEXT,
    experience_level TEXT,
    recent_weekly_hours REAL,
    recent_structure_notes TEXT,
    available_hours REAL,
    hours_distribution TEXT,
    training_setup TEXT,
    power_source TEXT,
    constraints TEXT,
    -- Nutritionist onboarding
    sex TEXT,
    height_cm REAL,
    weight_kg REAL,
    weight_goal TEXT,
    lifestyle_activity_level TEXT,
    dietary_restrictions TEXT,
    eating_pattern TEXT,
    -- Logistics
    timezone TEXT,
    wake_time TEXT,
    checkin_intensity TEXT,
    onboarding_completed_at TEXT,
    -- Legacy field kept for backward compatibility, superseded by available_hours
    weekly_hours REAL,
    -- Integration credentials
    intervals_api_key TEXT,
    intervals_athlete_id TEXT DEFAULT '0',
    strava_access_token TEXT,
    strava_refresh_token TEXT,
    strava_expires_at INTEGER,
    telegram_chat_id TEXT,
    profile_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    start_date TEXT NOT NULL,
    type TEXT,
    name TEXT,
    duration_secs INTEGER,
    distance_m REAL,
    load INTEGER,
    avg_power INTEGER,
    np_power INTEGER,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wellness (
    date TEXT PRIMARY KEY,
    hrv REAL,
    sleep_secs INTEGER,
    fatigue INTEGER,
    ctl REAL,
    atl REAL,
    ramp_rate REAL,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS planned_workouts (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT,
    description TEXT,
    planned_duration_secs INTEGER,
    planned_load INTEGER,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_logs (
    date TEXT PRIMARY KEY,
    anchor_time TEXT,
    coach_brief TEXT,
    nutritionist_brief TEXT,
    pre_meal_text TEXT,
    during_meal_text TEXT,
    post_meal_text TEXT,
    other_meals_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programme (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    notes TEXT,
    phases_json TEXT,
    generated_at TEXT
);

CREATE TABLE IF NOT EXISTS programme_days (
    date TEXT PRIMARY KEY,
    training_summary TEXT,
    training_detail TEXT,
    training_duration_mins INTEGER,
    training_load INTEGER,
    nutrition_summary TEXT,
    nutrition_detail TEXT,
    calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER
);
"""


def get_connection() -> sqlite3.Connection:
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _add_column_if_missing(conn: sqlite3.Connection, table: str, column: str, coldef: str) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coldef}")


PROFILE_MIGRATION_COLUMNS = [
    ("telegram_chat_id", "TEXT"),
    ("name", "TEXT"),
    ("age", "INTEGER"),
    ("event_demand_type", "TEXT"),
    ("ftp_test_method", "TEXT"),
    ("ftp_test_date", "TEXT"),
    ("power_curve_json", "TEXT"),
    ("experience_level", "TEXT"),
    ("recent_weekly_hours", "REAL"),
    ("recent_structure_notes", "TEXT"),
    ("available_hours", "REAL"),
    ("hours_distribution", "TEXT"),
    ("training_setup", "TEXT"),
    ("power_source", "TEXT"),
    ("sex", "TEXT"),
    ("height_cm", "REAL"),
    ("weight_kg", "REAL"),
    ("weight_goal", "TEXT"),
    ("lifestyle_activity_level", "TEXT"),
    ("dietary_restrictions", "TEXT"),
    ("eating_pattern", "TEXT"),
    ("timezone", "TEXT"),
    ("wake_time", "TEXT"),
    ("checkin_intensity", "TEXT"),
    ("onboarding_completed_at", "TEXT"),
    ("profile_summary", "TEXT"),
]

PROGRAMME_MIGRATION_COLUMNS = [
    ("phases_json", "TEXT"),
]

PROGRAMME_DAYS_MIGRATION_COLUMNS = [
    ("calories", "INTEGER"),
    ("protein_g", "INTEGER"),
    ("carbs_g", "INTEGER"),
    ("fat_g", "INTEGER"),
]


def init_db() -> None:
    with db_session() as conn:
        conn.executescript(SCHEMA)
        # Additive migrations for columns added after a DB file already existed.
        for column, coldef in PROFILE_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "profile", column, coldef)
        for column, coldef in PROGRAMME_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "programme", column, coldef)
        for column, coldef in PROGRAMME_DAYS_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "programme_days", column, coldef)
