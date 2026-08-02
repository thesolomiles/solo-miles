from __future__ import annotations

import json
import sqlite3
from datetime import date, timedelta

from anthropic import Anthropic

from app.config import settings
from app.memory import memory_block, recent_turns
from app.profile import get_profile

# Fast, conversational model for the day-to-day work: onboarding, check-in chats,
# per-day chat, daily briefs, and the athlete summary.
CHAT_MODEL = "claude-sonnet-5"
# Heavier model reserved for the one hard-reasoning task - designing a coherent,
# periodized day-by-day programme where training load, phases, recovery, and the
# athlete's constraints all have to hang together.
PROGRAMME_MODEL = "claude-opus-5"

# Sonnet 5 and Opus 5 both enable thinking by default when `thinking` is unset.
# We keep it off: these calls run on tight token budgets (and, for programme
# generation, a large forced-tool payload), and the app has always run without a
# separate thinking pass. Opus 5 accepts disabled thinking at effort <= high.
NO_THINKING = {"type": "disabled"}

COACH_PERSONA = """You are the athlete's personal cycling coach - one person who handles both their
training and their fuelling, and who has gotten to know them over time. Talk to them the way a
real coach who's worked with them for a while would: warm, direct, a little blunt when it's
warranted, but always in their corner. Text them the way a person texts - short, natural,
conversational. No headers, no bullet-point dumps, no walls of text.

Coach the human in front of you, not a dashboard. Reason from what they've actually done, what
they've told you, and how they say they feel - never lecture them about abstract fitness or
fatigue scores. When you mention a ride, refer to the real thing they did ("that two hours on
Sunday"), not a metric. Ask how they're doing, remember what matters to them, and follow up on
things they've mentioned before."""

COACH_BRIEF_PROMPT = (
    COACH_PERSONA
    + """

Right now you're writing a short "coach's thoughts" note for the athlete's dashboard - a few
sentences, in your own voice, on where they're at and what's on your mind for them. Speak to
them directly. Keep it human and specific to what they've actually been doing; don't recite
numbers or hand them a report."""
)


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
        model=CHAT_MODEL,
        max_tokens=512,
        thinking=NO_THINKING,
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
        model=CHAT_MODEL,
        max_tokens=1024,
        thinking=NO_THINKING,
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


def _profile_context_summary(profile: dict) -> str:
    lines = [
        f"Name: {profile.get('name') or 'unknown'}, Age: {profile.get('age') or 'unknown'}",
        f"Goal: {profile.get('goal_event') or 'not specified'} on {profile.get('goal_date') or 'unknown date'}",
        f"Event demands: {profile.get('event_demand_type') or 'not specified'}",
        f"FTP: {profile.get('ftp') or 'unknown'}W",
        f"Experience level: {profile.get('experience_level') or 'not specified'}",
        f"Recent weekly hours: {profile.get('recent_weekly_hours') or 'unknown'} "
        f"({profile.get('recent_structure_notes') or 'no notes'})",
        f"Available hours/week: {profile.get('available_hours') or 'unknown'}, "
        f"distribution: {profile.get('hours_distribution') or 'not specified'}",
        f"Setup: {profile.get('training_setup') or 'not specified'}, "
        f"power source: {profile.get('power_source') or 'not specified'}",
        f"Constraints: {profile.get('constraints') or 'none stated'}",
        f"Sex: {profile.get('sex') or 'not specified'}, height: {profile.get('height_cm') or 'unknown'} cm, "
        f"weight: {profile.get('weight_kg') or 'unknown'} kg",
        f"Weight goal: {profile.get('weight_goal') or 'not specified'}",
        f"Lifestyle activity level: {profile.get('lifestyle_activity_level') or 'not specified'}",
        f"Dietary restrictions: {profile.get('dietary_restrictions') or 'none stated'}",
        f"Eating pattern: {profile.get('eating_pattern') or 'not specified'}",
        f"Timezone: {profile.get('timezone') or 'not specified'}, "
        f"wake time: {profile.get('wake_time') or 'not specified'}",
        f"Check-in preference: {profile.get('checkin_intensity') or 'not specified'}",
    ]
    return "\n".join(lines)


