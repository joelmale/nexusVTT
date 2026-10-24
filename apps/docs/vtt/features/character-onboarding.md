# Bring your character into a VTT game

You can create a character inside VTT, import a Forge JSON file, or claim a
party character supplied by the DM. Creating or saving a character does not
by itself confirm that the DM has received it or that a linked token is on
the map.

:::note Candidate scope
The shared four-screen creator and local draft recovery are part of the
current candidate. Rules output, recovery, accessibility, and host handoff
still have open verification gates. For shared creation instructions and
known limitations, use the [character-creation guide](/forge/character-creation).
:::

## Create before joining

1. Open **Player Setup**. Under **Your Characters**, choose an existing
   character, or open **Character Forge → Open Character Forge** to build
   one inside VTT.
2. The creator begins with the guided 2024 flow. Choose **Advanced Mode**
   before entering choices if you need the detailed wizard. VTT does not
   currently expose the Forge host's edition picker; do not assume this is
   a selectable 2014 path.
3. After saving, check the selected character and player name. Enter the
   DM's four-character room code, choose **Join As: Player**, and select
   **Join Game**. A spectator can watch without playing a character.
4. Confirm with the DM that the intended character is in the session and
   has a token on the active scene.

If you already have a Forge export, use **Import JSON → Upload File** in
Player Setup instead. VTT supports Forge exports, Nexus VTT exports, and
its documented generic JSON format through the import dialog; it is not a
universal importer for every character-builder format. Inspect the import
result and select the intended character before joining.

The dashboard also has **Create Character**. A character saved there is a
library/account character; it is not a request to join a room.

## Create or claim during a desktop session

Open the **Characters** panel. A player can choose **Create** or
**Create a Character**. If the panel offers **Select Existing Character**,
use it to claim a free party character. The DM can **Import** characters into
the party without assigning them to a player first.

The **Choose your character** dialog lists unassigned characters and those
already owned by you. Select **Play as [name]** and wait for **Asking the
DM…** to finish. A character assigned to another player cannot be claimed.
If the DM is away, wait for them to return and try again.

Creation inside a session saves the character and sends it to the DM's
client. The current completion flow does not give a reliable, separate
“saved but awaiting session acceptance” screen or a dedicated retry button
for a failed handoff. If the creator closes but the DM cannot see the
character, check your saved characters and the connection before creating
another copy. With the DM, use an explicit export/import or existing party
character claim when a new submission has not reached the session.

Open a character card's **View Character Sheet** action to inspect it.
**Open in Panel / Popout** opens a separate character panel. A token badge
means a token is linked to that character; **Focus on Token** pans to it when
that action is present. **Add to Combat** creates an initiative entry; it
does not place a token.

## Play on a phone with Simple Player Mode

Simple Player Mode presents **Map**, **My Hero**, and **Rolls**. A touch-device
player can enter it automatically after joining, or use a DM-provided simple
invite. The full VTT's **Simple Mode** button and Simple Mode's
**Settings → Switch to Full VTT** change views. This does not change your
rules edition or rebuild the character. Tablet settings can show the map
beside the hero/roll panel.

If you have no owned character, **Choose your character** opens. Select
**Play as [name]**, or **Create New Character** to open the shared creator.
You can also open **My Hero → Select or Create Your Character** or
**Settings → Switch Character** later. Spectators have no hero tab or
character-claim action.

After creation, check **My Hero** and confirm with the DM that the character
was accepted into the game. Account saving and session acceptance are
separate operations. The current UI can close the creator before a failed
or delayed session submission is resolved; it does not provide a complete
handoff-recovery workflow.

### Get a token onto the map

Ask the DM to open the intended scene and place or confirm a token linked
to your character. Creating or claiming a sheet in Simple Mode does not
place a linked token automatically. Joining without a selected character
can create a default player token, which is different from confirming a
character-linked token.

On **Map**, one-finger movement pans. To move your available, unlocked token,
use **Move Token** or tap it, choose a destination, and select
**Confirm Move**. **Center on Me** finds it; **Follow DM** follows the DM's
view. If there is no move control, ask the DM to check placement, ownership,
visibility, and locking on the active scene. See [Tokens](tokens.md) for the
technical token model and limitations.

