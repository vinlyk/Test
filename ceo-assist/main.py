"""
CEO-Assist — FastAPI application entry point.

Run with:
    uvicorn main:app --reload --host 127.0.0.1 --port 8000

The app is intentionally bound to localhost only. It should NOT be exposed
to the network without proper authentication and TLS.
"""
import json
import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config.settings import settings
from agent.ceo_agent import get_agent, CEOAssistAgent
from security.audit_log import audit_logger
from integrations.microsoft_graph import ms_graph

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CEO-Assist",
    description="AI Executive Assistant powered by Claude Opus 4.6",
    version="1.0.0",
    docs_url=None,  # Disable public docs in production
    redoc_url=None,
)

# CORS: restrict to localhost only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
_static_path = Path(__file__).parent / "ui" / "static"
if _static_path.exists():
    app.mount("/static", StaticFiles(directory=str(_static_path)), name="static")


# ── Request/Response Models ───────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str


class ResetRequest(BaseModel):
    confirm: bool = False


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the main UI."""
    html_path = Path(__file__).parent / "ui" / "templates" / "index.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>CEO-Assist</h1><p>UI template not found.</p>")


@app.get("/api/status")
async def status():
    """Health check and integration status."""
    return {
        "status": "running",
        "model": "claude-opus-4-6",
        "timestamp": datetime.utcnow().isoformat(),
        "integrations": {
            "microsoft": settings.is_ms_configured(),
            "affinity_crm": settings.is_affinity_configured(),
            "pitchbook": settings.is_pitchbook_configured(),
            "travel": settings.is_travel_configured(),
            "anthropic": bool(settings.anthropic_api_key),
        },
    }


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for streaming chat.

    Protocol:
      Client → Server: {"message": "..."}
      Server → Client: {"type": "chunk", "text": "..."}
                       {"type": "done"}
                       {"type": "error", "message": "..."}
    """
    await websocket.accept()
    agent = get_agent()
    logger.info("WebSocket connection established")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            user_msg = payload.get("message", "").strip()
            if not user_msg:
                continue

            if user_msg.lower() == "/reset":
                agent.reset_conversation()
                await websocket.send_json({"type": "done", "text": "Conversation reset."})
                continue

            # Stream response
            try:
                async for chunk in agent.chat_stream(user_msg):
                    await websocket.send_json({"type": "chunk", "text": chunk})
                await websocket.send_json({"type": "done"})
            except Exception as exc:
                logger.error("Chat error: %s", exc, exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "message": f"Error: {exc}",
                })
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)


@app.post("/api/reset")
async def reset_conversation(req: ResetRequest):
    """Reset the conversation history."""
    if req.confirm:
        get_agent().reset_conversation()
        return {"status": "reset", "message": "Conversation cleared."}
    return {"status": "no-op", "message": "Send confirm=true to reset."}


@app.get("/api/audit")
async def get_audit_log(n: int = 50):
    """Return the last n audit log entries."""
    entries = audit_logger.tail(n)
    return {"entries": entries}


# Microsoft OAuth endpoints
@app.get("/api/microsoft/auth/start")
async def ms_auth_start():
    """Start Microsoft device-code flow."""
    if not settings.is_ms_configured():
        raise HTTPException(
            status_code=400,
            detail="Microsoft integration not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env",
        )
    try:
        flow = await ms_graph.start_device_code_flow()
        return flow
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/microsoft/auth/complete")
async def ms_auth_complete(body: dict):
    """Poll and complete the device-code flow."""
    device_code = body.get("device_code", "")
    if not device_code:
        raise HTTPException(status_code=400, detail="device_code required")
    success = await ms_graph.complete_device_code_flow(device_code)
    return {"success": success, "message": "Authenticated!" if success else "Authentication failed or timed out."}


@app.get("/api/microsoft/auth/status")
async def ms_auth_status():
    """Check if Microsoft is authenticated."""
    is_auth = await ms_graph.ensure_authenticated()
    return {"authenticated": is_auth}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  CEO-Assist — Starting on http://127.0.0.1:8000")
    print("  This app is LOCAL ONLY — do not expose to the internet")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