ATHLETE_SUMMARY_PROMPT = """Write a short note recapping this athlete's intake profile below - 3-4
sentences stating the hard facts: their goal event and date, the key numbers (FTP, weight, available
hours), and anything they explicitly told you (constraints, preferences, schedule). Don't classify or
characterize the athlete - no skill-level labels ("beginner/intermediate/advanced"), no judgments about
their fitness, build, or ability ("respectable", "solid base", "good shape", etc). State what's true, not
an opinion of them. Plain prose, no headers, no bullet points, no bold text."""


def generate_athlete_summary(profile: dict) -> str:
    context = _profile_context_summary(profile)
    resp = _client().messages.create(
        model=CHAT_MODEL,
        max_tokens=400,
        thinking=NO_THINKING,
        system=ATHLETE_SUMMARY_PROMPT,
        messages=[{"role": "user", "content": f"ATHLETE PROFILE:\n{context}"}],
    )
    return "\n\n".join(
        block.text.strip() for block in resp.content if block.type == "text" and block.text.strip()
    )


GENERATE_PROGRAMME_PROMPT = """You are Coach, building a day-by-day training and nutrition programme for
an athlete based on their profile and planning notes below. Today's date is {today}.

Decide the right length for this block yourself: if their goal event is 5 weeks or less away, cover every
day from tomorrow through the event (including a taper). Otherwise, build a focused ~4-week block (28
days) leading toward their goal - you don't need to plan all the way to the event in one shot, this block
will be refreshed later.

For each day, decide the training session (or explicitly a rest/recovery day) appropriate for their
experience level, available hours, weekly hours distribution, and current form - apply real periodization
(progressive overload, a down week roughly every 3-4 weeks, taper before the event if it falls in this
block). Pair it with nutrition guidance sized to that day's training load and their profile (weight, goal,
eating pattern) - including explicit daily targets for calories, protein, carbs, and fat, not just prose,
scaled up on hard/long days and down on rest days.

Break the block into named phases (e.g. "Build Block", "Recovery Week", "Taper Block") that together cover
every day you generate with no gaps or overlaps, in chronological order. Each phase needs a one-sentence
purpose - what it's for and why it's placed there. Call set_programme once with the full block."""

GENERATE_PROGRAMME_TOOL = {
    "name": "set_programme",
    "description": "Save the generated day-by-day training and nutrition programme.",
    "input_schema": {
        "type": "object",
        "properties": {
            "programme_notes": {
                "type": "string",
                "description": "A short paragraph explaining the overall approach/periodization for this block.",
            },
            "phases": {
                "type": "array",
                "description": (
                    "The named phases making up this block, in chronological order, covering every day "
                    "with no gaps or overlaps."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "e.g. 'Build Block', 'Taper Block'."},
                        "purpose": {"type": "string", "description": "One sentence: what this phase is for."},
                        "start_date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
                        "end_date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
                    },
                    "required": ["name", "purpose", "start_date", "end_date"],
                },
            },
            "days": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
                        "training_summary": {
                            "type": "string",
                            "description": "Short one-line summary for a table cell, e.g. 'Endurance ride, 90min Z2'.",
                        },
                        "training_detail": {
                            "type": "string",
                            "description": "Full session description: warm-up, main set, cooldown, target zones, notes.",
                        },
                        "training_duration_mins": {"type": "integer"},
                        "training_load": {"type": "integer", "description": "Estimated training load (TSS-like)."},
                        "nutrition_summary": {
                            "type": "string",
                            "description": "Short one-line nutrition note for the table.",
                        },
                        "nutrition_detail": {
                            "type": "string",
                            "description": "Fuel plan for the day: pre/during/post-ride nutrition, daily targets.",
                        },
                        "calories": {"type": "integer", "description": "Total daily calorie target, kcal."},
                        "protein_g": {"type": "integer", "description": "Daily protein target, grams."},
                        "carbs_g": {"type": "integer", "description": "Daily carbohydrate target, grams."},
                        "fat_g": {"type": "integer", "description": "Daily fat target, grams."},
                    },
                    "required": [
                        "date",
                        "training_summary",
                        "training_detail",
                        "nutrition_summary",
                        "nutrition_detail",
                        "calories",
                        "protein_g",
                        "carbs_g",
                        "fat_g",
                    ],
                },
            },
        },
        "required": ["days", "phases"],
    },
}


