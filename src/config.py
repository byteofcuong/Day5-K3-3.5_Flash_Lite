"""Centralized application configuration."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


class ConfigError(RuntimeError):
    """Raised when required application configuration is missing."""


@dataclass(frozen=True)
class Settings:
    account_id: str
    api_token: str
    d1_database_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str
    http_timeout: int = 15
    download_expiry: int = 900

    @property
    def d1_query_url(self) -> str:
        return (
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{self.account_id}/d1/database/{self.d1_database_id}/query"
        )

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.account_id}.r2.cloudflarestorage.com"


def load_settings(secrets: Mapping[str, Any] | None = None) -> Settings:
    """Load and validate settings from Streamlit secrets or a supplied mapping."""
    if secrets is None:
        import streamlit as st

        secrets = st.secrets

    cloudflare = secrets.get("cloudflare", {})
    r2 = secrets.get("r2", {})
    values = {
        "account_id": cloudflare.get("account_id"),
        "api_token": cloudflare.get("api_token"),
        "d1_database_id": cloudflare.get("d1_database_id"),
        "r2_access_key_id": r2.get("access_key_id"),
        "r2_secret_access_key": r2.get("secret_access_key"),
        "r2_bucket_name": r2.get("bucket_name"),
    }
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ConfigError(
            "Thiếu cấu hình bắt buộc: "
            + ", ".join(missing)
            + ". Hãy kiểm tra .streamlit/secrets.toml."
        )
    return Settings(**values)

