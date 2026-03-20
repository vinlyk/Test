"""OneNote / meeting notes tool implementations."""
import logging
from datetime import datetime
from typing import List, Optional

from integrations.microsoft_graph import ms_graph
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def list_onenote_notebooks() -> str:
    audit_logger.log_tool_call("list_onenote_notebooks", {})
    try:
        notebooks = await ms_graph.list_notebooks()
        if not notebooks:
            return "No OneNote notebooks found."
        lines = ["**OneNote Notebooks:**\n"]
        for nb in notebooks:
            lines.append(f"• **{nb.get('displayName')}** (ID: {nb.get('id')})")
            # Fetch sections
            try:
                sections = await ms_graph.list_sections(nb["id"])
                for sec in sections:
                    lines.append(f"  ↳ {sec.get('displayName')} (ID: {sec.get('id')})")
            except Exception:
                pass
        return "\n".join(lines)
    except Exception as exc:
        return f"Error listing notebooks: {exc}"


async def search_onenote(query: str) -> str:
    audit_logger.log_tool_call("search_onenote", {"query": query})
    try:
        # Search across pages via SharePoint
        results = await ms_graph.search_sharepoint(query)
        if not results:
            return f"No OneNote content found for '{query}'."
        lines = [f"**OneNote search results for '{query}':**\n"]
        for r in results[:5]:
            lines.append(f"• **{r.get('title', 'Untitled')}**")
            if r.get("url"):
                lines.append(f"  URL: {r.get('url')}")
            if r.get("last_modified"):
                lines.append(f"  Modified: {r.get('last_modified', '')[:10]}")
            lines.append("")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error searching OneNote: {exc}"


async def create_meeting_notes(
    meeting_title: str,
    date: str,
    attendees: List[str],
    key_points: List[str] = None,
    decisions: List[str] = None,
    action_items: List[dict] = None,
    section_id: Optional[str] = None,
) -> str:
    audit_logger.log_tool_call("create_meeting_notes", {"title": meeting_title})
    key_points = key_points or []
    decisions = decisions or []
    action_items = action_items or []

    # Build HTML content for OneNote
    def ul(items: list) -> str:
        if not items:
            return "<p><em>None</em></p>"
        return "<ul>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"

    actions_html = ""
    if action_items:
        actions_html = "<table style='border-collapse:collapse;width:100%'>"
        actions_html += "<tr><th style='border:1px solid #ccc;padding:4px'>Task</th><th style='border:1px solid #ccc;padding:4px'>Owner</th><th style='border:1px solid #ccc;padding:4px'>Due</th></tr>"
        for ai in action_items:
            actions_html += f"<tr><td style='border:1px solid #ccc;padding:4px'>{ai.get('task','')}</td><td style='border:1px solid #ccc;padding:4px'>{ai.get('owner','')}</td><td style='border:1px solid #ccc;padding:4px'>{ai.get('due_date','')}</td></tr>"
        actions_html += "</table>"
    else:
        actions_html = "<p><em>None</em></p>"

    content_html = f"""
    <h2>{meeting_title}</h2>
    <p><strong>Date:</strong> {date}</p>
    <p><strong>Attendees:</strong> {', '.join(attendees)}</p>
    <h3>Key Discussion Points</h3>
    {ul(key_points)}
    <h3>Decisions Made</h3>
    {ul(decisions)}
    <h3>Action Items</h3>
    {actions_html}
    <p style='color:#888;font-size:12px;margin-top:20px'>Created by CEO-Assist on {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    """

    try:
        if section_id:
            result = await ms_graph.create_onenote_page(
                section_id=section_id,
                title=f"{date} - {meeting_title}",
                content_html=content_html,
            )
            page_url = result.get("links", {}).get("oneNoteWebUrl", {}).get("href", "")
            return f"Meeting notes saved to OneNote!\nTitle: {date} - {meeting_title}\nURL: {page_url}"
        else:
            # Save locally if no section_id
            return await _save_notes_locally(meeting_title, date, attendees, key_points, decisions, action_items)
    except Exception as exc:
        logger.warning("OneNote save failed, saving locally: %s", exc)
        return await _save_notes_locally(meeting_title, date, attendees, key_points, decisions, action_items)


async def _save_notes_locally(title, date, attendees, key_points, decisions, action_items) -> str:
    from .local_file_tools import write_meeting_notes
    lines = [f"# {title}", f"**Date:** {date}", f"**Attendees:** {', '.join(attendees)}", ""]
    if key_points:
        lines += ["## Key Discussion Points", *[f"- {p}" for p in key_points], ""]
    if decisions:
        lines += ["## Decisions", *[f"- {d}" for d in decisions], ""]
    if action_items:
        lines += ["## Action Items", "| Task | Owner | Due |", "|------|-------|-----|"]
        for ai in action_items:
            lines.append(f"| {ai.get('task','')} | {ai.get('owner','')} | {ai.get('due_date','')} |")
    filename = f"{date}_{title.replace(' ', '_')[:40]}"
    return await write_meeting_notes(filename=filename, content="\n".join(lines))