def generate_training_programme(profile: dict, notes: str) -> dict:
    context = _profile_context_summary(profile)
    system = GENERATE_PROGRAMME_PROMPT.format(today=date.today().isoformat())
    resp = _client().messages.create(
        model=PROGRAMME_MODEL,
        max_tokens=16000,
        thinking=NO_THINKING,
        system=system,
        tools=[GENERATE_PROGRAMME_TOOL],
        tool_choice={"type": "tool", "name": "set_programme"},
        messages=[
            {
                "role": "user",
                "content": f"ATHLETE PROFILE:\n{context}\n\nPLANNING NOTES:\n{notes or '(none)'}",
            }
        ],
    )
    for block in resp.content:
        if block.type == "tool_use" and block.name == "set_programme":
            data = dict(block.input)
            return {
                "notes": data.get("programme_notes", ""),
                "phases": data.get("phases", []),
                "days": data.get("days", []),
            }
    return {"notes": "", "phases": [], "days": []}


COACH_CHAT_SYSTEM_PROMPT = (
    COACH_PERSONA
    + """

You're chatting with them over Telegram. Their profile and what you've learned about them are
below; use it and your judgement to answer training and nutrition questions as the one coach who
covers both. When you learn something worth keeping - a niggle, a life constraint, a preference, a
goal shift, how a block actually went - call remember so it sticks. Don't remember trivia or
things already in their profile.

Building a training plan - follow this exactly:
1. When the athlete wants a training plan (or it's clearly time to build one), first have a quick
   back-and-forth to confirm anything time-sensitive - upcoming travel or races, current fatigue or
   form, illness or niggles, which days suit hard rides or rest. Keep it light, don't interrogate.
2. Once you have enough, call generate_plan with a short notes summary. This DRAFTS a full day-by-day
   training and nutrition plan. It is NOT saved and does NOT appear on their dashboard yet.
3. After it drafts, run through the plan with the athlete in plain language - the overall approach, the
   phases and why, how the weeks build, the key sessions, roughly how the fuelling scales. Then ask if
   it works for them. DO NOT save it yet.
4. Only call generate_plan again if the athlete actually asks for changes - redrafting is a slow,
   expensive step, so don't rerun it just because they said yes or "looks good". Once they're happy
   with the drafted plan, do NOT redraft; move to step 5.
5. Saving needs TWO separate agreements. First the athlete has to be happy with the plan itself. Then
   you tell them plainly that you're about to save it to their dashboard and ask them to confirm. Only
   after they clearly say yes to saving do you call save_plan. Never call save_plan before the athlete
   has seen a drafted plan and explicitly approved saving it to the dashboard."""
)

COACH_GENERATE_PLAN_TOOL = {
    "name": "generate_plan",
    "description": (
        "Draft (but do NOT save) a full day-by-day training and nutrition plan for the athlete, using "
        "the notes you've gathered. Call this only after a quick check-in, when the athlete wants a "
        "plan. The drafted plan is held privately for review - it does not appear on their dashboard."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "notes": {
                "type": "string",
                "description": (
                    "Short summary of everything relevant to building the plan: schedule preferences, "
                    "constraints, current form/fatigue, upcoming travel or events."
                ),
            }
        },
        "required": ["notes"],
    },
}

