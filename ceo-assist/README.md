# CEO-Assist

An AI-powered executive assistant for your laptop, built on **Claude Opus 4.6** (adaptive thinking + streaming). Runs entirely locally — your data stays on your machine.

## Features

| Feature | Description |
|---------|-------------|
| **Meeting Management** | Check calendar, find common availability, create invites |
| **Pre-Meeting Briefs** | Email history, attendee CRM profiles, research briefings, suggested talking points |
| **Strategic Advice** | Meeting objectives, negotiation stances, recent news context |
| **Post-Meeting Notes** | Structured notes saved to OneNote + local file; CRM updates |
| **Travel Planning** | Business class flights and 5-star hotel search via Amadeus |

## Data Sources

| Integration | What it accesses | Required config |
|-------------|-----------------|-----------------|
| **Microsoft Graph** | Outlook email, Calendar, OneNote, SharePoint, Contacts | Azure app registration |
| **Affinity CRM** | Relationship history, notes, interaction logs | Affinity API key |
| **Pitchbook** | Company funding, investor profiles, bios | Pitchbook API key |
| **Amadeus** | Flight and hotel search | Amadeus API key/secret |
| **Web Search** | Public news and information | None (free DuckDuckGo) |
| **Local Files** | Documents on your laptop | None |

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Anthropic API key ([get one here](https://console.anthropic.com))

### 2. Configure
```bash
cd ceo-assist
cp .env.example .env
# Edit .env and add your API keys
```

**Minimum required:**
```env
ANTHROPIC_API_KEY=your_key_here
```

### 3. Start
```bash
./start.sh
# Opens browser automatically at http://127.0.0.1:8000
```

## Setting Up Integrations

### Microsoft 365 (Outlook, Calendar, OneNote)

1. Go to [Azure Portal](https://portal.azure.com) → App registrations → New registration
2. Name: `CEO-Assist`, Supported account types: `Single tenant`
3. Under **API permissions**, add:
   - `Mail.Read`, `Mail.Send`
   - `Calendars.ReadWrite`
   - `Notes.ReadWrite`
   - `Sites.Read.All`
   - `User.Read`, `Contacts.Read`, `People.Read`
4. Grant admin consent
5. Create a **Client secret** under Certificates & secrets
6. Copy Client ID, Client Secret, Tenant ID to `.env`
7. In the app, click **"Connect Microsoft 365"** → follow the device code flow

### Affinity CRM
1. Go to Affinity → Settings → API Keys → Create key
2. Add to `.env` as `AFFINITY_API_KEY`

### Pitchbook
- Enterprise API access required. Contact your Pitchbook rep for API credentials.

### Travel (Amadeus)
1. Register at [developers.amadeus.com](https://developers.amadeus.com) (free test tier)
2. Create an app and copy API key + secret
3. Update `AMADEUS_BASE_URL` to production URL for live data

## Security Considerations

- The app runs on **localhost only** (`127.0.0.1:8000`) — not exposed to the network
- OAuth tokens are stored in the **OS keychain** (macOS Keychain / Windows Credential Manager / Linux Secret Service), never in plaintext
- All data access is **audit logged** locally at `~/.ceo-assist/data/audit.jsonl`
- Sensitive file paths are **blocked** from local file access
- API keys are loaded from `.env` (never committed to git — add `.env` to `.gitignore`)
- Meeting notes are saved to `~/.ceo-assist/data/meeting_notes/`

## Architecture

```
ceo-assist/
├── main.py                    # FastAPI app (WebSocket streaming)
├── agent/
│   ├── ceo_agent.py           # Claude Opus 4.6 agent (adaptive thinking)
│   ├── system_prompt.py       # CEO-specific system prompt
│   └── tools/
│       ├── calendar_tools.py  # Calendar management
│       ├── email_tools.py     # Email access
│       ├── notes_tools.py     # OneNote + local notes
│       ├── crm_tools.py       # Affinity CRM
│       ├── research_tools.py  # Pitchbook + web search
│       ├── travel_tools.py    # Flights + hotels
│       └── local_file_tools.py# Local document access
├── integrations/
│   ├── microsoft_graph.py     # MS Graph API (OAuth, device-code flow)
│   ├── affinity.py            # Affinity CRM API
│   ├── pitchbook.py           # Pitchbook API
│   └── travel.py              # Amadeus travel API
├── security/
│   ├── credentials.py         # OS keychain credential manager
│   └── audit_log.py           # Append-only audit trail
├── config/settings.py         # Environment-based settings
└── ui/                        # Local web frontend (HTML/CSS/JS)
```

## Privacy & Data Flow

1. You type a message → sent over local WebSocket to the FastAPI backend
2. The agent decides which tools to call (calendar, email, CRM, etc.)
3. Tool calls go directly to the respective APIs (Microsoft, Affinity, etc.)
4. Results are assembled and sent to **Claude Opus 4.6** via the Anthropic API
5. The response streams back to your browser
6. **Nothing is stored in the cloud** except for what you explicitly send to the Anthropic API for Claude to process

The Anthropic API does not train on your data by default. Review [Anthropic's privacy policy](https://www.anthropic.com/privacy) for details.
