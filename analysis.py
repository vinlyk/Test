"""
Claude API integration for transcript analysis.
"""
import json

from chunker import needs_chunking, split_into_chunks

DEFAULT_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM_PROMPT_TEXT = (
    "You analyze YouTube transcripts. "
    "Output ONLY a valid JSON array of key points. "
    "Each item: {\"point\": \"concise statement\", \"importance\": \"high|medium|low\"}. "
    "Maximum 10 items. No preamble, no explanation, no markdown fences. "
    "Output the raw JSON array only."
)

_SYSTEM_PARAM = [
    {
        "type": "text",
        "text": _SYSTEM_PROMPT_TEXT,
        "cache_control": {"type": "ephemeral"},
    }
]


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


def _analyze_single_pass(client, text: str, model: str) -> list:
    """Send the full transcript in one API call and return key points."""
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=_SYSTEM_PARAM,
        messages=[{"role": "user", "content": text}],
    )
    return _parse_key_points(response.content[0].text)


def _summarize_chunk(client, chunk: str, chunk_index: int, total_chunks: int, model: str) -> list:
    """Extract key points from a single chunk."""
    user_content = (
        f"This is part {chunk_index + 1} of {total_chunks} of the transcript.\n\n{chunk}"
    )
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=_SYSTEM_PARAM,
        messages=[{"role": "user", "content": user_content}],
    )
    return _parse_key_points(response.content[0].text)


def _consolidate_summaries(client, all_chunk_points: list, model: str) -> list:
    """Merge key points from all chunks into a final deduplicated list (max 10)."""
    combined = json.dumps(all_chunk_points, indent=2)
    user_content = (
        "Below are key points extracted from different parts of a video transcript. "
        "Consolidate them: remove duplicates, rank by importance, and return the top 10 "
        "as a JSON array with the same schema {\"point\": \"...\", \"importance\": \"high|medium|low\"}.\n\n"
        + combined
    )
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=_SYSTEM_PARAM,
        messages=[{"role": "user", "content": user_content}],
    )
    return _parse_key_points(response.content[0].text)


def _analyze_chunked(client, text: str, model: str) -> tuple:
    """
    Map-reduce analysis for long transcripts.
    Returns (key_points, chunks_used) where chunks_used = N_chunks + 1 consolidation call.
    """
    chunks = split_into_chunks(text)
    if not chunks:
        return [], 0

    all_chunk_points = []
    for i, chunk in enumerate(chunks):
        points = _summarize_chunk(client, chunk, i, len(chunks), model)
        all_chunk_points.extend(points)

    key_points = _consolidate_summaries(client, all_chunk_points, model)
    return key_points, len(chunks) + 1


def analyze_transcript(client, transcript_text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Analyze a transcript and return key points.

    Returns:
        {
            "key_points": list[dict],   # [{"point": "...", "importance": "high|medium|low"}]
            "model_used": str,
            "chunks_used": int,         # 1 for single-pass, N+1 for chunked
        }
    """
    if needs_chunking(transcript_text):
        key_points, chunks_used = _analyze_chunked(client, transcript_text, model)
    else:
        key_points = _analyze_single_pass(client, transcript_text, model)
        chunks_used = 1

    return {
        "key_points": key_points,
        "model_used": model,
        "chunks_used": chunks_used,
    }
