from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # No default on purpose: the app must fail loudly if the database
    # address is missing, rather than silently connect to the wrong place.
    database_url: str

    model_config = SettingsConfigDict(env_file=".env")


def get_settings() -> Settings:
    return Settings()
