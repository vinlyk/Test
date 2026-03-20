"""
Central tool registry.

All tools are defined here as Anthropic tool schemas, and their
implementation functions are mapped in TOOL_REGISTRY.
"""
from typing import Any, Callable, Dict, List

# Tool implementations are imported here
from .calendar_tools import (
    list_calendar_events,
    find_meeting_slots,
    create_meeting,
)
from .email_tools import (
    list_emails,
    read_email,
    search_emails_by_person,
)
from .notes_tools import (
    list_onenote_notebooks,
    search_onenote,
    create_meeting_notes,
)
from .crm_tools import (
    search_person_in_crm,
    get_person_background,
    add_crm_note,
)
from .research_tools import (
    research_company,
    research_person,
    web_search,
)
from .travel_tools import (
    search_flights,
    search_hotels,
    get_airport_code,
)
from .local_file_tools import (
    read_local_file,
    list_local_files,
    write_meeting_notes,
)

# ── Tool Schemas (Anthropic format) ──────────────────────────────────────────

TOOL_SCHEMAS: List[dict] = [

    # ── Calendar ─────────────────────────────────────────────────────────────
    {
        "name": "list_calendar_events",
        "description": (
            "List the CEO's upcoming calendar events. "
            "Use this to check the schedule, prepare for meetings, or find free slots."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days ahead to look (default 7)",
                    "default": 7,
                },
                "filter_keyword": {
                    "type": "string",
                    "description": "Optional keyword to filter events by subject",
                },
            },
        },
    },
    {
        "name": "find_meeting_slots",
        "description": (
            "Find available time slots for a meeting with specified attendees. "
            "Checks everyone's calendar and suggests open windows."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "attendee_emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee email addresses",
                },
                "duration_minutes": {
                    "type": "integer",
                    "description": "Desired meeting duration in minutes (default 60)",
                    "default": 60,
                },
                "days_ahead": {
                    "type": "integer",
                    "description": "How many days ahead to search (default 14)",
                    "default": 14,
                },
            },
            "required": ["attendee_emails"],
        },
    },
    {
        "name": "create_meeting",
        "description": "Create a calendar meeting/event with specified attendees and details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "subject": {"type": "string", "description": "Meeting subject/title"},
                "start_datetime": {"type": "string", "description": "Start time (ISO 8601, e.g. 2024-03-15T14:00:00)"},
                "end_datetime": {"type": "string", "description": "End time (ISO 8601)"},
                "attendee_emails": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Attendee email addresses",
                },
                "location": {"type": "string", "description": "Meeting location or Teams/Zoom link"},
                "body": {"type": "string", "description": "Meeting description / agenda"},
            },
            "required": ["subject", "start_datetime", "end_datetime", "attendee_emails"],
        },
    },

    # ── Email ────────────────────────────────────────────────────────────────
    {
        "name": "list_emails",
        "description": "List recent emails from the CEO's inbox with subject and preview.",
        "input_schema": {
            "type": "object",
            "properties": {
                "folder": {
                    "type": "string",
                    "description": "Folder to list (inbox, sentItems, drafts). Default: inbox",
                    "default": "inbox",
                },
                "count": {"type": "integer", "description": "Number of emails to fetch (default 10)", "default": 10},
                "unread_only": {"type": "boolean", "description": "Only return unread emails", "default": False},
            },
        },
    },
    {
        "name": "read_email",
        "description": "Read the full body of a specific email by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email_id": {"type": "string", "description": "The email message ID from list_emails"},
            },
            "required": ["email_id"],
        },
    },
    {
        "name": "search_emails_by_person",
        "description": (
            "Search for all recent email threads with a specific person. "
            "Use this to get context before a meeting with that person."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "email_or_name": {"type": "string", "description": "Email address or name of the person"},
                "count": {"type": "integer", "description": "Number of emails to retrieve (default 10)", "default": 10},
            },
            "required": ["email_or_name"],
        },
    },

    # ── Notes / OneNote ──────────────────────────────────────────────────────
    {
        "name": "list_onenote_notebooks",
        "description": "List available OneNote notebooks and their sections.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "search_onenote",
        "description": "Search OneNote pages for content related to a topic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_meeting_notes",
        "description": (
            "Create a structured meeting notes page in OneNote. "
            "Use after a meeting to capture key points, decisions, and action items."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "meeting_title": {"type": "string"},
                "date": {"type": "string", "description": "Meeting date (YYYY-MM-DD)"},
                "attendees": {"type": "array", "items": {"type": "string"}},
                "key_points": {"type": "array", "items": {"type": "string"}, "description": "Main discussion points"},
                "decisions": {"type": "array", "items": {"type": "string"}},
                "action_items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "task": {"type": "string"},
                            "owner": {"type": "string"},
                            "due_date": {"type": "string"},
                        },
                    },
                },
                "section_id": {"type": "string", "description": "OneNote section ID to save to (optional)"},
            },
            "required": ["meeting_title", "date", "attendees"],
        },
    },

    # ── CRM (Affinity) ────────────────────────────────────────────────────────
    {
        "name": "search_person_in_crm",
        "description": (
            "Search for a person in Affinity CRM to get their background, "
            "organization, and relationship history."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Person's full name"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "get_person_background",
        "description": "Get detailed background and interaction history for a person from the CRM.",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {"type": "integer", "description": "Affinity person ID from search_person_in_crm"},
                "include_notes": {"type": "boolean", "default": True},
            },
            "required": ["person_id"],
        },
    },
    {
        "name": "add_crm_note",
        "description": "Add a note about a person to Affinity CRM (e.g., post-meeting summary).",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_id": {"type": "integer"},
                "note": {"type": "string", "description": "Note content"},
            },
            "required": ["person_id", "note"],
        },
    },

    # ── Research ──────────────────────────────────────────────────────────────
    {
        "name": "research_company",
        "description": (
            "Research a company using Pitchbook data — funding, investors, "
            "employees, revenue stage, and comparable companies."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
            },
            "required": ["company_name"],
        },
    },
    {
        "name": "research_person",
        "description": "Research an individual's professional background, board positions, and prior companies.",
        "input_schema": {
            "type": "object",
            "properties": {
                "person_name": {"type": "string"},
            },
            "required": ["person_name"],
        },
    },
    {
        "name": "web_search",
        "description": (
            "Search the web for recent news, articles, or information about a topic, "
            "person, company, or industry. Returns summarized search results."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "focus": {
                    "type": "string",
                    "description": "Focus area: news | company | person | industry | general",
                    "default": "general",
                },
            },
            "required": ["query"],
        },
    },

    # ── Travel ────────────────────────────────────────────────────────────────
    {
        "name": "search_flights",
        "description": "Search for available flights between two cities.",
        "input_schema": {
            "type": "object",
            "properties": {
                "origin": {"type": "string", "description": "Origin city or IATA code (e.g., SIN, Singapore)"},
                "destination": {"type": "string", "description": "Destination city or IATA code"},
                "departure_date": {"type": "string", "description": "Departure date (YYYY-MM-DD)"},
                "return_date": {"type": "string", "description": "Return date for round trips (YYYY-MM-DD)"},
                "travel_class": {
                    "type": "string",
                    "enum": ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
                    "default": "BUSINESS",
                },
                "adults": {"type": "integer", "default": 1},
            },
            "required": ["origin", "destination", "departure_date"],
        },
    },
    {
        "name": "search_hotels",
        "description": "Search for hotels in a city for specified dates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name or IATA city code"},
                "check_in": {"type": "string", "description": "Check-in date (YYYY-MM-DD)"},
                "check_out": {"type": "string", "description": "Check-out date (YYYY-MM-DD)"},
                "adults": {"type": "integer", "default": 1},
            },
            "required": ["city", "check_in", "check_out"],
        },
    },
    {
        "name": "get_airport_code",
        "description": "Look up the IATA airport code for a city or airport name.",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City or airport name"},
            },
            "required": ["location"],
        },
    },

    # ── Local Files ───────────────────────────────────────────────────────────
    {
        "name": "list_local_files",
        "description": "List files in a specified local directory (restricted to approved paths).",
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Directory path relative to home"},
                "extension": {"type": "string", "description": "Filter by extension (e.g., .pdf, .docx)"},
            },
        },
    },
    {
        "name": "read_local_file",
        "description": "Read the content of a local text/document file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file_path": {"type": "string", "description": "Absolute or home-relative path to the file"},
            },
            "required": ["file_path"],
        },
    },
    {
        "name": "write_meeting_notes",
        "description": "Save meeting notes as a local markdown file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {"type": "string", "description": "Filename (without extension)"},
                "content": {"type": "string", "description": "Markdown content"},
            },
            "required": ["filename", "content"],
        },
    },
]

# ── Implementation Registry ───────────────────────────────────────────────────

TOOL_REGISTRY: Dict[str, Callable] = {
    "list_calendar_events": list_calendar_events,
    "find_meeting_slots": find_meeting_slots,
    "create_meeting": create_meeting,
    "list_emails": list_emails,
    "read_email": read_email,
    "search_emails_by_person": search_emails_by_person,
    "list_onenote_notebooks": list_onenote_notebooks,
    "search_onenote": search_onenote,
    "create_meeting_notes": create_meeting_notes,
    "search_person_in_crm": search_person_in_crm,
    "get_person_background": get_person_background,
    "add_crm_note": add_crm_note,
    "research_company": research_company,
    "research_person": research_person,
    "web_search": web_search,
    "search_flights": search_flights,
    "search_hotels": search_hotels,
    "get_airport_code": get_airport_code,
    "list_local_files": list_local_files,
    "read_local_file": read_local_file,
    "write_meeting_notes": write_meeting_notes,
}


def get_all_tools() -> List[dict]:
    return TOOL_SCHEMAS
