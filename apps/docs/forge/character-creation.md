# Create a character

Start with your group's rules edition, starting level, and character idea. If
someone has told you to “make a Fighter,” you already have enough to begin.
Forge and VTT share one creator; the place you open it decides where the
finished character is saved.

:::note What this guide is based on
Written 2026-10-27 from the current source (Forge 1.5.3, VTT 0.1.0, commit
`6d187098`), not from a deployed site. Your hosted version may be older.
Labels such as “recommended” describe a suggested starting point. The app
does not guarantee that every class, level, or option is complete and
correct, and its accessibility has not been tested on real devices or with
screen readers. Always review the saved sheet with your DM. Contributors:
see the [engineering guide](/platform/integrations/character-creation).
:::

## Open the creator and choose a path

In standalone Forge, open **New Character**, choose **Legacy (2014)** or
**Revised (2024)** (2024 is selected first), then choose a method. Use the
edition your DM requested.

| Forge option | What opens | Use it when |
| --- | --- | --- |
| **Personality Wizard** | The four-screen quick build (with an optional longer quiz) | You want a suggested starting point, or you already know your class |
| **Character Wizard** | The detailed wizard | You want control over background, species, class choices, spells, and equipment |
| **Manual Entry** | A character-sheet form | You already have a character and want to copy its values |

In VTT, **Open Character Forge**, **Create Character**, or the in-game
**Create** button opens the same creator inside VTT. VTT first asks
**Use 2014 rules** or **Use 2024 rules**, then opens the **detailed wizard**.
Choose **Use guided creation** at the top of the wizard for the quick build.
Inside the quick build, **Advanced Mode** switches back to the detailed wizard. Forge offers the same switch buttons in whichever door you open.
Switching keeps your name, class and the rest of your draft in most cases; if
you rely on a choice you made on the first quick-build screen (the playstyle
card or the species list), look at it again after you switch. For
joining a room, continue to
[VTT character onboarding](/vtt/features/character-onboarding).

## Make a first Fighter

In Forge choose **Personality Wizard**. In VTT choose **Use guided creation**.

1. On **How do you want to play?**, choose **Close Combat**, or press the
   **Fighter** button under the class list. Leave **Desired Species** on
   **Recommended Match** unless you have a preference.
2. On **Recommended Character**, read the class, species, background, ability
   scores, and skills. Ability scores describe strengths such as Strength and
   Dexterity; a skill proficiency is training in a task. **Customize Stats**
   and **Customize Skills** open editors.
3. On the equipment screen, check the weapon and armor list. “Equipped” means an
   item is marked for use, not merely carried. A playstyle description such as
   “sword and shield” does not guarantee that exact gear.
4. On **Name & Finalize**, enter a name or use the dice-icon **Randomize Name** button, choose an
   alignment (a short roleplaying description), and read **First-Turn Combat
   Guidance**. Choose **Create Character** and wait for **Saving…**.

The build is a suggestion. Compare the saved sheet with what you chose,
especially HP, armor class, weapon attacks, and money.

## Make a sneaky elf archer

**Sneak & Skills** recommends a Rogue. **Ranged Archery** recommends a Fighter
and starts from an Elf unless you choose another species. Neither promises
every detail of your concept.

* For a quick start, choose **Sneak & Skills**, set **Desired Species** to an
  Elf option, then open **Customize Skills** and check for Stealth.
* For full control, use the detailed wizard: choose an Elf species and lineage,
  the Rogue class, class skills, and expertise (extra training in chosen
  skills), then pick equipment that includes a bow and its ammunition.
* Check species, background and class skills for duplicates before saving.

## Make a spellcaster with a starting package

**Arcane Magic** recommends a Wizard and **Divine Support** a Cleric. Other
casters (Bard, Druid, Sorcerer, Warlock and more) are available from the class
buttons. The equipment screen shows **Prepared Spells & Cantrips**; a cantrip
is a spell you can cast repeatedly, and a prepared spell is one you have
chosen for the day. A Wizard also keeps a spellbook. Open **Swap Spells** to
change the suggestion.

Use the detailed wizard when you want to choose every spell, subclass, or
extra granted spell yourself; its spell screen shows the counts you must
meet. Before play, check the saved spell lists, spell attack bonus, save DC (the
number a target must meet to resist your spell), and spell slots. Forge's sheet
and the VTT sheet have [different spell controls](character-sheet.md#spells-and-first-actions).
The VTT sheet's **Spells** tab and Simple Mode's Spells card share one spellbook
panel with spell slots and a casting-source selector; it needs an active game
session, so outside a game track slots yourself.

## Choose everything in the detailed wizard

The detailed wizard has 14 steps, and steps that do not apply to your build are
skipped. It offers starting levels 1–20, but that does not mean every class and
level has been independently verified; level one is the best-covered case.

| Screen | What to check |
| --- | --- |
| **Character Level** | The starting level your DM agreed |
| **Basic Identity** (2024: includes background) | Name, alignment, background and, in 2024, its ability increases |
| **Choose Species** | Species, lineage, and any skill, feat or spell choices |
| **Choose Class & Subclass** | Class skills and class or subclass choices |
| **Determine Abilities** | Standard array, point buy, rolled or custom scores; changing method resets assignments |
| **High-Level Setup / Ability Score Improvements** | Extra choices for higher starting levels |
| **Fighting Style / Spells / Feats** | A feat is a special character benefit |
| **Select Languages** | Languages your character knows |
| **Select Equipment / Customize Equipment** | Package or gold, quantities, and money |
| **Final Details & Personality** | Personality, HP method, and final creation |

Standard array assigns six fixed numbers; point buy spends a displayed budget.
Use custom scores or extra equipment only with your DM's agreement. The 2024
equipment screen offers a background package-or-gold choice; selecting a package
does not also give you the gold.

Use **Back** to change earlier answers. Dependent choices may be cleared or
re-checked when you change class, background, species, level, or abilities, and
the creator does not list everything it changed, so revisit skills, feats,
spells, languages and equipment afterwards.

## Fast creation for an experienced player

For a level-one build, press your class's button on the first quick-build screen
and skip the playstyle questions. The longer quiz is behind **Want to take the
in-depth personality quiz instead?**; it also keeps your work if you switch.
For exact choices or a higher starting level, use the detailed wizard.

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
| A 2014 option is missing | Confirm the edition (**Legacy (2014)** in Forge, **Use 2014 rules** in VTT); don't substitute a similar 2024 option |
| A pick you made on screen 1 of the quick build isn't kept after switching modes | Choose it again, or use the detailed wizard from the start |
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
