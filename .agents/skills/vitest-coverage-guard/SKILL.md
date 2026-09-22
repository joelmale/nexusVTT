---
name: vitest-coverage-guard
description: >-
  Automates writing comprehensive Vitest unit and integration tests aiming for 80%+ branch
  and line coverage whenever net-new code is added or existing code is modified.
  Includes standard mocking patterns for IndexedDB (fake-indexeddb), WebSockets,
  Comlink web workers, Zustand stores, and React Testing Library best practices.
---

# Vitest Coverage Guard

Ensures code quality and test resilience by guiding the creation and maintenance of unit and integration tests in Vitest with an 80%+ branch and line coverage target.

## When to Use

Activate this skill when:
- Creating new components, hooks, stores, or utility functions.
- Modifying existing features that have missing or failing tests.
- Refactoring or improving test coverage across frontend or backend modules.
- Diagnosing flaky tests, memory leaks, or unhandled asynchronous re-renders in Vitest.

---

## Core Testing Principles

1. **Framework**: Vitest (`vitest`) + React Testing Library (`@testing-library/react`) + `@testing-library/user-event`.
2. **Accessibility-First Queries**:
   - Always prefer `screen.getByRole` / `screen.findByRole` with accessible names over `getByTestId` or container queries.
   - Example: `screen.getByRole('button', { name: /save character/i })`.
3. **80%+ Coverage Rule**:
   - Write tests that systematically hit both the happy path and alternate branches:
     - Error boundaries & rejected promises.
     - Optional props / default fallback values.
     - Cancellation & abort controllers.
     - Loading, empty, and populated states.
4. **Isolated State**:
   - Always reset Zustand stores and clear mocks in `beforeEach` / `afterEach`.
   - Never allow state bleed across test files.

---

## Standard Mocking Patterns

For complete, copy-pasteable mock templates, see [patterns.md](./references/patterns.md).

### 1. IndexedDB (`fake-indexeddb`)
When testing code that interacts with IndexedDB:
```typescript
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
```

### 2. Comlink Worker Offloading
Off-thread workers (`storageWorkerClient.ts`, math/geometry loops) must be mocked at the client boundary rather than instantiating actual browser Worker threads:
```typescript
vi.mock('@/services/storageWorkerClient', () => ({
  storageWorker: {
    saveSnapshot: vi.fn().mockResolvedValue(true),
    loadSnapshot: vi.fn().mockResolvedValue(null),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
  },
}));
```

### 3. WebSocket Realtime Mock
Never open actual network sockets in unit tests. Mock WebSocket event dispatch:
```typescript
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal('WebSocket', MockWebSocket);
```

### 4. Zustand Store Resetting
Reset store state between tests to prevent test pollution:
```typescript
import { useGameStore } from '@/stores/gameStore';

const initialGameStoreState = useGameStore.getState();
beforeEach(() => {
  useGameStore.setState(initialGameStoreState, true);
});
```

---

## Execution Workflow

1. **Analyze Coverage**:
   Run the specific test file or package coverage:
   ```bash
   npx vitest run <path/to/test.tsx> --coverage
   ```
2. **Identify Uncovered Branches**:
   Check uncovered lines and conditional branches (e.g. ternary operators, optional chaining `?.`, error catch blocks).
3. **Write Targeted Test Cases**:
   - Add parameterized tests (`test.each`) for edge cases and boundary numbers.
   - Assert error states and toast notifications when network or worker calls reject.
4. **Validate**:
   Ensure all tests pass cleanly without console errors or unhandled promise warnings:
   ```bash
   npm run test:unit
   ```
