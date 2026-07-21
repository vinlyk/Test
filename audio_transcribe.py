"""
Audio-transcription fallback for videos whose captions are disabled.

Downloads the audio with yt-dlp and transcribes it locally with faster-whisper.
Works on any video that has audio (including Chinese). faster-whisper is imported
lazily so the base app stays light — it is only needed when this path runs.
"""
import os
import sys
import tempfile

# Model size trades speed vs accuracy: tiny/base/small/medium/large-v3.
# Larger = better (esp. for Chinese) but slower. Override with WHISPER_MODEL.
DEFAULT_WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")


class AudioTranscriptionError(Exception):
    """Raised when audio download or speech-to-text fails."""
    pass


def _log(message: str):
    print(f"  [analyzer] {message}", file=sys.stderr, flush=True)


def _cookie_attempts() -> list:
    """
    Cookie sources for yt-dlp. Anonymous only ([None]) by default so macOS never
    prompts for keychain access. Opt into browser logins (for IP-blocked cases)
    with YTDLP_USE_BROWSER_COOKIES=1.
    """
    if os.environ.get("YTDLP_USE_BROWSER_COOKIES", "").strip().lower() in ("1", "true", "yes"):
        return [None, ("chrome",), ("safari",), ("edge",), ("brave",), ("firefox",)]
    return [None]


# Map friendly/incorrect codes to the language hints Whisper understands.
_LANG_HINTS = {"cn": "zh", "chinese": "zh", "zho": "zh", "english": "en"}


def _language_hint(languages) -> str:
    """Turn the requested language list into a single Whisper language hint (or None)."""
    if not languages:
        return None
    base = languages[0].split("-")[0].lower()
    return _LANG_HINTS.get(base, base or None)


def _segments_to_raw(segments) -> list:
    """Convert whisper segments (each with .start/.end/.text) into raw_data dicts."""
    raw = []
    for seg in segments:
        text = (getattr(seg, "text", "") or "").strip()
        if not text:
            continue
        start = float(getattr(seg, "start", 0) or 0)
        end = float(getattr(seg, "end", start) or start)
        raw.append({"text": text, "start": start, "duration": max(0.0, end - start)})
    return raw


def _download_audio(video_id: str, dest_dir: str) -> str:
    """Download the best audio track to dest_dir and return the file path."""
    try:
        import yt_dlp
    except ImportError as e:
        raise AudioTranscriptionError(
            "yt-dlp is required for audio download. Install it:\n"
            "  python3 -m pip install yt-dlp"
        ) from e

    url = f"https://www.youtube.com/watch?v={video_id}"
    outtmpl = os.path.join(dest_dir, "audio.%(ext)s")
    # Anonymous download only, by default — this never touches the browser keychain,
    # so macOS won't prompt for a password. Public videos download fine this way.
    # Set YTDLP_USE_BROWSER_COOKIES=1 to also try browser logins (only needed if
    # YouTube blocks your IP, e.g. on a VPN); that path may trigger a keychain prompt.
    cookie_attempts = _cookie_attempts()

    last_err = None
    for cookies in cookie_attempts:
        opts = {
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
        }
        if cookies:
            opts["cookiesfrombrowser"] = cookies
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return ydl.prepare_filename(info)
        except Exception as e:
            last_err = e
            continue

    raise AudioTranscriptionError(f"Could not download audio: {last_err}")


def transcribe_audio(video_id: str, languages: list = None, model_size: str = None) -> list:
    """
    Download a video's audio and transcribe it with faster-whisper.

    Returns raw_data (list of {"text","start","duration"}). Raises
    AudioTranscriptionError on any failure.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise AudioTranscriptionError(
            "Audio transcription needs faster-whisper. Install it:\n"
            "  python3 -m pip install faster-whisper"
        ) from e

    model_size = model_size or DEFAULT_WHISPER_MODEL
    lang_hint = _language_hint(languages)

    with tempfile.TemporaryDirectory() as tmp:
        _log("Captions unavailable — downloading audio for speech-to-text...")
        audio_path = _download_audio(video_id, tmp)

        _log(f"Transcribing audio with Whisper '{model_size}' (this can take several minutes)...")
        try:
            model = WhisperModel(
                model_size,
                device=os.environ.get("WHISPER_DEVICE", "cpu"),
                compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
            )
            segments, _info = model.transcribe(audio_path, language=lang_hint)
            raw = _segments_to_raw(segments)
        except Exception as e:
            raise AudioTranscriptionError(f"Whisper transcription failed: {e}") from e

    if not raw:
        raise AudioTranscriptionError("Whisper produced no text from the audio.")
    _log(f"Speech-to-text complete: {len(raw)} segments.")
    return raw
