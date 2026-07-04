# YouTube Transcript Analyzer — Setup Guide (Windows)

## What This App Does

This tool takes any YouTube video URL and:
1. Fetches the full video transcript (auto-generated or manual captions)
2. Sends the transcript to Claude AI to extract the **top 10 key points** with importance ratings (HIGH / MEDIUM / LOW)
3. Displays both the full transcript and the key points

**Two modes:**
- **Web UI** — opens a browser page, paste URL, click Analyze
- **CLI** — run from terminal, supports JSON output for scripting

---

## Prerequisites

Install the following before starting:

| Tool | Version | Download |
|---|---|---|
| Python | 3.11 or later | https://www.python.org/downloads/ |
| Git | Any recent version | https://git-scm.com/download/win |

**Python install tip:** During Python installation, check **"Add Python to PATH"** — this is required.

**Verify your installs** by opening Command Prompt and running:
```cmd
python --version
pip --version
git --version
```

---

## Installation

Open **Command Prompt** (or PowerShell) and run:

```cmd
git clone https://github.com/vinlyk/Test.git
cd Test
git checkout claude/youtube-transcript-analyzer-e1Wza
pip install -r requirements.txt
```

---

## Configuration — Anthropic API Key

You need an Anthropic API key to use Claude AI. Get one at https://console.anthropic.com.

### Option A — Set for this terminal session only (quickest)

**Command Prompt:**
```cmd
set ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
```

**PowerShell:**
```powershell
$env:ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"
```

### Option B — Set permanently (recommended)

1. Press `Win + S`, search for **"Environment Variables"**
2. Click **"Edit the system environment variables"**
3. Click **"Environment Variables..."**
4. Under **User variables**, click **New**
5. Variable name: `ANTHROPIC_API_KEY`
6. Variable value: `sk-ant-YOUR-KEY-HERE`
7. Click OK on all dialogs
8. Restart any open terminals for the change to take effect

---

## Running the Web UI (Recommended)

### One-click launch
Double-click **`run.bat`** in the `Test` folder.

On first run it installs dependencies automatically, then launches the app and opens your browser.

### From terminal
```cmd
python web_ui.py
```

The browser opens automatically at `http://localhost:5000` (or the next free port if 5000 is in use).

**What you'll see:**
- Paste a YouTube URL in the input box
- Your API key is pre-filled if set as an environment variable
- Click **Analyze** (or press Enter)
- Results appear in two tabs: **Key Points** and **Full Transcript**

---

## Running the CLI

```cmd
python analyzer.py <youtube_url> [options]
```

### Options

| Flag | Description |
|---|---|
| `--timestamps` | Include `[MM:SS]` timestamps in transcript |
| `--no-transcript` | Show key points only (skip full transcript) |
| `--json` | Output everything as JSON (good for scripting) |
| `--model MODEL` | Override Claude model (default: `claude-haiku-4-5-20251001`) |
| `--language LANG` | Preferred transcript language code (default: `en`) |

### Exit codes
| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Transcript error (no captions, bad URL) |
| 2 | API error (bad key, rate limit) |
| 3 | Unexpected error |

---

## Usage Examples

```cmd
:: Basic analysis
python analyzer.py https://www.youtube.com/watch?v=VIDEO_ID

:: Key points only
python analyzer.py https://youtu.be/VIDEO_ID --no-transcript

:: Full JSON output (good for piping to other tools)
python analyzer.py https://youtu.be/VIDEO_ID --json

:: With timestamps
python analyzer.py https://youtu.be/VIDEO_ID --timestamps

:: Non-English video (Spanish)
python analyzer.py https://youtu.be/VIDEO_ID --language es

:: Short URL format also works
python analyzer.py https://youtu.be/dQw4w9WgXcQ

:: YouTube Shorts work too
python analyzer.py https://youtube.com/shorts/VIDEO_ID
```

---

## File Structure

```
Test/
├── analyzer.py        # CLI entry point
├── web_ui.py          # Flask web UI (browser-based)
├── transcript.py      # YouTube URL parsing + transcript fetching/cleaning
├── analysis.py        # Claude AI integration (single-pass + chunked for long videos)
├── chunker.py         # Splits very long transcripts into chunks (no API calls)
├── requirements.txt   # Python dependencies
├── run.bat            # Windows one-click launcher
├── run.sh             # macOS/Linux one-click launcher
└── tests/             # Full pytest test suite (92 tests)
    ├── test_transcript.py
    ├── test_chunker.py
    ├── test_analysis.py
    └── test_analyzer.py
```

---

## Cost

The app uses **Claude Haiku** by default — the cheapest Claude model.

| Video length | Approximate cost |
|---|---|
| < 15 minutes | ~$0.001 |
| 30–60 minutes | ~$0.002 |
| 2 hours | ~$0.007 |
| 3+ hours | ~$0.010 |

Most videos cost under **$0.01**.

---

## Troubleshooting

### `pip` is not recognized
Python was not added to PATH during installation. Either reinstall Python with "Add to PATH" checked, or use:
```cmd
python -m pip install -r requirements.txt
```

### `python` is not recognized
Python is not on PATH. Reinstall Python from https://www.python.org/downloads/ and check "Add Python to PATH".

### Browser opens but shows "This site can't be reached"
The server may still be starting. Wait 2–3 seconds and refresh the page. If it persists, the port may be blocked by your company firewall — try running on a different port:
```cmd
set FLASK_RUN_PORT=8080
python web_ui.py
```

### "Transcripts are disabled for this video"
The video owner has disabled captions. Try a different video.

### "No transcript found"
The video has no captions in the requested language. Try adding `--language en` (or another language code) or omit the language flag to auto-select any available transcript.

### "Invalid API key"
Double-check your `ANTHROPIC_API_KEY` value. Make sure there are no leading/trailing spaces and that it starts with `sk-ant-`.

### Port already in use
The app automatically scans ports 5000–5100 and picks the first free one. The terminal output shows the exact URL — look for `Open: http://localhost:XXXX`.

### Company firewall blocks YouTube
Some corporate networks block YouTube. If transcript fetching fails with a connection error, you may need to use this tool on a personal network or request a firewall exception.

---

## Running Tests

To verify everything is working correctly:
```cmd
python -m pytest tests/ -v
```

All 92 tests should pass. Tests use mocks and do **not** require an API key or internet access.
