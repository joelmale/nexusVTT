import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import {
  createGuestHostSession,
  createGuestPlayerSession,
  openPanel,
} from './support/flows';
import {
  hasManagedSmokeStack,
  startSmokeService,
  stopSmokeService,
} from './support/stack';
import {
  eventMessages,
  messagesOfType,
  observeWebSocketMessages,
  resendLastClientMessage,
  routeWebSocketsToBackend,
  type WebSocketObservation,
} from './support/websocket-observer';

interface DeltaSyncMetrics {
  commits: { full: number; patch: number };
  resync: { 'base-mismatch': number };
}

interface RealtimeMetrics {
  instanceId: string;
  connected: boolean;
  orderedReceived: number;
}

function observePage(page: Page): { logs: string[]; errors: string[] } {
  const diagnostics = { logs: [] as string[], errors: [] as string[] };
  page.on('console', (message) => diagnostics.logs.push(message.text()));
  page.on('pageerror', (error) =>
    diagnostics.errors.push(error.stack ?? error.message),
  );
  return diagnostics;
}

function joinedIdentity(observation: WebSocketObservation): string | undefined {
  const uuid = eventMessages(observation, 'session/joined').at(-1)?.data.uuid;
  return typeof uuid === 'string' ? uuid : undefined;
}

function token(page: Page, playerName: string) {
  return page.locator(`[data-token-name="${playerName}"]`);
}

function chatMessage(page: Page, content: string) {
  return page
    .locator('.chat-panel__message-content')
    .filter({ hasText: content });
}

function diceRoll(page: Page, expression: string) {
  return page.locator('.dice-roller__roll').filter({ hasText: expression });
}

function activeScene(page: Page) {
  return page.locator('[data-role="scene-canvas-root"]');
}

async function expectSingleInitiativeEntry(
  page: Page,
  name: string,
): Promise<void> {
  const entries = page.locator('.initiative-name-input');
  await expect(entries).toHaveCount(1);
  await expect(entries).toHaveValue(name);
}

async function editActiveSceneName(page: Page, name: string): Promise<void> {
  const field = page
    .locator('.scene-panel__field')
    .filter({ has: page.getByText('Scene Name', { exact: true }) });
  await field.locator('.scene-panel__field-display').click();
  const input = field.locator('input[type="text"]');
  await input.fill(name);
  await input.press('Enter');
  await expect(activeScene(page)).toHaveAttribute('data-scene-name', name);
}

test.describe.configure({ mode: 'serial' });

