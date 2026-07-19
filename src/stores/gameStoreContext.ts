export interface GameStoreContext {
  userId: string;
  isAuthenticated: boolean;
}

let readContext = (): GameStoreContext => ({
  userId: '',
  isAuthenticated: false,
});

export function configureGameStoreContext(
  reader: () => GameStoreContext,
): void {
  readContext = reader;
}

export function getGameStoreContext(): GameStoreContext {
  return readContext();
}
