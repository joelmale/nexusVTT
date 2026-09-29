"""
Regenerates src/data/game_lexicon.txt: lower-case words that appear in SRD
entity names (monsters, spells, classes, races, features, feats, subclasses)
plus a curated list of common RPG terms. The quality metric's `wordValidity`
treats these as real words so "Tiamat" or "Gorgon" is not counted as OCR noise.

Usage (from the repo root):
    python apps/codex/services/ocr-service/scripts/build_game_lexicon.py
"""
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]
SRD = REPO / "packages" / "character-creator" / "src" / "data" / "srd"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "game_lexicon.txt"

SOURCES = ["Monsters", "Spells", "spells", "Classes", "Races", "Features", "Feats", "Subclasses", "Alignments"]

CURATED = """
aarakocra abjuration antimagic arcana attunement bardic battlemaster bonus cantrip cantrips
chromatic concentration conjuration darkvision dex divination dm dmg dnd dragonborn dungeon
eldritch enchantment evocation expertise fey fiendish genasi githyanki githzerai grapple
grappled halfling hexblade homebrew illusion incapacitated initiative ki kobold lich
longbow longsword multiclass multiclassing necromancy necrotic nonmagical npc npcs paladin
pc pcs petrified phb pseudodragon psionic quarterstaff rapier recharge ritual shortbow
shortsword sorcerer spellcasting spellbook statblock subclass subrace tabaxi tiefling
transmutation truesight tremorsense warlock yuan-ti
beholder demilich drow duergar illithid kenku mephit tiamat bahamut vecna tabletop
"""

WORD = re.compile(r"[a-z][a-z'\-]+")


def names(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "name" and isinstance(item, str):
                yield item
            else:
                yield from names(item)
    elif isinstance(value, list):
        for item in value:
            yield from names(item)


def main():
    words = set(CURATED.split())
    for path in sorted(SRD.rglob("*.json")):
        if not any(source in path.name for source in SOURCES):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as error:
            print(f"skipping unreadable {path.relative_to(REPO)}: {error}")
            continue
        for name in names(data):
            words.update(WORD.findall(name.lower()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(sorted(w.strip("'-") for w in words if len(w.strip("'-")) > 1)) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(words)} words)")


if __name__ == "__main__":
    main()
