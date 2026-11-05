from pydantic import BaseModel, EmailStr
from typing import Optional


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # admin, doctor, staff, patient


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
