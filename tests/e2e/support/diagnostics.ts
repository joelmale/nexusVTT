import {
  expect,
  test as base,
  type ConsoleMessage,
  type Request,
  type TestInfo,
} from '@playwright/test';

export interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
}

async function attachDiagnostics(
  diagnostics: BrowserDiagnostics,
  testInfo: TestInfo,
): Promise<void> {
  await testInfo.attach('browser-diagnostics', {
    body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
    contentType: 'application/json',
  });
}

export const test = base.extend<{ diagnostics: BrowserDiagnostics }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const diagnostics: BrowserDiagnostics = {
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
      };

      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === 'error') {
          diagnostics.consoleErrors.push(message.text());
        }
      };
      const onPageError = (error: Error) => {
        diagnostics.pageErrors.push(error.stack ?? error.message);
      };
      const onRequestFailed = (request: Request) => {
        diagnostics.requestFailures.push(
          `${request.url()} — ${request.failure()?.errorText ?? 'unknown failure'}`,
        );
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('requestfailed', onRequestFailed);

      await use(diagnostics);

      // Merge Playwright's retained buffers so a production bootstrap failure
      // always leaves useful evidence, including errors raised near teardown.
      for (const error of await page.pageErrors()) {
        const message = error.stack ?? error.message;
        if (!diagnostics.pageErrors.includes(message)) {
          diagnostics.pageErrors.push(message);
        }
      }
      for (const message of await page.consoleMessages()) {
        if (
          message.type() === 'error' &&
          !diagnostics.consoleErrors.includes(message.text())
        ) {
          diagnostics.consoleErrors.push(message.text());
        }
      }
      await attachDiagnostics(diagnostics, testInfo);
    },
    { auto: true },
  ],
});

export { expect };
