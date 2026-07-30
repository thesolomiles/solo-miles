from __future__ import annotations

import json
import sqlite3
from datetime import date, timedelta

from anthropic import Anthropic

from app.config import settings
from app.profile import get_profile

MODEL = "claude-sonnet-4-6"

COACH_SYSTEM_PROMPT = """You are a direct, blunt cycling coach. You have access to the athlete's stated
goal (event, date, FTP, weekly hours available), their recent training data
from intervals.icu (activities, load, wellness metrics), and their training
history logged in this app. Assess their current training status relative to
their goal - on track, overreaching, undertraining, fatigue signals, whatever
the data shows. Be direct about what's wrong, don't soften bad news, but stay
constructive - the goal is to help them adjust, not just criticize. Keep your
response to a few sentences of reasoning, not a wall of text."""

NUTRITIONIST_SYSTEM_PROMPT = """You are a direct, blunt sports nutritionist. You have access to the athlete's
profile (goal, weight if provided, weekly training hours) and today's planned
training (duration/intensity if known). Calculate today's target calories and
macros, and give clear eating windows relative to their training time (e.g.
what to eat pre-ride, during if the session is long, and post-ride recovery
window). When they report what they actually ate, compare it against target
and flag it directly if it's insufficient or poorly timed - don't just log it
silently. Keep responses concise: numbers plus the reasoning behind them, not
a full report every time."""


def _client() -> Anthropic:
    return Anthropic(api_key=settings.anthropic_api_key)


def _coach_profile_summary(row: sqlite3.Row | None) -> str:
    if row is None or not row["goal_event"]:
        return "No profile set yet."
    lines = [
        f"Name: {row['name'] or 'unknown'}, Age: {row['age'] or 'unknown'}",
        f"Goal: {row['goal_event']} on {row['goal_date']}",
        f"Event demands: {row['event_demand_type'] or 'not specified'}",
        f"FTP: {row['ftp']}W (tested via {row['ftp_test_method'] or 'unknown method'} "
        f"on {row['ftp_test_date'] or 'unknown date'})",
        f"Experience level: {row['experience_level'] or 'not specified'}",
        f"Recent weekly hours: {row['recent_weekly_hours']} "
        f"({row['recent_structure_notes'] or 'no notes'})",
        f"Available hours/week going forward: {row['available_hours']}, "
        f"distribution: {row['hours_distribution'] or 'not specified'}",
        f"Setup: {row['training_setup'] or 'not specified'}, "
        f"power source: {row['power_source'] or 'not specified'}",
        f"Constraints: {row['constraints'] or 'none stated'}",
    ]
    if row["power_curve_json"]:
        try:
            lines.append(f"Short-duration power: {json.loads(row['power_curve_json'])}")
        except (ValueError, TypeError):
            pass
    return "\n".join(lines)


def _nutritionist_profile_summary(row: sqlite3.Row | None) -> str:
    if row is None or not row["goal_event"]:
        return "No profile set yet."
    return (
        f"Goal: {row['goal_event']} on {row['goal_date']}\n"
        f"Sex: {row['sex'] or 'not specified'}\n"
        f"Height: {row['height_cm']} cm, Weight: {row['weight_kg']} kg\n"
        f"Weight goal: {row['weight_goal'] or 'not specified'}\n"
        f"Lifestyle activity level: {row['lifestyle_activity_level'] or 'not specified'}\n"
        f"Dietary restrictions: {row['dietary_restrictions'] or 'none stated'}\n"
        f"Eating pattern: {row['eating_pattern'] or 'not specified'}\n"
        f"Available training hours/week: {row['available_hours']}"
    )


def _recent_activities_summary(conn: sqlite3.Connection, days: int = 14) -> str:
    since = (date.today() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT * FROM activities WHERE start_date >= ? ORDER BY start_date DESC",
        (since,),
    ).fetchall()
    if not rows:
        return f"No activities logged in the last {days} days."
    lines = []
    for r in rows:
        mins = round((r["duration_secs"] or 0) / 60)
        km = round((r["distance_m"] or 0) / 1000, 1)
        lines.append(
            f"- {r['start_date'][:10]} {r['type']} '{r['name']}': {mins} min, {km} km, "
            f"avg power {r['avg_power']}W, np {r['np_power']}W"
        )
    return "\n".join(lines)


def _wellness_trend_summary(conn: sqlite3.Connection, days: int = 7) -> str:
    since = (date.today() - timedelta(days=days)).isoformat()
    today = date.today().isoformat()
    rows = conn.execute(
        "SELECT * FROM wellness WHERE date >= ? AND date <= ? ORDER BY date",
        (since, today),
    ).fetchall()
    if not rows:
        return "No wellness/load data available."
    lines = []
    for r in rows:
        line = f"- {r['date']}: CTL {r['ctl']}, ATL {r['atl']}, ramp rate {r['ramp_rate']}"
        if r["hrv"] is not None:
            line += f", HRV {r['hrv']}"
        if r["sleep_secs"] is not None:
            line += f", sleep {round(r['sleep_secs'] / 3600, 1)}h"
        lines.append(line)
    return "\n".join(lines)


def _todays_planned_workout(conn: sqlite3.Connection) -> str:
    today = date.today().isoformat()
    row = conn.execute(
        "SELECT * FROM planned_workouts WHERE date LIKE ? ORDER BY date LIMIT 1",
        (f"{today}%",),
    ).fetchone()
    if row is None:
        return "No planned workout logged for today."
    mins = round((row["planned_duration_secs"] or 0) / 60)
    return f"{row['name']}: ~{mins} min planned. {row['description'] or ''}".strip()


def build_coach_context(conn: sqlite3.Connection) -> str:
    profile = get_profile(conn)
    return (
        f"ATHLETE PROFILE\n{_coach_profile_summary(profile)}\n\n"
        f"RECENT ACTIVITIES (last 14 days)\n{_recent_activities_summary(conn)}\n\n"
        f"TRAINING LOAD TREND (last 7 days)\n{_wellness_trend_summary(conn)}"
    )


def build_nutritionist_context(conn: sqlite3.Connection) -> str:
    profile = get_profile(conn)
    return (
        f"ATHLETE PROFILE\n{_nutritionist_profile_summary(profile)}\n\n"
        f"TODAY'S PLANNED TRAINING\n{_todays_planned_workout(conn)}"
    )


def run_coach(conn: sqlite3.Connection) -> str:
    context = build_coach_context(conn)
    resp = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=COACH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )
    return resp.content[0].text


def run_nutritionist(conn: sqlite3.Connection) -> str:
    context = build_nutritionist_context(conn)
    resp = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=NUTRITIONIST_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": context}],
    )
    return resp.content[0].text
