from __future__ import annotations

import sqlite3


def get_programme(conn: sqlite3.Connection) -> dict:
    meta = conn.execute("SELECT * FROM programme WHERE id = 1").fetchone()
    days = conn.execute("SELECT * FROM programme_days ORDER BY date").fetchall()
    return {
        "notes": meta["notes"] if meta else None,
        "generated_at": meta["generated_at"] if meta else None,
        "days": [dict(d) for d in days],
    }


def save_programme(conn: sqlite3.Connection, notes: str, days: list[dict]) -> None:
    conn.execute(
        """
        INSERT INTO programme (id, notes, generated_at)
        VALUES (1, :notes, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET notes=excluded.notes, generated_at=excluded.generated_at
        """,
        {"notes": notes},
    )
    conn.execute("DELETE FROM programme_days")
    for d in days:
        conn.execute(
            """
            INSERT INTO programme_days (date, training_summary, training_detail,
                                         training_duration_mins, training_load,
                                         nutrition_summary, nutrition_detail)
            VALUES (:date, :training_summary, :training_detail, :training_duration_mins,
                    :training_load, :nutrition_summary, :nutrition_detail)
            """,
            {
                "date": d.get("date"),
                "training_summary": d.get("training_summary"),
                "training_detail": d.get("training_detail"),
                "training_duration_mins": d.get("training_duration_mins"),
                "training_load": d.get("training_load"),
                "nutrition_summary": d.get("nutrition_summary"),
                "nutrition_detail": d.get("nutrition_detail"),
            },
        )
