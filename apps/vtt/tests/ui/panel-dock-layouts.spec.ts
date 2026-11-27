import { favoriteOrListedPanel, panelsDock } from '../support/panelDock';
import { expect, gotoGame, test } from './support/gameFixture';

test('Settings switches all three dock layouts without losing open windows or their state', async ({
  page,
}) => {
  await gotoGame(page);
  const dock = panelsDock(page);
  await expect(dock).toHaveAttribute('data-layout', 'favorites');
  await (await favoriteOrListedPanel(page, 'Chat')).click();
  const chat = page.getByRole('dialog', { name: 'Chat', exact: true });
  const draft = chat.getByPlaceholder(/Type a message/i);
  await draft.fill('Keep this draft');
  await (await favoriteOrListedPanel(page, 'Settings')).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  const layoutSelect = settings.getByRole('combobox', { name: 'Panels Dock' });

  await layoutSelect.selectOption({ label: 'Panel Switcher' });
  await expect(dock).toHaveAttribute('data-layout', 'switcher');
  await expect(draft).toHaveValue('Keep this draft');
  await settings.getByRole('button', { name: 'Close panel' }).click();

  await dock
    .getByRole('button', { name: 'Panels', exact: true })
    .press('Enter');
  const search = dock.getByRole('searchbox', { name: 'Find a panel' });
  await expect(search).toBeFocused();
  await search.fill('chat');
  await search.press('Escape');
  await expect(search).toBeHidden();
  await expect(chat).toBeVisible();

  await dock.getByRole('button', { name: 'Panels', exact: true }).click();
  await search.fill('sett');
  await search.press('Enter');
  await expect(settings).toBeVisible();
  await layoutSelect.selectOption({ label: 'Open Panels Rail' });
  await expect(dock).toHaveAttribute('data-layout', 'rail');
  const windows = dock.getByRole('group', { name: 'Open windows' });
  await windows.getByRole('button', { name: 'Close Settings' }).click();
  await expect(settings).toHaveCount(0);
  await windows.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(chat).toBeVisible();
  await expect(draft).toHaveValue('Keep this draft');

  await dock.getByRole('button', { name: 'Add panel', exact: true }).click();
  const add = dock.getByRole('group', { name: 'Add panel' });
  await expect(
    add.getByRole('button', { name: 'Chat', exact: true }),
  ).toHaveCount(0);
  await add.getByRole('button', { name: 'Dice', exact: true }).click();
  await expect(
    windows.getByRole('button', { name: 'Dice', exact: true }),
  ).toHaveAttribute('aria-current', 'true');
  await windows.getByRole('button', { name: 'Close Dice' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Dice', exact: true }),
  ).toHaveCount(0);

  await page.reload();
  await expect(dock).toHaveAttribute('data-layout', 'rail');
  await dock.getByRole('button', { name: 'Add panel', exact: true }).click();
  await add.getByRole('button', { name: 'Settings', exact: true }).click();
  await layoutSelect.selectOption({ label: 'Favorites Bar' });
  await expect(dock).toHaveAttribute('data-layout', 'favorites');
});
