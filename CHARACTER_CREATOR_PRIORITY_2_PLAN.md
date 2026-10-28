# Implementation Plan: Character Creator & Onboarding (Priority 2)

The broader [shared character creation implementation plan](apps/docs/platform/integrations/archive/character-creation-implementation-plan.md)
builds on the Priority 2 changes landed in `edd07ca9`. Use that plan for the
remaining rules, onboarding, accessibility, recovery and host-handoff work;
verify these landed changes before assigning duplicate fixes.

## Overview & Context

Following the completion of **Priority 1** (resolved in [`4afa1831`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/utils/characterCreationUtils.ts) covering 2024 Background Ability Score Increases, ability modifier double-dipping prevention, background slug/name lookup tolerance, and Level 1 Fighter fighting style unlocks), **Priority 2** focuses on onboarding ergonomics for players joining without characters, currency parsing robustness in equipment assignment, alignment state consistency, and comprehensive test coverage.

---

## Phase 1: Desktop VTT Player Onboarding & Creation Entry Point

### Problem Statement
When non-host players connect to the desktop VTT (via Quick Join or room code) without an assigned character:
- They are dropped directly onto the canvas with an empty character panel displaying only static text (*"No characters found"*).
- Unlike Simple Player Mode (which presents [`CharacterClaimModal.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/src/components/simple-player/CharacterClaimModal.tsx)), desktop players are given no actionable call-to-action (CTA) to create a new character or claim an unclaimed party sheet.

### Proposed Changes

#### 1. Actionable Empty State in [`CharacterPanel.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/src/components/CharacterPanel.tsx)
- Detect when `!isHost` and the player has no owned/assigned characters (`filteredCharacters.length === 0`).
- Replace the passive *"No characters found"* text with an interactive CTA block:
  - **Primary CTA:** `"➕ Create a Character"` — invokes `startCharacterCreation(...)` from [`useCharacterCreationLauncher`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/src/hooks/useCharacterCreationLauncher.ts).
  - **Secondary CTA (Conditional):** `"Select Existing Character"` — opens the character claim dialog if unassigned characters exist in the room.

#### 2. Onboarding Prompt in [`GameUI.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/src/components/GameUI.tsx)
- Check player role and character ownership state upon connecting.
- For non-host players with zero characters assigned, surface an initial non-blocking banner or auto-trigger the character claim/creation modal, bringing desktop onboarding parity with [`SimplePlayerShell.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/src/components/simple-player/SimplePlayerShell.tsx).

---

## Phase 2: Starting Currency & Gold Parser in Equipment Service

### Problem Statement
Background starting equipment definitions often contain currency strings such as `"50 gp"`, `"24 gp"`, `"8 gp"`, or `"15 sp"`. When these strings pass through `addItemToInventoryByName` in [`equipmentService.ts`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/services/equipmentService.ts), the item catalog cannot resolve them as inventory items, logging warnings and failing to grant starting funds.

### Proposed Changes

#### 1. Coin String Detection in [`equipmentService.ts`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/services/equipmentService.ts)
- Implement regex matching for coin denominations:
  ```typescript
  const COIN_REGEX = /^\s*(\d+)\s*(cp|sp|ep|gp|pp)\s*$/i;
  ```
- Before looking up an item name in the SRD item catalog, test against `COIN_REGEX`.

#### 2. Structured Currency Accumulation
- If an equipment entry matches `COIN_REGEX`:
  - Extract the integer amount and denomination (normalized to lowercase).
  - Accumulate the amount into the character's currency wallet (`character.currencies[denomination]` or `equipmentGold`).
  - Bypass adding a dummy item to `character.inventory`.

---

## Phase 3: Alignment Harmonization & Default Fallbacks

### Problem Statement
In [`CharacterFinalization.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/components/guided/CharacterFinalization.tsx#L31-L53), the default state initializes `alignment` to `'Neutral'`. However, the selectable options define `'True Neutral'`. If the user submits without changing the selection, an inconsistent or unlisted alignment value is persisted.

### Proposed Changes

#### 1. Standardize Initial State
- Update the default state in [`CharacterFinalization.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/components/guided/CharacterFinalization.tsx):
  ```typescript
  const [alignment, setAlignment] = useState<string>('True Neutral');
  ```
- Ensure option lists across both guided creation and the standard wizard use matching labels and values for all 9 core alignments.

---

## Phase 4: Verification, Testing & Coverage

### Unit & Component Tests

1. **[`CharacterPanel.test.tsx`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/apps/vtt/tests/unit/components/CharacterPanel.test.tsx):**
   - Verify that when `isHost: false` and the character list is empty, the `"➕ Create a Character"` button renders.
   - Verify that clicking the button launches the character creator modal via the launcher hook.

2. **[`equipmentService.test.ts`](file:///c:/Users/nelso/Documents/Coding/nexusVTT/packages/character-creator/src/services/equipmentService.test.ts):**
   - Verify that background gear arrays containing `"50 gp"`, `"15 sp"`, etc., parse correctly and credit `character.currencies`.
   - Verify that coin strings do not produce dummy items in `character.inventory`.

3. **Alignment Regression Test:**
   - Verify default finalization output yields `'True Neutral'` without manual user interaction.

### Quality & Type Checking
- Run `npm run test:unit` in `apps/vtt` and `packages/character-creator`.
- Run `npm run type-check` across the workspaces.
