# NexusVTT Design & Architecture Manifest

This document serves as the strict engineering and styling source of truth for the NexusVTT codebase[cite: 1]. All new feature implementations, refactors, and interface updates must adhere to the structural constraints detailed below[cite: 1].

---

## 1. Thematic Design Standards (D&D Focus)

All UI elements must utilize centralized Tailwind design tokens to maintain a unified, high-density, fantasy-tabletop aesthetic[cite: 1].

*   **Layering Hierarchy:**
    *   **The Tabletop Layer (`bg-vtt-iron-900`):** App base layout mimicking a dark, heavy wooden or iron gaming table.
    *   **The Frame Layer (`bg-vtt-iron-800 border-vtt-iron-700`):** Navigation panels, utility toolbars, and layout boundaries mimicking forged trim frames.
    *   **The Tome Layer (`bg-vtt-parchment text-vtt-parchment-text`):** High-density data containers (character sheets, campaign cards, spell trackers). High-contrast dark ink on aged parchment ensures optimal legibility.
*   **Color Tokens & Accents:**
    *   `vtt-iron-900`: `#15181c` | `vtt-iron-800`: `#1e2227` | `vtt-iron-700`: `#2a2f37`
    *   `vtt-parchment`: `#f4eccf` | `vtt-parchment-text`: `#1c1917`
    *   `vtt-bronze`: `#8c6d4f` (Used for semantic headers, borders, and active iconography).
    *   `vtt-amber-glow`: `#d97706` (Used for candlelight glows, interactive states, hover effects, and notification alerts).
*   **Typography Rules:**
    *   **Headings:** Use a calligraphic serif font configuration (`font-fantasy` / *Cinzel Decorative*) exclusively for high-level categories and headers.
    *   **UI & Numbers:** Use a clean, ultra-compact sans-serif font configuration (`font-interface` / *Inter*) for levels, math readouts, actions, and dates to ensure immediate parsing during gameplay.

---

## 2. Layout & UI/UX Constraints

*   **High-Density Space Optimization:** Maximize vertical real estate. Eliminate loose margins, excessive padding, and floating white space. Use grid arrays over vertical lists for campaigns, characters, and assets to display more information above the fold.
*   **Native Overlays via Popover API:** Do not write custom state management or window event listeners for basic presentation dropdowns, context menus, or static toolbars. Use the native HTML Popover API (`popover="auto"` and `popovertarget`) to automatically promote overlays to the browser's top layer.
*   **Canvas Boundary Rule:** Do not use top-layer popovers for elements anchored to entities moving inside the real-time gaming canvas (e.g., token health bars, dynamic floating text). Keep canvas labels synchronous within local canvas positioning loops to prevent rendering jitter.

---

## 3. Architectural & Performance Rules

*   **Web Worker Offloading:** Heavy procedural algorithms, map parsing, noise loops, and massive geometry generators (e.g., cave, city, or world generation) must **never** run on the main React thread. They must be executed off-thread asynchronously via the Comlink-wrapped `mapGeneratorService` to preserve a locked 60fps UI rendering rate.
*   **Strict Tree-Shaking Imports:** To prevent compilation bloat and preserve fast Vite dev-server hot-reloading, never destructure icons from the root library (e.g., `import { Sword } from 'lucide-react'`). Use direct component path imports exclusively:
```typescript
    import Sword from 'lucide-react/dist/esm/icons/sword';
    ```

---

## 4. TypeScript Strictness Guardrail

*   **Zero 'any' Types:** The use of `any` types is strictly forbidden across the entire codebase. 
*   **Actionable Typing:** All data payloads, event handlers, worker proxy signatures, and React component props must be explicitly, structurally, and strongly typed. If extending an upstream vendor structure, cleanly type the expected parameters or use strict generics.