"""
Local file system tools.

Access is intentionally restricted to safe paths:
  - The user's home directory subtree
  - A configurable whitelist of paths

Files containing secrets (.env, *credentials*, etc.) are blocked.
"""
import logging
import os
from pathlib import Path
from typing import Optional

from config.settings import settings
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)

_HOME = Path.home()
_NOTES_DIR = settings.data_dir / "meeting_notes"
_NOTES_DIR.mkdir(parents=True, exist_ok=True)

# Files/patterns that should never be readable
_BLOCKED_PATTERNS = {".env", "credentials", "id_rsa", "id_ed25519", ".ssh", "token", "secret"}


def _safe_path(path_str: str) -> Optional[Path]:
    """Resolve path and verify it is under home directory and not blocked."""
    try:
        p = Path(path_str).expanduser().resolve()
        # Must be under home
        p.relative_to(_HOME)
        # Block sensitive names
        name_lower = p.name.lower()
        if any(blocked in name_lower for blocked in _BLOCKED_PATTERNS):
            return None
        return p
    except Exception:
        return None


async def list_local_files(directory: str = "", extension: str = "") -> str:
    audit_logger.log_tool_call("list_local_files", {"directory": directory})
    base = _HOME / directory if directory else _HOME / "Documents"
    safe = _safe_path(str(base))
    if not safe or not safe.is_dir():
        return f"Directory not found or not accessible: {directory or 'Documents'}"
    try:
        files = sorted(safe.iterdir())
        if extension:
            ext = extension if extension.startswith(".") else f".{extension}"
            files = [f for f in files if f.suffix.lower() == ext.lower()]
        if not files:
            return f"No files found in {safe}"
        lines = [f"**Files in {safe}:**\n"]
        for f in files[:50]:
            size = ""
            if f.is_file():
                size_bytes = f.stat().st_size
                size = f" ({size_bytes // 1024} KB)" if size_bytes > 1024 else f" ({size_bytes} B)"
            icon = "📁" if f.is_dir() else "📄"
            lines.append(f"{icon} {f.name}{size}")
        if len(list(safe.iterdir())) > 50:
            lines.append("... (showing first 50 entries)")
        return "\n".join(lines)
    except PermissionError:
        return f"Permission denied: {safe}"
    except Exception as exc:
        return f"Error listing files: {exc}"


async def read_local_file(file_path: str) -> str:
    audit_logger.log_tool_call("read_local_file", {"path": file_path})
    safe = _safe_path(file_path)
    if not safe:
        return "Access denied: file path not allowed."
    if not safe.exists():
        return f"File not found: {file_path}"
    if not safe.is_file():
        return f"Not a file: {file_path}"
    # Size limit: 500 KB
    if safe.stat().st_size > 512_000:
        return f"File too large to read directly ({safe.stat().st_size // 1024} KB). Consider summarizing a smaller section."
    try:
        # Try text first
        text = safe.read_text(encoding="utf-8", errors="replace")
        if len(text) > 8000:
            text = text[:8000] + "\n\n... [truncated — file has more content]"
        return f"**File:** {safe.name}\n\n{text}"
    except Exception as exc:
        return f"Error reading file: {exc}"


async def write_meeting_notes(filename: str, content: str) -> str:
    audit_logger.log_tool_call("write_meeting_notes", {"filename": filename})
    # Sanitize filename
    safe_name = "".join(c for c in filename if c.isalnum() or c in "-_. ")
    safe_name = safe_name.strip() or "meeting_notes"
    if not safe_name.endswith(".md"):
        safe_name += ".md"
    output_path = _NOTES_DIR / safe_name
    try:
        output_path.write_text(content, encoding="utf-8")
        return f"Meeting notes saved to: {output_path}"
    except Exception as exc:
        return f"Error saving notes: {exc}"
