from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    database_url: str

    jwt_secret: str = "super-secret-dev-jwt-key-change-in-production-12345"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_starttls: bool = True
    smtp_timeout_seconds: int = 10
    smtp_from_name: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    oauth_encryption_key: str = ""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()




