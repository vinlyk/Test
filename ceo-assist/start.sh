#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CEO-Assist startup script
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Please install Python 3.10+"
  exit 1
fi

# Create venv if not exists
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install dependencies
echo "Installing / updating dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# Check .env
if [ ! -f ".env" ]; then
  echo ""
  echo "WARNING: .env file not found!"
  echo "Copy .env.example to .env and add your API keys:"
  echo "  cp .env.example .env"
  echo "  nano .env"
  echo ""
  echo "At minimum, you need ANTHROPIC_API_KEY to use CEO-Assist."
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CEO-Assist — Starting..."
echo "  Open your browser: http://127.0.0.1:8000"
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open browser after a short delay (macOS / Linux)
if command -v open &>/dev/null; then
  (sleep 2 && open http://127.0.0.1:8000) &
elif command -v xdg-open &>/dev/null; then
  (sleep 2 && xdg-open http://127.0.0.1:8000) &
fi

exec uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info
