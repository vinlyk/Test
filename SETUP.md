# YouTube Transcript Analyzer — Setup Guide (Windows)

Analyzes YouTube videos using your Claude subscription. No API key or credit balance needed — it uses the `claude` CLI you already have installed.

---

## What the app does

1. You paste a YouTube URL into the web UI (or CLI).
2. It downloads the video's captions automatically.
3. It sends the transcript to Claude (via your desktop Claude subscription) and extracts the key points.
4. Results appear in a clean web page: importance-tagged key points + full transcript.

---

## Prerequisites

### 1. Python 3.11 or newer
Download: https://www.python.org/downloads/windows/

During installation **check "Add Python to PATH"** — this is unchecked by default and causes most issues.

Verify in Command Prompt:
```
python --version
```

### 2. Git
Download: https://git-scm.com/download/win

Verify:
```
git --version
```

### 3. Claude desktop app + CLI
Download: https://claude.ai/download

After installing:
- Open Claude → Settings → **Developer** → enable **"Claude Code (beta)"** (this enables the `claude` CLI)
- Restart your terminal after enabling

Verify:
```
claude --version
```

---

## Installation

Open **Command Prompt** (not PowerShell — some pip commands behave differently there):

```cmd
git clone https://github.com/vinlyk/test.git YouTubeAnalyzer
cd YouTubeAnalyzer
python -m pip install -r requirements.txt
```

That installs three packages: `youtube-transcript-api`, `flask`, and `pytest`.

---

## Running the Web UI

### Option A — Double-click launcher (easiest)
Double-click `run.bat` in the project folder. It:
- Checks Python is installed
- Installs/updates dependencies
- Starts the web server
- Opens your browser automatically

### Option B — Command Prompt
```cmd
cd YouTubeAnalyzer
python web_ui.py
```

Then open: http://localhost:5000

The app auto-scans ports 5000–5100 if 5000 is busy. The terminal shows the actual port.

### To stop the server
Press `Ctrl+C` in the terminal window.

---

## Running the CLI

```cmd
python analyzer.py https://www.youtube.com/watch?v=VIDEO_ID
```

**All flags:**

| Flag | What it does |
|------|-------------|
| `--timestamps` | Include `[MM:SS]` timestamps in transcript |
| `--no-transcript` | Key points only, no full transcript |
| `--json` | Output everything as JSON (good for scripting) |
| `--language de` | Prefer German captions (any ISO 639-1 code) |
| `--model claude-opus-4-8` | Override Claude model |

**Examples:**

```cmd
:: Basic analysis
python analyzer.py https://youtu.be/dQw4w9WgXcQ

:: Key points only, JSON output
python analyzer.py https://youtu.be/dQw4w9WgXcQ --no-transcript --json

:: German transcript with timestamps
python analyzer.py https://www.youtube.com/watch?v=dQw4w9WgXcQ --language de --timestamps

:: Save output to a file
python analyzer.py https://youtu.be/dQw4w9WgXcQ --json > result.json
```

---

## File structure

```
YouTubeAnalyzer/
├── analyzer.py       CLI entry point (argparse)
├── web_ui.py         Flask web server + single-page UI
├── analysis.py       Calls claude CLI, parses key points
├── transcript.py     YouTube transcript fetch + clean
├── chunker.py        Splits long transcripts for analysis
├── run.bat           Windows one-click launcher
├── run.sh            macOS/Linux one-click launcher
├── requirements.txt  Python dependencies
└── tests/            pytest test suite (90 tests)
```

---

## Troubleshooting

### `python` not recognized
You didn't check "Add Python to PATH" during installation.  
Fix: Reinstall Python and check the box, or add it manually:  
`C:\Users\<you>\AppData\Local\Programs\Python\Python311\` and its `Scripts\` subfolder.

### `claude` not recognized
The Claude CLI isn't in PATH.  
Fix: Enable it in Claude → Settings → Developer → Claude Code, then **restart your terminal**.

### Port already in use
The app auto-finds the next free port (5000–5100). Check the terminal output for the actual URL.  
If port scanning fails: stop other apps on port 5000, or edit `web_ui.py` line `find_free_port(5000, 5100)` to a different range.

### "No transcript available" error
The video has no captions. This affects:
- Very new videos (captions take time)
- Videos where the owner disabled captions
- Some live streams

Try a different video, or add `--language en` to force English captions.

### Browser doesn't open automatically
Go to http://localhost:5000 manually (or the port shown in the terminal).

### `pip` errors about permissions
Run Command Prompt as Administrator, or add `--user`:
```cmd
python -m pip install -r requirements.txt --user
```

### Analysis takes a long time
Long videos (1+ hour) are split into chunks and analyzed in multiple passes. This is normal. Each chunk takes ~30–60 seconds via the Claude CLI.

---

## Running tests

```cmd
python -m pytest tests/ -v
```

All 90 tests should pass. Tests use mocks — no internet or Claude subscription needed to run them.
