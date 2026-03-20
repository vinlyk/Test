"""Research tool implementations (Pitchbook + web search)."""
import logging
from typing import List

import httpx

from integrations.pitchbook import pitchbook_client
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


async def research_company(company_name: str) -> str:
    audit_logger.log_tool_call("research_company", {"company": company_name})
    try:
        companies = await pitchbook_client.search_company(company_name)
        if not companies:
            return f"No Pitchbook data found for '{company_name}'. Try web_search for recent news."
        if "error" in companies[0]:
            return companies[0]["error"]
        # Get detailed profile for top result
        top = companies[0]
        lines = [f"**Company Research: {company_name}**\n"]
        lines.append(f"**Name:** {top.get('name', company_name)}")
        if top.get("description"):
            lines.append(f"**Description:** {top.get('description')[:300]}")
        if top.get("stage"):
            lines.append(f"**Stage:** {top.get('stage')}")
        if top.get("totalRaised"):
            lines.append(f"**Total Raised:** {top.get('totalRaised')}")
        if top.get("lastDeal"):
            lines.append(f"**Last Deal:** {top.get('lastDeal')}")
        if top.get("employees"):
            lines.append(f"**Employees:** {top.get('employees')}")
        if top.get("revenue"):
            lines.append(f"**Revenue:** {top.get('revenue')}")
        if top.get("investors"):
            investors = top.get("investors", [])[:5]
            lines.append(f"**Key Investors:** {', '.join(str(i) for i in investors)}")
        if top.get("website"):
            lines.append(f"**Website:** {top.get('website')}")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error researching company: {exc}"


async def research_person(person_name: str) -> str:
    audit_logger.log_tool_call("research_person", {"person": person_name})
    try:
        results = await pitchbook_client.get_person_profile(person_name)
        if not results:
            return f"No Pitchbook data for '{person_name}'. Try web_search for recent news and bio."
        if "error" in results[0]:
            return results[0]["error"]
        top = results[0]
        lines = [f"**Person Research: {person_name}**\n"]
        for field, label in [
            ("title", "Current Title"),
            ("company", "Current Company"),
            ("location", "Location"),
            ("education", "Education"),
            ("bio", "Bio"),
        ]:
            if top.get(field):
                val = str(top[field])[:300]
                lines.append(f"**{label}:** {val}")
        if top.get("boardPositions"):
            lines.append(f"**Board Positions:** {top.get('boardPositions')}")
        if top.get("priorCompanies"):
            lines.append(f"**Prior Companies:** {top.get('priorCompanies')}")
        return "\n".join(lines)
    except Exception as exc:
        return f"Error researching person: {exc}"


async def web_search(query: str, focus: str = "general") -> str:
    """
    Lightweight web search using DuckDuckGo instant answer API.
    For a production deployment, replace with Google Custom Search, Bing, or Brave Search API.
    """
    audit_logger.log_tool_call("web_search", {"query": query, "focus": focus})
    # Augment query based on focus
    focus_suffixes = {
        "news": "news latest",
        "company": "company profile funding investors",
        "person": "professional background career",
        "industry": "industry report trends analysis",
        "general": "",
    }
    full_query = f"{query} {focus_suffixes.get(focus, '')}".strip()
    try:
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": full_query,
                    "format": "json",
                    "no_html": 1,
                    "skip_disambig": 1,
                },
                timeout=15,
                headers={"User-Agent": "CEO-Assist/1.0"},
            )
        data = resp.json()
        lines = [f"**Web search: '{query}'**\n"]
        # Abstract (main result)
        if data.get("Abstract"):
            lines.append(f"**Summary:** {data['Abstract'][:500]}")
            if data.get("AbstractURL"):
                lines.append(f"Source: {data['AbstractURL']}")
            lines.append("")
        # Related topics
        topics = data.get("RelatedTopics", [])[:5]
        if topics:
            lines.append("**Related Information:**")
            for t in topics:
                if isinstance(t, dict) and t.get("Text"):
                    lines.append(f"• {t['Text'][:200]}")
        if not data.get("Abstract") and not topics:
            lines.append(
                "No instant results available. "
                "For comprehensive research, consider using a dedicated search API. "
                f"Suggested query: '{full_query}'"
            )
        return "\n".join(lines)
    except Exception as exc:
        return f"Web search unavailable: {exc}. Suggest manual search for '{query}'."
