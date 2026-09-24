/**
 * Vite `base` for the Admin UI: `/` unless ADMIN_UI_BASE says otherwise.
 * Normalized to a leading and trailing slash so asset URLs and the router
 * basename (import.meta.env.BASE_URL) always agree.
 */
export function resolveAdminUiBase(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return '/'
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(trimmed)) {
    throw new Error(`ADMIN_UI_BASE must be a path, not a URL: ${trimmed}`)
  }
  const segments = trimmed.split('/').filter(Boolean)
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`
}
