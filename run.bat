@echo off
:: YouTube Transcript Analyzer — Windows launcher
:: Double-click this file to start

cd /d "%~dp0"

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is required. Install from https://python.org
    pause
    exit /b 1
)

:: Install dependencies if needed
echo Checking dependencies...
python -m pip install -r requirements.txt -q

:: Launch
echo Starting YouTube Transcript Analyzer...
python web_ui.py
pause
