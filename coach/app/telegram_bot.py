from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from app.agents import run_coach, run_nutritionist
from app.config import settings
from app.db import db_session, init_db
from app.profile import is_onboarding_complete, set_telegram_chat_id
from app.sync import sync_intervals, sync_strava

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    with db_session() as conn:
        set_telegram_chat_id(conn, str(update.effective_chat.id))
        onboarded = is_onboarding_complete(conn)

    if onboarded:
        await update.message.reply_text(
            "Welcome back. Use /brief anytime for your coach + nutrition brief."
        )
    else:
        await update.message.reply_text(
            "Almost there - finish setting up your profile here first, "
            f"then come back and message me:\n{settings.web_base_url}"
        )


async def brief(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    with db_session() as conn:
        if not is_onboarding_complete(conn):
            await update.message.reply_text(
                f"Finish setting up your profile first: {settings.web_base_url}"
            )
            return

    await update.message.reply_text("Pulling latest data...")

    with db_session() as conn:
        try:
            sync_intervals(conn)
        except Exception:
            logger.exception("intervals sync failed")
        try:
            sync_strava(conn)
        except Exception:
            logger.exception("strava sync failed")

    with db_session() as conn:
        coach_text = run_coach(conn)
        nutrition_text = run_nutritionist(conn)

    await update.message.reply_text(f"\U0001f6b4 Coach:\n\n{coach_text}")
    await update.message.reply_text(f"\U0001f957 Nutritionist:\n\n{nutrition_text}")


def main() -> None:
    init_db()
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set in .env")

    application = Application.builder().token(settings.telegram_bot_token).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("brief", brief))

    application.run_polling()


if __name__ == "__main__":
    main()
