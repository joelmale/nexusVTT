from src.quality import page_quality, repetition, symbol_noise, word_validity


def test_word_validity_ignores_dice_numbers_and_ordinals():
    text = "Hit Points 114 (12d10 + 48). Casting Time: 1 action. 3rd-level evocation, 2d6+3 fire damage."
    assert word_validity(text) == 1.0


def test_word_validity_counts_game_lexicon_names():
    # Not English dictionary words; present in the SRD-derived lexicon.
    assert word_validity("The gorgon and the lich attack") == 1.0
    assert word_validity("Tiamat wakes") == 1.0


def test_word_validity_extra_lexicon():
    assert word_validity("Zyzzlethorp appears") == 0.5
    assert word_validity("Zyzzlethorp appears", ["Zyzzlethorp"]) == 1.0


def test_word_validity_flags_ocr_garbage():
    garbage = "Tlie qvick brwn fx jmps ovr tlie lazv dg"
    assert word_validity(garbage) < 0.5
    assert word_validity("   12 34 2d6 ") is None


def test_symbol_noise():
    assert symbol_noise("## Gorgon\n\n**Armor Class** 19 (natural armor)") == 0.0
    assert symbol_noise("abc ☼☼☼ ▓▓▒") > 0.4
    assert symbol_noise("") == 0.0


def test_repetition_detects_loops():
    assert repetition("The gorgon breathes petrifying gas at a creature it can see.") == 1
    assert repetition("the the the the the the") == 6
    assert repetition("armor class armor class armor class armor class and more") == 4


def test_page_quality_shape():
    quality = page_quality("## Gorgon\n\nArmor Class 19", "surya")
    assert quality["wordValidity"] == 1.0
    assert quality["textSource"] == {"embedded": 0.0, "ocr": 1.0}
    assert set(quality) == {"wordCount", "symbolNoise", "repetition", "wordValidity", "textSource"}
    assert "textSource" not in page_quality("text")