COACH_SAVE_PLAN_TOOL = {
    "name": "save_plan",
    "description": (
        "Save the currently drafted plan to the athlete's dashboard so they can see it. Only call after "
        "the athlete has reviewed the drafted plan, is happy with it, and has explicitly agreed to save "
        "it to the dashboard. If no plan has been drafted yet, do not call this."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

REMEMBER_TOOL = {
    "name": "remember",
    "description": (
        "Save a durable fact about this athlete that's worth carrying into future conversations - "
        "a niggle or injury, a life/schedule constraint, a preference, a goal shift, how a training "
        "block actually went, anything that helps you coach them as a person. Don't use it for "
        "trivia or for things already in their profile."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "fact": {
                "type": "string",
                "description": "One concise fact to remember, phrased so it stands on its own later.",
            }
        },
        "required": ["fact"],
    },
}

COACH_CHAT_TOOLS = [COACH_GENERATE_PLAN_TOOL, COACH_SAVE_PLAN_TOOL, REMEMBER_TOOL]


def run_coach_conversation(messages, profile, memory_text, generate_plan, save_plan, remember):
    """Drive one Telegram coach turn (Sonnet) with a small tool loop.

    ``messages`` is the plain text history (list of {"role", "content"}) ending in the athlete's new
    message. ``memory_text`` is the block of facts the coach has remembered about this athlete.
    ``generate_plan(notes) -> str`` drafts a plan with Opus and returns a short summary for the coach
    to run through; ``save_plan() -> bool`` commits the currently drafted plan to the dashboard;
    ``remember(fact)`` persists a durable fact. Returns the coach's reply text to send back.
    """
    system = (
        f"{COACH_CHAT_SYSTEM_PROMPT}\n\nToday's date is {date.today().isoformat()}.\n\n"
        f"ATHLETE PROFILE:\n{_profile_context_summary(profile)}\n\n"
        f"WHAT YOU'VE LEARNED ABOUT THEM OVER TIME:\n{memory_text or '(nothing yet)'}"
    )
    convo = [{"role": m["role"], "content": m["content"]} for m in messages]
    client = _client()
    final_text = ""

    for _ in range(6):  # safety cap on tool round-trips within a single turn
        resp = client.messages.create(
            model=CHAT_MODEL,
            max_tokens=1024,
            thinking=NO_THINKING,
            system=system,
            tools=COACH_CHAT_TOOLS,
            messages=convo,
        )
        text = "\n\n".join(
            b.text.strip() for b in resp.content if b.type == "text" and b.text.strip()
        )
        if text:
            final_text = text

        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            break

        convo.append({"role": "assistant", "content": resp.content})
        results = []
        for tu in tool_uses:
            if tu.name == "generate_plan":
                summary = generate_plan(dict(tu.input).get("notes", ""))
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": summary})
            elif tu.name == "save_plan":
                ok = save_plan()
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": (
                            "Plan saved to the dashboard."
                            if ok
                            else "There's no drafted plan to save yet - draft one and get the athlete's "
                            "approval first."
                        ),
                    }
                )
            elif tu.name == "remember":
                remember(dict(tu.input).get("fact", ""))
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": "Noted."})
        convo.append({"role": "user", "content": results})

    return final_text or "Sorry, something went wrong on my end - say that again?"


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


def _todays_programme_day(conn: sqlite3.Connection, day: str | None = None) -> sqlite3.Row | None:
    day = day or date.today().isoformat()
    return conn.execute("SELECT * FROM programme_days WHERE date = ?", (day,)).fetchone()


def _programme_day_line(row: sqlite3.Row | None) -> str:
    if row is None or not (row["training_summary"] or "").strip():
        return "Nothing on the plan for that day."
    mins = row["training_duration_mins"]
    dur = f", ~{mins} min" if mins else ""
    fuel = ""
    if row["calories"]:
        fuel = (
            f" Fuel: ~{row['calories']} kcal, {row['protein_g']}g P / "
            f"{row['carbs_g']}g C / {row['fat_g']}g F."
        )
    return f"{row['training_summary']}{dur}.{fuel}".strip()


