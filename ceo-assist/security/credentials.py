"""
Secure credential management using OS keychain + encrypted local cache.

All sensitive tokens (OAuth access/refresh, API keys) are stored in the
OS keychain via the `keyring` library. This means credentials never touch
disk in plaintext and benefit from OS-level security (e.g., macOS Keychain,
Windows Credential Manager, Linux Secret Service).
"""
import json
import logging
from typing import Optional

try:
    import keyring
    _KEYRING_AVAILABLE = True
except ImportError:
    _KEYRING_AVAILABLE = False

logger = logging.getLogger(__name__)

_SERVICE_NAME = "ceo-assist"


class CredentialManager:
    """Store and retrieve credentials from the OS keychain."""

    def set(self, key: str, value: str) -> None:
        """Persist a credential to the OS keychain."""
        if not _KEYRING_AVAILABLE:
            logger.warning("keyring not available — credential '%s' not persisted", key)
            return
        try:
            keyring.set_password(_SERVICE_NAME, key, value)
        except Exception as exc:
            logger.error("Failed to store credential '%s': %s", key, exc)

    def get(self, key: str) -> Optional[str]:
        """Retrieve a credential from the OS keychain."""
        if not _KEYRING_AVAILABLE:
            return None
        try:
            return keyring.get_password(_SERVICE_NAME, key)
        except Exception as exc:
            logger.error("Failed to retrieve credential '%s': %s", key, exc)
            return None

    def delete(self, key: str) -> None:
        """Remove a credential from the OS keychain."""
        if not _KEYRING_AVAILABLE:
            return
        try:
            keyring.delete_password(_SERVICE_NAME, key)
        except Exception:
            pass  # Already gone

    def store_token_bundle(self, provider: str, bundle: dict) -> None:
        """Store an OAuth token bundle (access + refresh + expiry) as JSON."""
        self.set(f"{provider}_token_bundle", json.dumps(bundle))

    def load_token_bundle(self, provider: str) -> Optional[dict]:
        """Load an OAuth token bundle. Returns None if not found."""
        raw = self.get(f"{provider}_token_bundle")
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None
        return None


credential_manager = CredentialManager()
