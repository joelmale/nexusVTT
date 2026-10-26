# Create a character

Start with your group's rules edition, starting level, and character idea. If
someone has told you to “make a Fighter,” you already have enough to begin.
Forge and VTT share the creator; the place you open it determines where the
finished character is saved.

:::note Candidate features
This guide describes the character-creation candidate in the current source.
The four-screen flow and VTT draft recovery are implemented but still under
review. Interface labels such as “optimal” or “certified” do not establish
complete rules support or release readiness. See the
[implementation status and remaining gates](/platform/integrations/character-creation-implementation-plan).
:::

## Open the creator and choose a path

In standalone Forge, open **New Character**, choose **Legacy (2014)** or
**Revised (2024)**, then choose a method. Revised (2024) is the initial choice.
Use the edition your DM requested; neither edition includes every published
option.

| Forge option | What opens | Use it when |
| --- | --- | --- |
| **Personality Wizard** | Four-screen level-one build, with an optional longer quiz | You want a suggested starting point, or already know your class |
| **Character Wizard** | Detailed choices, starting with level | You want control over backgrounds, lineage, class choices, spells, and equipment |
| **Manual Entry** | A character-sheet form | You already have a character and want to copy its values |

In VTT, **Open Character Forge**, **Create Character**, or the in-game
character creator opens the shared flow inside VTT. It starts with the
four-screen build using 2024; the VTT host has no edition picker. Choose
**Advanced Mode** for detailed choices. For room participation, continue to
[VTT character onboarding](/vtt/features/character-onboarding).

## Make a first Fighter

In Forge, choose **Personality Wizard**. In VTT, use the initial guided flow.

1. On **How do you want to play?**, choose **Close Combat**, or choose
   **Fighter** in the class buttons. Leave **Desired Species** on
   **Recommended Match**, unless you have a preference.
2. On **Recommended Character**, read the class, species, background,
   ability scores, and skills. Ability scores describe strengths such as
   Strength and Dexterity; a skill proficiency is training in a task.
   **Customize Stats** and **Customize Skills** open editors.
3. Review **Starting Loadout & Currency**. “Equipped” means an item is marked
   for use, rather than merely carried. Check the actual weapon and armor
   list: the **Close Combat** description mentions a sword and shield, but
   that description does not guarantee a shield in the supplied package.
4. On **Name & Finalize**, enter a name or use **Randomize Name**, choose an
   alignment, and read **First-Turn Combat Guidance**. Alignment is a brief
   roleplaying description. Choose **Create Character** and wait for saving.

This is a suggested build, not a guarantee of legal or complete output.
Review the saved sheet with your DM, including HP, armor, weapon attacks,
class resources, and required feat or spell choices. The equipment and money
shown before saving can differ from the saved result in this candidate.
For precise choices, use the detailed wizard from the outset.

## Make a sneaky elf archer

**Sneak & Skills** recommends a Rogue. **Ranged Archery** recommends a
Fighter. Choosing archery does not also promise Stealth training, and
choosing Rogue does not finish every species or expertise choice for you.

For a starting point, choose **Sneak & Skills**, set **Desired Species** to
the available Elf option, and inspect skills and gear. **Customize Skills**
changes class skill selections; **Back** returns to the earlier screen while
the flow remains open.

For control over the complete concept, start with **Character Wizard** in
Forge, or **Advanced Mode** before making guided edits in VTT. Choose Elf,
the available lineage or variant, and Rogue; then choose class skills and
expertise. Expertise is extra training in selected skills. Select equipment
containing the intended bow, and check that the saved inventory includes
ammunition as well as the bow. Check species-granted skills, background
skills, and class selections for duplicates. The quick flow's skill editor
does not reliably show all background grants.

## Make a spellcaster with a starting package

**Arcane Magic** recommends a Wizard; **Divine Support** recommends a Cleric.
The guided flow displays starting spells on the equipment screen. Cantrips
are repeatable spells; prepared spells are the spells selected for use,
while a Wizard's spellbook can contain additional spells.

Read **Prepared Spells & Cantrips**, and open **Swap Spells** if needed. The
Wizard recommendation includes a six-spell book and a prepared subset in
the source, but that does not prove all edition, species, background, and
feat grants are complete. Spell swaps can reset when another choice
rebuilds the recommendation, including a name change. Recheck before saving.

Use the detailed wizard for explicit spell selection, class features,
subclasses, or additional granted spells. Its spell screen separates
cantrips, known/prepared spells, and the Wizard's book and preparation where
applicable. Read spell details and satisfy the displayed counts. Those
counts are interface limits, not proof that every 2014 and 2024 formula is
correct. **Randomize** on this screen currently does nothing; select spells
directly.

