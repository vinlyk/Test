"""
Transcript chunking utilities.
No API calls — uses word-count heuristics only.
"""

WORDS_PER_TOKEN = 0.75
SINGLE_PASS_WORD_THRESHOLD = 100_000
CHUNK_WORD_COUNT = 8_000


def estimate_tokens(text: str) -> int:
    """Estimate token count from word count (0.75 tokens per word)."""
    return int(len(text.split()) * WORDS_PER_TOKEN)


def needs_chunking(text: str) -> bool:
    """Return True if the transcript is too long for a single API call."""
    return len(text.split()) > SINGLE_PASS_WORD_THRESHOLD


def split_into_chunks(text: str) -> list:
    """
    Split text into word-boundary chunks of CHUNK_WORD_COUNT words each.
    No overlap. Returns [] for empty input.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    for i in range(0, len(words), CHUNK_WORD_COUNT):
        chunk_words = words[i: i + CHUNK_WORD_COUNT]
        chunks.append(" ".join(chunk_words))
    return chunks
