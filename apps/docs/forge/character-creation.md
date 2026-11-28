# Create a character

Start with your group's rules edition, starting level, and character idea. If
someone has told you to “make a Fighter,” you already have enough to begin.
Forge and VTT share one creator; the place you open it decides where the
finished character is saved.

## Open the creator

In Forge, open **New Character**, select the rules edition, then choose
**Character Wizard**. If you opened the dedicated Character Forge page, choose
**Create a character**. In VTT, use **Create Character** on the dashboard,
**Open Character Forge** in Player Setup, or **Create** in the in-game
Characters panel. Both apps open the shared wizard.

The default edition is 2024. Choose **Legacy (2014)** from the Forge dashboard
or add `?edition=2014` to the dedicated Forge creator or VTT page URL before
opening the wizard. Existing drafts resume with their saved edition. Follow
[VTT character onboarding](/vtt/features/character-onboarding) to join a game
with the finished sheet.

## Enter a character manually in Forge

Choose **Manual Entry** under **New Character**. Enter your character's level,
class, species, background, ability scores, HP, skill proficiencies, languages,
and coins. The preview shows class saving throws for the selected edition and
unarmored AC of 10 plus the Dexterity modifier. A new sheet starts with full
class hit dice for its level and an empty inventory. Use **Character Wizard**
when you want starting equipment and spell choices.

Select **Save Character** to save the sheet to this browser. A failed save keeps
the form open for retry.

## Start with recommended picks or choose each option

1. On **Character Level**, set the starting level your DM requested. For a
   level-one build, select a class under **Start with recommended picks** and
   apply **Use recommended picks**. A Fighter is a straightforward first build.
2. Continue through the wizard and review background, species, class choices,
   abilities, and equipment. The wizard skips screens that do not apply to
   your character.
3. For a spellcaster, check cantrips, granted spells, and prepared spells or
   spellbook choices for your class. The spell picker shows the required counts.
4. On **Final Details & Personality**, check the name, HP, equipment and
   remaining choices. Choose **Create Character**, or **Save Character** on the
   dedicated Forge creator page.

You can build each choice yourself by continuing without applying recommended
picks. For an elf Rogue, choose an Elf species and lineage, check Stealth and
expertise, and select a bow and ammunition if you want ranged attacks.

Use **Back** to change an earlier choice. Changing class, background, species,
level, or abilities can reset dependent choices. Review skills, feats, spells,
languages, and equipment after a change. Check the finished sheet with your DM,
especially for builds above level one.

## Save, cancel, resume, and retry

Press the final button once and wait for **Saving…**; extra clicks are ignored.
If saving fails, the creator stays open with your answers and shows the error.
Fix the cause (for example, restore your connection) and press the button again.

Cancelling or closing the creator keeps a draft **in this browser**. The next
time you open the creator it offers:

* **Resume creation** — continue where the draft left off (including which
  screen you were on).
* **Retry previous save** — shown when a finished build was frozen but not saved.
* **Export recovery copy** — downloads the draft as `nexus-character-draft.json`.
* **Discard draft and start new** — deletes the draft.

The draft is removed only after the character is saved successfully. There is
**one draft per browser** in Forge (and one per player and room in VTT), and
two open tabs can conflict — the second tab reports “Draft changed in another
tab.” Work in a single tab, and do not clear browser data to “fix” a draft; that
also deletes your characters.

| Where you create | Where the finished character lives |
| --- | --- |
| **Standalone Forge** | This browser's IndexedDB. No account and no automatic VTT sync. |
| **Signed-in VTT** | Saved to your account, then cached locally. |
| **Guest VTT** | Local to this browser only; it is not an account backup. |

### Recover common problems

| Symptom | Next action |
| --- | --- |
| Saved gear, money or spells differ from what you chose | Check inventory, equipped items, ammunition and coins with your DM; correct them on the saved sheet |
| Save reports an error | Keep the creator open, restore access, and press the button again; the retry reuses the same character, so it will not create a copy. Don't change answers between a failed save and the retry: the retry sends the first build, so edit the saved sheet afterwards instead |
| You closed the creator mid-build | Reopen it and choose **Resume creation** |
| Reopening says a draft exists you don't want | Choose **Export recovery copy** if unsure, then **Discard draft and start new** |
| A 2014 option is missing | Check the saved draft edition or open a fresh build using `?edition=2014` |
| A character is missing in another browser | Open the browser where you saved it; Forge data is per browser |
| Escape closes more than you expected | Use the visible **Back**, **Save** or close buttons inside nested editors |

## Use the saved character

After a successful Forge save, the new character is added to **Your Heroes**
and selected, and a short “created” message appears. If you do not land on the
sheet, choose **View Sheet** on its card; **Back to List** returns to the cards.
See [Using the character sheet](character-sheet.md) for first rolls, equipment,
and backups. **Edit** on a card is a manual editor, not a resumed creation.

**Export Data** downloads selected characters (all if none are selected) as JSON.
**Import Data** adds copies with **new IDs**, so importing the same file twice
creates duplicates. This is manual transfer, not sync. For VTT import and room
participation, follow [VTT onboarding](/vtt/features/character-onboarding).

## Keyboard, phone, and help

Use **Tab** and **Shift+Tab** to move, **Enter** or **Space** for buttons, and the
visible **Back** and **Continue** controls to navigate. The creator is a modal
dialog that keeps focus inside, closes with **Escape**, and returns focus to
where you started. Errors are announced to screen readers. Species traits and
spell details have explanations in the detailed wizard.

On a phone, scroll inside the creator to reach all choices and the footer, and
dismiss the soft keyboard if it covers navigation. Automated layout checks run at
320, 390, 768 and 1440 px wide, but testing on real phones, screen readers and
zoom levels has not been done. If a control cannot be reached or only works on
hover, use a larger screen and tell your DM which screen and control.

Contributors can read the
[shared-creator architecture](/vtt/adr/shared-character-creator).
