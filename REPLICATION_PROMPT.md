Build a **YouTube Transcript Analyzer** — a local Python app that fetches a YouTube video's transcript and uses Claude to extract the key points. It must run entirely on my machine using my **Claude subscription via the `claude` CLI** (NO Anthropic API key, no API credits). Provide both a one-click web UI and a command-line interface, plus a full pytest suite that passes offline.

## External dependencies
- Python 3.11+
- The `claude` CLI (from the Claude desktop app / Claude Code) must be installed and on PATH — this is the analysis engine, called via `subprocess`.
- Python packages only: `youtube-transcript-api>=0.6.3`, `flask>=3.0`, `pytest>=7.0`. NO `anthropic` package.

## Files to create

### requirements.txt
```
youtube-transcript-api>=0.6.3
flask>=3.0
pytest>=7.0
```

### transcript.py
- `class TranscriptError(Exception)` — wraps all youtube-transcript-api errors.
- `extract_video_id(url)` — returns the 11-char ID from any of: `youtu.be/ID`, `youtube.com/watch?v=ID`, `youtube.com/shorts/ID`, `youtube.com/embed/ID`, or a bare 11-char ID (`^[\w-]{11}$`). Raise `ValueError` on empty/unparseable input.
- `fetch_transcript(video_id, languages=["en"])` — IMPORTANT: youtube-transcript-api v1.x uses the **instance API**, not the old classmethod. Use `api = YouTubeTranscriptApi(); fetched = api.fetch(video_id, languages=languages); return fetched.to_raw_data()`. On `NoTranscriptFound`, fall back to `api.list(video_id).find_transcript([]).fetch().to_raw_data()`. Catch `TranscriptsDisabled`, `VideoUnavailable`, and generic exceptions, re-raising each as `TranscriptError` with a helpful message. Return a list of `{"text","start","duration"}` dicts.
- `clean_transcript(raw, include_timestamps=False)` — strip noise markers `[Music]/[Applause]/[Laughter]/[Cheering]/[Booing]/[Crowd]/[Background]…` (case-insensitive) and `♪…♪`, collapse whitespace, drop empty lines, join with newlines. If `include_timestamps`, prefix each line with `[MM:SS]` computed from `start` (minutes:seconds only, zero-padded, no hours).

### chunker.py (word-count heuristics only, no API calls)
- Constants: `WORDS_PER_TOKEN = 0.75`, `SINGLE_PASS_WORD_THRESHOLD = 100_000`, `CHUNK_WORD_COUNT = 8_000`.
- `estimate_tokens(text)` → `int(len(text.split()) * WORDS_PER_TOKEN)`.
- `needs_chunking(text)` → `len(text.split()) > SINGLE_PASS_WORD_THRESHOLD`.
- `split_into_chunks(text)` → list of non-overlapping chunks of `CHUNK_WORD_COUNT` words each; `[]` for empty input.

### analysis.py (calls the `claude` CLI)
- `DEFAULT_MODEL = None` (None = use CLI/subscription default).
- `_check_claude_cli()` — raise `RuntimeError` if `shutil.which("claude")` is falsy.
- `_call_claude(prompt, model=None)` — run `["claude", "-p", prompt]` (append `["--model", model]` if given) via `subprocess.run(capture_output=True, text=True, timeout=120)`. Raise `RuntimeError` on `FileNotFoundError`, `TimeoutExpired`, or non-zero return code (include stderr). Return `stdout.strip()`.
- `_parse_key_points(response_text)` — slice from first `[` to last `]`, `json.loads`, and return only dict items containing BOTH `"point"` and `"importance"`. Return `[]` on any failure (never raise).
- `_analyze_single_pass(text, model=None)` — one `_call_claude` with an instruction that says: analyze this YouTube transcript, output ONLY a raw JSON array (no preamble, no markdown fences), max 10 items, each `{"point": "...", "importance": "high|medium|low"}`.
- Map-reduce for long transcripts: `_summarize_chunk(chunk, i, total, model)` per chunk, then `_consolidate_summaries(all_points, model)` (dedupe, rank, top 10). `_analyze_chunked` returns `(key_points, len(chunks)+1)`; empty chunks → `([], 0)`.
- `analyze_transcript(transcript_text, model=DEFAULT_MODEL)` → calls `_check_claude_cli()`, branches on `needs_chunking`, returns `{"key_points": [...], "model_used": model or "claude (subscription default)", "chunks_used": N}` (1 for single pass, chunks+1 for chunked).

