"""Application settings — loaded from environment variables."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""

    # Microsoft Graph
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_tenant_id: str = "common"

    # Affinity CRM
    affinity_api_key: str = ""
    affinity_base_url: str = "https://api.affinity.co"

    # Pitchbook
    pitchbook_api_key: str = ""
    pitchbook_base_url: str = "https://api.pitchbook.com"

    # Amadeus Travel
    amadeus_api_key: str = ""
    amadeus_api_secret: str = ""
    amadeus_base_url: str = "https://test.api.amadeus.com"

    # App
    app_secret_key: str = "dev-secret-change-in-production"
    log_level: str = "INFO"
    data_dir: Path = Path.home() / ".ceo-assist" / "data"
    max_email_fetch: int = 20
    max_calendar_days_ahead: int = 30

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def is_ms_configured(self) -> bool:
        return bool(self.microsoft_client_id and self.microsoft_client_secret)

    def is_affinity_configured(self) -> bool:
        return bool(self.affinity_api_key)

    def is_pitchbook_configured(self) -> bool:
        return bool(self.pitchbook_api_key)

    def is_travel_configured(self) -> bool:
        return bool(self.amadeus_api_key and self.amadeus_api_secret)


settings = Settings()

# Ensure data directory exists
settings.data_dir.mkdir(parents=True, exist_ok=True)
