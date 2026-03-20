"""
Microsoft Graph API client.

Handles OAuth 2.0 authentication (device-code flow — no redirect URI needed,
perfect for a laptop app) and provides typed methods for:
  - Calendar: list/create/update events
  - Mail: list/read/send emails
  - OneNote: list notebooks, sections, pages; create pages
  - SharePoint: search and read documents
  - Contacts: list contacts

Token refresh is automatic. Credentials are persisted in the OS keychain.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx

from config.settings import settings
from security.credentials import credential_manager
from security.audit_log import audit_logger

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPES = [
    "offline_access",
    "Mail.Read",
    "Mail.Send",
    "Calendars.ReadWrite",
    "Notes.ReadWrite",
    "Sites.Read.All",
    "User.Read",
    "Contacts.Read",
    "People.Read",
]


class MicrosoftGraphClient:
    """Async Microsoft Graph client with auto token refresh."""

    def __init__(self) -> None:
        self._client_id = settings.microsoft_client_id
        self._client_secret = settings.microsoft_client_secret
        self._tenant = settings.microsoft_tenant_id
        self._access_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    # ── Auth ─────────────────────────────────────────────────────────────────

    def _token_url(self) -> str:
        return f"https://login.microsoftonline.com/{self._tenant}/oauth2/v2.0/token"

    async def _refresh_token(self) -> bool:
        """Refresh using stored refresh token. Returns True on success."""
        bundle = credential_manager.load_token_bundle("microsoft")
        if not bundle or "refresh_token" not in bundle:
            return False
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                self._token_url(),
                data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": bundle["refresh_token"],
                    "scope": " ".join(GRAPH_SCOPES),
                },
            )
        if resp.status_code != 200:
            logger.warning("Token refresh failed: %s", resp.text)
            return False
        data = resp.json()
        self._store_token(data)
        return True

    def _store_token(self, data: dict) -> None:
        expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
        self._access_token = data["access_token"]
        self._token_expiry = expiry
        bundle = {
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", ""),
            "expiry": expiry.isoformat(),
        }
        credential_manager.store_token_bundle("microsoft", bundle)

    async def ensure_authenticated(self) -> bool:
        """
        Ensure we have a valid access token.
        Tries refresh first, then device-code flow as fallback.
        Returns True if authenticated.
        """
        # Load cached token
        if not self._access_token:
            bundle = credential_manager.load_token_bundle("microsoft")
            if bundle:
                self._access_token = bundle.get("access_token")
                expiry_str = bundle.get("expiry", "")
                if expiry_str:
                    self._token_expiry = datetime.fromisoformat(expiry_str)

        # Check expiry (refresh 5 min before expiry)
        if self._token_expiry and datetime.now(timezone.utc) >= self._token_expiry - timedelta(minutes=5):
            self._access_token = None

        if self._access_token:
            return True

        # Try refresh
        if await self._refresh_token():
            return True

        # Fallback: device-code flow (returns instructions for the user)
        return False

    async def start_device_code_flow(self) -> Dict[str, str]:
        """
        Initiate device-code auth. Returns a dict with:
          user_code, verification_url, message, device_code
        The caller must display the message to the user and then call
        complete_device_code_flow(device_code).
        """
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"https://login.microsoftonline.com/{self._tenant}/oauth2/v2.0/devicecode",
                data={
                    "client_id": self._client_id,
                    "scope": " ".join(GRAPH_SCOPES),
                },
            )
        resp.raise_for_status()
        data = resp.json()
        return {
            "user_code": data.get("user_code", ""),
            "verification_url": data.get("verification_uri", "https://microsoft.com/devicelogin"),
            "message": data.get("message", ""),
            "device_code": data.get("device_code", ""),
            "expires_in": data.get("expires_in", 900),
        }

    async def complete_device_code_flow(self, device_code: str) -> bool:
        """Poll for token after user has entered device code. Returns True on success."""
        import asyncio
        for _ in range(60):  # Poll for up to 5 minutes
            await asyncio.sleep(5)
            async with httpx.AsyncClient() as http:
                resp = await http.post(
                    self._token_url(),
                    data={
                        "client_id": self._client_id,
                        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                        "device_code": device_code,
                    },
                )
            if resp.status_code == 200:
                self._store_token(resp.json())
                return True
            err = resp.json().get("error", "")
            if err == "authorization_pending":
                continue
            elif err in ("authorization_declined", "bad_verification_code", "expired_token"):
                return False
        return False

    # ── HTTP Helper ───────────────────────────────────────────────────────────

    async def _get(self, path: str, params: Dict = None) -> Any:
        if not await self.ensure_authenticated():
            raise RuntimeError("Microsoft Graph: not authenticated. Please connect your Microsoft account.")
        audit_logger.log_api_call("microsoft_graph", path)
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{GRAPH_BASE}{path}",
                headers={"Authorization": f"Bearer {self._access_token}"},
                params=params or {},
                timeout=30,
            )
        resp.raise_for_status()
        return resp.json()

    async def _post(self, path: str, body: dict) -> Any:
        if not await self.ensure_authenticated():
            raise RuntimeError("Microsoft Graph: not authenticated.")
        audit_logger.log_api_call("microsoft_graph", path)
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{GRAPH_BASE}{path}",
                headers={
                    "Authorization": f"Bearer {self._access_token}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=30,
            )
        resp.raise_for_status()
        return resp.json()

    # ── Calendar ─────────────────────────────────────────────────────────────

    async def list_events(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None,
        top: int = 20,
    ) -> List[dict]:
        """List calendar events between start and end (ISO 8601 strings)."""
        now = datetime.now(timezone.utc)
        params = {
            "$top": top,
            "$orderby": "start/dateTime",
            "$select": "id,subject,start,end,location,attendees,bodyPreview,organizer,isAllDay",
        }
        if start:
            params["startDateTime"] = start
        if end:
            params["endDateTime"] = end
        else:
            params["endDateTime"] = (now + timedelta(days=settings.max_calendar_days_ahead)).isoformat()
        data = await self._get("/me/calendarView", params=params)
        return data.get("value", [])

    async def create_event(self, event: dict) -> dict:
        """Create a calendar event. Event should match Graph API format."""
        return await self._post("/me/events", event)

    async def get_attendee_availability(
        self, emails: List[str], start: str, end: str
    ) -> dict:
        """Find meeting times using the findMeetingTimes API."""
        body = {
            "attendees": [{"emailAddress": {"address": e}} for e in emails],
            "timeConstraint": {
                "activityDomain": "work",
                "timeSlots": [{"start": {"dateTime": start, "timeZone": "UTC"},
                               "end": {"dateTime": end, "timeZone": "UTC"}}],
            },
            "meetingDuration": "PT1H",
            "maxCandidates": 5,
        }
        return await self._post("/me/findMeetingTimes", body)

    # ── Mail ─────────────────────────────────────────────────────────────────

    async def list_emails(
        self,
        folder: str = "inbox",
        search: Optional[str] = None,
        sender: Optional[str] = None,
        top: int = None,
    ) -> List[dict]:
        """List emails with optional search/sender filter."""
        top = top or settings.max_email_fetch
        params = {
            "$top": top,
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,isRead",
        }
        if search:
            params["$search"] = f'"{search}"'
        if sender:
            params["$filter"] = f"from/emailAddress/address eq '{sender}'"
        return (await self._get(f"/me/mailFolders/{folder}/messages", params)).get("value", [])

    async def get_email_body(self, message_id: str) -> dict:
        """Fetch the full body of a specific email."""
        return await self._get(f"/me/messages/{message_id}?$select=id,subject,from,body,receivedDateTime,toRecipients,ccRecipients")

    async def send_email(self, to: List[str], subject: str, body: str) -> None:
        """Send an email on the CEO's behalf."""
        msg = {
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": body},
                "toRecipients": [{"emailAddress": {"address": a}} for a in to],
            }
        }
        audit_logger.log("send_email", "mail", {"to": to, "subject": subject})
        await self._post("/me/sendMail", msg)

    # ── OneNote ───────────────────────────────────────────────────────────────

    async def list_notebooks(self) -> List[dict]:
        data = await self._get("/me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime")
        return data.get("value", [])

    async def list_sections(self, notebook_id: str) -> List[dict]:
        data = await self._get(f"/me/onenote/notebooks/{notebook_id}/sections?$select=id,displayName")
        return data.get("value", [])

    async def list_pages(self, section_id: str, top: int = 20) -> List[dict]:
        data = await self._get(f"/me/onenote/sections/{section_id}/pages?$select=id,title,lastModifiedDateTime&$top={top}")
        return data.get("value", [])

    async def get_page_content(self, page_id: str) -> str:
        """Return HTML content of a OneNote page."""
        if not await self.ensure_authenticated():
            raise RuntimeError("Not authenticated")
        async with httpx.AsyncClient() as http:
            resp = await http.get(
                f"{GRAPH_BASE}/me/onenote/pages/{page_id}/content",
                headers={"Authorization": f"Bearer {self._access_token}"},
                timeout=30,
            )
        resp.raise_for_status()
        return resp.text

    async def create_onenote_page(self, section_id: str, title: str, content_html: str) -> dict:
        """Create a new OneNote page with HTML content."""
        if not await self.ensure_authenticated():
            raise RuntimeError("Not authenticated")
        html = f"<!DOCTYPE html><html><head><title>{title}</title></head><body>{content_html}</body></html>"
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{GRAPH_BASE}/me/onenote/sections/{section_id}/pages",
                headers={
                    "Authorization": f"Bearer {self._access_token}",
                    "Content-Type": "text/html",
                },
                content=html.encode(),
                timeout=30,
            )
        resp.raise_for_status()
        return resp.json()

    # ── SharePoint ────────────────────────────────────────────────────────────

    async def search_sharepoint(self, query: str, top: int = 10) -> List[dict]:
        """Full-text search across SharePoint."""
        params = {
            "$search": f'"{query}"',
            "$top": top,
            "$select": "id,name,webUrl,lastModifiedDateTime,file",
        }
        data = await self._get("/search/query", params={"q": query})
        # Graph search API has a different shape
        hits = []
        for response in data.get("value", []):
            for hit_container in response.get("hitsContainers", []):
                for hit in hit_container.get("hits", []):
                    hits.append({
                        "title": hit.get("summary", ""),
                        "url": hit.get("resource", {}).get("webUrl", ""),
                        "last_modified": hit.get("resource", {}).get("lastModifiedDateTime", ""),
                    })
        return hits[:top]

    # ── Contacts / People ────────────────────────────────────────────────────

    async def search_contacts(self, name: str) -> List[dict]:
        """Search contacts and people directory."""
        params = {
            "$search": f'"{name}"',
            "$select": "displayName,emailAddresses,jobTitle,companyName,department",
        }
        data = await self._get("/me/people", params=params)
        return data.get("value", [])


ms_graph = MicrosoftGraphClient()
