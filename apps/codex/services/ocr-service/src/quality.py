"""
Per-page text cleanliness metrics (DocumentPage.quality).

See apps/docs/codex/ingestion-pipeline-v2-plan.md#quality-telemetry. These are
proxies for clean reading, not proof of correctness; badge thresholds are set
from the gold set.
"""
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set

LEXICON_PATH = Path(__file__).resolve().parent / "data" / "game_lexicon.txt"

# Tokens that are not words and must not count against wordValidity.
DICE = re.compile(r"^\d*d\d+(?:\s*[+\-−]\s*\d+)?$", re.IGNORECASE)
NUMBER = re.compile(r"^[+\-−]?\d+(?:[.,/:]\d+)*%?$")
ORDINAL = re.compile(r"^\d+(?:st|nd|rd|th)$", re.IGNORECASE)
MARKDOWN_SYNTAX = re.compile(r"[#*_`>|\[\]()!~]")
TOKEN_EDGE = re.compile(r"^[^\w]+|[^\w]+$")
MARKDOWN_CHARS = set("#*_`>|~+-=<$^")
WORD_SHAPE = re.compile(r"^[a-z]+(?:['’\-][a-z]+)*$")


@lru_cache(maxsize=1)
def _english():
    from spellchecker import SpellChecker

    return SpellChecker(distance=1)


@lru_cache(maxsize=1)
def game_lexicon() -> frozenset:
    if not LEXICON_PATH.exists():
        return frozenset()
    return frozenset(w.strip() for w in LEXICON_PATH.read_text(encoding="utf-8").splitlines() if w.strip())


def _is_non_word(token: str) -> bool:
    return bool(DICE.match(token) or NUMBER.match(token) or ORDINAL.match(token))


def _tokens(text: str) -> List[str]:
    return [TOKEN_EDGE.sub("", t) for t in MARKDOWN_SYNTAX.sub(" ", text).split()]


def word_validity(text: str, extra_lexicon: Optional[Iterable[str]] = None) -> Optional[float]:
    """
    Share of word tokens found in an English dictionary or the game lexicon,
    after excluding dice notation (2d6+3), numbers and ordinals. None when the
    page has no word tokens (for example a full-page illustration).
    """
    lexicon: Set[str] = set(game_lexicon())
    if extra_lexicon:
        lexicon.update(w.lower() for w in extra_lexicon)

    words: List[str] = []
    for token in _tokens(text):
        # "3rd-level" -> "level": numeric, ordinal and dice parts are not words.
        parts = [p for p in re.split(r"[\-–—/+]", token) if p and not _is_non_word(p)]
        if parts:
            words.append("-".join(parts).lower())
    if not words:
        return None

    candidates = [w for w in words if w not in lexicon]
    # Hyphenated/possessive forms count if every part is known.
    parts = {p for w in candidates for p in re.split(r"['’\-]", w) if p}
    known = _english().known(list(parts | set(candidates)))

    def valid(word: str) -> bool:
        if word in lexicon or word in known:
            return True
        if not WORD_SHAPE.match(word):
            return False
        pieces = [p for p in re.split(r"['’\-]", word) if p]
        return len(pieces) > 1 and all(p in known or p in lexicon or len(p) == 1 for p in pieces)

    return round(sum(1 for w in words if valid(w)) / len(words), 4)


def symbol_noise(text: str) -> float:
    """Share of non-space characters that are neither alphanumeric nor punctuation."""
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 0.0
    noisy = sum(
        1
        for c in chars
        # Markdown syntax and arithmetic signs are expected output, not noise.
        if not c.isalnum() and not unicodedata.category(c).startswith("P") and c not in MARKDOWN_CHARS
    )
    return round(noisy / len(chars), 4)


def repetition(text: str, n: int = 3) -> int:
    """
    Longest run of one n-gram repeated back to back, in repeats. An
    autoregressive OCR loop ("the the the the ...") scores high; normal prose
    scores 1.
    """
    words = [w.lower() for w in _tokens(text) if w]
    if len(words) < n:
        return 1 if words else 0
    best = 1
    for size in range(1, n + 1):
        i = 0
        while i + size <= len(words):
            gram = words[i:i + size]
            run = 1
            j = i + size
            while words[j:j + size] == gram:
                run += 1
                j += size
            best = max(best, run)
            i += 1 if run == 1 else (run - 1) * size
    return best


def page_quality(markdown: str, text_extraction_method: Optional[str] = None,
                 extra_lexicon: Optional[Iterable[str]] = None) -> Dict[str, object]:
    """
    PageQuality for one page. `text_extraction_method` is Marker's page-level
    value: "pdftext" (embedded text) or "surya" (OCR).
    """
    quality: Dict[str, object] = {
        "wordCount": sum(1 for t in _tokens(markdown) if t and not NUMBER.match(t)),
        "symbolNoise": symbol_noise(markdown),
        "repetition": repetition(markdown),
    }
    validity = word_validity(markdown, extra_lexicon)
    if validity is not None:
        quality["wordValidity"] = validity
    if text_extraction_method:
        ocr = 1.0 if text_extraction_method != "pdftext" else 0.0
        quality["textSource"] = {"embedded": 1.0 - ocr, "ocr": ocr}
    return quality
