"""
Transcript chunking utilities.
No API calls — uses word-count heuristics only.
"""

WORDS_PER_TOKEN = 0.75
SINGLE_PASS_WORD_THRESHOLD = 100_000
CHUNK_WORD_COUNT = 8_000

# Translation is chunked by characters, not words: languages like Chinese have
# no spaces, so word counts wildly underestimate their real length.
TRANSLATE_CHUNK_CHARS = 4_000


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


def split_by_chars(text: str, max_chars: int = TRANSLATE_CHUNK_CHARS) -> list:
    """
    Split text into chunks of at most `max_chars` characters, breaking on line
    boundaries so lines (and their timestamps) stay intact. Used for translation,
    where character count is the meaningful size measure. Returns [] for empty input.
    """
    if not text.strip():
        return []

    chunks = []
    current = []
    current_len = 0
    for line in text.split("\n"):
        added = len(line) + 1  # +1 for the newline that rejoins them
        if current and current_len + added > max_chars:
            chunks.append("\n".join(current))
            current = [line]
            current_len = added
        else:
            current.append(line)
            current_len += added

    if current:
        chunks.append("\n".join(current))
    return chunks
