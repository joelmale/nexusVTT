import type { Locator, Page } from '@playwright/test';

export function panelsDock(page: Page): Locator {
  return page.getByRole('group', { name: 'Panels', exact: true });
}

export async function favoriteOrListedPanel(
  page: Page,
  name: string,
): Promise<Locator> {
  const dock = panelsDock(page);
  const favorite = dock
    .getByRole('group', { name: 'Favorite panels' })
    .getByRole('button', { name, exact: true });
  if (await favorite.count()) return favorite;

  const directory = dock.locator('[popover]:popover-open').getByRole('group', {
    name: 'All panels',
    exact: true,
  });
  if (!(await directory.count())) {
    await dock.getByRole('button', { name: 'All panels', exact: true }).click();
  }
  return directory.getByRole('button', { name, exact: true });
}
