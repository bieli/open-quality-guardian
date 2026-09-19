from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://oqg:oqg@db:5432/oqg"
    cors_origins: str = "http://localhost:5173"
    seed_on_start: bool = True
    upload_dir: str = "/data/uploads"
    app_name: str = "Open Quality Guardian"


@lru_cache
def get_settings() -> Settings:
    return Settings()
