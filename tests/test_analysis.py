"""Tests for analysis.py"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock, patch, call

from analysis import (
    DEFAULT_MODEL,
    _analyze_chunked,
    _analyze_single_pass,
    _parse_key_points,
    analyze_transcript,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_client(response_text):
    """Return an anthropic client mock whose messages.create returns response_text."""
    client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=response_text)]
    client.messages.create.return_value = mock_response
    return client


VALID_JSON = '[{"point": "First point", "importance": "high"}, {"point": "Second", "importance": "low"}]'
VALID_POINTS = [{"point": "First point", "importance": "high"}, {"point": "Second", "importance": "low"}]


# ---------------------------------------------------------------------------
# _parse_key_points
# ---------------------------------------------------------------------------

class TestParseKeyPoints:
    def test_clean_json(self):
        result = _parse_key_points(VALID_JSON)
        assert result == VALID_POINTS

    def test_json_with_preamble(self):
        text = "Here are the key points:\n" + VALID_JSON
        result = _parse_key_points(text)
        assert result == VALID_POINTS

    def test_json_with_trailing_text(self):
        text = VALID_JSON + "\n\nThose are the main points."
        result = _parse_key_points(text)
        assert result == VALID_POINTS

    def test_empty_array(self):
        result = _parse_key_points("[]")
        assert result == []

    def test_invalid_json(self):
        result = _parse_key_points("not json at all")
        assert result == []

    def test_malformed_json(self):
        result = _parse_key_points('[{"point": broken}]')
        assert result == []

    def test_missing_importance_key_filtered_out(self):
        text = '[{"point": "only point, no importance"}]'
        result = _parse_key_points(text)
        assert result == []

    def test_missing_point_key_filtered_out(self):
        text = '[{"importance": "high"}]'
        result = _parse_key_points(text)
        assert result == []

    def test_mixed_valid_invalid(self):
        text = '[{"point": "good", "importance": "high"}, {"no_point": true}]'
        result = _parse_key_points(text)
        assert len(result) == 1
        assert result[0]["point"] == "good"

    def test_no_brackets(self):
        result = _parse_key_points("Some text with no brackets at all")
        assert result == []


# ---------------------------------------------------------------------------
# _analyze_single_pass
# ---------------------------------------------------------------------------

class TestAnalyzeSinglePass:
    def test_returns_parsed_key_points(self):
        client = make_mock_client(VALID_JSON)
        result = _analyze_single_pass(client, "some transcript text", DEFAULT_MODEL)
        assert result == VALID_POINTS

    def test_calls_create_once(self):
        client = make_mock_client(VALID_JSON)
        _analyze_single_pass(client, "text", DEFAULT_MODEL)
        assert client.messages.create.call_count == 1

    def test_max_tokens_1024(self):
        client = make_mock_client(VALID_JSON)
        _analyze_single_pass(client, "text", DEFAULT_MODEL)
        call_kwargs = client.messages.create.call_args
        assert call_kwargs.kwargs.get("max_tokens") == 1024 or call_kwargs[1].get("max_tokens") == 1024

    def test_uses_specified_model(self):
        client = make_mock_client(VALID_JSON)
        _analyze_single_pass(client, "text", "claude-opus-4-6")
        call_kwargs = client.messages.create.call_args
        model = call_kwargs.kwargs.get("model") or call_kwargs[1].get("model")
        assert model == "claude-opus-4-6"

    def test_transcript_in_user_message(self):
        client = make_mock_client(VALID_JSON)
        _analyze_single_pass(client, "my transcript", DEFAULT_MODEL)
        call_kwargs = client.messages.create.call_args
        messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")
        assert messages[0]["role"] == "user"
        assert "my transcript" in messages[0]["content"]


# ---------------------------------------------------------------------------
# analyze_transcript — single pass path
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptSinglePass:
    def test_result_has_required_keys(self):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "short text")
        assert "key_points" in result
        assert "model_used" in result
        assert "chunks_used" in result

    def test_chunks_used_is_1(self):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "short text")
        assert result["chunks_used"] == 1

    def test_model_used_matches_default(self):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "short text")
        assert result["model_used"] == DEFAULT_MODEL

    def test_model_used_matches_override(self):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "short text", model="claude-opus-4-6")
        assert result["model_used"] == "claude-opus-4-6"

    def test_single_api_call_for_short_text(self):
        client = make_mock_client(VALID_JSON)
        analyze_transcript(client, "short text")
        assert client.messages.create.call_count == 1


# ---------------------------------------------------------------------------
# analyze_transcript — chunked path
# ---------------------------------------------------------------------------

class TestAnalyzeTranscriptChunked:
    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=["chunk1", "chunk2", "chunk3"])
    def test_n_plus_1_calls(self, mock_split, mock_needs):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "any text")
        # 3 chunk calls + 1 consolidation = 4
        assert client.messages.create.call_count == 4

    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=["chunk1", "chunk2", "chunk3"])
    def test_chunks_used_is_n_plus_1(self, mock_split, mock_needs):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "any text")
        assert result["chunks_used"] == 4

    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=["chunk1", "chunk2", "chunk3"])
    def test_all_calls_use_max_tokens_1024(self, mock_split, mock_needs):
        client = make_mock_client(VALID_JSON)
        analyze_transcript(client, "any text")
        for c in client.messages.create.call_args_list:
            mt = c.kwargs.get("max_tokens") or c[1].get("max_tokens")
            assert mt == 1024

    @patch("analysis.needs_chunking", return_value=True)
    @patch("analysis.split_into_chunks", return_value=[])
    def test_empty_chunks_returns_empty(self, mock_split, mock_needs):
        client = make_mock_client(VALID_JSON)
        result = analyze_transcript(client, "any text")
        assert result["key_points"] == []
        assert client.messages.create.call_count == 0
