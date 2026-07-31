from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class OnboardingPayload(BaseModel):
    # Coach
    name: Optional[str] = None
    age: Optional[int] = None
    goal_event: Optional[str] = None
    goal_date: Optional[str] = None
    event_demand_type: Optional[str] = None
    ftp: Optional[int] = None
    ftp_test_method: Optional[str] = None
    ftp_test_date: Optional[str] = None
    power_curve_json: Optional[str] = None
    experience_level: Optional[str] = None
    recent_weekly_hours: Optional[float] = None
    recent_structure_notes: Optional[str] = None
    available_hours: Optional[float] = None
    hours_distribution: Optional[str] = None
    training_setup: Optional[str] = None
    power_source: Optional[str] = None
    constraints: Optional[str] = None
    # Nutritionist
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    weight_goal: Optional[str] = None
    lifestyle_activity_level: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    eating_pattern: Optional[str] = None
    # Logistics
    timezone: Optional[str] = None
    wake_time: Optional[str] = None
    checkin_intensity: Optional[str] = None


class LoginPayload(BaseModel):
    mode: str  # "owner" | "guest"
    username: Optional[str] = None
    password: Optional[str] = None


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class OnboardingChatPayload(BaseModel):
    messages: list[ChatMessage]
    draft: dict = {}


class ProgrammeChatPayload(BaseModel):
    messages: list[ChatMessage]
    draft: dict = {}


class ProgrammeGeneratePayload(BaseModel):
    notes: str = ""
