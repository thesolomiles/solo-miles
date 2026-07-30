import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


class Settings:
    intervals_api_key: str = os.environ.get("INTERVALS_API_KEY", "")
    intervals_athlete_id: str = os.environ.get("INTERVALS_ATHLETE_ID", "0")
    database_path: str = os.environ.get("DATABASE_PATH", str(BASE_DIR / "data" / "coach.db"))
    strava_client_id: str = os.environ.get("STRAVA_CLIENT_ID", "")
    strava_client_secret: str = os.environ.get("STRAVA_CLIENT_SECRET", "")
    strava_redirect_uri: str = os.environ.get(
        "STRAVA_REDIRECT_URI", "http://localhost:8008/strava/callback"
    )
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    telegram_bot_token: str = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.environ.get("TELEGRAM_CHAT_ID", "")
    web_base_url: str = os.environ.get("WEB_BASE_URL", "http://localhost:8008")

    owner_username: str = os.environ.get("OWNER_USERNAME", "")
    owner_password: str = os.environ.get("OWNER_PASSWORD", "")
    session_secret: str = os.environ.get("SESSION_SECRET", "")
    cookie_secure: bool = os.environ.get("COOKIE_SECURE", "false").lower() == "true"


settings = Settings()
