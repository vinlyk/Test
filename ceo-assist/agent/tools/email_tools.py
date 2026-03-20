"""Email tool implementations."""
import logging
from typing import Any, List

from integrations.microsoft_graph import ms_graph
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def list_emails(folder: str = "inbox", count: int = 10, unread_only: bool = False) -> str:
    audit_logger.log_tool_call("list_emails", {"folder": folder, "count": count})
    try:
        emails = await ms_graph.list_emails(folder=folder, top=count)
        if not emails:
            return f"No emails found in {folder}."
        if unread_only:
            emails = [e for e in emails if not e.get("isRead", True)]
        lines = [f"**{folder.title()} ({len(emails)} emails):**\n"]
        for e in emails:
            read_status = "" if e.get("isRead") else "🔵 "
            sender = e.get("from", {}).get("emailAddress", {})
            from_name = sender.get("name", sender.get("address", "Unknown"))
            date = e.get("receivedDateTime", "")[:10]
            subject = e.get("subject", "(No subject)")
            preview = e.get("bodyPreview", "")[:80]
            has_att = " 📎" if e.get("hasAttachments") else ""
            lines.append(f"{read_status}**{subject}**{has_att}")
            lines.append(f"  From: {from_name}  |  Date: {date}")
            lines.append(f"  Preview: {preview}")
            lines.append(f"  ID: {e.get('id', '')}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error listing emails: {exc}"


async def read_email(email_id: str) -> str:
    audit_logger.log_tool_call("read_email", {"email_id": email_id[:20]})
    try:
        e = await ms_graph.get_email_body(email_id)
        sender = e.get("from", {}).get("emailAddress", {})
        subject = e.get("subject", "(No subject)")
        date = e.get("receivedDateTime", "")
        from_name = f"{sender.get('name', '')} <{sender.get('address', '')}>"
        to_list = [r.get("emailAddress", {}).get("address", "") for r in e.get("toRecipients", [])]
        body = e.get("body", {}).get("content", "")
        # Strip HTML tags for readability
        import re
        body_text = re.sub(r"<[^>]+>", "", body).strip()
        body_text = re.sub(r"\n{3,}", "\n\n", body_text)[:3000]  # cap at 3000 chars
        return (
            f"**Subject:** {subject}\n"
            f"**From:** {from_name}\n"
            f"**To:** {', '.join(to_list)}\n"
            f"**Date:** {date[:19].replace('T', ' ')}\n\n"
            f"---\n\n{body_text}"
        )
    except Exception as exc:
        return f"Error reading email: {exc}"


async def search_emails_by_person(email_or_name: str, count: int = 10) -> str:
    audit_logger.log_tool_call("search_emails_by_person", {"person": email_or_name})
    try:
        # Try searching both from and to
        results = await ms_graph.list_emails(search=email_or_name, top=count)
        if not results:
            return f"No emails found involving '{email_or_name}'."
        lines = [f"**Email history with {email_or_name}:**\n"]
        for e in results:
            sender = e.get("from", {}).get("emailAddress", {})
            from_name = sender.get("name", sender.get("address", "?"))
            date = e.get("receivedDateTime", "")[:10]
            subject = e.get("subject", "(No subject)")
            preview = e.get("bodyPreview", "")[:120]
            lines.append(f"• **{subject}**  [{date}]")
            lines.append(f"  From: {from_name}")
            lines.append(f"  {preview}")
            lines.append(f"  ID: {e.get('id', '')}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error searching emails: {exc}"
