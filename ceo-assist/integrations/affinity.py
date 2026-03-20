"""
Affinity CRM integration.

Affinity is a relationship intelligence CRM. This client surfaces:
  - Person / organization lookups
  - Relationship history and notes
  - Deal pipeline status
  - Activity (calls, emails, meetings) history

API docs: https://api-docs.affinity.co/
"""
import logging
from typing import Any, Dict, List, Optional

import httpx

from config.settings import settings
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)


class AffinityCRMClient:

    def __init__(self) -> None:
        self._api_key = settings.affinity_api_key
        self._base = settings.affinity_base_url

    def _headers(self) -> dict:
        # Affinity uses HTTP Basic auth: username="" password=api_key
        import base64
        token = base64.b64encode(f":{self._api_key}".encode()).decode()
        return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

    def _available(self) -> bool:
        return bool(self._api_key)

    async def _get(self, path: str, params: dict = None) -> Any:
        if not self._available():
            return {"error": "Affinity API key not configured. Add AFFINITY_API_KEY to .env"}
        audit_logger.log_api_call("affinity", path)
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{self._base}{path}",
                headers=self._headers(),
                params=params or {},
                timeout=20,
            )
        resp.raise_for_status()
        return resp.json()

    async def search_person(self, name: str) -> List[dict]:
        """Search for a person by name."""
        data = await self._get("/persons", {"term": name})
        if "error" in data:
            return [data]
        persons = data.get("persons", [])
        return [
            {
                "id": p.get("id"),
                "name": f"{p.get('first_name', '')} {p.get('last_name', '')}".strip(),
                "emails": p.get("primary_email") or p.get("emails", []),
                "organization": p.get("primary_organization", {}).get("name", ""),
                "type": "person",
            }
            for p in persons
        ]

    async def search_organization(self, name: str) -> List[dict]:
        """Search for a company / organization."""
        data = await self._get("/organizations", {"term": name})
        if "error" in data:
            return [data]
        orgs = data.get("organizations", [])
        return [
            {
                "id": o.get("id"),
                "name": o.get("name", ""),
                "domain": o.get("domain", ""),
                "type": "organization",
            }
            for o in orgs
        ]

    async def get_person_notes(self, person_id: int) -> List[dict]:
        """Get notes associated with a person."""
        data = await self._get("/notes", {"person_id": person_id})
        if "error" in data:
            return [data]
        return [
            {
                "content": n.get("content", ""),
                "created_at": n.get("created_at", ""),
                "creator": n.get("creator", {}).get("first_name", ""),
            }
            for n in data.get("notes", [])
        ]

    async def get_person_interactions(self, person_id: int) -> List[dict]:
        """Get email / meeting interactions with a person."""
        data = await self._get("/interactions", {"person_id": person_id})
        if "error" in data:
            return [data]
        return data.get("interactions", [])

    async def get_relationship_strength(self, person_id: int) -> dict:
        """Get relationship score and last interaction date."""
        data = await self._get(f"/persons/{person_id}")
        if "error" in data:
            return data
        return {
            "name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "interaction_dates": data.get("interaction_dates", {}),
            "emails": data.get("emails", []),
        }

    async def create_note(self, person_id: int, content: str) -> dict:
        """Create a note for a person in Affinity."""
        if not self._available():
            return {"error": "Affinity not configured"}
        audit_logger.log("create_note", "affinity", {"person_id": person_id})
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{self._base}/notes",
                headers=self._headers(),
                json={"person_ids": [person_id], "content": content},
                timeout=20,
            )
        resp.raise_for_status()
        return resp.json()

    async def list_lists(self) -> List[dict]:
        """List all Affinity lists (deal pipelines, etc.)."""
        data = await self._get("/lists")
        if "error" in data:
            return [data]
        return data if isinstance(data, list) else data.get("lists", [])


affinity_client = AffinityCRMClient()
