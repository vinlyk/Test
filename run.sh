#!/bin/bash
# YouTube Transcript Analyzer — macOS/Linux launcher
# Double-click this file (or: chmod +x run.sh && ./run.sh)

cd "$(dirname "$0")"

echo "============================================"
echo "  YouTube Transcript Analyzer"
echo "============================================"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: Python 3 not found. Install from https://python.org"
  read -p "Press Enter to exit..."
  exit 1
fi

PY_VER=$(python3 --version 2>&1)
echo "  Python: $PY_VER"

# Check claude CLI
if ! command -v claude &>/dev/null; then
  echo ""
  echo "WARNING: 'claude' CLI not found in PATH."
  echo "  The analyzer uses your Claude subscription via the claude CLI."
  echo "  Install Claude: https://claude.ai/download  (then enable CLI in settings)"
  echo "  If already installed, restart your terminal and try again."
  echo ""
fi

# Install dependencies
echo ""
echo "Checking Python dependencies..."
python3 -m pip install -r requirements.txt -q --break-system-packages 2>/dev/null || \
python3 -m pip install -r requirements.txt -q
echo "  Dependencies OK"

# Launch
echo ""
echo "Starting web server..."
echo "  If the browser does not open automatically, go to: http://localhost:5000"
echo "  Press Ctrl+C to stop."
echo ""
python3 web_ui.py
