---
title: T-08 device and assistive technology run checklist
description: Tickable run sheet for the real device, screen-reader, zoom and keyboard acceptance of the character creator and Campaign Studio.
---

# T-08 device and assistive technology run checklist

> **Waived by the owner on 2026-10-27; these rows are excluded, not passed.** Use this sheet only if the decision is reversed.

Tick boxes as you go. Task steps and pass criteria live in the
[manual acceptance instructions](character-creation-manual-acceptance.md); sample
inputs and expected values (F24, WL24) are there too. Record results with the
result block at the end of that document. Statuses are **not run, pass, fail,
blocked**. Anything not done stays open; do not mark an unavailable combination
as passed.

## 0. Before any testing

- [ ] Reachable test URL supplied, and exact candidate build ID written down
- [ ] URL opens on every physical device (not `localhost` on the phone)
- [ ] Disposable account and disposable campaign created; no production data
- [ ] Synthetic character names only (`AT F24 <run ID>`, `AT WL24 <run ID>`)
- [ ] Run ID chosen: ____________  Date: ____________
- [ ] Versions captured **before** testing (fill in below)
- [ ] Know how to turn each screen reader off
- [ ] Screenshot/recording rules understood: no tokens, cookies, real names

| Setup                           | Versions to record                                                  | Done |
| ------------------------------- | ------------------------------------------------------------------- | ---- |
| Windows + NVDA + Chrome         | Windows ____ NVDA ____ Chrome ____                                  | [ ]  |
| Windows + NVDA + Firefox        | Windows ____ NVDA ____ Firefox ____                                 | [ ]  |
| MacBook + VoiceOver + Safari    | macOS ____ Safari ____                                              | [ ]  |
| MacBook + VoiceOver + Edge      | macOS ____ Edge ____ (owner reported 156.0.4314.42; confirm on day) | [ ]  |
| iPhone + VoiceOver + Safari     | Model ____ iOS ____ Safari ____                                     | [ ]  |
| iPad + VoiceOver + Safari       | Model ____ iPadOS ____ Safari ____                                  | [ ]  |
| Android + TalkBack + Chrome     | Model ____ Android ____ TalkBack ____ Chrome ____                   | [ ]  |
| Tester AT experience / settings | ____________________________________                               | [ ]  |

## 1. Screen-reader matrix

Mark each cell with the result (P / F / B / –). A cell needs every task in its
column set run. Creator tasks run in **Forge and VTT desktop, guided and full**;
on phones/tablets also **Player Setup and Simple Player**.

| Task                         | NVDA Chrome | NVDA Firefox | Mac Safari | Mac Edge | iPhone | iPad | Android |
| ---------------------------- | ----------- | ------------ | ---------- | -------- | ------ | ---- | ------- |
| C-01 Blank creation          |             |              |            |          |        |      |         |
| C-02 Error and repair        |             |              |            |          |        |      |         |
| C-03 Resume and save         |             |              |            |          |        |      |         |
| C-04 Edit and dialogs        |             |              |            |          |        |      |         |
| C-05 Casting and resources   |             |              |            |          |        |      |         |
| S-01 Studio author + reload  |             |              |            |          |        |      |         |
| S-02 Studio publish/activate |             |              |            |          |        |      |         |
| S-03 Studio correction/retry |             |              |            |          |        |      |         |

Host/mode coverage for C-01–C-05 (tick when run on at least one setup; repeat
per setup in the table above):

- [ ] Forge guided
- [ ] Forge full
- [ ] VTT desktop guided
- [ ] VTT desktop full
- [ ] Player Setup (phone/tablet)
- [ ] Simple Player (phone/tablet)

## 2. Per-task listening checks

While running each task, watch for and note (with the exact words heard):

- [ ] Unnamed or mislabeled buttons
- [ ] Selected/checked state not announced
- [ ] Headings meaningless or missing; step/mode not identifiable
- [ ] Validation error not announced, not reachable, or not tied to its field
- [ ] Save, success and failure status not announced
- [ ] Repeated or noisy announcements
- [ ] Hidden content in the reading order
- [ ] Keyboard trap
- [ ] Focus lost after save, cancel or route change
- [ ] Dialog: name announced, focus contained, Escape closes innermost first, focus returns to trigger
- [ ] Assistance needed (record it; it is not a clean pass)

