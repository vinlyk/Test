"""
Pitchbook integration for company and investor research.

Pitchbook API access is typically enterprise-licensed. If unavailable,
falls back to graceful degradation with a clear message.

For companies without a Pitchbook API subscription, consider using
the free Crunchbase Basic API or web search as alternatives.
"""
import logging
from typing import Any, Dict, List, Optional

import httpx

from config.settings import settings
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


class PitchbookClient:

    def __init__(self) -> None:
        self._api_key = settings.pitchbook_api_key
        self._base = settings.pitchbook_base_url

    def _available(self) -> bool:
        return bool(self._api_key)

    def _not_available_msg(self) -> dict:
        return {
            "error": (
                "Pitchbook API not configured. Add PITCHBOOK_API_KEY to .env "
                "or use web search for company research."
            )
        }

    async def _get(self, path: str, params: dict = None) -> Any:
        if not self._available():
            return self._not_available_msg()
        audit_logger.log_api_call("pitchbook", path)
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{self._base}{path}",
                headers={"X-API-Key": self._api_key, "Accept": "application/json"},
                params=params or {},
                timeout=20,
            )
        if resp.status_code == 404:
            return {"error": "Not found in Pitchbook"}
        resp.raise_for_status()
        return resp.json()

    async def search_company(self, name: str) -> List[dict]:
        """Search for a company profile."""
        data = await self._get("/companies/search", {"name": name, "limit": 5})
        if "error" in data:
            return [data]
        return data.get("results", [])

    async def get_company_profile(self, company_id: str) -> dict:
        """Get detailed company profile including funding, investors, team."""
        data = await self._get(f"/companies/{company_id}")
        if "error" in data:
            return data
        return {
            "name": data.get("name"),
            "description": data.get("description"),
            "founded": data.get("foundedDate"),
            "stage": data.get("stage"),
            "total_raised": data.get("totalRaised"),
            "last_deal": data.get("lastDeal"),
            "investors": data.get("investors", []),
            "employees": data.get("employees"),
            "revenue": data.get("revenue"),
            "headquarters": data.get("headquarters"),
            "website": data.get("website"),
        }

    async def get_person_profile(self, name: str) -> List[dict]:
        """Look up an individual's background — board positions, prior companies, etc."""
        data = await self._get("/people/search", {"name": name, "limit": 5})
        if "error" in data:
            return [data]
        return data.get("results", [])

    async def get_industry_comps(self, sector: str) -> List[dict]:
        """Get comparable companies in a sector."""
        data = await self._get("/companies/search", {"sector": sector, "limit": 10})
        if "error" in data:
            return [data]
        return data.get("results", [])


pitchbook_client = PitchbookClient()
