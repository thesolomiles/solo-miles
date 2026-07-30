from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Request, Response
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.agents import run_coach, run_nutritionist
from app.auth import (
    GUEST_PROFILES,
    check_owner_credentials,
    clear_session_cookie,
    get_session,
    new_guest_id,
    require_owner,
    require_session,
    set_session_cookie,
)
from app.db import db_session, init_db
from app.profile import (
    clear_onboarding,
    get_profile,
    is_onboarding_complete,
    upsert_onboarding_profile,
)
from app.schemas import LoginPayload, OnboardingPayload
from app.strava_client import build_authorize_url, exchange_code_for_tokens
from app.sync import sync_intervals, sync_strava

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
    if payload.mode == "owner":
        if not check_owner_credentials(payload.username or "", payload.password or ""):
            return Response(status_code=401, content='{"detail":"Invalid credentials"}', media_type="application/json")
        set_session_cookie(response, {"role": "owner"})
        return {"role": "owner"}
    if payload.mode == "guest":
        guest_id = new_guest_id()
        set_session_cookie(response, {"role": "guest", "guest_id": guest_id})
        return {"role": "guest"}
    return Response(status_code=400, content='{"detail":"Invalid mode"}', media_type="application/json")


@app.post("/auth/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"status": "ok"}


@app.get("/auth/session")
def auth_session(request: Request):
    session = get_session(request)
    if session is None:
        return {"role": None}
    return {"role": session.get("role")}


@app.post("/sync/intervals")
def sync_intervals_route(days_back: int = 14, days_forward: int = 7, session=Depends(require_owner)):
    with db_session() as conn:
        return sync_intervals(conn, days_back=days_back, days_forward=days_forward)


@app.get("/strava/authorize")
def strava_authorize(session=Depends(require_owner)):
    return RedirectResponse(build_authorize_url())


@app.get("/strava/callback")
def strava_callback(code: str, session=Depends(require_owner)):
    with db_session() as conn:
        exchange_code_for_tokens(conn, code)
    return {"status": "strava connected"}


@app.post("/sync/strava")
def sync_strava_route(days_back: int = 14, session=Depends(require_owner)):
    with db_session() as conn:
        return sync_strava(conn, days_back=days_back)


@app.get("/onboarding/status")
def onboarding_status(session=Depends(require_session)):
    if session["role"] == "guest":
        return {"completed": bool(GUEST_PROFILES.get(session["guest_id"], {}).get("onboarding_completed_at"))}
    with db_session() as conn:
        return {"completed": is_onboarding_complete(conn)}


@app.post("/onboarding/complete")
def onboarding_complete(payload: OnboardingPayload, session=Depends(require_session)):
    if session["role"] == "guest":
        data = payload.dict()
        data["onboarding_completed_at"] = "guest"
        GUEST_PROFILES[session["guest_id"]] = data
        return {"status": "ok"}
    with db_session() as conn:
        upsert_onboarding_profile(conn, payload.dict())
    return {"status": "ok"}


@app.post("/onboarding/reset")
def onboarding_reset(session=Depends(require_session)):
    if session["role"] == "guest":
        GUEST_PROFILES[session["guest_id"]] = {}
        return {"status": "ok"}
    with db_session() as conn:
        clear_onboarding(conn)
    return {"status": "ok"}


@app.get("/profile")
def profile(session=Depends(require_session)):
    if session["role"] == "guest":
        return GUEST_PROFILES.get(session["guest_id"], {})
    with db_session() as conn:
        row = get_profile(conn)
        return dict(row) if row else {}


@app.get("/dashboard/training-load")
def dashboard_training_load(days_back: int = 90, session=Depends(require_session)):
    if session["role"] == "guest":
        guest_profile = GUEST_PROFILES.get(session["guest_id"], {})
        return {"points": [], "goal_date": guest_profile.get("goal_date")}
    since = (date.today() - timedelta(days=days_back)).isoformat()
    with db_session() as conn:
        rows = conn.execute(
            "SELECT date, ctl, atl, ramp_rate FROM wellness WHERE date >= ? ORDER BY date",
            (since,),
        ).fetchall()
        profile = get_profile(conn)
    return {
        "points": [dict(r) for r in rows],
        "goal_date": profile["goal_date"] if profile else None,
    }


@app.post("/dashboard/sync")
def dashboard_sync(session=Depends(require_owner)):
    with db_session() as conn:
        try:
            intervals_result = sync_intervals(conn, days_back=90, days_forward=7)
        except Exception as e:
            intervals_result = {"error": str(e)}
        try:
            strava_result = sync_strava(conn, days_back=90)
        except Exception as e:
            strava_result = {"error": str(e)}
    return {"intervals": intervals_result, "strava": strava_result}


@app.get("/agents/coach/brief")
def coach_brief(session=Depends(require_owner)):
    with db_session() as conn:
        return {"brief": run_coach(conn)}


@app.get("/agents/nutritionist/brief")
def nutritionist_brief(session=Depends(require_owner)):
    with db_session() as conn:
        return {"brief": run_nutritionist(conn)}


@app.get("/debug/activities")
def debug_activities(session=Depends(require_owner)):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM activities ORDER BY start_date DESC").fetchall()
        return [dict(r) for r in rows]


@app.get("/debug/wellness")
def debug_wellness(session=Depends(require_owner)):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM wellness ORDER BY date DESC").fetchall()
        return [dict(r) for r in rows]


@app.get("/debug/planned-workouts")
def debug_planned_workouts(session=Depends(require_owner)):
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM planned_workouts ORDER BY date").fetchall()
        return [dict(r) for r in rows]


# Mounted last so it only catches requests that don't match an API route above.
app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
