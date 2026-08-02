import json
import logging
from datetime import date, timedelta
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.agents import (
    generate_athlete_summary,
    run_coach_brief,
    run_onboarding_chat,
)
from app.auth import (
    check_owner_credentials,
    clear_session_cookie,
    get_session,
    require_session,
    set_session_cookie,
)
from app.checkin import deliver_checkin
from app.config import settings
from app.db import db_session, init_db
from app.profile import (
    clear_onboarding,
    get_profile,
    is_onboarding_complete,
    save_profile_summary,
    upsert_onboarding_profile,
)
from app.programme import get_programme
from app.schemas import (
    LoginPayload,
    OnboardingChatPayload,
    OnboardingPayload,
)
from app.strava_client import build_authorize_url, exchange_code_for_tokens
from app.sync import sync_one_strava_activity, sync_strava
from app.telegram_bot import get_bot_username

logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).resolve().parent.parent / "web"

app = FastAPI(title="Coach")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/login")
def login(payload: LoginPayload, response: Response):
    if not check_owner_credentials(payload.username, payload.password):
        return Response(status_code=401, content='{"detail":"Invalid credentials"}', media_type="application/json")
    set_session_cookie(response)
    return {"status": "ok"}


@app.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"status": "ok"}


@app.get("/auth/session")
def auth_session(request: Request):
    return {"authenticated": get_session(request) is not None}


@app.get("/strava/authorize")
def strava_authorize(_=Depends(require_session)):
    return RedirectResponse(build_authorize_url())


@app.get("/strava/callback")
def strava_callback(code: str, _=Depends(require_session)):
    with db_session() as conn:
        exchange_code_for_tokens(conn, code)
    return RedirectResponse("/")


@app.post("/sync/strava")
def sync_strava_route(days_back: int = 14, _=Depends(require_session)):
    with db_session() as conn:
        return sync_strava(conn, days_back=days_back)


@app.get("/strava/webhook")
def strava_webhook_verify(request: Request):
    """Strava subscription handshake: echo hub.challenge when the verify token matches."""
    params = request.query_params
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == settings.strava_verify_token
    ):
        return JSONResponse({"hub.challenge": params.get("hub.challenge")})
    return Response(status_code=403)


def _process_strava_event(object_id: int, aspect_type: str) -> None:
    """Handle a Strava activity event: sync the activity, then have the coach check in.

    Runs as a background task so the webhook can return 200 within Strava's ~2s window.
    """
    if aspect_type != "create":
        return
    try:
        with db_session() as conn:
            activity = sync_one_strava_activity(conn, object_id)
            profile = get_profile(conn)
        if activity is None or profile is None:
            return
        # Respect the athlete's check-in preference: only ping for bigger efforts if they
        # asked for big-moments-only.
        if profile["checkin_intensity"] == "big_moments_only" and not _is_big_effort(activity):
            return
        deliver_checkin(
            "post_workout", activity["id"], {"kind": "post_workout", "activity": activity}
        )
    except Exception:
        logger.exception("Failed to process Strava webhook event for activity %s", object_id)


def _is_big_effort(activity: dict) -> bool:
    mins = (activity.get("duration_secs") or 0) / 60
    km = (activity.get("distance_m") or 0) / 1000
    return mins >= 90 or km >= 40


@app.post("/strava/webhook")
async def strava_webhook_event(request: Request, background_tasks: BackgroundTasks):
    """Receive a Strava event, ack fast, and defer the real work to a background task."""
    try:
        event = await request.json()
    except Exception:
        return Response(status_code=200)
    if event.get("object_type") == "activity" and event.get("object_id") is not None:
        background_tasks.add_task(
            _process_strava_event, event["object_id"], event.get("aspect_type", "")
        )
    return PlainTextResponse("ok")


@app.get("/connections/status")
def connections_status(_=Depends(require_session)):
    with db_session() as conn:
        row = get_profile(conn)
    bot_username = get_bot_username()
    return {
        "strava_connected": bool(row and row["strava_refresh_token"]),
        "telegram_connected": bool(row and row["telegram_chat_id"]),
        "telegram_link": f"https://t.me/{bot_username}" if bot_username else None,
    }


