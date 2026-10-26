import { expect, test } from './support/diagnostics';
import { createTestIdentity } from './support/testIdentity';
import { hasManagedSmokeStack } from './support/stack';
import { auditCreator } from './support/creatorAccessibility';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { CreationDraft } from '../../../../packages/character-creator/src/types/draft';
import type { ReferenceBuildOracle } from '../../../../packages/character-creator/src/tests/fixtures/referenceBuilds';
import type { Character as ForgeCharacter } from '../../../../packages/character-creator/src/types/dnd';
import type { Character as VttCharacter } from '@nexus/character-contracts';

const fixtures = JSON.parse(
  readFileSync(
    new URL('./fixtures/creator-reference-drafts.json', import.meta.url),
    'utf8',
  ),
) as Record<string, { draft: CreationDraft; oracle: ReferenceBuildOracle }>;

/** Real UI completion/recovery and persistence; input authoring is fixture-seeded. */
for (const host of ['forge', 'vtt'] as const)
  for (const mode of ['full', 'guided'] as const)
    for (const [reference, fixture] of Object.entries(fixtures)) {
      for (const theme of host === 'forge' && reference === 'F24'
        ? ['dark', 'light', 'paper']
        : ['dark']) {
        test(`${host} ${mode} completes and reloads ${reference} ${theme}`, async ({
          page,
          context,
          diagnostics,
        }, testInfo) => {
          test.skip(
            !hasManagedSmokeStack(),
            'Requires managed production images.',
          );
          test.setTimeout(reference === 'F24' ? 180_000 : 90_000);
          const identity =
            host === 'vtt' ? await createTestIdentity(context) : undefined;
          try {
            if (host === 'forge')
              await page.addInitScript(
                (value) => localStorage.setItem('5e-forge-theme', value),
                theme,
              );
            const oracle = fixture.oracle;
            const draft = {
              ...structuredClone(fixture.draft),
              draftId: randomUUID(),
              characterId: randomUUID(),
              attemptId: randomUUID(),
              name: `${reference} ${host} ${mode}`,
            };
            const key =
              host === 'forge'
                ? 'forge:local:creation'
                : `vtt:${identity!.userId}:standalone:creation`;
            await page.goto(host === 'forge' ? '/forge/' : '/dashboard');
            await expect(
              page
                .getByRole('button', {
                  name:
                    host === 'forge'
                      ? /create.*character|new character/i
                      : 'Create Character',
                  exact: host === 'vtt',
                })
                .first(),
            ).toBeVisible();
            if (host === 'vtt') {
              await page
                .getByRole('button', { name: 'Create Character', exact: true })
                .click();
              await expect(
                page.getByRole('button', { name: 'Use 2024 rules' }),
              ).toBeVisible();
              await page
                .getByRole('button', { name: 'Close', exact: true })
                .click();
            }
            await page.evaluate(
              async ({ database, key, record }) => {
                await new Promise<void>((resolve, reject) => {
                  const request = indexedDB.open(database);
                  request.onerror = () => reject(request.error);
                  request.onsuccess = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains('characterDrafts')) {
                      db.close();
                      reject(
                        new Error('Host draft schema was not initialized.'),
                      );
                      return;
                    }
                    const transaction = db.transaction(
                      'characterDrafts',
                      'readwrite',
                    );
                    transaction.objectStore('characterDrafts').put({
                      id: key,
                      value: JSON.stringify(record),
                      revision: 1,
                      clientTabId: 'matrix',
                    });
                    transaction.oncomplete = () => {
                      db.close();
                      resolve();
                    };
                    transaction.onerror = () => reject(transaction.error);
                  };
                });
              },
              {
                database: host === 'forge' ? 'NexusForge' : 'NexusVTT',
                key,
                record: {
                  version: 1,
                  draft,
                  updatedAt: new Date().toISOString(),
                  clientTabId: 'matrix',
                  presentation: {
                    mode,
                    guidedFlow: 'four-screen',
                    step: mode === 'full' ? 13 : 3,
                    positions: { full: 13, fourScreen: 3 },
                  },
                },
              },
            );
            if (host === 'forge') await page.goto('/forge/character-creator');
            else
              await page
                .getByRole('button', { name: 'Create Character', exact: true })
                .click();
            await page
              .getByRole('button', { name: 'Resume creation', exact: true })
              .click();
            if (reference === 'F24' && mode === 'guided') {
              await page
                .getByRole('button', { name: 'Back', exact: true })
                .click();
              await page
                .getByRole('button', { name: 'Back', exact: true })
                .click();
              const customize = page.getByRole('button', {
                name: 'Customize Stats',
                exact: true,
              });
              await customize.click();
              const nested = page.getByRole('dialog', {
                name: 'Edit Ability Scores',
                exact: true,
              });
              await expect(nested).toBeVisible();
              await page.keyboard.press('Tab');
              await page.keyboard.press('Shift+Tab');
              await expect(nested).toContainText(
                'Redistribute the standard array',
              );
              await page.keyboard.press('Escape');
              await expect(nested).toBeHidden();
              await expect(customize).toBeFocused();
              await page
                .getByRole('button', { name: 'Continue', exact: true })
                .click();
              await page
                .getByRole('button', { name: 'Continue', exact: true })
                .click();
            }
            const submit = page
              .locator('dialog[open]')
              .last()
              .getByRole('button', {
                name:
                  host === 'forge' && mode === 'full'
                    ? 'Save Character'
                    : 'Create Character',
                exact: true,
              });
            await expect(submit).toBeEnabled();
            const accessibilityFailures =
              reference === 'F24' ? await auditCreator(page, testInfo) : [];
            const savedResponse =
              host === 'vtt'
                ? page.waitForResponse(
                    (response) =>
                      response.url().endsWith('/api/characters') &&
                      response.request().method() === 'POST',
                  )
                : undefined;
            await submit.click();
            let saved: ForgeCharacter | VttCharacter;
            if (savedResponse) {
              const response = await savedResponse;
              expect(response.ok()).toBe(true);
              const record: { id: string; data: VttCharacter } =
                await response.json();
              expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
              expect(record.data.id).toBe(record.id);
              expect(response.request().postDataJSON().creationAttemptId).toBe(
                draft.attemptId,
              );
              saved = record.data;
              await page.reload();
              const charactersResponse =
                await context.request.get('/api/characters');
              expect(charactersResponse.ok()).toBe(true);
              const records: Array<{ id: string; data: VttCharacter }> =
                await charactersResponse.json();
              expect(
                records.find((entry) => entry.id === record.id)?.data,
              ).toMatchObject({
                name: draft.name,
                maxHitPoints: oracle.expected.hp,
              });
            } else {
              await expect(
                page.getByText(`${draft.name} is ready for adventure.`),
              ).toBeVisible();
              await page.reload();
              saved = await page.evaluate(
                async (id) =>
                  new Promise<ForgeCharacter>((resolve, reject) => {
                    const request = indexedDB.open('NexusForge');
                    request.onsuccess = () => {
                      const db = request.result;
                      const read = db
                        .transaction('characters')
                        .objectStore('characters')
                        .get(id);
                      read.onsuccess = () => {
                        resolve(read.result as ForgeCharacter);
                        db.close();
                      };
                      read.onerror = () => reject(read.error);
                    };
                  }),
                draft.characterId,
              );
            }
            expect(saved.name).toBe(draft.name);
            expect(saved.maxHitPoints).toBe(oracle.expected.hp);
            expect(saved.armorClass).toBe(oracle.expected.ac);
            expect(saved.initiative).toBe(oracle.expected.initiative);
            expect(saved.speed).toBe(oracle.expected.speed);
            if (oracle.expected.currency)
              expect(saved.currency).toMatchObject(oracle.expected.currency);
            for (const [ability, score] of Object.entries(
              oracle.expected.abilities,
            ))
              expect(
                saved.abilities[ability as keyof typeof saved.abilities].score,
              ).toBe(score);
            if (oracle.creationData.classSlug === 'wizard') {
              expect(saved.spellcasting?.spellbook).toEqual(
                oracle.creationData.spellSelection.spellbook,
              );
              expect(saved.spellcasting?.preparedSpells).toEqual(
                oracle.creationData.spellSelection.dailyPrepared ??
                  oracle.creationData.spellSelection.preparedSpells,
              );
            }
            if (oracle.expected.spells) {
              expect(saved.spellcasting?.spellSaveDC).toBe(
                oracle.expected.spells.spellSaveDC,
              );
              expect(saved.spellcasting?.spellAttackBonus).toBe(
                oracle.expected.spells.spellAttackBonus,
              );
            }
            if (oracle.creationData.classSlug === 'warlock') {
              expect(saved.spellcasting?.cantripsKnown).toEqual(
                oracle.creationData.spellSelection.selectedCantrips,
              );
              expect(saved.spellcasting?.spellSlots?.[1]).toBe(1);
              if (oracle.edition === '2024') {
                expect(saved.eldritchInvocations).toEqual(
                  oracle.creationData.eldritchInvocations,
                );
                expect(saved.spellcasting?.preparedSpells).toEqual(
                  oracle.creationData.spellSelection.preparedSpells,
                );
              } else {
                expect(saved.spellcasting?.spellsKnown).toEqual(
                  oracle.creationData.spellSelection.knownSpells,
                );
              }
            }
            expect(diagnostics.pageErrors).toEqual([]);
            expect(
              accessibilityFailures,
              'Automated accessibility and reflow findings',
            ).toEqual([]);
          } finally {
            await identity?.dispose();
          }
        });
      }
    }
