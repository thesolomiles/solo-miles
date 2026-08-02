from __future__ import annotations

import asyncio
import logging
from datetime import datetime, time as dtime
from zoneinfo import ZoneInfo

import requests
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from app.agents import generate_training_programme, run_coach_brief, run_coach_conversation
from app.checkin import deliver_checkin
from app.config import settings
from app.db import db_session, init_db
from app.memory import add_memory, append_turn, clear_conversation, memory_block, recent_turns
from app.notify import chunk_message
from app.profile import get_profile, is_onboarding_complete, set_telegram_chat_id
from app.programme import save_programme
from app.sync import sync_strava

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_bot_username_cache: str | None = None

# A plan drafted by Opus but not yet saved to the dashboard - it lives here until the athlete
# explicitly approves saving it (or the process restarts). Conversation history now lives in the
# DB (app.memory), so it survives restarts; only this transient draft is held in memory.
_pending_plans: dict[str, dict] = {}

# Scheduler: one repeating tick drives the time-based check-ins. All decisions read live DB
# state so it self-heals across restarts and profile edits.
TICK_SECONDS = 300
MISSED_EVENING_HOUR = 20  # local hour after which a still-undone planned session counts as missed


def get_bot_username() -> str | None:
    """Fetch (and cache) the bot's @username so the web app can build a t.me deep link."""
    global _bot_username_cache
    if _bot_username_cache:
        return _bot_username_cache
    if not settings.telegram_bot_token:
        return None
    try:
        resp = requests.get(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/getMe", timeout=10
        )
        resp.raise_for_status()
        _bot_username_cache = resp.json()["result"]["username"]
        return _bot_username_cache
    except Exception:
        logger.exception("Failed to fetch Telegram bot username")
        return None


def _summarize_plan_for_chat(plan: dict) -> str:
    """Full-but-compact view of a drafted plan, fed back so the coach can run through it in one turn.

    Includes every day (as a one-liner) so the coach never needs to redraft just to see the detail -
    redrafting would overwrite the very plan the athlete is reviewing, so it must not happen on its own.
    """
    days = plan.get("days", [])
    phases = plan.get("phases", [])
    lines: list[str] = ["This is the full drafted plan. Do not call generate_plan again to see detail."]
    if plan.get("notes"):
        lines.append(f"Overall approach: {plan['notes']}")
    if days:
        lines.append(f"Covers {len(days)} days, {days[0]['date']} to {days[-1]['date']}.")
    for ph in phases:
        lines.append(
            f"\nPhase '{ph.get('name')}' ({ph.get('start_date')} - {ph.get('end_date')}): "
            f"{ph.get('purpose')}"
        )
    lines.append("\nDay by day:")
    for d in days:
        lines.append(
            f"{d.get('date')}: {d.get('training_summary', '-')} "
            f"(~{d.get('training_load', '?')} TSS) | "
            f"{d.get('calories', '?')} kcal, {d.get('protein_g', '?')}g P / "
            f"{d.get('carbs_g', '?')}g C / {d.get('fat_g', '?')}g F"
        )
    return "\n".join(lines) or "Plan drafted."


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    with db_session() as conn:
        set_telegram_chat_id(conn, str(update.effective_chat.id))
        onboarded = is_onboarding_complete(conn)

    if onboarded:
        await update.message.reply_text(
            "Hey, I'm your coach - training and nutrition both. Just talk to me like you would a real "
            "coach: ask about your training, your fuelling, or tell me when you want me to build you a "
            "plan. I'll also check in with you as things happen. /brief anytime for my current read on you."
        )
    else:
        await update.message.reply_text(
            "Almost there - finish setting up your profile here first, "
            f"then come back and message me:\n{settings.web_base_url}"
        )


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = str(update.effective_chat.id)
    _pending_plans.pop(chat_id, None)
    with db_session() as conn:
        clear_conversation(conn)
    await update.message.reply_text("Fresh start - what's on your mind?")


