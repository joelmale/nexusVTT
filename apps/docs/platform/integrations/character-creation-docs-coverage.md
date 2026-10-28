---
title: Character creation documentation coverage and audit
description: Coverage matrix, corrections, unresolved discrepancies, and validation record for the 2026-10-27 character-creation documentation refresh.
---

# Character creation documentation coverage and audit

Audit date **2026-10-27**, repository `HEAD` **`6d187098`** (Forge `1.5.3`, VTT
`0.1.0`). Evidence was gathered by reading source and test files with
`path:line` references; **no running application was driven**, so no user-facing
instruction was confirmed against a live build and no screenshots were captured
or added. Treat the player guides as source-derived.

## Coverage matrix

| Workflow | Implementation evidence | User doc | Engineering doc | Correction made |
| --- | --- | --- | --- | --- |
| “Make a Fighter” | Four-screen flow, class bypass (`FourScreenNewcomerFlow.tsx`) | [Create a character](/forge/character-creation) | [Presentations](character-creation.md#presentations-and-shared-state) | Hosts open the **detailed wizard** by default, not the quick build |
| Sneaky elf archer | `recommendationService.ts:196-203` | Same guide | [Recommendations](character-creation.md#recommendations) | Removed claims that archery lacks species/Elf default; kept Stealth check advice |
| Rapid creation | Class buttons on screen 1 | Same guide | Same | Quick build now keeps work when switching to the quiz or detailed wizard |
| Spellcaster | `recommendationService.ts` spell packages | Same guide | [Evaluation](character-creation.md#evaluation-entitlements-and-support-policy) | Removed “Randomize does nothing” and “spell lists lost in result generation”, no longer true |
| Edit, switch modes | `CharacterCreator.tsx:73`, `creatorSession.test.tsx` | Same guide | Presentations | “Does not reliably preserve” → shared session with named local exceptions |
| Cancel / resume / retry | Forge and VTT `useCreatorRecovery.ts` | [Save, cancel, resume](/forge/character-creation#save-cancel-resume-and-retry) | [Host: Forge](character-creation.md#host-forge), [Host: VTT](character-creation.md#host-vtt) | Documented the four recovery actions; removed “no draft save in Forge” |
| Stable ID, no duplicates | `useCreationSubmission.ts:67-98`, `IndexedDbAdapter.ts` `put` | Same | [Submission](character-creation.md#submission-identity-and-retry) | Removed “new UUID per attempt”; added stale-retry defect |
| Standalone Forge finish | `App.tsx:333-348` | [Use the saved character](/forge/character-creation#use-the-saved-character) | Host: Forge | “Opens the sheet” → added to list and selected, toast, **View Sheet** fallback |
| Desktop VTT finish | `SharedCharacterCreator.tsx:103-137`, `characterHandoff.ts` | [Create or claim](/vtt/features/character-onboarding#create-or-claim-during-a-desktop-session) | Host: VTT | Handoff failure keeps the creator open with retry (previous doc said no retry) |
| Simple Player Mode | `SimplePlayerShell.tsx`, `SimpleInviteCard.tsx` | [Simple Player Mode](/vtt/features/character-onboarding#play-on-a-phone-with-simple-player-mode) | Host: VTT | Added edition prompt and shared recovery |
| 2014 and 2024 paths | VTT edition dialog (`SharedCharacterCreator.tsx:197-207`); Forge modal | Both guides | Evaluation | Removed “VTT opens 2024 only / no edition picker” |
| Token placement, GM involvement | `characterHandoff.ts:36-44` | Onboarding | Host: VTT | No automatic token; no awaiting-GM state (documented as absent) |
| Keyboard, phone, help | `CreatorDialog.tsx`, e2e axe audit | Both guides | [Accessibility](character-creation.md#accessibility-and-styling) | Describe dialog/focus behavior; state T-08 waived and uncertified |
| Rollout / rollback | `creatorCapabilities.ts` | — | [Rollout](character-creation.md#rollout-and-rollback) | Previously implied a default guided flow; actual default is full |
| Support certification | `supportManifest.ts` (13 × `false`) | Guide caveat | Evaluation | Previous “12 classes `level1Certified: true`” was wrong |
| ADR history | ADR-0002 | — | [ADR note](/vtt/adr/shared-character-creator#implementation-status-note--2026-10-27-supersedes-the-2026-10-24-note-above) | Added superseding note; history preserved |

## Important inaccuracies corrected

1. Engineering guide said UI submission did not use the evaluator, generated a new
   UUID per attempt, never set `combatGuidance`, and had no Forge draft support.
   All false at `6d187098`.
2. Manifest claim of certified classes was reversed (13 classes, all `false`).
3. Player guides described VTT as 2024-only with “partial” local-storage drafts and
   no retry; VTT now asks the edition, uses worker-backed drafts with explicit
   Resume / Retry / Export / Discard.
4. Package README and plan said implementation had not started or was only a
   candidate; plan status now records what exists and what is unproven.
5. Four pages (engineering guide, VTT onboarding, tranche evidence, T-08
   checklist) were not registered in a sidebar; they are now.

## Remaining discrepancies (not fixed — runtime code is out of scope)

Full list with reproduction steps:
[Known defects](character-creation.md#known-defects-and-discrepancies). Highest
impact: desktop spectators can create and submit a character
(`apps/vtt/src/components/CharacterPanel.tsx:127-130`); a failed save retried
after editing re-sends the original build (`useCreationSubmission.ts:67-70`);
Forge import regenerates IDs (`apps/forge/src/App.tsx:482-483`).

## Remaining documentation and evidence gaps

* No live-build verification, screenshots, or timed task runs.
* No moderated usability study, pilot, release, or rollback rehearsal exists to document.
* Device, screen-reader, zoom and keyboard acceptance (T-08) is waived, not passed.
* Rules statements rely on the repository's SRD-based fixtures; this pass did not
  re-derive edition rules from the publisher's text beyond what those fixtures cite.
* [Forge sheet guide](/forge/character-sheet) was only checked for statements that
  touched creation; its layout and roll sections were not re-verified.

## Validation performed

| Check | Result |
| --- | --- |
| `npm run typecheck --workspace=@nexus/docs` | Passed (before and after edits) |
| `npm run build:docs` (Docusaurus, `onBrokenLinks: 'throw'`) | First run failed on an HTML comment in this page (MDX); fixed. Final run (after reviewer corrections): passed. |
| `npm run test:character-creator` | Passed: 86 files, 1458 passed, 1 todo (about 84 s) |
| Independent source fact-check of the three rewritten pages | Run by a separate reviewer; 5 errors found (VTT spell panel claim, two control names, one wrong file path, one omission) and corrected |
| Forge/VTT host suites, e2e matrix, `check:*` scripts | **Not run** in this pass |
| Live application walk-through, screenshots, accessibility tools | **Not performed** |
