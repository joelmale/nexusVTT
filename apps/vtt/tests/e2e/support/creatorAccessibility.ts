import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { type Page, type TestInfo } from '@playwright/test';

/** Automated checks complement, and do not certify, assistive-technology testing. */
export async function auditCreator(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const scan = await new AxeBuilder({ page })
      .include('dialog[open]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const reportPath = testInfo.outputPath(
      `creator-accessibility-${width}.json`,
    );
    writeFileSync(reportPath, JSON.stringify(scan, null, 2));
    await testInfo.attach(`creator-accessibility-${width}.json`, {
      path: reportPath,
      contentType: 'application/json',
    });
    failures.push(
      ...scan.violations.map(
        (violation) =>
          `${width}px ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
      ),
    );
    const overflow = await page.evaluate(() => ({
      document:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      creator: [
        ...document.querySelectorAll<HTMLElement>('.nexus-character-creator'),
      ].map((element) => element.scrollWidth - element.clientWidth),
    }));
    if (overflow.document > 1 || overflow.creator.some((value) => value > 1))
      failures.push(
        `${width}px horizontal overflow: ${JSON.stringify(overflow)}`,
      );
    await testInfo.attach(`creator-${width}.png`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.locator('dialog[open]').last().focus();
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
      if (
        !(await page.evaluate(() =>
          Boolean(document.activeElement?.closest('dialog[open]')),
        ))
      )
        failures.push(
          `${width}px keyboard focus left the modal on ${index % 2 ? 'Shift+Tab' : 'Tab'}.`,
        );
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await testInfo.attach('creator-css-zoom-200-percent.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  if (
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    )
  )
    failures.push('Horizontal overflow at CSS zoom 200%.');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  return failures;
}
