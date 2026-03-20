"""Calendar tool implementations."""
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from integrations.microsoft_graph import ms_graph
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def list_calendar_events(days_ahead: int = 7, filter_keyword: str = "") -> str:
    audit_logger.log_tool_call("list_calendar_events", {"days_ahead": days_ahead})
    try:
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days_ahead)
        events = await ms_graph.list_events(
            start=now.isoformat(),
            end=end.isoformat(),
            top=30,
        )
        if filter_keyword:
            events = [e for e in events if filter_keyword.lower() in e.get("subject", "").lower()]
        if not events:
            return f"No events found in the next {days_ahead} days."
        lines = [f"**Upcoming events (next {days_ahead} days):**\n"]
        for e in events:
            start = e.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
            end_t = e.get("end", {}).get("dateTime", "")[:16].replace("T", " ")
            subject = e.get("subject", "(No subject)")
            location = e.get("location", {}).get("displayName", "")
            attendees = [a.get("emailAddress", {}).get("name", "") for a in e.get("attendees", [])]
            lines.append(f"• **{subject}**")
            lines.append(f"  Time: {start} → {end_t}")
            if location:
                lines.append(f"  Location: {location}")
            if attendees:
                lines.append(f"  Attendees: {', '.join(attendees[:5])}")
            preview = e.get("bodyPreview", "")
            if preview:
                lines.append(f"  Notes: {preview[:100]}")
            lines.append(f"  ID: {e.get('id', '')}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        logger.error("list_calendar_events failed: %s", exc)
        return f"Error fetching calendar: {exc}"


async def find_meeting_slots(
    attendee_emails: List[str],
    duration_minutes: int = 60,
    days_ahead: int = 14,
) -> str:
    audit_logger.log_tool_call("find_meeting_slots", {"attendees": attendee_emails})
    try:
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=days_ahead)
        result = await ms_graph.get_attendee_availability(
            emails=attendee_emails,
            start=now.isoformat(),
            end=end.isoformat(),
        )
        slots = result.get("meetingTimeSuggestions", [])
        if not slots:
            return "No common availability found in the specified window. Try extending the date range."
        lines = ["**Available meeting slots:**\n"]
        for slot in slots[:5]:
            ts = slot.get("meetingTimeSlot", {})
            start = ts.get("start", {}).get("dateTime", "")[:16].replace("T", " ")
            end_t = ts.get("end", {}).get("dateTime", "")[:16].replace("T", " ")
            confidence = slot.get("confidence", 0)
            lines.append(f"• {start} → {end_t}  (confidence: {confidence:.0f}%)")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error finding meeting slots: {exc}"


async def create_meeting(
    subject: str,
    start_datetime: str,
    end_datetime: str,
    attendee_emails: List[str],
    location: str = "",
    body: str = "",
) -> str:
    audit_logger.log_tool_call("create_meeting", {"subject": subject, "attendees": attendee_emails})
    try:
        event = {
            "subject": subject,
            "start": {"dateTime": start_datetime, "timeZone": "UTC"},
            "end": {"dateTime": end_datetime, "timeZone": "UTC"},
            "attendees": [
                {"emailAddress": {"address": email}, "type": "required"}
                for email in attendee_emails
            ],
            "isOnlineMeeting": True,
        }
        if location:
            event["location"] = {"displayName": location}
        if body:
            event["body"] = {"contentType": "HTML", "content": f"<p>{body}</p>"}
        result = await ms_graph.create_event(event)
        return f"Meeting created successfully!\nSubject: {subject}\nStart: {start_datetime}\nAttendees: {', '.join(attendee_emails)}\nEvent ID: {result.get('id', 'N/A')}"
    except Exception as exc:
        return f"Error creating meeting: {exc}"
