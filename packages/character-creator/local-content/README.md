# Local content pack

Put your own book text here. Everything in this folder except this README and
`spells.example.json` is gitignored, so it is never committed or pushed, and
images built in CI do not contain it.

1. Copy `spells.example.json` to `spells.json` (any `*.json` name works; files
   are merged, later names win).
2. Key each spell by its name. Matching ignores case and curly apostrophes.
3. Value is the text, or `{ "description", "higherLevels" }`.
4. Restart the dev server. Matching spells show your text and are no longer
   flagged "text not bundled". Names that do not match a known spell are ignored.

This works for the 33 Artificer spells that ship mechanics-only, and it also
overrides SRD spell text if you list those names. It applies in dev builds and
in any local build made on a machine that has the files; a deployed image built
elsewhere will not have them.
