import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  createGuestHostSession,
  createGuestPlayerSession,
  openPanel,
} from './support/flows';
import { hasManagedSmokeStack } from './support/stack';
import {
  messagesOfType,
  observeWebSocketMessages,
  resendLastClientMessage,
  type WebSocketObservation,
} from './support/websocket-observer';

function chatMessage(page: Page, content: string) {
  return page
    .locator('.chat-panel__message-content')
    .filter({ hasText: content });
}

async function sendChat(page: Page, content: string): Promise<void> {
  await page
    .getByPlaceholder('Type a message or /help for commands...')
    .fill(content);
  await page.getByTitle('Send message (Enter)').click();
}

function chatSequenceMap(
  observation: WebSocketObservation,
  messages: string[],
): Map<string, number> {
  const expected = new Set(messages);
  return new Map(
    observation.messages
      .filter(
        (message) =>
          message.type === 'chat-message' &&
          typeof message.data.content === 'string' &&
          expected.has(message.data.content) &&
          typeof message.serverSequence === 'number',
      )
      .map((message) => [
        message.data.content as string,
        message.serverSequence as number,
      ]),
  );
}

test.describe.configure({ mode: 'serial' });

test('four clients preserve one total order through retries and a replay gap', async ({
  browser,
}, testInfo) => {
  test.skip(
    !hasManagedSmokeStack(),
    'Multi-client recovery requires npm run test:e2e.',
  );
  test.setTimeout(240_000);

  const contexts: BrowserContext[] = [];
  const diagnostics: Array<{ name: string; errors: string[] }> = [];

  try {
    const pages: Page[] = [];
    const observations: WebSocketObservation[] = [];
    for (let index = 0; index < 4; index += 1) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      contexts.push(context);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      diagnostics.push({ name: `client-${index + 1}`, errors });
      observations.push(await observeWebSocketMessages(page));
      pages.push(page);
    }

    const { roomCode } = await createGuestHostSession(pages[0]);
    const playerNames = [1, 2, 3].map(
      (index) => `Chaos Player ${index} ${Date.now()}`,
    );
    for (let index = 1; index < pages.length; index += 1) {
      await createGuestPlayerSession(
        pages[index],
        roomCode,
        playerNames[index - 1],
      );
    }

    await Promise.all(pages.map((page) => openPanel(page, 'Chat')));
    const burst = pages.map(
      (_, index) => `ordered-burst-${index + 1}-${Date.now()}`,
    );
    await Promise.all(pages.map((page, index) => sendChat(page, burst[index])));

    for (const page of pages) {
      for (const content of burst) {
        await expect(chatMessage(page, content)).toHaveCount(1);
      }
    }

    const duplicateAckCount = messagesOfType(
      observations[1],
      'event-ack',
    ).length;
    await resendLastClientMessage(pages[1], 'chat-message');
    await expect
      .poll(() => messagesOfType(observations[1], 'event-ack').length)
      .toBeGreaterThan(duplicateAckCount);
    expect(
      messagesOfType(observations[1], 'event-ack').at(-1)?.data.duplicate,
    ).toBe(true);
    for (const page of pages) {
      await expect(chatMessage(page, burst[1])).toHaveCount(1);
    }

    const offlineObservation = observations[3];
    const cursorCountBeforeReplay = messagesOfType(
      offlineObservation,
      'event-cursor',
    ).length;
    await offlineObservation.disconnect();

    const recoveryBurst = pages
      .slice(0, 3)
      .map((_, index) => `replay-burst-${index + 1}-${Date.now()}`);
    await Promise.all(
      pages
        .slice(0, 3)
        .map((page, index) => sendChat(page, recoveryBurst[index])),
    );
    offlineObservation.reconnect();
    await expect
      .poll(() => messagesOfType(offlineObservation, 'event-cursor').length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(cursorCountBeforeReplay);

    const allMessages = [...burst, ...recoveryBurst];
    for (const page of pages) {
      for (const content of allMessages) {
        await expect(chatMessage(page, content)).toHaveCount(1);
      }
    }

    const referenceOrder = chatSequenceMap(observations[0], allMessages);
    expect(referenceOrder.size).toBe(allMessages.length);
    for (const observation of observations.slice(1)) {
      expect(chatSequenceMap(observation, allMessages)).toEqual(referenceOrder);
    }
    expect(diagnostics.every((client) => client.errors.length === 0)).toBe(
      true,
    );
  } finally {
    await testInfo.attach('multiplayer-chaos-diagnostics', {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
      contentType: 'application/json',
    });
    await Promise.all(contexts.map((context) => context.close()));
  }
});
