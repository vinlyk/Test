"""
Claude analysis via the `claude` CLI (uses your Claude subscription — no API key needed).
"""
import json
import os
import shutil
import subprocess
import sys
import time

from chunker import needs_chunking, split_by_chars, split_into_chunks

DEFAULT_MODEL = None  # None = use CLI default (matches your subscription tier)

# Overridable via env for slower machines / long transcripts.
CLAUDE_CLI_TIMEOUT = int(os.environ.get("CLAUDE_CLI_TIMEOUT", "180"))
CLAUDE_CLI_RETRIES = int(os.environ.get("CLAUDE_CLI_RETRIES", "2"))


def _log(message: str):
    """Print a progress line to the terminal running the app."""
    print(f"  [analyzer] {message}", file=sys.stderr, flush=True)

_TRANSLATE_INSTRUCTION = (
    "Translate the following video transcript into natural, fluent English. "
    "Output ONLY the English translation — no preamble, notes, or commentary. "
    "Preserve the line breaks between lines. "
    "If a line starts with a [MM:SS] timestamp, keep that timestamp unchanged at "
    "the start of the line.\n\nTRANSCRIPT:\n"
)

_INSTRUCTION = (
    "Analyze this YouTube transcript and extract key points. "
    "Output ONLY a valid JSON array. "
    "Each item: {\"point\": \"concise statement\", \"importance\": \"high|medium|low\"}. "
    "Maximum 10 items. No preamble, no explanation, no markdown fences. "
    "Output the raw JSON array only.\n\nTRANSCRIPT:\n"
)


def _check_claude_cli():
    if not shutil.which("claude"):
        raise RuntimeError(
            "The `claude` CLI was not found. "
            "Make sure Claude Code is installed and available in your PATH."
        )


def _call_claude(prompt: str, model: str = None) -> str:
    """Call `claude -p <prompt>` and return the response text, retrying on timeout."""
    cmd = ["claude", "-p", prompt]
    if model:
        cmd += ["--model", model]

    last_timeout = None
    for attempt in range(1, CLAUDE_CLI_RETRIES + 2):  # +1 for the initial try
        start = time.time()
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=CLAUDE_CLI_TIMEOUT,
                # Explicitly non-interactive: if `claude` ever waits on a prompt
                # (e.g. a first-run confirmation) it fails fast instead of hanging
                # silently until the timeout.
                stdin=subprocess.DEVNULL,
            )
            _log(f"claude CLI responded in {time.time() - start:.1f}s.")
            break
        except FileNotFoundError:
            raise RuntimeError("`claude` CLI not found. Install Claude Code and log in.")
        except subprocess.TimeoutExpired:
            last_timeout = True
            _log(f"claude CLI call did not respond within {CLAUDE_CLI_TIMEOUT}s (attempt {attempt}).")
            if attempt <= CLAUDE_CLI_RETRIES:
                _log("Retrying...")
                time.sleep(2)
                continue
            raise RuntimeError(
                f"Claude CLI timed out after {CLAUDE_CLI_TIMEOUT}s "
                f"(tried {CLAUDE_CLI_RETRIES + 1} times)."
            )

    if result.returncode != 0:
        raise RuntimeError(f"claude CLI error: {result.stderr.strip() or 'unknown error'}")

    return result.stdout.strip()


def _parse_key_points(response_text: str) -> list:
    """
    Extract a JSON array of key points from Claude's response text.
    Returns [] if parsing fails.
    """
    start = response_text.find("[")
    end = response_text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return []
    try:
        data = json.loads(response_text[start: end + 1])
        if not isinstance(data, list):
            return []
        return [
            p for p in data
            if isinstance(p, dict) and "point" in p and "importance" in p
        ]
    except (json.JSONDecodeError, ValueError):
        return []


def _analyze_single_pass(text: str, model: str = None) -> list:
    response = _call_claude(_INSTRUCTION + text, model=model)
    return _parse_key_points(response)


def _summarize_chunk(chunk: str, chunk_index: int, total_chunks: int, model: str = None) -> list:
    prompt = (
        f"This is part {chunk_index + 1} of {total_chunks} of a YouTube transcript. "
        "Extract key points as a JSON array. "
        "Each item: {\"point\": \"...\", \"importance\": \"high|medium|low\"}. "
        "Output ONLY the raw JSON array.\n\nTRANSCRIPT PART:\n" + chunk
    )
    response = _call_claude(prompt, model=model)
    return _parse_key_points(response)


def _consolidate_summaries(all_points: list, model: str = None) -> list:
    combined = json.dumps(all_points, indent=2)
    prompt = (
        "Below are key points extracted from different parts of a video transcript. "
        "Consolidate them: remove duplicates, rank by importance, return the top 10 as a JSON array. "
        "Each item: {\"point\": \"...\", \"importance\": \"high|medium|low\"}. "
        "Output ONLY the raw JSON array.\n\n" + combined
    )
    response = _call_claude(prompt, model=model)
    return _parse_key_points(response)


def _analyze_chunked(text: str, model: str = None) -> tuple:
    chunks = split_into_chunks(text)
    if not chunks:
        return [], 0

    all_points = []
    for i, chunk in enumerate(chunks):
        _log(f"Extracting key points (part {i + 1}/{len(chunks)})...")
        points = _summarize_chunk(chunk, i, len(chunks), model=model)
        all_points.extend(points)

    _log("Consolidating key points...")
    key_points = _consolidate_summaries(all_points, model=model)
    return key_points, len(chunks) + 1


def translate_to_english(text: str, model: str = DEFAULT_MODEL) -> str:
    """
    Translate a transcript into English via the `claude` CLI (your subscription).

    Splits by character count so non-space-delimited languages (e.g. Chinese) are
    chunked correctly, translates each chunk, and rejoins in order. Returns "" for
    empty input.
    """
    _check_claude_cli()

    if not text.strip():
        return ""

    chunks = split_by_chars(text)
    translated_parts = []
    for i, chunk in enumerate(chunks, 1):
        _log(f"Translating to English (part {i}/{len(chunks)})...")
        response = _call_claude(_TRANSLATE_INSTRUCTION + chunk, model=model)
        translated_parts.append(response.strip())

    return "\n".join(translated_parts)


def analyze_transcript(transcript_text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Analyze a transcript using the `claude` CLI (your subscription, no API key).

    Returns:
        {
            "key_points": list[dict],
            "model_used": str,
            "chunks_used": int,
        }
    """
    _check_claude_cli()

    if needs_chunking(transcript_text):
        key_points, chunks_used = _analyze_chunked(transcript_text, model=model)
    else:
        _log("Extracting key points...")
        key_points = _analyze_single_pass(transcript_text, model=model)
        chunks_used = 1

    return {
        "key_points": key_points,
        "model_used": model or "claude (subscription default)",
        "chunks_used": chunks_used,
    }
