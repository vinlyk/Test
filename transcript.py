"""
YouTube transcript fetching and cleaning.
"""
import json
import re
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

# Block errors are only present in newer versions — import defensively.
try:
    from youtube_transcript_api._errors import RequestBlocked, IpBlocked
    _BLOCK_ERRORS = (RequestBlocked, IpBlocked)
except ImportError:  # pragma: no cover - depends on library version
    _BLOCK_ERRORS = ()


class TranscriptError(Exception):
    """Wraps all youtube-transcript-api errors."""
    pass


_BLOCK_HELP = (
    "YouTube blocked the transcript request. This almost always means your requests "
    "look like they come from a datacenter IP.\n"
    "  1. If you are on a VPN, turn it OFF and try again (most common fix).\n"
    "  2. Otherwise install yt-dlp so the app can use your browser's YouTube login:\n"
    "       python3 -m pip install yt-dlp\n"
    "     then make sure you are signed in to YouTube in Chrome or Safari and retry."
)


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


# Common regional/script variants, so selecting a base language finds real tracks.
_LANG_VARIANTS = {
    "zh": ["zh", "zh-Hans", "zh-Hant", "zh-CN", "zh-TW", "zh-HK", "zh-Hans-CN", "zh-Hant-TW"],
    "en": ["en", "en-US", "en-GB", "en-orig"],
    "pt": ["pt", "pt-BR", "pt-PT"],
    "es": ["es", "es-ES", "es-419", "es-US"],
    "fr": ["fr", "fr-FR", "fr-CA"],
}


def _expand_languages(languages: list) -> list:
    """Expand each requested language to include its common regional variants."""
    expanded = []
    for lang in languages:
        base = lang.split("-")[0].lower()
        for variant in _LANG_VARIANTS.get(base, [lang]):
            if variant not in expanded:
                expanded.append(variant)
        if lang not in expanded:
            expanded.append(lang)
    return expanded


def fetch_transcript(video_id: str, languages: list = None) -> list:
    """
    Fetch raw transcript data for a YouTube video.

    Returns a list of dicts with keys: 'text', 'start', 'duration'.
    Falls back to any available transcript if the preferred language is not found.

    Raises TranscriptError on any failure.
    """
    if languages is None:
        languages = ["en"]
    languages = _expand_languages(languages)

    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=languages)
        return fetched.to_raw_data()
    except TranscriptsDisabled as e:
        raise TranscriptError("Transcripts are disabled for this video.") from e
    except NoTranscriptFound:
        # Fall back: pick any available transcript (handles unmatched Chinese codes, etc.)
        try:
            transcript_list = api.list(video_id)
            try:
                fetched = transcript_list.find_transcript(languages).fetch()
                return fetched.to_raw_data()
            except Exception:
                pass
            for transcript in transcript_list:
                try:
                    return transcript.fetch().to_raw_data()
                except Exception:
                    continue
            raise NoTranscriptFound(video_id, languages, {})
        except Exception:
            # Nothing via the primary library — try yt-dlp before giving up.
            raw = _fetch_via_ytdlp(video_id, languages)
            if raw:
                return raw
            raise TranscriptError(
                f"No transcript found for video '{video_id}'. "
                "The video may not have captions available."
            )
    except VideoUnavailable as e:
        raise TranscriptError(
            f"Video '{video_id}' is unavailable. Check the URL and that the video is public."
        ) from e
    except _BLOCK_ERRORS as e:
        # YouTube is blocking the anonymous request (VPN / datacenter IP).
        # Retry with yt-dlp using the browser's YouTube login before surfacing the error.
        raw = _fetch_via_ytdlp(video_id, languages)
        if raw:
            return raw
        raise TranscriptError(_BLOCK_HELP) from e
    except Exception as e:
        # Unknown failure — attempt the yt-dlp fallback as a last resort.
        raw = _fetch_via_ytdlp(video_id, languages)
        if raw:
            return raw
        raise TranscriptError(f"Failed to fetch transcript: {e}") from e


def _parse_json3(data: dict) -> list:
    """Convert YouTube json3 caption data into raw_data dicts."""
    out = []
    for ev in (data.get("events") or []):
        segs = ev.get("segs") or []
        text = "".join(s.get("utf8", "") for s in segs)
        if not text.strip():
            continue
        out.append({
            "text": text,
            "start": ev.get("tStartMs", 0) / 1000.0,
            "duration": ev.get("dDurationMs", 0) / 1000.0,
        })
    return out


def _download_json(url: str) -> dict:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _captions_from_info(info: dict, languages: list) -> list:
    """Pick a json3 caption track from yt-dlp info and parse it."""
    subs = info.get("subtitles") or {}
    autos = info.get("automatic_captions") or {}
    # Preferred languages first, then any manual, then any auto-generated.
    ordered = list(languages)
    ordered += [l for l in subs if l not in ordered]
    ordered += [l for l in autos if l not in ordered]

    for lang in ordered:
        tracks = subs.get(lang) or autos.get(lang) or []
        json3 = next((t for t in tracks if t.get("ext") == "json3" and t.get("url")), None)
        if not json3:
            continue
        try:
            return _parse_json3(_download_json(json3["url"]))
        except Exception:
            continue
    return []


def _fetch_via_ytdlp(video_id: str, languages: list) -> list:
    """
    Fallback transcript fetch using yt-dlp. Tries the browser's YouTube login
    (cookies) first — this bypasses the anonymous-IP blocking YouTube applies to
    datacenter/VPN addresses. Returns [] if yt-dlp is unavailable or finds nothing.
    """
    try:
        import yt_dlp
    except ImportError:
        return []

    url = f"https://www.youtube.com/watch?v={video_id}"
    # Cookie sources to try, in order. None = no cookies (works from clean IPs).
    cookie_attempts = [("chrome",), ("safari",), ("edge",), ("brave",), ("firefox",), None]

    for cookies in cookie_attempts:
        opts = {"skip_download": True, "quiet": True, "no_warnings": True}
        if cookies:
            opts["cookiesfrombrowser"] = cookies
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception:
            continue  # e.g. browser not installed / locked DB / still blocked
        raw = _captions_from_info(info, languages)
        if raw:
            return raw
    return []


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
