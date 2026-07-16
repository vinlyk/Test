"""Tests for transcript.py"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch, MagicMock

from transcript import (
    extract_video_id,
    fetch_transcript,
    clean_transcript,
    TranscriptError,
    _parse_json3,
    _captions_from_info,
    _fetch_via_ytdlp,
)


# ---------------------------------------------------------------------------
# extract_video_id
# ---------------------------------------------------------------------------

class TestExtractVideoId:
    def test_youtu_be(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_youtu_be_with_timestamp(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ?t=30") == "dQw4w9WgXcQ"

    def test_watch_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url_no_www(self):
        assert extract_video_id("https://youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_watch_url_with_extra_params(self):
        assert extract_video_id(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcd123"
        ) == "dQw4w9WgXcQ"

    def test_shorts_url(self):
        assert extract_video_id("https://youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_embed_url(self):
        assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_bare_id(self):
        assert extract_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_invalid_domain(self):
        with pytest.raises(ValueError):
            extract_video_id("https://example.com/video/dQw4w9WgXcQ")

    def test_invalid_not_a_url(self):
        with pytest.raises(ValueError):
            extract_video_id("not a url at all")

    def test_empty_string(self):
        with pytest.raises(ValueError):
            extract_video_id("")

    def test_youtube_no_video_id(self):
        with pytest.raises(ValueError):
            extract_video_id("https://youtube.com/")


# ---------------------------------------------------------------------------
# fetch_transcript
# ---------------------------------------------------------------------------

class TestFetchTranscript:
    def _make_api_mock(self, raw_data):
        """Return a mock YouTubeTranscriptApi class whose instance returns raw_data."""
        mock_fetched = MagicMock()
        mock_fetched.to_raw_data.return_value = raw_data

        mock_instance = MagicMock()
        mock_instance.fetch.return_value = mock_fetched

        mock_class = MagicMock(return_value=mock_instance)
        return mock_class, mock_instance

    @patch("transcript.YouTubeTranscriptApi")
    def test_success(self, mock_class):
        raw = [{"text": "Hello world", "start": 0.0, "duration": 1.5}]
        mock_class, mock_instance = self._make_api_mock(raw)
        with patch("transcript.YouTubeTranscriptApi", mock_class):
            result = fetch_transcript("dQw4w9WgXcQ")
        assert result == raw
        mock_instance.fetch.assert_called_once_with("dQw4w9WgXcQ", languages=["en"])

    @patch("transcript.YouTubeTranscriptApi")
    def test_custom_language(self, mock_class):
        raw = [{"text": "Hola", "start": 0.0, "duration": 1.0}]
        mock_class, mock_instance = self._make_api_mock(raw)
        with patch("transcript.YouTubeTranscriptApi", mock_class):
            result = fetch_transcript("dQw4w9WgXcQ", languages=["es"])
        mock_instance.fetch.assert_called_once_with("dQw4w9WgXcQ", languages=["es"])
        assert result == raw

    @patch("transcript.YouTubeTranscriptApi")
    def test_transcripts_disabled_raises(self, mock_class):
        from youtube_transcript_api._errors import TranscriptsDisabled
        mock_instance = MagicMock()
        mock_instance.fetch.side_effect = TranscriptsDisabled("vid123")
        mock_class.return_value = mock_instance
        with pytest.raises(TranscriptError, match="disabled"):
            fetch_transcript("vid123")

    @patch("transcript.YouTubeTranscriptApi")
    def test_video_unavailable_raises(self, mock_class):
        from youtube_transcript_api._errors import VideoUnavailable
        mock_instance = MagicMock()
        mock_instance.fetch.side_effect = VideoUnavailable("vid123")
        mock_class.return_value = mock_instance
        with pytest.raises(TranscriptError, match="unavailable"):
            fetch_transcript("vid123")

    @patch("transcript.YouTubeTranscriptApi")
    def test_no_transcript_found_falls_back_to_auto(self, mock_class):
        """On NoTranscriptFound, falls back to listing available transcripts."""
        from youtube_transcript_api._errors import NoTranscriptFound
        raw = [{"text": "Auto caption", "start": 0.0, "duration": 1.0}]

        mock_fetched = MagicMock()
        mock_fetched.to_raw_data.return_value = raw

        mock_transcript_obj = MagicMock()
        mock_transcript_obj.fetch.return_value = mock_fetched

        mock_transcript_list = MagicMock()
        mock_transcript_list.find_transcript.return_value = mock_transcript_obj

        mock_instance = MagicMock()
        mock_instance.fetch.side_effect = NoTranscriptFound("vid", [], {})
        mock_instance.list.return_value = mock_transcript_list

        mock_class.return_value = mock_instance

        result = fetch_transcript("vid123")
        assert result == raw


# ---------------------------------------------------------------------------
# yt-dlp fallback helpers
# ---------------------------------------------------------------------------

class TestParseJson3:
    def test_basic(self):
        data = {"events": [
            {"tStartMs": 0, "dDurationMs": 1500, "segs": [{"utf8": "Hello "}, {"utf8": "world"}]},
            {"tStartMs": 2500, "dDurationMs": 2000, "segs": [{"utf8": "Second"}]},
        ]}
        assert _parse_json3(data) == [
            {"text": "Hello world", "start": 0.0, "duration": 1.5},
            {"text": "Second", "start": 2.5, "duration": 2.0},
        ]

    def test_skips_blank_segments(self):
        data = {"events": [
            {"tStartMs": 0, "dDurationMs": 1000, "segs": [{"utf8": "\n"}]},
            {"tStartMs": 1000, "dDurationMs": 1000, "segs": [{"utf8": "Real"}]},
        ]}
        assert _parse_json3(data) == [{"text": "Real", "start": 1.0, "duration": 1.0}]

    def test_empty_events(self):
        assert _parse_json3({"events": []}) == []
        assert _parse_json3({}) == []


class TestCaptionsFromInfo:
    def test_prefers_requested_language(self):
        info = {
            "subtitles": {"en": [{"ext": "json3", "url": "http://x/en.json3"}]},
            "automatic_captions": {},
        }
        with patch("transcript._download_json", return_value={
            "events": [{"tStartMs": 0, "dDurationMs": 1000, "segs": [{"utf8": "hi"}]}]
        }):
            result = _captions_from_info(info, ["en"])
        assert result == [{"text": "hi", "start": 0.0, "duration": 1.0}]

    def test_falls_back_to_auto_captions(self):
        info = {
            "subtitles": {},
            "automatic_captions": {"en": [{"ext": "json3", "url": "http://x/auto.json3"}]},
        }
        with patch("transcript._download_json", return_value={
            "events": [{"tStartMs": 0, "dDurationMs": 500, "segs": [{"utf8": "auto"}]}]
        }):
            result = _captions_from_info(info, ["en"])
        assert result == [{"text": "auto", "start": 0.0, "duration": 0.5}]

    def test_no_json3_track_returns_empty(self):
        info = {"subtitles": {"en": [{"ext": "vtt", "url": "http://x/en.vtt"}]}, "automatic_captions": {}}
        assert _captions_from_info(info, ["en"]) == []


class TestFetchViaYtdlp:
    def test_returns_empty_when_ytdlp_missing(self):
        # Simulate yt_dlp not being importable.
        with patch.dict(sys.modules, {"yt_dlp": None}):
            assert _fetch_via_ytdlp("vid123", ["en"]) == []


# ---------------------------------------------------------------------------
# clean_transcript
# ---------------------------------------------------------------------------

class TestCleanTranscript:
    def test_basic_text(self):
        raw = [{"text": "Hello world", "start": 0.0, "duration": 1.0}]
        assert clean_transcript(raw) == "Hello world"

    def test_strips_music_marker(self):
        raw = [{"text": "[Music] Hello", "start": 0.0, "duration": 1.0}]
        assert clean_transcript(raw) == "Hello"

    def test_strips_applause_marker(self):
        raw = [{"text": "Great! [Applause]", "start": 0.0, "duration": 1.0}]
        assert clean_transcript(raw) == "Great!"

    def test_strips_music_variant(self):
        raw = [{"text": "[music playing] Welcome", "start": 0.0, "duration": 1.0}]
        assert clean_transcript(raw) == "Welcome"

    def test_strips_music_notes_paired(self):
        raw = [{"text": "♪ some tune ♪ hello", "start": 0.0, "duration": 1.0}]
        result = clean_transcript(raw)
        assert "♪" not in result
        assert "hello" in result

    def test_strips_music_notes_single(self):
        raw = [{"text": "♪ hello", "start": 0.0, "duration": 1.0}]
        result = clean_transcript(raw)
        assert "♪" not in result

    def test_normalizes_whitespace(self):
        raw = [{"text": "  hello    world  ", "start": 0.0, "duration": 1.0}]
        assert clean_transcript(raw) == "hello world"

    def test_skips_blank_entries(self):
        raw = [
            {"text": "[Music]", "start": 0.0, "duration": 1.0},
            {"text": "Hello", "start": 1.0, "duration": 1.0},
        ]
        assert clean_transcript(raw) == "Hello"

    def test_timestamps_format(self):
        raw = [{"text": "Hello", "start": 65.0, "duration": 1.0}]
        result = clean_transcript(raw, include_timestamps=True)
        assert result == "[01:05] Hello"

    def test_timestamps_overflow_minutes(self):
        raw = [{"text": "Test", "start": 3661.0, "duration": 1.0}]
        result = clean_transcript(raw, include_timestamps=True)
        assert result == "[61:01] Test"

    def test_timestamps_zero(self):
        raw = [{"text": "Start", "start": 0.0, "duration": 1.0}]
        result = clean_transcript(raw, include_timestamps=True)
        assert result == "[00:00] Start"

    def test_multiple_entries_joined_by_newline(self):
        raw = [
            {"text": "First", "start": 0.0, "duration": 1.0},
            {"text": "Second", "start": 1.0, "duration": 1.0},
        ]
        assert clean_transcript(raw) == "First\nSecond"

    def test_empty_raw_returns_empty_string(self):
        assert clean_transcript([]) == ""
