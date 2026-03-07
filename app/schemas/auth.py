from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str

    model_config = ConfigDict(from_attributes=True)


class SignupRequest(BaseModel):
    username: str
    password: str | None = None
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class DemoUserResponse(BaseModel):
    username: str
    email: str
    is_staff: bool
    first_name: str = ""
    last_name: str = ""
    demo_token: str = ""
    is_demo: bool = False
    is_admin: bool = False

    model_config = ConfigDict(from_attributes=True)
