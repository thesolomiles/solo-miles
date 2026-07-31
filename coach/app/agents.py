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


ONBOARDING_DIALOGUE_PROMPT = """You are Coach, an AI cycling coach and nutrition advisor running a
conversational intake with a new athlete - the same free-flowing back-and-forth as a normal chat,
not a rigid questionnaire. React to what they actually said, ask sensible follow-ups, group related
questions together instead of one field at a time, and use your own judgement to skip things that
don't apply (e.g. don't push for short-duration power numbers if they clearly don't track that).

This is your very first meeting with this athlete. If CURRENT KNOWN PROFILE below is empty, you know
literally nothing about them yet - not even their name - so open with genuine curiosity: welcome them,
introduce yourself briefly, and ask who they are and what brought them here before anything else. Let
the rest of the intake grow naturally out of what they tell you rather than jumping straight to logistics.

Over the course of the conversation you need to learn enough to plan their training and fuel their
rides: who they are (name), training basics (goal event/date, event demands, FTP, experience, recent
and available hours, setup), nutrition basics (sex, height, weight, weight goal, lifestyle activity,
eating pattern), and logistics (timezone, wake time, check-in preference). CURRENT KNOWN PROFILE below
is what you already have - don't re-ask for it. Once it's essentially complete, say so plainly and wrap
up warmly instead of hunting for the last few optional details.

Stay in character: direct, a little blunt, but constructive - like a real coach getting to know a new
athlete, not a form. Reply with a few sentences of plain conversational text - no lists, no tool talk."""

ONBOARDING_KICKOFF_MESSAGE = {
    "role": "user",
    "content": (
        "(This is the very start of the conversation - I haven't said anything yet. "
        "Kick things off.)"
    ),
}

EXTRACTION_SYSTEM_PROMPT = """Read the conversation between an AI cycling coach and a new athlete.
Call record_fields with any profile fields the athlete has revealed anywhere in the conversation that
aren't already in CURRENT KNOWN PROFILE below - only new or updated ones, omit the rest.

Set ready_to_finish to true only once these essentials are covered: name, goal_event, goal_date,
event_demand_type, ftp, experience_level, recent_weekly_hours, available_hours, hours_distribution,
training_setup, power_source, sex, height_cm, weight_kg, weight_goal, lifestyle_activity_level,
eating_pattern, timezone, wake_time, checkin_intensity. Optional fields (short-duration power, recent
structure notes, constraints, dietary restrictions) don't block finishing - leave ready_to_finish
false if any essential is still missing from CURRENT KNOWN PROFILE plus what you're recording now."""

RECORD_FIELDS_TOOL = {
    "name": "record_fields",
    "description": "Save profile fields learned from the conversation, and whether intake is essentially complete.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
            "goal_event": {"type": "string"},
            "goal_date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
            "event_demand_type": {"type": "string", "enum": ["steady", "punchy", "mixed"]},
            "ftp": {"type": "integer"},
            "ftp_test_method": {"type": "string"},
            "ftp_test_date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
            "power_curve_json": {
                "type": "string",
                "description": (
                    'JSON object string of any short-duration power the athlete knows, e.g. '
                    '{"5s": 1000, "1min": 400, "5min": 320}'
                ),
            },
            "experience_level": {
                "type": "string",
                "enum": ["beginner", "intermediate", "advanced", "competitive"],
            },
            "recent_weekly_hours": {"type": "number"},
            "recent_structure_notes": {"type": "string"},
            "available_hours": {"type": "number"},
            "hours_distribution": {"type": "string", "enum": ["even", "weekend_heavy"]},
            "training_setup": {"type": "string", "enum": ["trainer", "outdoor", "both"]},
            "power_source": {"type": "string", "enum": ["meter", "estimated"]},
            "constraints": {"type": "string"},
            "sex": {"type": "string", "enum": ["male", "female", "other"]},
            "height_cm": {"type": "number"},
            "weight_kg": {"type": "number"},
            "weight_goal": {"type": "string", "enum": ["maintain", "lose", "gain"]},
            "lifestyle_activity_level": {
                "type": "string",
                "enum": ["desk_job", "on_feet", "in_between"],
            },
            "dietary_restrictions": {"type": "string"},
            "eating_pattern": {"type": "string", "enum": ["big_meals", "grazing", "in_between"]},
            "timezone": {"type": "string"},
            "wake_time": {"type": "string", "description": "24h HH:MM"},
            "checkin_intensity": {"type": "string", "enum": ["everything", "big_moments_only"]},
            "ready_to_finish": {"type": "boolean"},
        },
        "required": ["ready_to_finish"],
    },
}


def _client() -> Anthropic:
    return Anthropic(api_key=settings.anthropic_api_key)


def run_onboarding_chat(messages: list[dict], draft: dict) -> tuple[str, dict, bool]:
    known = json.dumps(draft, indent=2) if draft else "(nothing yet)"
    api_messages = [ONBOARDING_KICKOFF_MESSAGE, *messages]

    dialogue_resp = _client().messages.create(
        model=MODEL,
        max_tokens=512,
        system=f"{ONBOARDING_DIALOGUE_PROMPT}\n\nCURRENT KNOWN PROFILE:\n{known}",
        messages=api_messages,
    )
    reply = "\n\n".join(
        block.text.strip() for block in dialogue_resp.content if block.type == "text" and block.text.strip()
    )
    if not reply:
        reply = "Got it."

    if not messages:
        return reply, draft, False

    extraction_resp = _client().messages.create(
        model=MODEL,
        max_tokens=1024,
        system=f"{EXTRACTION_SYSTEM_PROMPT}\n\nCURRENT KNOWN PROFILE:\n{known}",
        tools=[RECORD_FIELDS_TOOL],
        tool_choice={"type": "tool", "name": "record_fields"},
        messages=api_messages,
    )
    updated_draft = dict(draft)
    done = False
    for block in extraction_resp.content:
        if block.type == "tool_use" and block.name == "record_fields":
            data = dict(block.input)
            done = bool(data.pop("ready_to_finish", False))
            for key, value in data.items():
                if value not in (None, ""):
                    updated_draft[key] = value

    return reply, updated_draft, done


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
