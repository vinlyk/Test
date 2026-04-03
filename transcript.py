"""
YouTube transcript fetching and cleaning.
"""
import re
from urllib.parse import urlparse, parse_qs

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class TranscriptError(Exception):
    """Wraps all youtube-transcript-api errors."""
    pass


def extract_video_id(url: str) -> str:
    """
    Extract a YouTube video ID from any common URL format or bare ID.

    Supports:
      - https://youtu.be/ID
      - https://www.youtube.com/watch?v=ID
      - https://youtube.com/shorts/ID
      - https://www.youtube.com/embed/ID
      - Bare 11-character video IDs

    Raises ValueError if no valid ID can be found.
    """
    if not url or not url.strip():
        raise ValueError("Empty URL provided.")

    url = url.strip()

    # Bare ID: alphanumeric + hyphens + underscores, exactly 11 chars
    if re.match(r'^[\w-]{11}$', url):
        return url

    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    # youtu.be short links
    if "youtu.be" in hostname:
        video_id = parsed.path.lstrip("/").split("/")[0].split("?")[0]
        if video_id:
            return video_id
        raise ValueError(f"Could not extract video ID from URL: {url}")

    # youtube.com URLs
    if "youtube.com" in hostname:
        # /watch?v=ID
        if parsed.path.startswith("/watch"):
            params = parse_qs(parsed.query)
            ids = params.get("v", [])
            if ids:
                return ids[0]

        # /shorts/ID or /embed/ID
        path_parts = [p for p in parsed.path.split("/") if p]
        for keyword in ("shorts", "embed"):
            if keyword in path_parts:
                idx = path_parts.index(keyword)
                if idx + 1 < len(path_parts):
                    return path_parts[idx + 1]

    raise ValueError(f"Could not extract a YouTube video ID from: {url}")


def fetch_transcript(video_id: str, languages: list = None) -> list:
    """
    Fetch raw transcript data for a YouTube video.

    Returns a list of dicts with keys: 'text', 'start', 'duration'.
    Falls back to any available transcript if the preferred language is not found.

    Raises TranscriptError on any failure.
    """
    if languages is None:
        languages = ["en"]

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=languages)
        return fetched.to_raw_data()
    except TranscriptsDisabled as e:
        raise TranscriptError(f"Transcripts are disabled for this video.") from e
    except NoTranscriptFound:
        # Fall back: pick any available transcript
        try:
            transcript_list = api.list(video_id)
            transcript = transcript_list.find_transcript([])
            fetched = transcript.fetch()
            return fetched.to_raw_data()
        except Exception as inner:
            raise TranscriptError(
                f"No transcript found for video '{video_id}'. "
                "The video may not have captions available."
            ) from inner
    except VideoUnavailable as e:
        raise TranscriptError(
            f"Video '{video_id}' is unavailable. Check the URL and that the video is public."
        ) from e
    except Exception as e:
        raise TranscriptError(f"Failed to fetch transcript: {e}") from e


def clean_transcript(raw: list, include_timestamps: bool = False) -> str:
    """
    Clean raw transcript entries into readable text.

    Strips noise markers ([Music], [Applause], ♪), normalizes whitespace.
    Optionally prefixes each entry with [MM:SS] timestamps.
    """
    _NOISE_PATTERN = re.compile(
        r'\[(?:Music|Applause|Laughter|Cheering|Booing|Crowd|Background)[^\]]*\]',
        flags=re.IGNORECASE,
    )
    _MUSIC_NOTE_PATTERN = re.compile(r'♪[^♪]*♪|♪')

    lines = []
    for entry in raw:
        text = entry.get("text", "") or ""

        # Strip noise markers
        text = _NOISE_PATTERN.sub("", text)
        text = _MUSIC_NOTE_PATTERN.sub("", text)

        # Normalize whitespace
        text = " ".join(text.split())

        if not text:
            continue

        if include_timestamps:
            start = float(entry.get("start", 0))
            total_seconds = int(start)
            mm = total_seconds // 60
            ss = total_seconds % 60
            text = f"[{mm:02d}:{ss:02d}] {text}"

        lines.append(text)

    return "\n".join(lines)
