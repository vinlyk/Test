#!/bin/bash
# YouTube Transcript Analyzer — macOS/Linux launcher
# Double-click this file (or: chmod +x run.sh && ./run.sh)

cd "$(dirname "$0")"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "Python 3 is required. Install from https://python.org"
  read -p "Press Enter to exit..."
  exit 1
fi

# Install dependencies if needed
echo "Checking dependencies..."
python3 -m pip install -r requirements.txt -q

# Launch
echo "Starting YouTube Transcript Analyzer..."
python3 web_ui.py