def _athlete_knowledge(conn: sqlite3.Connection) -> str:
    profile = get_profile(conn)
    if profile is not None and profile["profile_summary"]:
        who = profile["profile_summary"]
    elif profile is not None:
        who = _profile_context_summary(dict(profile))
    else:
        who = "No profile set yet."
    return (
        f"WHO THEY ARE\n{who}\n\n"
        f"WHAT YOU'VE LEARNED ABOUT THEM OVER TIME\n{memory_block(conn)}"
    )


def _recent_conversation_block(conn: sqlite3.Connection, turns: int = 8) -> str:
    history = recent_turns(conn, turns)
    if not history:
        return "(you haven't spoken recently)"
    lines = []
    for m in history:
        speaker = "You" if m["role"] == "assistant" else "Athlete"
        lines.append(f"{speaker}: {m['content']}")
    return "\n".join(lines)


def build_coach_context(conn: sqlite3.Connection) -> str:
    return (
        f"{_athlete_knowledge(conn)}\n\n"
        f"WHAT THEY'VE ACTUALLY BEEN DOING (last 14 days)\n{_recent_activities_summary(conn)}"
    )


def run_coach_brief(conn: sqlite3.Connection) -> str:
    """The unified coach's-thoughts note shown on the dashboard."""
    context = build_coach_context(conn)
    resp = _client().messages.create(
        model=CHAT_MODEL,
        max_tokens=600,
        thinking=NO_THINKING,
        system=COACH_BRIEF_PROMPT,
        messages=[{"role": "user", "content": context}],
    )
    return "\n\n".join(
        b.text.strip() for b in resp.content if b.type == "text" and b.text.strip()
    )


def _initiation_instruction(conn: sqlite3.Connection, trigger: dict) -> str:
    kind = trigger.get("kind")
    if kind == "morning":
        today = _programme_day_line(_todays_programme_day(conn))
        return (
            "It's the start of the athlete's day. Reach out with a warm, brief morning check-in - "
            "how they're feeling and what their plans (training and meals) are for today. "
            f"On the plan today: {today}"
        )
    if kind == "post_workout":
        a = trigger.get("activity") or {}
        mins = round((a.get("duration_secs") or 0) / 60)
        km = round((a.get("distance_m") or 0) / 1000, 1)
        return (
            "The athlete just finished a workout - reach out to see how it went and how they're "
            f"feeling, referencing the actual ride. It was: {a.get('type') or 'a session'} "
            f"'{a.get('name') or 'workout'}', {mins} min, {km} km."
        )
    if kind == "missed_workout":
        planned = trigger.get("planned") or "a session"
        return (
            "The athlete had a session planned today that they don't seem to have done. Reach out - "
            "no nagging or guilt-tripping, just check in on what happened and how they're doing. "
            f"The planned session was: {planned}"
        )
    return "Reach out to the athlete with a brief, warm check-in."


def run_coach_initiation(conn: sqlite3.Connection, trigger: dict) -> str:
    """Produce the opening message for a proactive check-in (morning / post-workout / missed).

    Pure text generation - the caller is responsible for dedupe, persisting the turn, and sending.
    """
    system = (
        f"{COACH_PERSONA}\n\n"
        "You are reaching out to the athlete first, unprompted - the way a coach who cares checks "
        "in on their athletes. Send ONE short, natural opening message. Don't announce that you're "
        "checking in ('just checking in on...') - just talk to them like a person.\n\n"
        f"Today's date is {date.today().isoformat()}.\n\n"
        f"{_athlete_knowledge(conn)}\n\n"
        f"WHAT THEY'VE ACTUALLY BEEN DOING (last 14 days)\n{_recent_activities_summary(conn)}\n\n"
        f"YOUR RECENT CONVERSATION\n{_recent_conversation_block(conn)}"
    )
    resp = _client().messages.create(
        model=CHAT_MODEL,
        max_tokens=512,
        thinking=NO_THINKING,
        system=system,
        messages=[{"role": "user", "content": _initiation_instruction(conn, trigger)}],
    )
    text = "\n\n".join(
        b.text.strip() for b in resp.content if b.type == "text" and b.text.strip()
    )
    return text or "Hey - how are you doing today?"