@app.get("/onboarding/status")
def onboarding_status(_=Depends(require_session)):
    with db_session() as conn:
        return {"completed": is_onboarding_complete(conn)}


@app.post("/onboarding/chat")
def onboarding_chat_route(payload: OnboardingChatPayload, _=Depends(require_session)):
    reply, draft, done = run_onboarding_chat(
        [m.dict() for m in payload.messages], payload.draft
    )
    return {"reply": reply, "draft": draft, "done": done}


@app.post("/onboarding/complete")
def onboarding_complete(payload: OnboardingPayload, _=Depends(require_session)):
    summary = generate_athlete_summary(payload.dict())
    with db_session() as conn:
        upsert_onboarding_profile(conn, payload.dict())
        save_profile_summary(conn, summary)
    return {"status": "ok"}


@app.post("/onboarding/reset")
def onboarding_reset(_=Depends(require_session)):
    with db_session() as conn:
        clear_onboarding(conn)
    return {"status": "ok"}


@app.get("/profile")
def profile(_=Depends(require_session)):
    return _current_profile()


def _current_profile() -> dict:
    with db_session() as conn:
        row = get_profile(conn)
        return dict(row) if row else {}


@app.get("/programme/status")
def programme_status(_=Depends(require_session)):
    with db_session() as conn:
        days = [dict(d) for d in conn.execute("SELECT date FROM programme_days ORDER BY date").fetchall()]
    if not days:
        return {"has_programme": False}
    return {
        "has_programme": True,
        "start_date": days[0]["date"],
        "end_date": days[-1]["date"],
        "days_count": len(days),
    }


@app.get("/programme")
def programme_get_route(_=Depends(require_session)):
    with db_session() as conn:
        return get_programme(conn)


def _actual_tss(conn, start_date: str, end_date: str) -> int:
    row = conn.execute(
        "SELECT SUM(load) AS total FROM activities WHERE substr(start_date, 1, 10) BETWEEN ? AND ?",
        (start_date, end_date),
    ).fetchone()
    return row["total"] or 0


def _activity_avg_hr(row):
    keys = row.keys()
    hr = row["avg_hr"] if "avg_hr" in keys else None
    # Fall back to the raw payload for rows synced before avg_hr was stored.
    if hr is None and "raw_json" in keys and row["raw_json"]:
        try:
            raw = json.loads(row["raw_json"])
        except (ValueError, TypeError):
            raw = {}
        hr = raw.get("average_heartrate") or raw.get("icu_average_hr")
    return round(hr) if hr else None


def _estimate_activity_tss(row, ftp: int):
    # Prefer the recorded load (TSS); otherwise estimate it from normalised power and FTP.
    if row["load"] is not None:
        return round(row["load"])
    power = row["np_power"] or row["avg_power"]
    if power and ftp and row["duration_secs"]:
        intensity = power / ftp
        return round(row["duration_secs"] * power * intensity / (ftp * 3600) * 100)
    return None


