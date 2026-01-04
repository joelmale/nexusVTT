# Test Suite & NIST 800-53 Mapping

Nexus VTT maintains a comprehensive test suite mapped to NIST 800-53 Rev 5
controls to ensure security, reliability, and data integrity.

## Test Coverage Overview

| Category            | Tests   | Files  | Coverage                       |
| ------------------- | ------- | ------ | ------------------------------ |
| Unit Tests          | 252     | 15     | Utils, Stores, Services, Types |
| Component Tests     | 16      | 3      | UI Components                  |
| E2E Tests           | 2       | 2      | Visual & Layout                |
| Total               | 270     | 18     | 100% Pass Rate                 |

## NIST 800-53 Control Mapping

### SI (System and Information Integrity)

SI-10: Information Input Validation
- `dice.test.ts` (15 tests)
  - Validates dice expression parsing (e.g., `2d6+3`, `1d20`)
  - Rejects invalid expressions (trailing operators, malformed syntax)
  - Enforces range limits (1-100 dice, 2-1000 sides)
  - Tests whitespace handling and edge cases

SI-11: Error Handling
- `assetManager.test.ts` (7 tests)
  - Handles network failures gracefully
  - Returns empty manifests on fetch errors
  - Tests asset loading and caching error paths
- `websocket.test.ts` (6 tests)
  - Handles malformed JSON messages
  - Tests connection timeout scenarios
  - Validates disconnect handling
- `sessionPersistence.test.ts` (24 tests)
  - Handles invalid JSON gracefully
  - Tests localStorage quota errors
  - Validates error recovery mechanisms

SI-7: Software, Firmware, and Information Integrity
- `mathUtils.test.ts` (32 tests)
  - Validates geometric calculations (distance, collision detection)
  - Tests grid snapping and coordinate transformations
  - Ensures mathematical precision for game mechanics

### AC (Access Control)

AC-2: Account Management
- `gameStore.test.ts` (19 tests)
  - Tests host/player role assignment
  - Validates session creation and joining
  - Tests phase transition controls (lobby → live → paused)
  - Prevents invalid state transitions

AC-3: Access Enforcement
- `gameStore.test.ts` (19 tests)
  - Tests role-based permissions (host vs player)
  - Validates user action authorization
  - Tests scene access controls

### AU (Audit and Accountability)

AU-2: Event Logging
- `websocket.test.ts` (6 tests)
  - Tests WebSocket connection event tracking
  - Validates message send/receive logging
  - Tests connection state transitions

AU-9: Protection of Audit Information
- `sessionPersistence.test.ts` (24 tests)
  - Tests activity timestamp tracking
  - Validates session statistics collection
  - Tests audit log integrity

### SC (System and Communications Protection)

SC-8: Transmission Confidentiality and Integrity
- `websocket.test.ts` (6 tests)
  - Tests WebSocket connection establishment
  - Validates message queuing when disconnected
  - Tests reconnection logic
  - Ensures message integrity during transmission

SC-23: Session Authenticity
- `sessionPersistence.test.ts` (24 tests)
  - Validates session structure and format
  - Tests session expiration (5-minute timeout)
  - Tests version compatibility checking
  - Validates reconnection URL generation

### CM (Configuration Management)

CM-2: Baseline Configuration
- `characterStore.test.ts` (25 tests)
  - Tests character data structure validation
  - Validates default character attributes
  - Tests character creation wizard flow

CM-3: Configuration Change Control
- `gameStore.test.ts` (19 tests)
  - Tests controlled state transitions
  - Validates phase change authorization
  - Tests rollback on invalid transitions

CM-6: Configuration Settings
- `colorSchemes.test.ts` (7 tests)
  - Tests theme configuration
  - Validates color scheme settings
  - Tests UI customization persistence

### CP (Contingency Planning)

CP-9: Information System Backup
- `sessionPersistence.test.ts` (24 tests)
  - Tests session save/load operations
  - Validates game state persistence
  - Tests recovery data generation
  - Validates backup version compatibility

CP-10: Information System Recovery
- `sessionPersistence.test.ts` (24 tests)
  - Tests session recovery from localStorage
  - Validates reconnection capability
  - Tests recovery from invalid data states
  - Validates graceful degradation

### IA (Identification and Authentication)

IA-2: Identification and Authentication
- `gameStore.test.ts` (19 tests)
  - Tests user identification via room codes
  - Validates player name requirements
  - Tests session authentication

IA-11: Re-authentication
- `sessionPersistence.test.ts` (24 tests)
  - Tests reconnection authentication
  - Validates session timeout handling
  - Tests URL parameter-based reconnection

### SI (System and Information Integrity) - UI/UX

SI-12: Information Handling and Retention
- `character.test.ts` (17 tests)
  - Validates character data type definitions
  - Tests data structure integrity
  - Ensures type safety across application

Component Integrity Tests
- `CharacterSheet.test.tsx` (24 tests) - UI rendering integrity
- `PlayerPanel.test.tsx` (25 tests) - Player list consistency
- `InitiativeTracker.test.tsx` (12 tests) - Turn order integrity
- `GameToolbar.test.tsx` (3 tests) - Toolbar state consistency
- `DiceRoller.test.tsx` (1 test) - Dice UI rendering
- `ContextPanel.test.tsx` (1 test) - Layout constraints

Visual Regression & Layout Validation
- `visual-regression.test.ts` - Prevents UI regressions
- `layout.test.ts` - Validates CSS layout rules and constraints

## Test Execution

```bash
npm run test
npm run test:unit
npm run test:e2e
npm run test:coverage
```

## Continuous Integration

- Pre-commit hooks (Husky)
- Pull request validation
- CI pipeline
- Pre-deployment checks

## Security Testing Summary

| Control Family                     | Tests   | Risk Coverage                                    |
| ---------------------------------- | ------- | ------------------------------------------------ |
| SI - System Integrity              | 90      | Input validation, error handling, data integrity |
| AC - Access Control                | 43      | Role management, authorization                   |
| AU - Audit & Accountability        | 30      | Logging, tracking, session monitoring            |
| SC - Communications Protection     | 30      | WebSocket security, message integrity            |
| CM - Configuration Management      | 56      | State management, version control                |
| CP - Contingency Planning          | 48      | Data persistence, recovery, backup               |
| IA - Authentication                | 43      | User identification, session auth                |
| Total                              | 270     | Comprehensive coverage                           |
