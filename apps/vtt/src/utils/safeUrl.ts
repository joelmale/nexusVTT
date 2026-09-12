const ALLOWED_SCHEMES = ['https:', 'http:', 'data:', 'blob:'];

export function safeImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/') || url.startsWith('.')) return url;
  try {
    const { protocol } = new URL(url);
    return ALLOWED_SCHEMES.includes(protocol) ? url : '';
  } catch {
    return '';
  }
}
