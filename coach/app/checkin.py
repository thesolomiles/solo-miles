"""Deliver a proactive coach check-in.

Both proactive paths - the bot's scheduler (morning, missed-workout) and the web webhook
(post-workout) - funnel through here so a check-in is generated, recorded in the conversation,
deduped, and sent in one consistent way regardless of which process initiated it.
"""
from __future__ import annotations

import logging

from app.agents import run_coach_initiation
from app.db import db_session
from app.memory import append_turn, log_checkin
from app.notify import send_message
from app.profile import get_profile, is_onboarding_complete

logger = logging.getLogger(__name__)


def deliver_checkin(kind: str, ref: str, trigger: dict) -> bool:
    """Generate and send a proactive check-in.

    `kind`/`ref` are the dedupe key (see the checkins table). Returns True if a message was
    sent, False if it was skipped (not onboarded, no Telegram link, or already sent).
    """
    with db_session() as conn:
        profile = get_profile(conn)
        if profile is None or not profile["telegram_chat_id"] or not is_onboarding_complete(conn):
            return False
        chat_id = profile["telegram_chat_id"]

        # Claim the check-in first so a concurrent tick / webhook retry can't double-send.
        # If generation fails below, the exception rolls back this claim (db_session only
        # commits on a clean exit), leaving it free to retry next time.
        if not log_checkin(conn, kind, ref):
            return False

        text = run_coach_initiation(conn, trigger)
        append_turn(conn, "assistant", text)

    return send_message(chat_id, text)
