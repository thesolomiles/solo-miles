from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid

from fastapi import HTTPException, Request, Response

from app.config import settings

COOKIE_NAME = "coach_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days

# Guest data never touches the real DB - it lives here for the life of the process.
GUEST_PROFILES: dict[str, dict] = {}


def _sign(payload: bytes) -> str:
    secret = settings.session_secret.encode()
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def create_session_token(data: dict) -> str:
    body = {**data, "exp": int(time.time()) + SESSION_TTL_SECONDS}
    payload = base64.urlsafe_b64encode(json.dumps(body).encode()).decode()
    signature = _sign(payload.encode())
    return f"{payload}.{signature}"


def verify_session_token(token: str) -> dict | None:
    try:
        payload, signature = token.split(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(_sign(payload.encode()), signature):
        return None
    try:
        body = json.loads(base64.urlsafe_b64decode(payload.encode()))
    except (ValueError, json.JSONDecodeError):
        return None
    if body.get("exp", 0) < time.time():
        return None
    return body


def get_session(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return verify_session_token(token)


def set_session_cookie(response: Response, data: dict) -> None:
    token = create_session_token(data)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME)


def check_owner_credentials(username: str, password: str) -> bool:
    if not settings.owner_username or not settings.owner_password:
        return False
    return secrets.compare_digest(username, settings.owner_username) and secrets.compare_digest(
        password, settings.owner_password
    )


def new_guest_id() -> str:
    guest_id = str(uuid.uuid4())
    GUEST_PROFILES[guest_id] = {}
    return guest_id


def require_session(request: Request) -> dict:
    session = get_session(request)
    if session is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return session


def require_owner(request: Request) -> dict:
    session = require_session(request)
    if session.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return session
