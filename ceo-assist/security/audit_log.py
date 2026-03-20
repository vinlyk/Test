"""
Append-only audit log for all data access and agent actions.

Every tool call, data access, and external API request is recorded so the
CEO can review what the agent did on their behalf.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from config.settings import settings

logger = logging.getLogger(__name__)


class AuditLogger:
    """Write structured audit events to a local JSONL file."""

    def __init__(self) -> None:
        self._log_path = settings.data_dir / "audit.jsonl"
        self._log_path.parent.mkdir(parents=True, exist_ok=True)

    def log(
        self,
        action: str,
        resource: str,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True,
    ) -> None:
        event = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "resource": resource,
            "success": success,
            "details": details or {},
        }
        try:
            with self._log_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(event) + "\n")
        except Exception as exc:
            logger.error("Audit log write failed: %s", exc)

    def log_tool_call(self, tool_name: str, args: Dict[str, Any]) -> None:
        self.log(action="tool_call", resource=tool_name, details={"args": _sanitize(args)})

    def log_api_call(self, api: str, endpoint: str, success: bool = True) -> None:
        self.log(action="api_call", resource=api, details={"endpoint": endpoint}, success=success)

    def tail(self, n: int = 50) -> list:
        """Return the last n audit entries."""
        try:
            lines = self._log_path.read_text(encoding="utf-8").strip().splitlines()
            return [json.loads(l) for l in lines[-n:] if l]
        except Exception:
            return []


def _sanitize(d: Dict[str, Any]) -> Dict[str, Any]:
    """Redact sensitive-looking keys from audit details."""
    _SENSITIVE = {"password", "token", "secret", "key", "credential", "auth"}
    return {
        k: "***REDACTED***" if any(s in k.lower() for s in _SENSITIVE) else v
        for k, v in d.items()
    }


audit_logger = AuditLogger()
