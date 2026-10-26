---
title: Character creator and Studio manual acceptance instructions
description: Device setup, repeatable tasks, pass criteria, and evidence capture for actual assistive technology testing.
---

# Character creator and Studio manual acceptance instructions

Prepared **2026-10-26** for the [validation plan](character-creation-validation-plan.md).
These are instructions for real testers. No task below has a recorded manual pass.
Report results against the [execution ledger](character-creation-validation-evidence.md).

## Candidate and device setup

The maintainer must supply an accessible **test URL and exact candidate build ID**
before execution. The current changes are local and uncommitted; an older deployed
version cannot validate them. Use disposable test accounts, a disposable campaign,
and synthetic character names. Confirm that the URL opens on each physical device.
`localhost` on a phone refers to that phone, not the Windows development computer.
Do not use production campaign data for these tests.

Device availability reported by the owner:

| Setup                       | Available information                                    | Still capture before the run                                                       |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Windows + NVDA              | Windows device available; tester can follow instructions | Windows, NVDA, Chrome and Firefox versions; tester's AT experience                 |
| MacBook + VoiceOver         | Edge **156.0.4314.42**, supplied by owner                | macOS version, exact Edge version on test date, Safari version                     |
| iPhone + VoiceOver + Safari | Physical iPhone; Safari described as latest              | Device model, iOS version, Safari version/build information available on device    |
| iPad + VoiceOver + Safari   | Physical iPad; Safari described as latest                | Device model, iPadOS version, Safari version/build information available on device |
| Android + TalkBack + Chrome | Android device available; tester can follow instructions | Device model, Android, TalkBack and Chrome versions                                |

Run the required Mac Safari combination as well as the available Mac Edge
combination. Edge on Mac does not replace NVDA on Windows or Safari on iOS.
If a required browser is unavailable, record that combination as **blocked**.
Do not translate “latest” into an assumed version number.

Use the tester's normal AT configuration. Record custom verbosity, key mappings,
typing mode, browser extensions and input devices that affect a result. An
experienced screen-reader user should review the final results; completing these
instructions for the first time is useful exploratory evidence, not that review.

## Screen-reader quick start

