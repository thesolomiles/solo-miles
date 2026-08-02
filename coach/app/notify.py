"""Send Telegram messages from any process.

Sending a Telegram message is a stateless HTTPS call, so both the web process (Strava
webhook) and the bot process (scheduler) can push proactive messages without going through
the polling bot - only receiving replies needs that. This is the one place that talks to
Telegram's sendMessage API.
"""
from __future__ import annotations

import logging

import requests

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_MSG_LIMIT = 4000


def chunk_message(text: str, limit: int = TELEGRAM_MSG_LIMIT) -> list[str]:
    """Split a reply into Telegram-sized chunks, preferring paragraph boundaries."""
    text = (text or "").strip()
    if not text:
        return ["…"]
    if len(text) <= limit:
        return [text]

    chunks: list[str] = []
    current = ""
    for para in text.split("\n\n"):
        if current and len(current) + len(para) + 2 > limit:
            chunks.append(current.strip())
            current = ""
        current += para + "\n\n"
        while len(current) > limit:
            chunks.append(current[:limit])
            current = current[limit:]
    if current.strip():
        chunks.append(current.strip())
    return chunks


def send_message(chat_id: str, text: str) -> bool:
    """Send `text` to `chat_id`, chunking as needed. Returns True on success."""
    if not settings.telegram_bot_token or not chat_id:
        logger.warning("Cannot send Telegram message: missing bot token or chat id")
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    ok = True
    for chunk in chunk_message(text):
        try:
            resp = requests.post(url, json={"chat_id": chat_id, "text": chunk}, timeout=15)
            resp.raise_for_status()
        except Exception:
            logger.exception("Failed to send Telegram message")
            ok = False
    return ok
