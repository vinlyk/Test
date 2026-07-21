"""Integration tests for analyzer.py (CLI entry point)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import pytest
from contextlib import ExitStack
from io import StringIO
from unittest.mock import MagicMock, patch

import analyzer
from transcript import TranscriptError

_RAW_DATA = [{"text": "Hello world", "start": 0.0, "duration": 1.5}]
_MOCK_RESULT = {
    "key_points": [{"point": "Test point", "importance": "high"}],
    "model_used": "claude (subscription default)",
    "chunks_used": 1,
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def run_cli(*argv):
    """Run analyzer.main() with mocked external dependencies."""
    patches = [
        patch("sys.argv", ["analyzer.py"] + list(argv)),
        patch("sys.stdout", new_callable=StringIO),
        patch("sys.stderr", new_callable=StringIO),
        patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"),
        patch("analyzer.fetch_transcript", return_value=_RAW_DATA),
        patch("analyzer.clean_transcript", return_value="Hello world"),
        patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT),
    ]
    with ExitStack() as stack:
        mocks = [stack.enter_context(p) for p in patches]
        stdout_mock = mocks[1]
        stderr_mock = mocks[2]
        try:
            analyzer.main()
            return 0, stdout_mock.getvalue(), stderr_mock.getvalue()
        except SystemExit as e:
            return e.code, stdout_mock.getvalue(), stderr_mock.getvalue()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHelpFlag:
    def test_help_exits_zero(self):
        with patch("sys.argv", ["analyzer.py", "--help"]), \
             patch("sys.stdout", new_callable=StringIO):
            try:
                analyzer.main()
                code = 0
            except SystemExit as e:
                code = e.code
        assert code == 0


class TestValidUrlSuccess:
    def test_exits_zero(self):
        code, out, err = run_cli("https://youtu.be/dQw4w9WgXcQ")
        assert code == 0

    def test_key_points_in_output(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ")
        assert "Test point" in out

    def test_importance_label_in_output(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ")
        assert "[HIGH]" in out

    def test_transcript_shown_by_default(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ")
        assert "Hello world" in out


class TestNoTranscriptFlag:
    def test_transcript_section_absent(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--no-transcript")
        assert "=== Transcript ===" not in out
        assert "Hello world" not in out

    def test_key_points_still_present(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--no-transcript")
        assert "Test point" in out


class TestJsonFlag:
    def test_output_is_valid_json(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json")
        parsed = json.loads(out)
        assert isinstance(parsed, dict)

    def test_json_has_key_points(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json")
        assert "key_points" in json.loads(out)

    def test_json_has_transcript_by_default(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json")
        assert "transcript" in json.loads(out)

    def test_json_has_metadata(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json")
        parsed = json.loads(out)
        assert "metadata" in parsed
        assert "model" in parsed["metadata"]


class TestJsonNoTranscript:
    def test_transcript_key_absent(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json", "--no-transcript")
        assert "transcript" not in json.loads(out)

    def test_key_points_present(self):
        code, out, _ = run_cli("https://youtu.be/dQw4w9WgXcQ", "--json", "--no-transcript")
        assert "key_points" in json.loads(out)


class TestLanguageFlag:
    def test_language_passed_to_fetch(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ", "--language", "de"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", return_value=_RAW_DATA) as mock_fetch, \
             patch("analyzer.clean_transcript", return_value="Hola"), \
             patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT):
            try:
                analyzer.main()
            except SystemExit:
                pass
            mock_fetch.assert_called_once_with("dQw4w9WgXcQ", languages=["de"])


class TestTranscriptError:
    def test_exits_1_on_transcript_error(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", side_effect=TranscriptError("No captions")):
            try:
                analyzer.main()
                code = 0
            except SystemExit as e:
                code = e.code
        assert code == 1

    def test_error_message_in_stderr(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO) as mock_err, \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", side_effect=TranscriptError("No captions")):
            try:
                analyzer.main()
            except SystemExit:
                pass
            assert "No captions" in mock_err.getvalue()


class TestAudioFallback:
    def test_falls_back_to_audio_when_captions_disabled(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO) as out, \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", side_effect=TranscriptError("Transcripts are disabled")), \
             patch("analyzer.transcribe_audio", return_value=_RAW_DATA) as mock_audio, \
             patch("analyzer.clean_transcript", return_value="Hello world"), \
             patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT):
            try:
                analyzer.main()
                code = 0
            except SystemExit as e:
                code = e.code
        mock_audio.assert_called_once()
        assert code == 0
        assert "Test point" in out.getvalue()

    def test_exits_1_when_audio_also_fails(self):
        from audio_transcribe import AudioTranscriptionError
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", side_effect=TranscriptError("disabled")), \
             patch("analyzer.transcribe_audio", side_effect=AudioTranscriptionError("no whisper")):
            try:
                analyzer.main()
                code = 0
            except SystemExit as e:
                code = e.code
        assert code == 1


class TestClaudeCliError:
    def test_exits_2_when_claude_not_found(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", return_value=_RAW_DATA), \
             patch("analyzer.clean_transcript", return_value="text"), \
             patch("analyzer.analyze_transcript", side_effect=RuntimeError("claude CLI not found")):
            try:
                analyzer.main()
                code = 0
            except SystemExit as e:
                code = e.code
        assert code == 2


class TestTranslateFlag:
    def test_translate_called_and_result_analyzed(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ", "--translate"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", return_value=_RAW_DATA), \
             patch("analyzer.clean_transcript", return_value="大家好"), \
             patch("analyzer.translate_to_english", return_value="Hello everyone") as mock_tr, \
             patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT) as mock_an:
            try:
                analyzer.main()
            except SystemExit:
                pass
            mock_tr.assert_called_once()
            # The translated English text must be what gets analyzed.
            assert mock_an.call_args[0][0] == "Hello everyone"

    def test_no_translate_by_default(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", return_value=_RAW_DATA), \
             patch("analyzer.clean_transcript", return_value="Hello world"), \
             patch("analyzer.translate_to_english") as mock_tr, \
             patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT):
            try:
                analyzer.main()
            except SystemExit:
                pass
            mock_tr.assert_not_called()


class TestTimestampsFlag:
    def test_timestamps_passed_to_clean(self):
        with patch("sys.argv", ["analyzer.py", "https://youtu.be/dQw4w9WgXcQ", "--timestamps"]), \
             patch("sys.stdout", new_callable=StringIO), \
             patch("sys.stderr", new_callable=StringIO), \
             patch("analyzer.extract_video_id", return_value="dQw4w9WgXcQ"), \
             patch("analyzer.fetch_transcript", return_value=_RAW_DATA), \
             patch("analyzer.clean_transcript", return_value="[00:00] Hello") as mock_clean, \
             patch("analyzer.analyze_transcript", return_value=_MOCK_RESULT):
            try:
                analyzer.main()
            except SystemExit:
                pass
            mock_clean.assert_called_once_with(_RAW_DATA, include_timestamps=True)