## 3. Keyboard-only (screen reader off, no pointer)

Run on Windows Chrome and Firefox, and MacBook Safari.

- [ ] C-01 to C-04 completed with Tab/Shift+Tab, arrows, Enter/Space, Escape
- [ ] S-01 to S-03 completed the same way
- [ ] Focus always visible and not hidden behind sticky bars or dialogs
- [ ] Tab order matches reading order

## 4. Real browser zoom

Use the browser zoom menu, not CSS zoom or OS magnifier. Record viewport and
zoom. Reset afterwards.

| Check                                                              | Chrome | Firefox | Safari |
| ------------------------------------------------------------------ | ------ | ------- | ------ |
| 200%: creator text, choices, errors, save/cancel reachable         |        |         |        |
| 400% (320 CSS px reflow): same, no 2-D scrolling of forms          |        |         |        |
| 200% and 400%: Studio forms and publish/activate controls          |        |         |        |
| Scene canvas noted separately (intrinsically two-dimensional)      |        |         |        |

## 5. Physical phone/tablet checks

Run on iPhone, iPad and Android.

| Check                                                                       | iPhone | iPad | Android |
| --------------------------------------------------------------------------- | ------ | ---- | ------- |
| Portrait: creator and sheet usable                                          |        |      |         |
| Landscape: creator and sheet usable                                         |        |      |         |
| Soft keyboard open on a bottom field: field, error, save/cancel reachable   |        |      |         |
| Invalid value entered, repaired, saved                                      |        |      |         |
| Touch targets reachable and adequately sized                                |        |      |         |
| Increased text size / text scaling                                          |        |      |         |
| Reduced motion enabled                                                      |        |      |         |

## 6. Themes and contrast

- [ ] Dark, light and paper themes checked in the creator (note which host palettes)
- [ ] Contrast acceptable for text, focus ring, errors and disabled states
- [ ] Error and state never conveyed by color alone

## 7. Saved values (during C-03 and C-05)

F24 (2024 Human Fighter, Soldier):

- [ ] Scores 17/13/15/8/12/10, HP 14, AC 17, initiative +1, speed 30, proficiency +2
- [ ] STR save +5, CON save +4, Greatsword +5, damage 2d6+3, gold 18 gp
- [ ] Second Wind shows 2 uses; spend one, rest, reload; count and recovery sensible

WL24 (2024 Human Warlock, Soldier):

- [ ] Scores 8/15/15/12/10/15, HP 12, AC 13, initiative +2, speed 30
- [ ] Spell attack +4, save DC 12, 2 cantrips, 2 prepared L1 spells, 1 Pact Magic slot, gold 29 gp
- [ ] Spend the slot, rest, reload; persists correctly
- [ ] Exactly one saved character; no duplicates

If a listed choice cannot be entered through the visible controls, stop that
branch and file it as a defect; do not substitute a different choice.

## 8. Studio-specific

- [ ] S-03 controlled failure: maintainer arranged one failed save/activation, or marked **blocked**
- [ ] Retry created no duplicate plan, run or actor
- [ ] Correct revision and content appear in VTT after activation

## 9. Close-out

- [ ] A result block filled for each task/device/host/mode (split when outcomes differ)
- [ ] Every fail has a defect ID, impact (blocks / impairs / minor) and evidence link
- [ ] Repairs done on a new build ID; retest recorded as a **separate** record
- [ ] Unavailable combinations recorded as **blocked**, not skipped
- [ ] Experienced screen-reader user reviewed the results (first-time runs are exploratory only)
- [ ] DM review recorded for accessibility and rules (assignment is not approval)
- [ ] Results linked to the execution ledger and to V-07

T-08 also still needs the independent rules sign-off and the 12–18 participant
study; this checklist covers the device and assistive technology portion only.
