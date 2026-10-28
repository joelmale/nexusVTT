# Bring your character into a VTT game

You can create a character inside VTT, import a Forge JSON file, or claim a
party character supplied by the DM. A character has three separate states:
**saved** (in your account or this browser), **in the game** (the DM's session
accepted it), and **on the map** (a token is linked to it). Saving does not
imply the other two.

:::note What this guide is based on
Written 2026-10-27 from the current source (VTT 0.1.0, commit `6d187098`), not
from a deployed site. Creator instructions live in the
[character-creation guide](/forge/character-creation). Real-phone and
screen-reader testing has not been done.
:::

## Create before joining

1. Open **Player Setup**. Under **Your Characters**, choose an existing
   character, or open **Character Forge → Open Character Forge** to build one
   inside VTT.
2. VTT asks **Use 2014 rules** or **Use 2024 rules**, then opens the detailed
   wizard. Choose **Use guided creation** for the four-screen quick build.
3. After saving, check the selected character and player name. Enter the DM's
   four-character room code, choose **Join As: Player**, and select **Join Game**.
   A spectator can watch without a character.
4. Confirm with the DM that your character is in the session and has a token on
   the active scene.

If you already have a Forge export, use **Import JSON → Upload File** in Player
Setup. VTT accepts Forge exports, Nexus VTT exports and its documented generic
JSON; it is not a universal importer. Inspect the result and select the intended
character before joining. The dashboard's **Create Character** saves a library
character; it is not a request to join a room.

## Create or claim during a desktop session

A player who has no character sees a **No Character Assigned** banner with
**Open Characters** (the banner returns after you reload if you dismiss it). Open
the **Characters** panel and choose **Create**, or **Select Existing Character**
to claim a free party character. The DM can **Import** characters into the party.

When you finish creating inside a session, VTT saves the character, then asks
the DM's client to accept it. You get a short confirmation only after the DM's
client accepts. If the DM is away or the request times out (about 8 seconds), the
creator **stays open with an error** and your build is kept; use **Retry previous
save** (also offered after a reload) when the DM is back. There is no separate
“awaiting GM” screen, so confirm with the DM if you see no confirmation.

The **Choose your character** dialog lists unassigned characters and those you
own. Select **Play as [name]** and wait for **Asking the DM…**. A character owned
by another player cannot be claimed.

Open a card's **View Character Sheet** to inspect it; **Open in Panel / Popout**
opens a separate panel. A token badge means a token is linked; **Focus on Token**
pans to it. **Add to Combat** creates an initiative entry but does not place a
token.

:::caution Known gap
A viewer who joined as a spectator can still see **Create** in the desktop
**Characters** panel. Spectators are not meant to submit characters; don't use
it. This is reported as a defect in the
[engineering guide](/platform/integrations/character-creation#known-defects-and-discrepancies).
:::

## Play on a phone with Simple Player Mode

Simple Player Mode has **Map**, **My Hero** and **Rolls**. A touch-device player
can enter it automatically, or use the DM's simple invite (a link or QR code that
opens `/play/ROOMCODE`; the DM can also create a watch-only link). The full VTT's
**Simple Mode** (phone & tablet view) button and Simple Mode's **Settings → Switch to Full VTT** change
views without changing your rules edition or rebuilding the character.

With no owned character, **Choose your character** opens. Select **Play as
[name]**, or **Create New Character** to open the same creator (including the
edition question and recovery). Later use **My Hero → Select or Create Your
Character** or **Settings → Switch Character**. Spectators have no hero tab or
claim action.

After creating, check **My Hero** and confirm acceptance as described above.

### Get a token onto the map

Ask the DM to open the intended scene and place or confirm a token linked to
your character. Creating or claiming a sheet does not place a linked token. If
the creator says to ask the DM to place a token, that message is based on what
your device currently knows and can be briefly out of date; check the map. Joining
without a character can create a default player token, which is not a
character-linked token.

On **Map**, one finger pans. To move your unlocked token, use **Move My Token** or
tap it, choose a destination, and select **Confirm Move**. **Center on My Token** finds
it; **Follow DM** follows the DM's view. If there is no move control, ask the DM to
check placement, ownership, visibility and locking. See [Tokens](tokens.md).

## Take your first actions

The creator's first-turn cards (shown on its last screen) are suggestions. Use
the actual sheet and your DM's rulings for bonuses, action costs, spells and
resources.

In **Simple Player Mode**:

1. Open **My Hero → Skills & Saves**. Choose **Normal**, **Advantage** or
   **Disadvantage**, then tap the skill, ability **Check** or **Save** the DM
   asks for.
2. On **Combat**, tap **Initiative** when asked. **Roll Attack** and **Roll
   Damage** are separate controls for an equipped weapon; **No equipped weapons**
   means check your gear.
3. **Action**, **Bonus Action** and **Reaction** are personal reminder checkboxes;
   they don't spend a resource. **Reset Turn** clears them.
4. Use the HP controls for damage or healing. At zero HP, **Roll Death Save** and
   **Mark Success/Failure** are separate steps. Use **End Turn** on your turn.
5. Results appear in **Rolls**. If the connection is recovering, wait before
   repeating an action.

Simple Mode's Spells card and the desktop sheet's **Spells** tab share one
spellbook panel with a spell slot grid, a casting-source selector and cast
controls. It needs an active campaign session. Treat casting results as
unverified until your DM confirms them; if the panel is unavailable, roll with
the dice roller and track slots yourself. See [Dice](dice.md) and
[Initiative and Combat](initiative-and-combat.md). Standalone Forge has its own
[sheet and spell controls](/forge/character-sheet).

## Understand saving and recovery

Signed-in creation saves to your account first (a retried save does not create a
duplicate), then caches locally. Guest creation stays in this browser. Accepting
the character into the session is a separate step, as above.

Forge uses its own browser's IndexedDB with no account or automatic VTT sync.
Forge's **Export Data** and VTT's JSON import are manual transfers; an imported
file is not a live connection.

VTT keeps your unfinished creation as a draft for you in this browser, per room
(or outside a room). Reopening the creator offers **Resume creation**, **Retry
previous save**, **Export recovery copy** or **Discard draft and start new**. See
[save, cancel, resume, and retry](/forge/character-creation#save-cancel-resume-and-retry).
Keep one creation tab open.

| Symptom | Recovery |
| --- | --- |
| Account save fails | Keep the creator open, restore access, press the final button again |
| Creator shows the DM is unavailable or did not accept | Keep it open; ask the DM to confirm they're connected, then **Retry previous save** |
| You closed the creator after a failed handoff | Reopen it and choose **Retry previous save** |
| Claim says the character is unavailable | Ask the DM to check assignment; choose your own or an unassigned character |
| **My Hero** shows the wrong character | **Settings → Switch Character**, then claim the intended one |
| **Waiting for the DM to open a map…** | Wait for the DM to open a scene |
| Sheet exists but no usable token | Ask the DM to confirm a visible, unlocked, correctly linked token in that scene |
| Gear, coins or spells look wrong | Compare the saved sheet with your choices and agree explicit corrections with the DM |

## Keyboard and small-screen help

Use **Tab/Shift+Tab** and the visible labels. The creator is a dialog that traps
focus and closes with **Escape**; inside nested editors prefer their visible
close button. On a phone, scroll within the creator and dismiss the soft
keyboard to reach its footer. See
[keyboard, phone, and help](/forge/character-creation#keyboard-phone-and-help).
