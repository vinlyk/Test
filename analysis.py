"""
Claude analysis via the `claude` CLI (uses your Claude subscription — no API key needed).
"""
import json
import shutil
import subprocess

from chunker import needs_chunking, split_into_chunks

DEFAULT_MODEL = None  # None = use CLI default (matches your subscription tier)

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
    """Call `claude -p <prompt>` and return the response text."""
    cmd = ["claude", "-p", prompt]
    if model:
        cmd += ["--model", model]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        raise RuntimeError("`claude` CLI not found. Install Claude Code and log in.")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Claude CLI timed out after 120 seconds.")

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
        points = _summarize_chunk(chunk, i, len(chunks), model=model)
        all_points.extend(points)

    key_points = _consolidate_summaries(all_points, model=model)
    return key_points, len(chunks) + 1


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
        key_points = _analyze_single_pass(transcript_text, model=model)
        chunks_used = 1

    return {
        "key_points": key_points,
        "model_used": model or "claude (subscription default)",
        "chunks_used": chunks_used,
    }