**Windows / NVDA:** start NVDA, then open the test URL in Chrome. Use Tab and
Shift+Tab for controls; Enter or Space activates the selected control. In browse
mode, H moves between headings. NVDA+Space toggles browse/focus mode if needed;
the NVDA modifier is the tester's configured Insert or Caps Lock key. Speech
Viewer under NVDA's Tools menu can capture announcements. Repeat the required
tasks in Firefox. Consult the [NVDA user guide](https://download.nvaccess.org/documentation/en/userGuide.html)
for the installed layout and version.

**MacBook / VoiceOver:** Command+F5 toggles VoiceOver; some keyboards require Fn.
Use Control+Option as the VO modifier unless configured otherwise. VO+Right/Left
moves between items, VO+Space activates, and VO+Shift+Down enters a group when
needed. Test Safari first, then the supplied Edge build. Keep ordinary keyboard
testing separate from VoiceOver navigation. See Apple's
[VoiceOver setup instructions](https://support.apple.com/guide/voiceover/turn-voiceover-on-or-off-vo2682/mac).

**iPhone and iPad / VoiceOver:** enable Settings → Accessibility → VoiceOver.
Swipe right/left to move between items and double-tap to activate the selected
item. Use the rotor's Headings and Form Controls options to inspect structure;
rotate two fingers to choose the rotor option, then swipe up/down to move through
it. Run the tasks separately on both physical devices. See Apple's
[rotor guide](https://support.apple.com/en-us/111796).

**Android / TalkBack:** enable TalkBack in the device's Accessibility settings
and complete its practice tutorial first. Swipe right/left between items,
double-tap to activate, and use two-finger scrolling. Manufacturer gestures can
differ; use the installed TalkBack help when needed. Open the test URL in Chrome.
See Google's [TalkBack navigation guide](https://support.google.com/accessibility/android/answer/6006598?hl=en).

Learn how to turn the screen reader off before beginning. A sighted helper may
assist with device setup. Record any assistance needed during an application
task; it must not be hidden in a pass result.

## Repeatable application tasks

Run C-01–C-05 in Forge and the VTT desktop creator, in both guided and full mode.
Repeat applicable character tasks through Player Setup and Simple Player on
phones/tablets. Run S-01–S-03 in Campaign Studio. A missing control or unavailable
workflow is a finding, not a reason to prefill storage or use developer tools.

| ID                          | Actions                                                                                                                                                                                                                   | Pass criteria                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01: Blank creation        | Start a new blank character. Navigate headings and landmarks. Choose edition, species, class and background. Inspect each grouped choice.                                                                                 | Meaningful headings; controls expose name, role, state and instructions; current step/mode is identifiable; no pointer required.                                                                                                                                          |
| C-02: Error and repair      | Attempt to continue with a required choice missing. Read the error, locate its field and correct it. Select a duplicate or incompatible choice where the UI permits the attempt.                                          | Error is announced or reached predictably, identifies the affected choice and suggests repair; group counts/states update; errors clear when repaired. Do not force an invalid choice through developer tools.                                                            |
| C-03: Resume and save       | Fill several steps, leave using the application navigation, reopen and resume. Finish the character, save once and reload the saved sheet.                                                                                | Resume/cancel actions are distinguishable; entered choices persist; progress/success/failure is conveyed without relying on color; one saved character results and values match the worksheet below.                                                                      |
| C-04: Edit and dialogs      | Reopen a saved character for editing where supported. Open nested selection/help dialogs, close the innermost first, then the outer dialog. Cancel one edit and save another.                                             | Dialog name and context are announced; focus stays within the active modal; Escape closes the intended layer; focus returns to its trigger; cancel/save outcomes are clear and correct.                                                                                   |
| C-05: Casting and resources | Create the Warlock sample below. Find spell/slot/resource controls. Expend a use, inspect remaining uses, rest and reload. Also inspect Fighter Second Wind.                                                              | Controls expose the resource, action and current/max count; changes and rest results are accessible; persistence is correct. Missing class-resource initialization is an existing open rules issue: record the observed failure, never infer a pass from a feature label. |
| S-01: Author and reload     | In a disposable campaign, open Sessions → Plan a session. Enter a Session Title. Add a custom Run-Sheet Beat; select a note beat if no map is needed. Save & Open Run Sheet. Edit Session Notes, Save draft, then reload. | Every action is operable and named; errors/status are accessible; title, notes and beat content survive reload in a sensible reading order.                                                                                                                               |
| S-02: Publish and activate  | Open Run Sheet, add/edit a step, Publish plan, then Play in VTT in the disposable campaign. Inspect the resulting run/scene in VTT.                                                                                       | Publication and activation states are announced; the correct revision/content appears in VTT; unavailable actions have understandable reasons; focus lands in a useful place after navigation.                                                                            |
| S-03: Correction and retry  | Attempt publication with a required field missing. Repair it and retry. On the test environment only, have the maintainer arrange one controlled failed save/activation and retry.                                        | Errors identify the problem and preserve entered work; retry does not duplicate a published plan, run or actor. If no controlled failure is available, record that subcase as blocked.                                                                                    |

For every task, listen for unnecessary repeated announcements, unnamed buttons,
unlabeled selected states, hidden content in the reading order, inaccessible
validation text, keyboard traps and focus lost after a save or route change.
Record the actual words heard for a confusing announcement.

## Sample inputs and saved values

Use these samples for the first accessibility pass. They supplement, and do not
replace, the complete class/edition reference review. Enter them through visible
controls. If the UI cannot represent a listed legal choice, stop that branch and
file the defect rather than substituting a different choice silently.

**F24:** 2024, level 1 Human Fighter, Soldier background; standard array
STR 15 / DEX 13 / CON 14 / INT 8 / WIS 12 / CHA 10. Soldier increases STR by 2
and CON by 1; Human skill Perception and Origin feat Tough; Soldier feat Savage
Attacker; class skills Acrobatics and Survival; Defense fighting style; masteries
Greatsword, Flail and Javelin. Choose Fighter equipment A (Chain Mail, Greatsword,
Flail, eight Javelins, Dungeoneer's Pack, 4 gp). Soldier contributes its own kit
and 14 gp. Use synthetic name `AT F24 <run ID>`.

Expected scores **17/13/15/8/12/10**, **HP 14**, **AC 17**, initiative **+1**,
speed **30**, proficiency **+2**, Strength save **+5**, Constitution save **+4**,
Greatsword attack **+5**, ordinary Greatsword damage **2d6+3**, gold **18 gp**.
Second Wind has **2 uses** in this edition; short-rest partial recovery needs
its own rules assertion and must not be assumed to refill every use.

**WL24:** 2024, level 1 Human Warlock, Soldier background; standard array
STR 8 / DEX 13 / CON 14 / INT 12 / WIS 10 / CHA 15. Soldier increases DEX by 2
and CON by 1; Human skill Perception and Origin feat Tough; Soldier feat Savage
Attacker; class skills Arcana and Deception; invocation Eldritch Mind. Choose
Eldritch Blast and Minor Illusion, and prepare Charm Person and Hex. Choose
Warlock equipment A (Leather Armor, Sickle, two Daggers, Orb, Book, Scholar's
Pack, 15 gp), plus the Soldier kit. Use synthetic name `AT WL24 <run ID>`.

Expected scores **8/15/15/12/10/15**, **HP 12**, **AC 13**, initiative **+2**,
speed **30**, spell attack **+4**, spell save DC **12**, **two cantrips**, **two
prepared level-one spells**, **one level-one Pact Magic slot**, gold **29 gp**.
An invocation feature label alone does not demonstrate that its effects work.

Values come from the fixed fixtures in
`packages/character-creator/src/tests/fixtures/referenceBuilds.ts`, source-checked
against [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).
Independent human rules approval remains open.

## Keyboard, zoom and physical-device checks

Repeat the required desktop workflows with the screen reader off and no pointer.
Use Tab/Shift+Tab, arrow keys for native choice controls, Enter/Space and Escape.
Focus must remain visible and unobscured, including behind sticky bars or dialogs.

Use the browser's real zoom menu at **200%** and **400%**, recording the viewport
and zoom setting. At a 1280 CSS-pixel-wide desktop baseline, 400% corresponds to
the usual 320 CSS-pixel reflow check. Confirm that text, choices, errors and
save/cancel buttons remain reachable without two-dimensional scrolling of forms.
Treat intrinsically two-dimensional scene canvases separately from form controls.
Reset zoom afterwards. Browser zoom, OS magnification and CSS zoom are distinct;
do not substitute one for another in the evidence.

On iPhone, iPad and Android, repeat in portrait and landscape. Open the soft
keyboard in text fields near the bottom, enter an invalid value, repair it and
save. Check that the focused field, errors and save/cancel controls remain
reachable. Test text scaling, reduced motion and applicable dark/light/paper
themes; record which host palettes were actually tested.

## Results to return

Copy this block once per task, device, host and mode. Split a task when outcomes
differ. Use **not run**, **pass**, **fail**, or **blocked**. An overall pass requires
all required subtasks to pass; unavailable tasks stay open.

```text
Run ID / date:
Candidate build ID / test URL:
Tester alias / reviewer alias / screen-reader experience:
Device model / OS version:
Browser and exact version / screen reader and version:
Host / creator mode / edition / task ID:
Orientation / browser zoom / text scaling / theme:
AT settings or extensions affecting the result:
Steps actually performed:
Expected behavior:
Observed behavior / exact announcement:
Result (not run, pass, fail, blocked):
Assistance or workaround required:
Impact (blocks completion, impairs completion, minor):
Evidence filename/link (synthetic data only):
Defect ID / repair build / manual retest result:
```

Do not capture account tokens, cookies, passwords, personal names or private
campaign prose in recordings or speech logs. Keep the initial failure and retest
as separate records. The maintainer links returned results to V-07; completing
this run sheet alone does not certify the broader rules system.
