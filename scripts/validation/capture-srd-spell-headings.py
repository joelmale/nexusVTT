"""Extract factual spell-heading oracles from the pinned official PDFs.

Requires Python and pypdf (capture verified with pypdf 6.14.2). No production
catalog is read. These fixtures do not certify spell prose or runtime effects.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


def checked_pdf(path, digest):
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError(f"Unexpected PDF hash: {path}. Review a new source revision separately.")
    return PdfReader(path)


def legacy_headings(reader):
    rows = []
    for page in range(113, 193):
        state = {"pending": "", "y": None}

        def flush():
            name = re.sub(r"\s+", " ", state["pending"]).strip()
            state.update(pending="", y=None)
            if name and not name.isdecimal():
                rows.append({"name": name, "page": page + 1})

        def visit(text, _cm, tm, font, _size):
            if font and "GillSans-SemiBold" in str(font.get("/BaseFont", "")) and text.strip() and not text.strip().isdecimal():
                # Kerning fragments of one heading share a baseline. Distinct
                # headings must not be concatenated, even with the same font.
                if state["y"] is not None and abs(state["y"] - tm[5]) > 0.1:
                    flush()
                state["pending"] += text
                state["y"] = tm[5]
            elif text.strip():
                flush()

        reader.pages[page].extract_text(visitor_text=visit)
        flush()
    start = next(i for i, row in enumerate(rows) if row["name"] == "Acid Arrow")
    end = next(i for i, row in enumerate(rows) if row["name"] == "Zone of Truth")
    rows = rows[start:end + 1]
    if len(rows) != 319:
        raise ValueError("Incomplete legacy heading extraction.")
    return rows


def revised_headings(reader):
    text = "\n".join(page.extract_text() for page in reader.pages[95:175])
    schools = "Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation"
    pattern = rf"^([^\n]+)\n(?:Level ([1-9]) ({schools})|({schools}) Cantrip)\s*\(([^)]*)\)"
    rows = [{"name": name.strip(), "level": int(level or 0), "school": (school or cantrip).lower(),
             "classes": sorted(re.sub(r"\s+", "", entry).lower() for entry in classes.split(","))}
            for name, level, school, cantrip, classes in re.findall(pattern, text, re.M)]
    if len(rows) != 339:
        raise ValueError("Incomplete revised heading extraction.")
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy", type=Path, required=True)
    parser.add_argument("--revised", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("packages/character-creator/src/tests/fixtures"))
    args = parser.parse_args()
    definitions = [
        (args.legacy, "5.1", "2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0", "srd51-spell-headings.json", legacy_headings,
         "Spell names and printed page locators extracted from primary-source description headings; does not certify levels, class membership, descriptions or effects. Independent DM review pending."),
        (args.revised, "5.2.1", "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87", "srd521-spell-headings.json", revised_headings,
         "Spell names, levels, schools and class membership extracted from primary-source spell headings; does not certify spell descriptions or effects. Independent DM review pending."),
    ]
    args.output.mkdir(parents=True, exist_ok=True)
    for path, revision, digest, filename, extract, scope in definitions:
        url_revision = "5.1" if revision == "5.1" else "5.2"
        rows = extract(checked_pdf(path, digest))
        artifact = {"revision": f"SRD {revision}", "source": f"https://media.dndbeyond.com/compendium-images/srd/{url_revision}/SRD_CC_v{revision}.pdf",
                    "pdfSha256": digest, "scope": scope, "spells": rows}
        (args.output / filename).write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
        print(f"Captured {len(rows)} source headings for SRD {revision}.")


if __name__ == "__main__":
    main()
