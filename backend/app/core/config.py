from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ScholarFlow API"
    app_version: str = "0.2.0"
    environment: str = "development"
    secret_key: str = Field(min_length=16)
    database_url: str = "sqlite+aiosqlite:///./data/scholarflow.db"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    allowed_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
