"""Tests for analysis.py — mocks subprocess.run instead of anthropic client."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import pytest
from unittest.mock import MagicMock, patch

import subprocess

from analysis import (
    DEFAULT_MODEL,
    CLAUDE_CLI_RETRIES,
    _analyze_chunked,
    _analyze_single_pass,
    _call_claude,
    _parse_key_points,
    analyze_transcript,
    translate_to_english,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_JSON = '[{"point": "First point", "importance": "high"}, {"point": "Second", "importance": "low"}]'
VALID_POINTS = [{"point": "First point", "importance": "high"}, {"point": "Second", "importance": "low"}]


def make_subprocess_mock(stdout=VALID_JSON, returncode=0):
    mock = MagicMock()
    mock.returncode = returncode
    mock.stdout = stdout
    mock.stderr = ""
    return mock


# ---------------------------------------------------------------------------
# _parse_key_points
# ---------------------------------------------------------------------------

class TestParseKeyPoints:
    def test_clean_json(self):
        assert _parse_key_points(VALID_JSON) == VALID_POINTS

    def test_json_with_preamble(self):
        assert _parse_key_points("Here are the key points:\n" + VALID_JSON) == VALID_POINTS

    def test_json_with_trailing_text(self):
        assert _parse_key_points(VALID_JSON + "\nThose are the main points.") == VALID_POINTS

    def test_empty_array(self):
        assert _parse_key_points("[]") == []

    def test_invalid_json(self):
        assert _parse_key_points("not json at all") == []

    def test_malformed_json(self):
        assert _parse_key_points('[{"point": broken}]') == []

    def test_missing_importance_filtered_out(self):
        assert _parse_key_points('[{"point": "only point, no importance"}]') == []

    def test_missing_point_filtered_out(self):
        assert _parse_key_points('[{"importance": "high"}]') == []

    def test_mixed_valid_invalid(self):
        text = '[{"point": "good", "importance": "high"}, {"no_point": true}]'
        result = _parse_key_points(text)
        assert len(result) == 1
        assert result[0]["point"] == "good"

    def test_no_brackets(self):
        assert _parse_key_points("Some text with no brackets") == []


# ---------------------------------------------------------------------------
# _analyze_single_pass
# ---------------------------------------------------------------------------

class TestCallClaudeRetry:
    @patch("analysis.time.sleep")
    @patch("analysis.subprocess.run")
    def test_retries_on_timeout_then_succeeds(self, mock_run, mock_sleep):
        mock_run.side_effect = [
            subprocess.TimeoutExpired(cmd="claude", timeout=180),
            make_subprocess_mock(stdout="ok"),
        ]
        result = _call_claude("hello")
        assert result == "ok"
        assert mock_run.call_count == 2

    @patch("analysis.time.sleep")
    @patch("analysis.subprocess.run")
    def test_raises_after_exhausting_retries(self, mock_run, mock_sleep):
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="claude", timeout=180)
        with pytest.raises(RuntimeError, match="timed out"):
            _call_claude("hello")
        assert mock_run.call_count == CLAUDE_CLI_RETRIES + 1

    @patch("analysis.subprocess.run")
    def test_no_retry_needed_on_first_success(self, mock_run):
        mock_run.return_value = make_subprocess_mock(stdout="fine")
        result = _call_claude("hello")
        assert result == "fine"
        assert mock_run.call_count == 1


class TestAnalyzeSinglePass:
    @patch("analysis.subprocess.run")
    def test_returns_parsed_key_points(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        result = _analyze_single_pass("some transcript text")
        assert result == VALID_POINTS

    @patch("analysis.subprocess.run")
    def test_calls_claude_once(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        _analyze_single_pass("text")
        assert mock_run.call_count == 1

    @patch("analysis.subprocess.run")
    def test_claude_p_flag_used(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        _analyze_single_pass("text")
        cmd = mock_run.call_args[0][0]
        assert cmd[0] == "claude"
        assert cmd[1] == "-p"

    @patch("analysis.subprocess.run")
    def test_transcript_in_prompt(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        _analyze_single_pass("my unique transcript content")
        cmd = mock_run.call_args[0][0]
        assert "my unique transcript content" in cmd[2]

    @patch("analysis.subprocess.run")
    def test_model_flag_added_when_specified(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        _analyze_single_pass("text", model="claude-opus-4-6")
        cmd = mock_run.call_args[0][0]
        assert "--model" in cmd
        assert "claude-opus-4-6" in cmd

    @patch("analysis.subprocess.run")
    def test_no_model_flag_when_none(self, mock_run):
        mock_run.return_value = make_subprocess_mock()
        _analyze_single_pass("text", model=None)
        cmd = mock_run.call_args[0][0]
        assert "--model" not in cmd


# ---------------------------------------------------------------------------
# analyze_transcript — single pass
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptSinglePass:
    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_result_has_required_keys(self, mock_run, mock_which):
        mock_run.return_value = make_subprocess_mock()
        result = analyze_transcript("short text")
        assert "key_points" in result
        assert "model_used" in result
        assert "chunks_used" in result

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_chunks_used_is_1(self, mock_run, mock_which):
        mock_run.return_value = make_subprocess_mock()
        result = analyze_transcript("short text")
        assert result["chunks_used"] == 1

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_single_subprocess_call(self, mock_run, mock_which):
        mock_run.return_value = make_subprocess_mock()
        analyze_transcript("short text")
        assert mock_run.call_count == 1

    @patch("analysis.shutil.which", return_value=None)
    def test_raises_when_claude_not_found(self, mock_which):
        with pytest.raises(RuntimeError, match="claude"):
            analyze_transcript("short text")


# ---------------------------------------------------------------------------
# analyze_transcript — chunked
# ---------------------------------------------------------------------------

class TestTranslateToEnglish:
    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_returns_translated_text(self, mock_run, mock_which):
        mock_run.return_value = make_subprocess_mock(stdout="Hello everyone")
        result = translate_to_english("大家好")
        assert result == "Hello everyone"

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_empty_input_no_call(self, mock_run, mock_which):
        result = translate_to_english("   ")
        assert result == ""
        assert mock_run.call_count == 0

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.subprocess.run")
    def test_transcript_in_prompt(self, mock_run, mock_which):
        mock_run.return_value = make_subprocess_mock(stdout="translated")
        translate_to_english("独特的中文内容")
        prompt = mock_run.call_args[0][0][2]
        assert "独特的中文内容" in prompt
        assert "English" in prompt

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.split_by_chars", return_value=["chunk A", "chunk B", "chunk C"])
    @patch("analysis.subprocess.run")
    def test_multiple_chunks_joined(self, mock_run, mock_split, mock_which):
        mock_run.return_value = make_subprocess_mock(stdout="X")
        result = translate_to_english("long text")
        assert mock_run.call_count == 3
        assert result == "X\nX\nX"

    @patch("analysis.shutil.which", return_value=None)
    def test_raises_when_claude_missing(self, mock_which):
        with pytest.raises(RuntimeError, match="claude"):
            translate_to_english("大家好")


class TestAnalyzeTranscriptChunked:
    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=["chunk1", "chunk2", "chunk3"])
    @patch("analysis.subprocess.run")
    def test_n_plus_1_calls(self, mock_run, mock_split, mock_needs, mock_which):
        mock_run.return_value = make_subprocess_mock()
        analyze_transcript("any text")
        assert mock_run.call_count == 4  # 3 chunks + 1 consolidation

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=["chunk1", "chunk2", "chunk3"])
    @patch("analysis.subprocess.run")
    def test_chunks_used_is_n_plus_1(self, mock_run, mock_split, mock_needs, mock_which):
        mock_run.return_value = make_subprocess_mock()
        result = analyze_transcript("any text")
        assert result["chunks_used"] == 4

    @patch("analysis.shutil.which", return_value="/usr/local/bin/claude")
    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=[])
    @patch("analysis.subprocess.run")
    def test_empty_chunks_no_calls(self, mock_run, mock_split, mock_needs, mock_which):
        mock_run.return_value = make_subprocess_mock()
        result = analyze_transcript("any text")
        assert result["key_points"] == []
        assert mock_run.call_count == 0