Before playing, check the saved focus/component equipment, book or known
spells, prepared spells, attack bonus, save DC, and slots. A save DC is the
number a target must meet when resisting a spell. Known and prepared spell
lists can be lost during final result generation in this candidate; if the
saved sheet is incomplete, review it with your DM before play.
[Forge's sheet](character-sheet.md#spells-and-first-actions) and the
[VTT sheet](/vtt/features/character-onboarding#take-your-first-actions) have
different spell controls. These VTT sheets do not currently offer complete
spell casting and slot management.

## Choose everything in the detailed wizard

The detailed wizard offers starting levels 1–20. Availability does not mean
every class, level, or edition has been independently verified. Follow the
screens that appear for your build, rather than a fixed step number:
conditional steps are skipped.

| Screen or choice | What to check |
| --- | --- |
| **Character Level** | Starting level agreed with your DM |
| **Basic Identity** | Name, alignment, background; in 2024, the background ability-increase choices shown by the form |
| **Choose Species** | Species, lineage/variant, and any displayed skill, feat, or spell choices |
| **Choose Class & Subclass** | Class skills and class-specific or subclass choices offered for that level |
| **Determine Abilities** | Standard array, point buy, rolled scores, or custom values; changing the method resets assignments |
| **High-Level Setup / Ability Score Improvements** | Additional choices shown for higher starting levels |
| **Fighting Style / Spells / Feats** | Conditional selections displayed for your build; a feat is a special character benefit |
| **Select Languages** | Languages your character is meant to know |
| **Select Equipment / Customize Equipment** | Package or shopping choices, additional inventory, quantities, and money |
| **Final Details & Personality** | Personality, ideals, bonds, flaws, HP method, and final creation |

Standard array assigns the same six starting numbers to different abilities;
point buy spends a displayed budget. Use custom scores or extra equipment
with your DM's agreement. The equipment browser permits adding items and
should not be treated as proof that every item was paid for or granted.

The 2024 equipment screen offers a background-package/gold fork; other modes
include quick-start packages, choices, and a shop. Review actual contents
and the saved result. Class/background packages, currency, quantities, and
equipped state are not fully consistent across preview and save paths.
Do not assume selecting a package and selecting gold grants both.

Use **Back** to revise answers. Some dependent screens remove selections
that exceed their limits, but there is no complete explanation or automatic
repair of every affected choice. After changing class, background, species,
level, or abilities, revisit skills, feats, spells, languages, and equipment.

## Fast creation for an experienced player

For a level-one starting point, choose the class directly on the first guided
screen; no personality questions are required. The longer quiz is available
through **Want to take the in-depth personality quiz instead?** It suggests
a class and profile, but does not carry quick-flow work into the quiz.

Choose the detailed wizard immediately for exact choices or a higher
starting level. In Forge, return to **New Character** and select
**Character Wizard**. In VTT, choose **Advanced Mode**. Switching
presentations does not reliably preserve current answers in this candidate;
record important choices first. The detailed view has no matching button
to return to the quick flow.

## Save, cancel, resume, and retry

Choose the final creation button once and wait for **Saving…**. Concurrent
submissions are blocked. A reported failure leaves the creator open with its
current answers: read the error, restore the required connection or storage
access, and try the final button again. If a request may have succeeded
before the error appeared, check the character list first; stable identity
across retries is not guaranteed in every host path.

| Where you create | Finished character | Interrupted creation |
| --- | --- | --- |
| **Standalone Forge** | Saved in this browser's IndexedDB and selected for display | No wizard draft save; closing, switching methods, or reloading can lose unfinished work |
| **Signed-in VTT** | Account save attempted before adding to the local list | Candidate stores a browser-local draft; recovery is partial with no resume/conflict prompt |
| **Guest VTT** | Added to the local character store/cache without an account save | Same partial local draft mechanism; it is not an account backup |

The close button and **Escape** dismiss the creator unless a save is in
progress. The detailed wizard also closes when its backdrop is clicked.
There is no unsaved-work confirmation. In the guided flow, **Back** on the
first screen leaves the flow.

VTT attempts to load the last local draft when the creator opens. It starts
at the first screen, and the quick flow restores only part of the choices.
Customized abilities and skills, alignment, spell edits, and the previous
screen are not all reliably recovered. The quiz does not save a draft.
There is no visible draft export, discard, migration, or multi-tab conflict
recovery interface. Keep creation to one tab and recheck every screen after
reopening. Do not clear browser storage as a recovery step; that can remove
characters and drafts.

### Recover common problems

| Symptom | Next action |
| --- | --- |
| Saved gear or money differs from the package | Check inventory, equipped items, ammunition, and coins with your DM; make an explicit correction on the saved sheet and retain a backup |
| A spell or skill edit disappears | Recheck final choices; use the detailed wizard for controlled selection before saving |
| A 2014 option is missing | Confirm **Legacy (2014)** in Forge; VTT currently opens 2024. Do not silently substitute a similarly named 2024 option |
| Save reports an account/network error | Keep the creator open, restore access, and retry after checking whether the character already exists |
| Reopened work differs | Treat it as partial recovery and review the whole build before submitting |
| A nested editor closes the entire creator | Reopen and check what survived. Use its visible **Save** or close button instead of Escape |
| A character is absent in another browser | Open the browser/profile where it was saved; Forge characters and drafts do not synchronize between browsers |

## Use the saved character

After a successful Forge save, the new character's sheet opens. Use
**Back to List** to return to character cards and select it again later.
For first rolls, equipment, editing, and backups, see
[Using the character sheet](character-sheet.md).

Use **Edit** on a Forge character card to change an existing character. This
is a manual editor, not a resumed creation wizard. It permits changing the
edition field; that is not a guided rules conversion. Back up before major
edits and review the resulting values.

Forge's **Export Data** downloads selected characters, or all characters if
none are selected, as JSON. **Import Data** adds copies with new IDs. This is
manual transfer/backup, not ongoing synchronization. For VTT import and room
participation, follow [VTT onboarding](/vtt/features/character-onboarding).

## Keyboard, phone, and help

Use **Tab** and **Shift+Tab** between controls, **Enter** or **Space** for
buttons, and visible **Back** and **Continue/Next** controls to navigate.
The creator includes dialog labels and save-error announcements, but full
keyboard, screen-reader, phone, and zoom certification remains pending.
Some nested editors do not isolate Escape; use their visible close control.

On a phone, scroll inside the creator to reach all choices and the footer.
Dismiss the soft keyboard if it covers navigation. Species traits and spell
details offer explanations in the detailed flow. If a control cannot be
reached or help only appears on hover, use a larger screen or ask your DM
for assistance and report the screen, device, and control name.

Contributors can read the
[shared-creator architecture](/vtt/adr/shared-character-creator).
