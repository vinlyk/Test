"""Tests for chunker.py"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch

from chunker import (
    CHUNK_WORD_COUNT,
    SINGLE_PASS_WORD_THRESHOLD,
    WORDS_PER_TOKEN,
    estimate_tokens,
    needs_chunking,
    split_into_chunks,
)


class TestEstimateTokens:
    def test_100_words(self):
        text = " ".join(["word"] * 100)
        assert estimate_tokens(text) == int(100 * WORDS_PER_TOKEN)  # 75

    def test_200_words(self):
        text = " ".join(["word"] * 200)
        assert estimate_tokens(text) == int(200 * WORDS_PER_TOKEN)  # 150

    def test_proportional(self):
        text_100 = " ".join(["word"] * 100)
        text_200 = " ".join(["word"] * 200)
        assert estimate_tokens(text_200) == 2 * estimate_tokens(text_100)

    def test_empty_string(self):
        assert estimate_tokens("") == 0

    def test_single_word(self):
        assert estimate_tokens("hello") == 0  # int(1 * 0.75) = 0


class TestNeedsChunking:
    def test_short_text_false(self):
        text = " ".join(["word"] * 100)
        assert needs_chunking(text) is False

    def test_empty_false(self):
        assert needs_chunking("") is False

    @patch("chunker.SINGLE_PASS_WORD_THRESHOLD", 10)
    def test_over_threshold_true(self):
        text = " ".join(["word"] * 11)
        assert needs_chunking(text) is True

    @patch("chunker.SINGLE_PASS_WORD_THRESHOLD", 10)
    def test_exactly_threshold_false(self):
        text = " ".join(["word"] * 10)
        assert needs_chunking(text) is False

    @patch("chunker.SINGLE_PASS_WORD_THRESHOLD", 10)
    def test_one_over_threshold_true(self):
        text = " ".join(["word"] * 11)
        assert needs_chunking(text) is True


class TestSplitIntoChunks:
    def test_empty_returns_empty_list(self):
        assert split_into_chunks("") == []

    def test_single_word_one_chunk(self):
        result = split_into_chunks("hello")
        assert result == ["hello"]

    @patch("chunker.CHUNK_WORD_COUNT", 5)
    def test_exact_chunk_size_one_chunk(self):
        text = " ".join(["word"] * 5)
        chunks = split_into_chunks(text)
        assert len(chunks) == 1

    @patch("chunker.CHUNK_WORD_COUNT", 5)
    def test_two_chunks(self):
        text = " ".join(["word"] * 10)
        chunks = split_into_chunks(text)
        assert len(chunks) == 2

    @patch("chunker.CHUNK_WORD_COUNT", 5)
    def test_partial_last_chunk(self):
        # 7 words: first chunk = 5 words, second = 2 words
        words = [f"w{i}" for i in range(7)]
        text = " ".join(words)
        chunks = split_into_chunks(text)
        assert len(chunks) == 2
        assert len(chunks[0].split()) == 5
        assert len(chunks[1].split()) == 2

    @patch("chunker.CHUNK_WORD_COUNT", 5)
    def test_chunk_sizes(self):
        text = " ".join([f"w{i}" for i in range(25)])
        chunks = split_into_chunks(text)
        assert len(chunks) == 5
        for chunk in chunks:
            assert len(chunk.split()) == 5

    @patch("chunker.CHUNK_WORD_COUNT", 8)
    def test_word_preservation(self):
        """All words must be present across all chunks with no data loss."""
        words = [f"word{i}" for i in range(25)]
        text = " ".join(words)
        chunks = split_into_chunks(text)
        reconstructed_words = []
        for chunk in chunks:
            reconstructed_words.extend(chunk.split())
        assert reconstructed_words == words

    def test_real_chunk_count(self):
        """25000 words at CHUNK_WORD_COUNT=8000 → 4 chunks."""
        words = [f"w{i}" for i in range(25000)]
        text = " ".join(words)
        chunks = split_into_chunks(text)
        expected_chunks = (25000 + CHUNK_WORD_COUNT - 1) // CHUNK_WORD_COUNT
        assert len(chunks) == expected_chunks

    def test_no_overlap(self):
        """Words should not appear in more than one chunk."""
        words = [f"unique{i}" for i in range(20)]
        text = " ".join(words)
        with patch("chunker.CHUNK_WORD_COUNT", 5):
            chunks = split_into_chunks(text)
        all_words = []
        for chunk in chunks:
            all_words.extend(chunk.split())
        # No duplicates if no overlap
        assert len(all_words) == len(set(all_words))
