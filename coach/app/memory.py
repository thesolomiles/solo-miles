"""Durable conversation history and long-term coach memory.

The coach used to keep chat history in an in-memory dict that died on every restart, so it
never really got to know the athlete. These helpers persist both the running conversation and
the discrete facts the coach chooses to remember, so its knowledge accumulates over time.
"""
from __future__ import annotations

import sqlite3

# How many recent turns to replay as working context. The long-term store (coach_memory)
# carries anything important beyond this window, so the coach doesn't forget it.
DEFAULT_HISTORY_TURNS = 40
DEFAULT_MEMORY_LIMIT = 40


def append_turn(conn: sqlite3.Connection, role: str, content: str) -> None:
    conn.execute(
        "INSERT INTO conversation (role, content) VALUES (?, ?)",
        (role, content),
    )


def recent_turns(conn: sqlite3.Connection, limit: int = DEFAULT_HISTORY_TURNS) -> list[dict]:
    """Return the last `limit` turns in chronological order (oldest first)."""
    rows = conn.execute(
        "SELECT role, content FROM conversation ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def clear_conversation(conn: sqlite3.Connection) -> None:
    conn.execute("DELETE FROM conversation")


def add_memory(conn: sqlite3.Connection, content: str, source: str = "chat") -> None:
    content = (content or "").strip()
    if not content:
        return
    conn.execute(
        "INSERT INTO coach_memory (content, source) VALUES (?, ?)",
        (content, source),
    )


def recent_memory(conn: sqlite3.Connection, limit: int = DEFAULT_MEMORY_LIMIT) -> list[str]:
    """Return remembered facts, oldest first, so the coach reads them in the order learned."""
    rows = conn.execute(
        "SELECT content FROM coach_memory ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [r["content"] for r in reversed(rows)]


def memory_block(conn: sqlite3.Connection, limit: int = DEFAULT_MEMORY_LIMIT) -> str:
    """A plain-text block of what the coach knows, for injection into a system prompt."""
    facts = recent_memory(conn, limit)
    if not facts:
        return "(nothing remembered yet)"
    return "\n".join(f"- {f}" for f in facts)


def already_checked_in(conn: sqlite3.Connection, kind: str, ref: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM checkins WHERE kind = ? AND ref = ? LIMIT 1",
        (kind, ref),
    ).fetchone()
    return row is not None


def log_checkin(conn: sqlite3.Connection, kind: str, ref: str) -> bool:
    """Record that a proactive check-in fired. Returns False if it was already logged
    (the UNIQUE(kind, ref) guard), so callers can treat it as a dedupe claim."""
    try:
        conn.execute("INSERT INTO checkins (kind, ref) VALUES (?, ?)", (kind, ref))
        return True
    except sqlite3.IntegrityError:
        return False