## Take your first actions

Check the saved values before the first turn. The creator's first-turn cards
are suggestions and include fixed text that may not match your final build.
Use the actual sheet and your DM's rules adjudication for bonuses, action
costs, spell availability, and resource use.

In **Simple Player Mode**:

1. Open **My Hero → Skills & Saves**. Choose **Normal**, **Advantage**, or
   **Disadvantage**, then tap the skill, ability **Check**, or **Save** the
   DM requests. Advantage/disadvantage changes how the d20 roll is made.
2. On **Combat**, tap **Initiative** when asked. For an equipped weapon,
   **Roll Attack** and **Roll Damage** are separate controls. Check the
   equipped gear if the sheet says **No equipped weapons**.
3. Use the **Action**, **Bonus Action**, and **Reaction** checkboxes as
   personal reminders; they do not apply a feature or spend a class
   resource. **Reset Turn** clears them; they also reset on your next turn.
4. Use the top HP controls for damage or healing and wait for the DM to
   apply the change. Use **End Turn** when available on your turn. At zero
   HP, **Roll Death Save** and **Mark Success/Failure** are separate steps.
5. Review results in **Rolls**. If the DM is away or the connection is
   recovering, wait for the connection and session state before repeating
   an action.

Simple Mode shows spell save DC and spell attack bonus but has no full spell
list/casting/slot controls. The desktop character sheet's **Spells** tab
also currently displays a spell-management placeholder. Use the dice roller
with the actual expression agreed with your DM, and track spell slots and
class resources explicitly. Switching to Full VTT does not by itself add
complete spell management to that sheet.

For the full VTT dice interface, see [Dice](dice.md); for turn order, see
[Initiative and Combat](initiative-and-combat.md). Standalone Forge has its
own [sheet and spell controls](/forge/character-sheet).

## Understand saving and recovery

Signed-in VTT creation attempts to save to your account before adding the
character locally. Guest creation adds to the local character store/cache
without an account save. Session ownership and DM acceptance are additional
steps; a saved account character is not proof of a completed room handoff.

Forge uses its own browser's IndexedDB and has no account or automatic VTT
synchronization. **Export Data** in Forge and VTT's JSON import are manual
transfer steps. Importing a file is not a live connection to the original.

The candidate stores VTT creation drafts in local browser storage. Reopening
can restore part of a draft, but does not reliably restore all edits, mode,
or screen; there is no visible conflict or migration recovery. Keep one
creation tab open. Read the
[save, cancel, resume, and retry limits](/forge/character-creation#save-cancel-resume-and-retry)
before relying on draft recovery.

| Symptom | Recovery |
| --- | --- |
| Account save fails | Leave the creator open, restore access, check for an existing save, then retry the final button |
| Sheet exists locally but DM cannot see it | Confirm connection and DM presence; check the party list together before retrying or importing a saved copy |
| Claim says the character is unavailable | Ask the DM to check assignment; choose your own or an unassigned character |
| **My Hero** shows the wrong character | Use **Settings → Switch Character** and claim/select the intended character |
| **Waiting for the DM to open a map…** | Wait for the DM to open a scene |
| Sheet exists but no usable token appears | Ask the DM to confirm a visible, unlocked, correctly owned/linked token in that scene |
| Gear, coins, known spells, or preparations are missing | Compare the saved sheet with your intended choices and agree explicit corrections with the DM; recreating alone may repeat the issue |

## Keyboard and small-screen help

Use **Tab/Shift+Tab** to reach buttons and visible labels to identify sheet
sections. Use the creator's visible back/close controls inside nested
editors; Escape can dismiss more than the editor. On a phone, scroll within
the creator and dismiss the soft keyboard to reach its footer. Complete
keyboard, screen-reader, real-phone, and zoom certification is still pending;
see the [shared creator's help and limitations](/forge/character-creation#keyboard-phone-and-help).
