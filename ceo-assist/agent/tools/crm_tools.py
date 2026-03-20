"""Affinity CRM tool implementations."""
import logging
from typing import Optional

from integrations.affinity import affinity_client
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def search_person_in_crm(name: str) -> str:
    audit_logger.log_tool_call("search_person_in_crm", {"name": name})
    try:
        persons = await affinity_client.search_person(name)
        orgs = await affinity_client.search_organization(name)
        if not persons and not orgs:
            return f"No results found in CRM for '{name}'."
        lines = [f"**CRM search results for '{name}':**\n"]
        for p in persons[:3]:
            if "error" in p:
                return p["error"]
            lines.append(f"**Person:** {p.get('name')} (ID: {p.get('id')})")
            lines.append(f"  Organization: {p.get('organization', 'N/A')}")
            emails = p.get('emails', '')
            if isinstance(emails, list):
                emails = ', '.join(emails)
            lines.append(f"  Email: {emails}")
            lines.append("")
        for o in orgs[:3]:
            if "error" in o:
                continue
            lines.append(f"**Organization:** {o.get('name')} (ID: {o.get('id')})")
            lines.append(f"  Domain: {o.get('domain', 'N/A')}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error searching CRM: {exc}"


async def get_person_background(person_id: int, include_notes: bool = True) -> str:
    audit_logger.log_tool_call("get_person_background", {"person_id": person_id})
    try:
        lines = [f"**Person background (ID: {person_id}):**\n"]
        # Relationship strength / interactions
        rel = await affinity_client.get_relationship_strength(person_id)
        if "error" in rel:
            return rel["error"]
        lines.append(f"**Name:** {rel.get('name')}")
        interaction_dates = rel.get("interaction_dates", {})
        if interaction_dates:
            lines.append(f"**Last interaction:** {interaction_dates.get('last_email_date', 'N/A')}")
            lines.append(f"**First interaction:** {interaction_dates.get('first_email_date', 'N/A')}")
        if include_notes:
            notes = await affinity_client.get_person_notes(person_id)
            if notes and not (len(notes) == 1 and "error" in notes[0]):
                lines.append(f"\n**CRM Notes ({len(notes)}):**")
                for n in notes[:5]:
                    lines.append(f"• [{n.get('created_at', '')[:10]}] {n.get('content', '')[:200]}")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error getting person background: {exc}"


async def add_crm_note(person_id: int, note: str) -> str:
    audit_logger.log_tool_call("add_crm_note", {"person_id": person_id})
    try:
        result = await affinity_client.create_note(person_id, note)
        if "error" in result:
            return result["error"]
        return f"Note added to CRM for person {person_id}. Note ID: {result.get('id', 'N/A')}"
    except Exception as exc:
        return f"Error adding CRM note: {exc}"
