#!/bin/bash
# YouTube Transcript Analyzer — macOS double-click launcher.
# Unlike run.sh, a .command file RUNS in Terminal when double-clicked in Finder.
# The window stays open on exit so you can read any messages.

cd "$(dirname "$0")" || exit 1

# Keep this launcher double-clickable after future updates.
chmod +x "$0" 2>/dev/null

echo "============================================"
echo "  YouTube Transcript Analyzer"
echo "============================================"

# --- Python check ---
if ! command -v python3 &>/dev/null; then
  echo "ERROR: Python 3 not found. Install it from https://python.org, then try again."
  echo ""
  read -p "Press Enter to close this window..."
  exit 1
fi
echo "  Python: $(python3 --version 2>&1)"

# --- claude CLI check (the analysis engine) ---
if ! command -v claude &>/dev/null; then
  echo ""
  echo "WARNING: the 'claude' CLI was not found in PATH."
  echo "  The analyzer needs it to extract key points (uses your Claude subscription)."
  echo "  Enable it in the Claude app: Settings > Developer > Claude Code, then reopen Terminal."
  echo "  (Fetching the transcript will still work without it.)"
fi

# --- Dependencies ---
echo ""
echo "Installing dependencies (first run can take a minute)..."
python3 -m pip install -r requirements.txt -q --break-system-packages 2>/dev/null \
  || python3 -m pip install -r requirements.txt -q \
  || echo "  (pip reported an issue — the app will still try to start)"
echo "  Dependencies ready."

# Optional speech-to-text engine (for videos with captions disabled). Best-effort.
echo ""
echo "Installing optional speech-to-text engine (for caption-less videos)..."
python3 -m pip install -r requirements-audio.txt -q --break-system-packages 2>/dev/null \
  || python3 -m pip install -r requirements-audio.txt -q \
  || echo "  (skipped — caption-less videos won't use speech-to-text until this installs)"

# --- Launch ---
echo ""
echo "Starting the web server..."
echo "  Your browser should open automatically."
echo "  If it does not, open the http://localhost:PORT line shown below."
echo "  Leave this window open while using the app. Press Ctrl+C to stop."
echo ""
python3 web_ui.py

# If the server exits (or fails to start), keep the window open so the error is readable.
echo ""
echo "The server has stopped."
read -p "Press Enter to close this window..."