async def brief(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    with db_session() as conn:
        if not is_onboarding_complete(conn):
            await update.message.reply_text(
                f"Finish setting up your profile first: {settings.web_base_url}"
            )
            return

    await update.message.reply_text("Pulling your latest rides...")

    with db_session() as conn:
        try:
            sync_strava(conn)
        except Exception:
            logger.exception("strava sync failed")

    text = await asyncio.to_thread(_run_brief)
    for chunk in chunk_message(text):
        await update.message.reply_text(chunk)


def _run_brief() -> str:
    with db_session() as conn:
        return run_coach_brief(conn)


async def coach_chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Free-form conversation with the coach. Any non-command text lands here."""
    if not update.message or not update.message.text:
        return
    user_text = update.message.text.strip()
    if not user_text:
        return

    chat_id = str(update.effective_chat.id)

    with db_session() as conn:
        set_telegram_chat_id(conn, chat_id)
        if not is_onboarding_complete(conn):
            await update.message.reply_text(
                f"Finish setting up your profile first, then we can talk: {settings.web_base_url}"
            )
            return
        profile = dict(get_profile(conn))
        append_turn(conn, "user", user_text)
        history = recent_turns(conn)
        memory_text = memory_block(conn)

    loop = asyncio.get_running_loop()

    def generate_plan(notes: str) -> str:
        # Building the plan runs Opus and can take a while - let the athlete know.
        asyncio.run_coroutine_threadsafe(
            update.message.reply_text("Putting your plan together - give me a minute…"), loop
        )
        plan = generate_training_programme(profile, notes)
        _pending_plans[chat_id] = plan
        return _summarize_plan_for_chat(plan)

    def save_plan() -> bool:
        plan = _pending_plans.get(chat_id)
        if not plan or not plan.get("days"):
            return False
        with db_session() as conn:
            save_programme(
                conn, plan.get("notes", ""), plan.get("phases", []), plan.get("days", [])
            )
        _pending_plans.pop(chat_id, None)
        return True

    def remember(fact: str) -> None:
        with db_session() as conn:
            add_memory(conn, fact, source="chat")

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    try:
        reply = await asyncio.to_thread(
            run_coach_conversation, history, profile, memory_text, generate_plan, save_plan, remember
        )
    except Exception:
        logger.exception("coach chat failed")
        # Drop the user turn we couldn't answer so it doesn't wedge the stored history.
        with db_session() as conn:
            conn.execute("DELETE FROM conversation WHERE id = (SELECT MAX(id) FROM conversation)")
        await update.message.reply_text("Something went wrong on my end. Try that again in a moment.")
        return

    with db_session() as conn:
        append_turn(conn, "assistant", reply)

    for chunk in chunk_message(reply):
        await update.message.reply_text(chunk)


# ---------------------------------------------------------------------------
# Proactive scheduler
# ---------------------------------------------------------------------------


def _local_now(profile) -> datetime:
    tz = profile["timezone"]
    try:
        zone = ZoneInfo(tz) if tz else ZoneInfo("UTC")
    except Exception:
        zone = ZoneInfo("UTC")
    return datetime.now(zone)


def _parse_hhmm(value: str | None, default: dtime) -> dtime:
    try:
        hh, mm = str(value).split(":")
        return dtime(int(hh), int(mm))
    except Exception:
        return default


def _is_real_session(day: dict) -> bool:
    summary = (day.get("training_summary") or "").strip()
    if not summary:
        return False
    if any(word in summary.lower() for word in ("rest", "day off", "off day")):
        return False
    return bool(day.get("training_load") or day.get("training_duration_mins"))


def _planned_line(day: dict) -> str:
    mins = day.get("training_duration_mins")
    dur = f", ~{mins} min" if mins else ""
    return f"{day.get('training_summary')}{dur}"


def _run_triggers() -> None:
    """Evaluate time-based check-ins against current DB state. Runs in a worker thread."""
    with db_session() as conn:
        profile = get_profile(conn)
        if profile is None or not profile["telegram_chat_id"] or not is_onboarding_complete(conn):
            return
        now = _local_now(profile)
        today = now.date().isoformat()
        wake = _parse_hhmm(profile["wake_time"], dtime(7, 0))
        day_row = conn.execute(
            "SELECT * FROM programme_days WHERE date = ?", (today,)
        ).fetchone()
        day = dict(day_row) if day_row else None
        did_today = (
            conn.execute(
                "SELECT 1 FROM activities WHERE substr(start_date, 1, 10) = ? LIMIT 1",
                (today,),
            ).fetchone()
            is not None
        )

    # deliver_checkin dedupes on (kind, ref), so calling every tick is safe.
    if now.time() >= wake:
        deliver_checkin("morning", today, {"kind": "morning"})

    if now.hour >= MISSED_EVENING_HOUR and day and _is_real_session(day) and not did_today:
        deliver_checkin(
            "missed_workout", today, {"kind": "missed_workout", "planned": _planned_line(day)}
        )


async def tick(context: ContextTypes.DEFAULT_TYPE) -> None:
    try:
        await asyncio.to_thread(_run_triggers)
    except Exception:
        logger.exception("scheduler tick failed")


def main() -> None:
    init_db()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set in .env")

    application = Application.builder().token(settings.telegram_bot_token).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("brief", brief))
    application.add_handler(CommandHandler("reset", reset))
    # Any plain text (not a command) is a message to the coach.
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, coach_chat))

    if application.job_queue is not None:
        application.job_queue.run_repeating(tick, interval=TICK_SECONDS, first=15)
    else:
        logger.warning("JobQueue unavailable - proactive check-ins disabled. Install python-telegram-bot[job-queue].")

    application.run_polling()


if __name__ == "__main__":
    main()