### analyzer.py (CLI entry point, argparse)
- Positional `url`. Flags: `--timestamps` (store_true), `--no-transcript` (dest `no_transcript`), `--json` (dest `json_output`), `--model` (default None), `--language` (default `en`).
- Flow: `extract_video_id` → `fetch_transcript(video_id, languages=[args.language])` → `clean_transcript(raw, include_timestamps=args.timestamps)` → `analyze_transcript(transcript, model=args.model)`.
- Exit codes: `ValueError`→1, `TranscriptError`→1, `RuntimeError` (claude)→2, other `Exception`→3. Errors go to stderr.
- Human output: a header block (URL, video id, model, chunks), a `=== Key Points ===` section listing `[IMPORTANCE] point`, and (unless `--no-transcript`) a `=== Transcript ===` section. `--json` emits `{url, video_id, key_points, metadata:{model, chunks_used}, transcript?}` with `indent=2`. Guard with `if __name__ == "__main__": main()`.

### web_ui.py (Flask, single-file, zero external assets)
- Serves one dark-themed HTML page (inline CSS/JS, no CDN) with: a YouTube URL text input, a language input (default `en`), two checkboxes ("Include timestamps", "Key points only (skip transcript)"), and an Analyze button with a spinner. Results render in tabs: **Key Points** (importance badges high/medium/low) and **Full Transcript** (with a Copy button). Subtitle: "Powered by your Claude subscription — no API key needed". There is NO API-key field anywhere.
- `POST /analyze` accepts JSON `{url, language, timestamps, no_transcript}`. Validate URL, run the same pipeline as the CLI, and return `{video_id, key_points, metadata:{model, chunks_used}, transcript?}`. Map errors to status codes: bad URL/transcript→400, claude `RuntimeError`→502, other→500. Escape HTML in rendered points client-side.
- `find_free_port(start=5000, end=5100)` — scan with `socket.bind` for the first free port.
- On `__main__`: pick a free port, spawn a daemon thread that sleeps ~1.5s then `webbrowser.open`s `http://localhost:{port}`, print the URL, and `app.run(host="0.0.0.0", port=port)`.

### run.bat (Windows one-click launcher)
`@echo off`, `cd /d "%~dp0"`, check `python --version`, `python -m pip install -r requirements.txt -q`, then `python web_ui.py`, `pause`.

### run.sh (macOS/Linux one-click launcher)
Bash: `cd` to script dir, verify `python3` and warn if `claude` is missing from PATH, `python3 -m pip install -r requirements.txt -q --break-system-packages || python3 -m pip install -r requirements.txt -q`, print the fallback URL, then `python3 web_ui.py`.

### tests/ (pytest, fully mocked — must pass with NO network and NO claude CLI)
- `test_transcript.py` — URL parsing (all formats + bare ID + invalid), and `clean_transcript` noise stripping / timestamp formatting.
- `test_chunker.py` — `estimate_tokens`, `needs_chunking` boundaries, `split_into_chunks` counts and empty input.
- `test_analysis.py` — mock `analysis.subprocess.run` and `analysis.shutil.which`. Cover `_parse_key_points` (clean JSON, preamble/trailing text, empty, malformed, missing-field filtering, no brackets), single-pass (`claude -p` command shape, model flag on/off), and chunked (N+1 calls, `chunks_used`, empty-chunks→no calls). Assert `analyze_transcript` raises `RuntimeError` when `which` returns None.
- `test_analyzer.py` — import `analyzer` ONCE at module top (do NOT use `importlib.reload` inside patched contexts — it re-imports the real functions and breaks the patches). Use `unittest.mock.patch` on `analyzer.extract_video_id/fetch_transcript/clean_transcript/analyze_transcript` plus `sys.argv/stdout/stderr`. Verify success exit 0, key points / importance labels / transcript in output, `--no-transcript`, `--json` validity, `--language` forwarded to fetch, `--timestamps` forwarded to clean, and exit codes 1 (TranscriptError) and 2 (claude RuntimeError).

## Acceptance
- `python -m pytest tests/ -v` → all tests pass offline (no network, no `claude` needed — everything mocked).
- `python analyzer.py <url>` prints key points + transcript on a real machine with the `claude` CLI logged in.
- `python web_ui.py` opens the browser to a working single-page UI.

## Notes / gotchas
- youtube-transcript-api v1.x is instance-based (`YouTubeTranscriptApi().fetch(...)`), NOT `YouTubeTranscriptApi.get_transcript(...)`.
- On Windows use `python`; on macOS use `python3`. If `pip` alone isn't found, use `python -m pip` / `python3 -m pip`.
- The app never stores or asks for an API key — all analysis goes through the local `claude` CLI subprocess.
