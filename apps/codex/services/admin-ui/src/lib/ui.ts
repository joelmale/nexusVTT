import { ApiError, isReauthRequired } from './api'

/** Human-readable text for a failed request. */
export function errorText(error: unknown): string {
  if (isReauthRequired(error)) {
    return 'This action needs a fresh sign-in. Redirecting you to Google; you will return here afterwards.'
  }
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} (request ${error.requestId})` : error.message
  }
  return error instanceof Error ? error.message : 'Request failed'
}

export const buttonClass = {
  primary:
    'inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50',
} as const

export const inputClass =
  'block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100'

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
