import uuid

from pydantic import BaseModel, EmailStr, TypeAdapter, field_validator
from pydantic_core import PydanticCustomError

_email_adapter = TypeAdapter(EmailStr)

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _email_valid(cls, value: str) -> str:
        try:
            _email_adapter.validate_python(value)
        except Exception as exc:
            raise PydanticCustomError("email", "Некорректный email адрес") from exc
        return value

    @field_validator("password")
    @classmethod
    def _password_valid(cls, value: str) -> str:
        if len(value) < 8:
            raise PydanticCustomError("password", "Пароль должен быть не короче 8 символов")
        has_letter = any(ch.isalpha() for ch in value)
        has_digit = any(ch.isdigit() for ch in value)
        if not has_letter or not has_digit:
            raise PydanticCustomError("password", "Пароль должен содержать буквы и цифры")
        return value

class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str
