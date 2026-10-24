# Use the Forge character sheet

A successful Forge creation opens the new character's sheet. To return later,
open **Your Heroes → View Sheet**. **Back to List** returns to the cards.
Forge saves characters in this browser's IndexedDB; it has no account or
automatic VTT synchronization.

For choosing a rules edition or making a build, use the
[character-creation guide](character-creation.md). For joining a room, use
[VTT character onboarding](/vtt/features/character-onboarding). The Forge
sheet and VTT sheet have different controls.

## Check the character before play

Read the saved class, level, species, background, abilities, HP, armor class
(AC), skills, equipped weapons, currency, and spell lists with your DM. A
preview or recommendation is not proof that every choice was saved or that
the build is rules-complete. The current creation candidate has known
[equipment, spell, and recovery limitations](character-creation.md#recover-common-problems).

The edition is stored on the character. Forge's creation chooser offers
2014 and 2024, but neither selection guarantees every published option or
complete automation. Do not treat a label change as conversion of an
existing character to a different rules edition.

## Find a comfortable layout

The desktop header's **Layout** selector offers **Classic D&D**, **Paper
Sheet**, and **Mobile**. Classic D&D is the initial desktop preference. On
a phone, the sheet uses the stacked layout regardless of that desktop
choice. The layout preference currently lives in memory; do not expect it
to persist after reloading.

The stacked layout has collapsible sections. Expand a section heading, or
use **Expand all sections**, to find hidden equipment, features, and actions.
Collapsed-section preferences are stored locally for that character. Layout
adjustment permits dragging sections, but keyboard reordering and persistence
of the panel order are not established.

## Make a first roll

1. Find **Skills** and select the skill your DM requests, such as Perception
   or Stealth. Where a roll-mode menu is shown, choose normal, advantage, or
   disadvantage before rolling.
2. For a saving throw, use **Saving Throws** and the requested ability.
   Check the displayed modifier against your intended proficiencies first.
3. Roll **Initiative** when combat begins. This makes a roll; it does not
   join a separate VTT room or place the character in that room's turn order.
4. Open **Attacks & Actions** and use the equipped weapon's attack control.
   Read the result and damage expression; the DM determines whether the
   attack hits and how damage applies.
5. Use **Dice Rolling Tray** for a custom expression when the sheet lacks
   the needed action, and inspect the roll history for results.

The sheet's controls are the supported route. Browser shortcuts such as
Ctrl+R are not character-sheet roll shortcuts.

## Equip a weapon and check ammunition

Open **Inventory** or the **Equipment** section in your layout. Use the
search and filters to find an item; open it for details and its available
**Equip/Unequip** action. Use **Add Items** to open the equipment manager.
Inventory quantities and equipped state are separate: carrying a bow does
not mean it is equipped.

After changing equipment, inspect the equipped weapon list and AC. Confirm
ammunition quantity, armor, shields, and money with your DM. These controls
are not a complete validator for hands, weapon compatibility, spending, or
edition-specific starting packages. Do not assume an attack automatically
consumes ammunition or that adding an item deducts its price.

## Spells and first actions

Open **Spellcasting** to see the ability, spell save DC, spell attack bonus,
cantrips, and the known or prepared spells present on the character. Select a
spell name for its description. A spell detail button is not an automatic
cast that resolves targeting, damage, healing, or concentration.

For prepared casters with a **Prepare** button, use it to open the preparation
dialog. A Wizard can have a spellbook and a separate prepared list; check
both after creation. Spell lists and preparation limits still have open
edition-specific issues. An empty prepared/known list can be a creation
handoff defect rather than a deliberate choice.

**Spell Slots** provides clickable markers for used/available slots. Mark
usage explicitly and verify the displayed level and count. Use the dice
tray with the expression agreed with your DM when an attack or damage roll
is needed. Do not assume opening a spell spends a slot or resolves its effect.

A Fighter can find **Second Wind** among class actions. Its action control
rolls healing, but the tactical action path does not reliably apply the HP
change or spend the resource. Record the use and update HP explicitly with
your DM. The creator's first-turn card is fixed guidance and may not match
the saved weapon, bonus, feature, or action cost.

## HP, rests, and other changes

Use the sheet's current-HP controls for damage or healing. Temporary HP has
separate controls. Check that the visible result changed as intended.
**Take a Short Rest** and **Take a Long Rest** are header actions; the short
rest asks about spending hit dice, and the long rest updates recovery.
The current rest implementation is not a complete edition-specific rules
validator. Review recovery with your DM, particularly hit dice and class
resources, rather than relying on the labels alone.

Conditions, coins, experience, and features have sections in the sheet;
expand them in stacked layouts. The level-up control opens a separate
progression workflow. Back up before major progression changes. Attunement
counters and some class/resource calculations are incomplete and differ
between layouts; use your group's rules rather than treating every counter
as authoritative.

## Editing an existing character

Available section controls can update items, HP, coins, and other values.
The repository also contains a manual character editor with an edition
field, but the current sheet layouts do not expose a working route to it.
There is no reliable “resume creation” or automatic rules-conversion flow
for an existing sheet. If a required correction has no reachable control,
retain an export and report the missing control instead of assuming the
creator will repair the original character.

## Back up or transfer characters

1. Use **Back to List**.
2. Select the checkboxes for specific heroes, or leave all unchecked to
   export all heroes.
3. Choose **Export Data** and keep the downloaded JSON file somewhere safe.

**Import Data** reads a Forge JSON array and adds copies with new character
IDs; it does not update an existing character in place. Importing the same
backup again can create additional copies. There is no automatic backup
service. Clearing site data, changing browser/profile, or losing the device
can make locally stored characters unavailable.

VTT's JSON importer can read Forge exports, but the apps do not maintain a
live link after import. Check gear, spells, money, and ownership in VTT after
transfer; see [VTT onboarding](/vtt/features/character-onboarding).

## When a control is missing or gives a surprising result

| Symptom | Next step |
| --- | --- |
| Equipment or actions are hidden | Expand the section or use **Expand all sections** in the stacked layout |
| No weapon attack is available | Confirm the weapon is carried and equipped |
| An attack or spell modifier looks wrong | Compare abilities, proficiency, equipped items, and edition with your DM; use the agreed dice expression while tracking the defect |
| A spell list is empty after creation | Compare it with your intended choices; review the creation handoff limitation before rebuilding |
| General edit action is absent | Use supported section controls; retain a JSON backup and report the unavailable manual editor |
| A character is absent after changing browser | Return to the original browser/profile or import a saved backup |
| Touch or keyboard navigation blocks progress | Try a larger screen or another layout and report the device, layout, and control name |

Keyboard, screen-reader, phone, and zoom completion are not certified for
every layout. Prefer visible controls over hover-only hints, and avoid
Escape in a nested creator editor when unfinished work matters. See
[creator help](character-creation.md#keyboard-phone-and-help).