@app.get("/dashboard/overview")
def dashboard_overview(_=Depends(require_session)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_end = week_start + timedelta(days=6)

    with db_session() as conn:
        profile = get_profile(conn)
        latest = conn.execute(
            "SELECT * FROM activities ORDER BY start_date DESC LIMIT 1"
        ).fetchone()
        actual_secs = conn.execute(
            "SELECT COALESCE(SUM(duration_secs), 0) AS secs FROM activities "
            "WHERE substr(start_date, 1, 10) BETWEEN ? AND ?",
            (week_start.isoformat(), week_end.isoformat()),
        ).fetchone()["secs"]
        next_prog = conn.execute(
            "SELECT date, training_summary AS name, training_duration_mins, "
            "training_load AS load FROM programme_days "
            "WHERE date >= ? AND training_summary IS NOT NULL AND training_summary != '' "
            "ORDER BY date LIMIT 1",
            (today.isoformat(),),
        ).fetchone()
        prog_planned_mins = conn.execute(
            "SELECT COALESCE(SUM(training_duration_mins), 0) AS mins FROM programme_days "
            "WHERE date BETWEEN ? AND ?",
            (week_start.isoformat(), week_end.isoformat()),
        ).fetchone()["mins"]

    ftp = (profile["ftp"] if profile else None) or 0

    latest_activity = None
    if latest is not None:
        latest_activity = {
            "name": latest["name"],
            "type": latest["type"],
            "date": latest["start_date"],
            "duration_secs": latest["duration_secs"],
            "distance_m": latest["distance_m"],
            "avg_power": round(latest["np_power"] or latest["avg_power"]) if (latest["np_power"] or latest["avg_power"]) else None,
            "avg_hr": _activity_avg_hr(latest),
            "tss": _estimate_activity_tss(latest, ftp),
        }

    next_workout = None
    if next_prog is not None:
        mins = next_prog["training_duration_mins"] or 0
        next_workout = {
            "date": next_prog["date"],
            "name": next_prog["name"],
            "duration_secs": mins * 60 or None,
            "load": next_prog["load"],
        }

    # Planned weekly hours: prefer the programme, then the rider's stated weekly availability.
    if prog_planned_mins:
        planned_hours = round(prog_planned_mins / 60, 1)
    elif profile and profile["available_hours"]:
        planned_hours = round(profile["available_hours"], 1)
    else:
        planned_hours = None

    return {
        "latest_activity": latest_activity,
        "next_workout": next_workout,
        "ftp": ftp or None,
        "ftp_test_date": profile["ftp_test_date"] if profile else None,
        "weekly_hours": {
            "actual": round(actual_secs / 3600, 1),
            "planned": planned_hours,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
        },
    }


@app.get("/dashboard/tss-by-day")
def dashboard_tss_by_day(_=Depends(require_session)):
    with db_session() as conn:
        days = conn.execute("SELECT * FROM programme_days ORDER BY date").fetchall()
        return [
            {
                "date": day["date"],
                "projected_tss": day["training_load"] or 0,
                "actual_tss": _actual_tss(conn, day["date"], day["date"]),
            }
            for day in days
        ]


@app.get("/dashboard/tss-daily")
def dashboard_tss_daily(days_back: int = 90, _=Depends(require_session)):
    since = (date.today() - timedelta(days=days_back)).isoformat()
    with db_session() as conn:
        rows = conn.execute(
            "SELECT substr(start_date, 1, 10) AS date, load, np_power, avg_power, duration_secs "
            "FROM activities WHERE substr(start_date, 1, 10) >= ? ORDER BY start_date",
            (since,),
        ).fetchall()
        profile = get_profile(conn)

    ftp = (profile["ftp"] if profile else None) or 0

    def activity_tss(row) -> int:
        # Prefer the recorded load (TSS); otherwise estimate it from normalised power and FTP.
        if row["load"] is not None:
            return round(row["load"])
        power = row["np_power"] or row["avg_power"]
        if power and ftp and row["duration_secs"]:
            intensity = power / ftp
            return round(row["duration_secs"] * power * intensity / (ftp * 3600) * 100)
        return 0

    daily: dict[str, int] = {}
    for row in rows:
        daily[row["date"]] = daily.get(row["date"], 0) + activity_tss(row)

    return {
        "points": [{"date": d, "tss": t} for d, t in sorted(daily.items())],
        "goal_date": profile["goal_date"] if profile else None,
    }


@app.post("/dashboard/sync")
def dashboard_sync(_=Depends(require_session)):
    with db_session() as conn:
        try:
            strava_result = sync_strava(conn, days_back=90)
        except Exception as e:
            strava_result = {"error": str(e)}
    return {"strava": strava_result}


@app.get("/agents/coach/brief")
def coach_brief(_=Depends(require_session)):
    with db_session() as conn:
        return {"brief": run_coach_brief(conn)}


@app.get("/debug/activities")
def debug_activities(_=Depends(require_session)):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM activities ORDER BY start_date DESC").fetchall()
        return [dict(r) for r in rows]


# Mounted last so it only catches requests that don't match an API route above.
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
