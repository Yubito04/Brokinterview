from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, found from this file's location, not from where the command is run.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # No default on purpose: the app must fail loudly if the database
    # address is missing, rather than silently connect to the wrong place.
    database_url: str

    # Only the tests use this one. It is optional so the app runs without it.
    test_database_url: str | None = None

    # Optional: without a key the app still runs, only the AI extraction
    # endpoint answers 503. pydantic-settings does not copy .env values into
    # os.environ, so this key is passed explicitly to the Anthropic client.
    anthropic_api_key: str | None = None

    # Cheap model on purpose: extracting fields from a short text is easy work.
    anthropic_model: str = "claude-haiku-5-5"

    model_config = SettingsConfigDict(env_file=ENV_FILE)


def get_settings() -> Settings:
    return Settings()
