"""
YouTube Transcript Analyzer — CLI entry point.

Usage:
    python analyzer.py <youtube_url> [options]

Options:
    --timestamps        Include [MM:SS] timestamps in transcript output
    --no-transcript     Suppress full transcript (key points only)
    --json              Emit all output as a JSON object
    --model MODEL       Claude model override (default: subscription default)
    --language LANG     Preferred transcript language code (default: en)
"""
import argparse
import json
import sys

from analysis import analyze_transcript, translate_to_english
from audio_transcribe import AudioTranscriptionError, transcribe_audio
from transcript import TranscriptError, clean_transcript, extract_video_id, fetch_transcript


def _format_human(url: str, video_id: str, transcript: str, result: dict,
                  show_transcript: bool) -> str:
    sep = "=" * 60
    lines = [
        sep,
        "VIDEO TRANSCRIPT ANALYZER",
        sep,
        f"URL:     {url}",
        f"Video:   {video_id}",
        f"Model:   {result['model_used']}",
        f"Chunks:  {result['chunks_used']}",
        sep,
    ]

    lines.append("\n=== Key Points ===\n")
    for kp in result["key_points"]:
        importance = kp.get("importance", "medium").upper()
        point = kp.get("point", "")
        lines.append(f"  [{importance}] {point}")

    if show_transcript:
        lines.append("\n=== Transcript ===\n")
        lines.append(transcript)

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Analyze YouTube video transcripts using your Claude subscription."
    )
    parser.add_argument("url", help="YouTube video URL or bare video ID")
    parser.add_argument(
        "--timestamps", action="store_true",
        help="Include [MM:SS] timestamps in transcript output"
    )
    parser.add_argument(
        "--no-transcript", action="store_true", dest="no_transcript",
        help="Suppress full transcript (key points only)"
    )
    parser.add_argument(
        "--json", action="store_true", dest="json_output",
        help="Emit all output as a JSON object"
    )
    parser.add_argument(
        "--model", default=None,
        help="Claude model override (default: uses your subscription's default model)"
    )
    parser.add_argument(
        "--language", default="en",
        help="Preferred transcript language code (default: en). Use 'zh' for Chinese."
    )
    parser.add_argument(
        "--translate", action="store_true",
        help="Translate the transcript to English before analysis (e.g. for Chinese videos)"
    )

    args = parser.parse_args()

    # Extract video ID
    try:
        video_id = extract_video_id(args.url)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Fetch and clean transcript (fall back to audio speech-to-text if no captions)
    try:
        raw = fetch_transcript(video_id, languages=[args.language])
        transcript = clean_transcript(raw, include_timestamps=args.timestamps)
    except TranscriptError as e:
        print(f"Transcript error: {e}", file=sys.stderr)
        print("Captions unavailable — attempting audio speech-to-text...", file=sys.stderr)
        try:
            raw = transcribe_audio(video_id, languages=[args.language])
            transcript = clean_transcript(raw, include_timestamps=args.timestamps)
        except AudioTranscriptionError as ae:
            print(f"Audio fallback failed: {ae}", file=sys.stderr)
            sys.exit(1)

    # Optionally translate to English (via CLI subscription)
    try:
        if args.translate:
            transcript = translate_to_english(transcript, model=args.model)
    except RuntimeError as e:
        print(f"Translation error: {e}", file=sys.stderr)
        sys.exit(2)

    # Analyze with Claude (via CLI subscription)
    try:
        result = analyze_transcript(transcript, model=args.model)
    except RuntimeError as e:
        print(f"Claude error: {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(3)

    # Output
    if args.json_output:
        output = {
            "url": args.url,
            "video_id": video_id,
            "key_points": result["key_points"],
            "metadata": {
                "model": result["model_used"],
                "chunks_used": result["chunks_used"],
                "translated": args.translate,
            },
        }
        if not args.no_transcript:
            output["transcript"] = transcript
        print(json.dumps(output, indent=2))
    else:
        print(_format_human(
            url=args.url,
            video_id=video_id,
            transcript=transcript,
            result=result,
            show_transcript=not args.no_transcript,
        ))


if __name__ == "__main__":
    main()
