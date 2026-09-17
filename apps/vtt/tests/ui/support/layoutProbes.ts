import type { Locator, Page } from '@playwright/test';

/**
 * Probes for the things jsdom structurally cannot answer, because it has no
 * layout engine: what is actually on top at a point, what the grid resolved
 * to, and what is genuinely reachable by Tab.
 *
 * Asserting these directly beats inferring them from whether a click happened
 * to succeed - an intercepted click surfaces as a 15s timeout with a wall of
 * retry logs, which is how the overlapping-panel bug hid for so long.
 */

/** The `aria-label` of the topmost panel at a point, or null. */
export async function panelAtPoint(
  page: Page,
  x: number,
  y: number,
): Promise<string | null> {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py);
      const panel = el?.closest('[role="dialog"]');
      return panel?.getAttribute('aria-label') ?? null;
    },
    [x, y] as const,
  );
}

/** True when `locator` is the top hit-test target at its own centre. */
export async function isTopmostAtCentre(locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  if (!box) return false;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  return locator.evaluate(
    (node, [px, py]) => {
      const hit = document.elementFromPoint(px, py);
      return Boolean(hit && (node === hit || node.contains(hit)));
    },
    [cx, cy] as const,
  );
}

/** Resolved `grid-template-columns` / `-rows` on `.game-layout`. */
export async function gameLayoutGrid(
  page: Page,
): Promise<{ columns: string; rows: string }> {
  return page.evaluate(() => {
    const el = document.querySelector('.game-layout');
    if (!el) return { columns: '', rows: '' };
    const cs = getComputedStyle(el);
    return {
      columns: cs.gridTemplateColumns,
      rows: cs.gridTemplateRows,
    };
  });
}

/** Bounding box of the scene canvas, which shrinks when a panel docks. */
export async function canvasRect(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('[data-role="scene-canvas-root"]');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
}

/**
 * Count focusable elements that Tab can actually reach - i.e. not inside an
 * `inert` subtree and not `visibility: hidden`.
 */
export async function tabbableInsideChrome(page: Page): Promise<number> {
  return page.evaluate(() => {
    const focusable =
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll('[data-chrome]')]
      .flatMap((root) => [...root.querySelectorAll(focusable)])
      .filter((el) => {
        if (el.closest('[inert]')) return false;
        const cs = getComputedStyle(el as HTMLElement);
        return cs.visibility !== 'hidden' && cs.display !== 'none';
      }).length;
  });
}

/** Panel transforms keyed by aria-label, for cascade assertions. */
export async function panelTransforms(
  page: Page,
): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[role="dialog"][aria-label]')].map(
        (el) => [
          el.getAttribute('aria-label') ?? '',
          (el as HTMLElement).style.transform,
        ],
      ),
    ),
  );
}