test('two participants converge through gameplay, reconnects, restart, and a stale-base conflict', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(
    !hasManagedSmokeStack(),
    'Multi-client recovery requires npm run test:e2e.',
  );
  test.setTimeout(240_000);

  const playerName = `Sync Player ${Date.now()}`;
  const chatText = `multiplayer-chat-${Date.now()}`;
  const recoveryChatText = `post-restart-chat-${Date.now()}`;
  const primaryOutageChatText = `primary-outage-chat-${Date.now()}`;
  const peerOutageChatText = `peer-outage-chat-${Date.now()}`;
  const replayChatText = `offline-replay-chat-${Date.now()}`;
  const combatantName = `Sentinel ${Date.now()}`;
  const diceExpression = '2d8+3';
  const recoveryDiceExpression = '1d12+2';
  const replayDiceExpression = '1d10+4';
  const backendUrl = process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:15001';
  const backendPeerUrl =
    process.env.E2E_BACKEND_PEER_URL ?? 'http://127.0.0.1:15002';

  let hostContext: BrowserContext | undefined;
  let playerContext: BrowserContext | undefined;
  const stoppedBackends = new Set<string>();

  const diagnostics = {
    host: { logs: [] as string[], errors: [] as string[] },
    player: { logs: [] as string[], errors: [] as string[] },
    hostSockets: undefined as WebSocketObservation | undefined,
    playerSockets: undefined as WebSocketObservation | undefined,
  };

  try {
    const viewport = { width: 1920, height: 1000 };
    hostContext = await browser.newContext({ viewport });
    playerContext = await browser.newContext({ viewport });
    const hostPage = await hostContext.newPage();
    const playerPage = await playerContext.newPage();
    await routeWebSocketsToBackend(hostPage, backendUrl);
    await routeWebSocketsToBackend(playerPage, backendPeerUrl);
    diagnostics.host = observePage(hostPage);
    diagnostics.player = observePage(playerPage);
    const hostSockets = await observeWebSocketMessages(hostPage);
    const playerSockets = await observeWebSocketMessages(playerPage);
    diagnostics.hostSockets = hostSockets;
    diagnostics.playerSockets = playerSockets;

    const { roomCode } = await createGuestHostSession(hostPage);
    await expect
      .poll(() => messagesOfType(hostSockets, 'game-state-ack').length)
      .toBeGreaterThan(0);

    await createGuestPlayerSession(playerPage, roomCode, playerName);
    await expect.poll(() => joinedIdentity(playerSockets)).not.toBeUndefined();
    const initialPlayerIdentity = joinedIdentity(playerSockets);

    // Quick-join creates the player's token. The custom asset and placement
    // must both reach the host, and exactly one instance may render per client.
    await expect(token(hostPage, playerName)).toBeVisible();
    await expect(token(playerPage, playerName)).toBeVisible();
    await expect(token(hostPage, playerName)).toHaveCount(1);
    await expect(token(playerPage, playerName)).toHaveCount(1);

    // Public chat is a server echo: both isolated stores should contain one
    // copy, including the sender.
    await openPanel(hostPage, 'Chat');
    await openPanel(playerPage, 'Chat');
    await playerPage
      .getByPlaceholder('Type a message or /help for commands...')
      .fill(chatText);
    await playerPage.getByTitle('Send message (Enter)').click();
    await expect(chatMessage(hostPage, chatText)).toHaveCount(1);
    await expect(chatMessage(playerPage, chatText)).toHaveCount(1);
    const acknowledgementCount = messagesOfType(
      playerSockets,
      'event-ack',
    ).length;
    await resendLastClientMessage(playerPage, 'chat-message');
    await expect
      .poll(() => messagesOfType(playerSockets, 'event-ack').length)
      .toBeGreaterThan(acknowledgementCount);
    expect(
      messagesOfType(playerSockets, 'event-ack').at(-1)?.data.duplicate,
    ).toBe(true);
    await expect(chatMessage(hostPage, chatText)).toHaveCount(1);
    await expect(chatMessage(playerPage, chatText)).toHaveCount(1);

    // Dice results are server-authoritative and must use the same expression
    // and result record on both clients without a local+server duplicate.
    await openPanel(hostPage, 'Dice');
    await openPanel(playerPage, 'Dice');
    await hostPage
      .getByPlaceholder('Click dice below to build your roll...')
      .fill(diceExpression);
    await hostPage.getByRole('button', { name: 'Roll', exact: true }).click();
    await expect(diceRoll(hostPage, diceExpression)).toHaveCount(1);
    await expect(diceRoll(playerPage, diceExpression)).toHaveCount(1);

    await expect
      .poll(async () => {
        const [primaryResponse, peerResponse] = await Promise.all([
          request.get(`${backendUrl}/api/metrics/realtime`),
          request.get(`${backendPeerUrl}/api/metrics/realtime`),
        ]);
        const primary = (await primaryResponse.json()) as RealtimeMetrics;
        const peer = (await peerResponse.json()) as RealtimeMetrics;
        return (
          primary.instanceId === 'smoke-primary' &&
          peer.instanceId === 'smoke-peer' &&
          primary.connected &&
          peer.connected &&
          primary.orderedReceived > 0 &&
          peer.orderedReceived > 0
        );
      })
      .toBe(true);

    // Floating panels can cover world-space objects even though SVG locators
    // remain technically visible. Close Dice before exercising pointer input
    // so the gesture is delivered to the token rather than the panel surface.
    await hostPage
      .getByRole('dialog', { name: 'Dice' })
      .getByRole('button', { name: 'Close panel' })
      .click();
    await playerPage
      .getByRole('dialog', { name: 'Dice' })
      .getByRole('button', { name: 'Close panel' })
      .click();

    // Move the auto-created token through the real SVG pointer gesture and
    // compare the committed transform on the remote participant.
    const originalPlayerTransform = await token(
      playerPage,
      playerName,
    ).getAttribute('transform');
    const tokenBounds = await token(hostPage, playerName).boundingBox();
    if (!tokenBounds) throw new Error('Host token has no rendered bounds.');
    await hostPage.mouse.move(
      tokenBounds.x + tokenBounds.width / 2,
      tokenBounds.y + tokenBounds.height / 2,
    );
    await hostPage.mouse.down();
    await hostPage.mouse.move(
      tokenBounds.x + tokenBounds.width / 2 + 100,
      tokenBounds.y + tokenBounds.height / 2 + 50,
      { steps: 5 },
    );
    await hostPage.mouse.up();
    await expect
      .poll(() => token(playerPage, playerName).getAttribute('transform'))
      .not.toBe(originalPlayerTransform);

    // Initiative is owned by a separate Zustand store; this verifies that it
    // is now included in the canonical projection and hydrated by peer patches.
    await openPanel(hostPage, 'Initiative');
    await openPanel(playerPage, 'Initiative');
    await hostPage.getByPlaceholder('Name').fill(combatantName);
    await hostPage.getByPlaceholder('Init').fill('17');
    await hostPage.getByRole('button', { name: 'Add', exact: true }).click();
    await expectSingleInitiativeEntry(playerPage, combatantName);

    // Creating a second public scene also activates it. Active-scene changes
    // must enter the delta pipeline, then both clients return to Scene 1.
    const sceneManager = hostPage.getByRole('region', {
      name: 'Scene Manager',
    });
    await sceneManager.hover();
    await sceneManager
      .getByRole('button', { name: 'Create new scene' })
      .click();
    await expect(activeScene(hostPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 2',
    );
    await expect(activeScene(playerPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 2',
    );
    await sceneManager.hover();
    await sceneManager.locator('button').filter({ hasText: 'Scene 1' }).click();
    await expect(activeScene(playerPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 1',
    );
    await expect(token(playerPage, playerName)).toHaveCount(1);

    // Leave through the real application lifecycle, keep the isolated browser
    // context/cookies, and prove identity plus synchronized state survive rejoin.
    const playerSocketCountBeforeOffline = playerSockets.socketUrls.length;
    const playerJoinCountBeforeOffline = eventMessages(
      playerSockets,
      'session/joined',
    ).length;
    const playerClosedSocketsBeforeOffline = playerSockets.closedSocketCount;
    await openPanel(playerPage, 'Lobby');
    await playerPage.getByRole('button', { name: /Leave Room$/ }).click();
    await expect(playerPage).toHaveURL(/\/lobby$/);
    await expect
      .poll(() => playerSockets.closedSocketCount)
      .toBeGreaterThan(playerClosedSocketsBeforeOffline);

    await openPanel(hostPage, 'Chat');
    await hostPage
      .getByPlaceholder('Type a message or /help for commands...')
      .fill(replayChatText);
    await hostPage.getByTitle('Send message (Enter)').click();
    await expect(chatMessage(hostPage, replayChatText)).toHaveCount(1);
    await openPanel(hostPage, 'Dice');
    await hostPage
      .getByPlaceholder('Click dice below to build your roll...')
      .fill(replayDiceExpression);
    await hostPage.getByRole('button', { name: 'Roll', exact: true }).click();
    await expect(diceRoll(hostPage, replayDiceExpression)).toHaveCount(1);

    await createGuestPlayerSession(playerPage, roomCode, playerName);
    await expect
      .poll(() => playerSockets.socketUrls.length, { timeout: 20_000 })
      .toBeGreaterThan(playerSocketCountBeforeOffline);
    await expect
      .poll(() => eventMessages(playerSockets, 'session/joined').length, {
        timeout: 20_000,
      })
      .toBeGreaterThan(playerJoinCountBeforeOffline);
    expect(joinedIdentity(playerSockets)).toBe(initialPlayerIdentity);
    await expect(activeScene(playerPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 1',
    );
    await expect(token(playerPage, playerName)).toHaveCount(1);
    await openPanel(playerPage, 'Chat');
    await expect(chatMessage(playerPage, replayChatText)).toHaveCount(1);
    await openPanel(playerPage, 'Dice');
    await expect(diceRoll(playerPage, replayDiceExpression)).toHaveCount(1);

    // Restart the backend while PostgreSQL remains alive. Both sockets must
    // recover and the persisted canonical state must not replay duplicates.
    const hostSocketCountBeforeRestart = hostSockets.socketUrls.length;
    const playerClosedSocketsBeforePrimaryRestart =
      playerSockets.closedSocketCount;
    const hostReconnectCountBeforeRestart = eventMessages(
      hostSockets,
      'session/reconnected',
    ).length;
    const playerJoinCountBeforeRestart = eventMessages(
      playerSockets,
      'session/joined',
    ).length;

    // Let the last acknowledged state finish its fire-and-forget DB write.
    await hostPage.waitForTimeout(1_000);
    await stopSmokeService('backend');
    stoppedBackends.add('backend');
    await expect
      .poll(() =>
        diagnostics.host.logs.some((entry) =>
          entry.includes('WebSocket disconnected'),
        ),
      )
      .toBe(true);

    await openPanel(playerPage, 'Chat');
    await playerPage
      .getByPlaceholder('Type a message or /help for commands...')
      .fill(primaryOutageChatText);
    await playerPage.getByTitle('Send message (Enter)').click();
    await expect(chatMessage(playerPage, primaryOutageChatText)).toHaveCount(1);

    await startSmokeService('backend');
    stoppedBackends.delete('backend');

    await expect
      .poll(() => hostSockets.socketUrls.length, { timeout: 30_000 })
      .toBeGreaterThan(hostSocketCountBeforeRestart);
    await expect
      .poll(() => eventMessages(hostSockets, 'session/reconnected').length, {
        timeout: 30_000,
      })
      .toBeGreaterThan(hostReconnectCountBeforeRestart);
    expect(playerSockets.closedSocketCount).toBe(
      playerClosedSocketsBeforePrimaryRestart,
    );
    expect(eventMessages(playerSockets, 'session/joined')).toHaveLength(
      playerJoinCountBeforeRestart,
    );
    expect(joinedIdentity(playerSockets)).toBe(initialPlayerIdentity);
    await openPanel(hostPage, 'Chat');
    await expect(chatMessage(hostPage, primaryOutageChatText)).toHaveCount(1);

    await expect(activeScene(hostPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 1',
    );
    await expect(activeScene(playerPage)).toHaveAttribute(
      'data-scene-name',
      'Scene 1',
    );
    await expect(token(hostPage, playerName)).toHaveCount(1);
    await expect(token(playerPage, playerName)).toHaveCount(1);

    await openPanel(hostPage, 'Initiative');
    await openPanel(playerPage, 'Initiative');
    await expectSingleInitiativeEntry(hostPage, combatantName);
    await expectSingleInitiativeEntry(playerPage, combatantName);

    await openPanel(hostPage, 'Chat');
    await openPanel(playerPage, 'Chat');
    await hostPage
      .getByPlaceholder('Type a message or /help for commands...')
      .fill(recoveryChatText);
    await hostPage.getByTitle('Send message (Enter)').click();
    await expect(chatMessage(hostPage, recoveryChatText)).toHaveCount(1);
    await expect(chatMessage(playerPage, recoveryChatText)).toHaveCount(1);
    await openPanel(hostPage, 'Dice');
    await openPanel(playerPage, 'Dice');
    await hostPage
      .getByPlaceholder('Click dice below to build your roll...')
      .fill(recoveryDiceExpression);
    await hostPage.getByRole('button', { name: 'Roll', exact: true }).click();
    await expect(diceRoll(hostPage, recoveryDiceExpression)).toHaveCount(1);
    await expect(diceRoll(playerPage, recoveryDiceExpression)).toHaveCount(1);

    // Repeat the asymmetric failure in the other direction. The host remains
    // active on primary, while the peer rejoins and repairs its ordered cursor
    // from PostgreSQL after the peer process is replaced.
    const playerSocketCountBeforePeerRestart = playerSockets.socketUrls.length;
    const playerJoinCountBeforePeerRestart = eventMessages(
      playerSockets,
      'session/joined',
    ).length;
    const hostClosedSocketsBeforePeerRestart = hostSockets.closedSocketCount;
    await stopSmokeService('backend-peer');
    stoppedBackends.add('backend-peer');
    await openPanel(hostPage, 'Chat');
    await hostPage
      .getByPlaceholder('Type a message or /help for commands...')
      .fill(peerOutageChatText);
    await hostPage.getByTitle('Send message (Enter)').click();
    await expect(chatMessage(hostPage, peerOutageChatText)).toHaveCount(1);
    await startSmokeService('backend-peer');
    stoppedBackends.delete('backend-peer');
    await expect
      .poll(() => playerSockets.socketUrls.length, { timeout: 30_000 })
      .toBeGreaterThan(playerSocketCountBeforePeerRestart);
    await expect
      .poll(() => eventMessages(playerSockets, 'session/joined').length, {
        timeout: 30_000,
      })
      .toBeGreaterThan(playerJoinCountBeforePeerRestart);
    expect(hostSockets.closedSocketCount).toBe(hostClosedSocketsBeforePeerRestart);
    expect(joinedIdentity(playerSockets)).toBe(initialPlayerIdentity);
    await openPanel(playerPage, 'Chat');
    await expect(chatMessage(playerPage, peerOutageChatText)).toHaveCount(1);

    // Grant the player co-host authority so both isolated clients can publish.
    // Establish host and player baselines, then race edits from different bases:
    // the stale host patch must be rejected and automatically re-baselined.
    await openPanel(hostPage, 'Lobby');
    hostPage.once('dialog', (dialog) => dialog.accept());
    await hostPage.getByTitle('Grant DM permissions').click();
    await expect(
      playerPage.getByRole('region', { name: 'Scene Manager' }),
    ).toBeVisible();

    await openPanel(hostPage, 'Scene');
    const hostAckCount = messagesOfType(hostSockets, 'game-state-ack').length;
    await editActiveSceneName(hostPage, 'Host Chain Baseline');
    await expect
      .poll(() => messagesOfType(hostSockets, 'game-state-ack').length)
      .toBeGreaterThan(hostAckCount);

    await openPanel(playerPage, 'Scene');
    const playerAckCount = messagesOfType(
      playerSockets,
      'game-state-ack',
    ).length;
    await editActiveSceneName(playerPage, 'Shared Chain Baseline');
    await expect
      .poll(() => messagesOfType(playerSockets, 'game-state-ack').length)
      .toBeGreaterThan(playerAckCount);
    await expect(activeScene(hostPage)).toHaveAttribute(
      'data-scene-name',
      'Shared Chain Baseline',
    );

    const hostConflictName = `Host Conflict ${Date.now()}`;
    const playerConflictName = `Player Conflict ${Date.now()}`;
    await Promise.all([
      editActiveSceneName(hostPage, hostConflictName),
      editActiveSceneName(playerPage, playerConflictName),
    ]);

    await expect
      .poll(async () => {
        const response = await request.get(
          `${backendUrl}/api/metrics/delta-sync`,
        );
        const metrics = (await response.json()) as DeltaSyncMetrics;
        return metrics.resync['base-mismatch'];
      })
      .toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const response = await request.get(
          `${backendUrl}/api/metrics/delta-sync`,
        );
        const metrics = (await response.json()) as DeltaSyncMetrics;
        return metrics.commits.patch;
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => {
        const hostName =
          await activeScene(hostPage).getAttribute('data-scene-name');
        const playerNameAfterConflict =
          await activeScene(playerPage).getAttribute('data-scene-name');
        return hostName !== null && hostName === playerNameAfterConflict;
      })
      .toBe(true);
    const convergedName =
      await activeScene(hostPage).getAttribute('data-scene-name');
    expect([hostConflictName, playerConflictName]).toContain(convergedName);

    // The projection normalizer is the final duplicate-event guard after the
    // optimistic entity event + canonical patch + two recovery cycles.
    await expect(token(hostPage, playerName)).toHaveCount(1);
    await expect(token(playerPage, playerName)).toHaveCount(1);
    await openPanel(hostPage, 'Initiative');
    await openPanel(playerPage, 'Initiative');
    await expectSingleInitiativeEntry(hostPage, combatantName);
    await expectSingleInitiativeEntry(playerPage, combatantName);

    expect(diagnostics.host.errors).toEqual([]);
    expect(diagnostics.player.errors).toEqual([]);
  } finally {
    for (const service of stoppedBackends) {
      await startSmokeService(service).catch(() => undefined);
    }
    await testInfo.attach('multiplayer-diagnostics', {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
      contentType: 'application/json',
    });
    await playerContext?.close();
    await hostContext?.close();
  }
});
