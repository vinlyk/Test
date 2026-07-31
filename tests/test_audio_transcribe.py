"""Tests for audio_transcribe.py — the speech-to-text fallback (all mocked)."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch

from audio_transcribe import (
    AudioTranscriptionError,
    _segments_to_raw,
    _language_hint,
    transcribe_audio,
)


class _Seg:
    def __init__(self, start, end, text):
        self.start = start
        self.end = end
        self.text = text


class TestSegmentsToRaw:
    def test_basic_conversion(self):
        segs = [_Seg(0.0, 2.5, " Hello "), _Seg(2.5, 5.0, "world")]
        assert _segments_to_raw(segs) == [
            {"text": "Hello", "start": 0.0, "duration": 2.5},
            {"text": "world", "start": 2.5, "duration": 2.5},
        ]

    def test_blank_segments_skipped(self):
        segs = [_Seg(0.0, 1.0, "   "), _Seg(1.0, 2.0, "real")]
        assert _segments_to_raw(segs) == [{"text": "real", "start": 1.0, "duration": 1.0}]

    def test_chinese_text(self):
        segs = [_Seg(0.0, 3.2, "大家好")]
        assert _segments_to_raw(segs) == [{"text": "大家好", "start": 0.0, "duration": 3.2}]

    def test_negative_duration_clamped(self):
        segs = [_Seg(5.0, 4.0, "oops")]
        assert _segments_to_raw(segs)[0]["duration"] == 0.0

    def test_empty_list(self):
        assert _segments_to_raw([]) == []


class TestLanguageHint:
    def test_cn_maps_to_zh(self):
        assert _language_hint(["CN"]) == "zh"

    def test_chinese_word_maps_to_zh(self):
        assert _language_hint(["chinese"]) == "zh"

    def test_regional_variant_uses_base(self):
        assert _language_hint(["zh-Hans"]) == "zh"

    def test_plain_language_kept(self):
        assert _language_hint(["en"]) == "en"

    def test_empty_returns_none(self):
        assert _language_hint([]) is None

    def test_invalid_code_falls_back_to_none(self):
        # "enzh" is not a real Whisper code — should auto-detect, not raise.
        assert _language_hint(["enzh"]) is None

    def test_garbage_code_falls_back_to_none(self):
        assert _language_hint(["xx-yy-zz"]) is None

    def test_valid_variant_still_works_after_typo_check(self):
        assert _language_hint(["pt-BR"]) == "pt"


class TestTranscribeAudio:
    def test_raises_when_faster_whisper_missing(self):
        # Simulate faster_whisper not installed.
        with patch.dict(sys.modules, {"faster_whisper": None}):
            with pytest.raises(AudioTranscriptionError, match="faster-whisper"):
                transcribe_audio("vid123", languages=["en"])
