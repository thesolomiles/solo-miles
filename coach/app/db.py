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
    avg_hr REAL,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Persistent Telegram conversation history (single athlete, so no chat partitioning).
-- Replaces the old in-memory history dict so the coach's memory survives restarts.
CREATE TABLE IF NOT EXISTS conversation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,          -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Curated facts the coach chooses to remember about the athlete over time
-- (e.g. "knee niggle since Aug", "hates trainer sessions"). This is the long-term
-- store that lets the coach get to know the athlete like a human would.
CREATE TABLE IF NOT EXISTS coach_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    source TEXT,                 -- where it came from, e.g. 'chat', 'post_workout'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log of proactive check-ins the coach has initiated. Doubles as a dedupe guard so a
-- trigger fires at most once per moment (kind='morning'/'missed_workout' keyed on the
-- date; kind='post_workout' keyed on the Strava activity id).
CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (kind, ref)
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
    # WAL + a busy timeout so the web process (Strava webhook) and the bot process
    # (scheduler + replies) can read/write the same SQLite file concurrently.
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
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

ACTIVITIES_MIGRATION_COLUMNS = [
    ("avg_hr", "REAL"),
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
        for column, coldef in ACTIVITIES_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "activities", column, coldef)
        for column, coldef in PROGRAMME_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "programme", column, coldef)
        for column, coldef in PROGRAMME_DAYS_MIGRATION_COLUMNS:
            _add_column_if_missing(conn, "programme_days", column, coldef)
