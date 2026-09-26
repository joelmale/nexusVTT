const resolveProductUrl = (
  configuredUrl: string,
  childPath = '',
  defaultBasePath = '/',
): string => {
  if (typeof window === 'undefined') {
    const configuredBase =
      configuredUrl === '/' ? defaultBasePath : configuredUrl;
    const base = configuredBase.endsWith('/')
      ? configuredBase
      : `${configuredBase}/`;
    return childPath ? `${base}${childPath}` : base;
  }

  const baseUrl = new URL(configuredUrl, window.location.href);
  if (baseUrl.pathname === '/') {
    baseUrl.pathname = defaultBasePath;
  }
  if (!baseUrl.pathname.endsWith('/')) {
    baseUrl.pathname = `${baseUrl.pathname}/`;
  }

  return childPath
    ? new URL(childPath, baseUrl).toString()
    : baseUrl.toString();
};

export const getCampaignStudioUrl = (): string =>
  resolveProductUrl(
    import.meta.env.VITE_CODEX_DM_URL ||
      import.meta.env.VITE_CODEX_URL ||
      (import.meta.env.DEV ? 'http://localhost:3003' : '/codex-dm/'),
    '',
    '/codex-dm/',
  );

export const getCharacterForgeUrl = (): string =>
  resolveProductUrl(
    import.meta.env.VITE_FORGE_URL ||
      (import.meta.env.DEV ? 'http://localhost:3000' : '/forge/'),
    'character-creator',
    '/forge/',
  );
