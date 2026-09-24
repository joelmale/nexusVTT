import type { ReactNode } from 'react'
import { useCan } from '@/auth/AuthContext'
import { permissionHint, type AdminAction } from '@/auth/permissions'
import { isReauthRequired } from '@/lib/api'
import { errorText } from '@/lib/ui'

/**
 * Renders `children` only when the administrator holds the permission for
 * `action`, so pages never issue requests control-api would deny. A UI hint:
 * control-api still decides every request.
 */
export function RequirePermission({ action, children }: { action: AdminAction; children: ReactNode }) {
  const allowed = useCan(action)
  if (!allowed) {
    return (
      <div className="p-6">
        <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="note">
          <p className="font-medium">You do not have access to this page.</p>
          <p className="mt-1">{permissionHint(action)}.</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/** Inline error for a failed request; step-up re-authentication gets its own wording. */
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  const reauth = isReauthRequired(error)
  return (
    <div
      role="alert"
      className={
        reauth
          ? 'rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900'
          : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
      }
    >
      {errorText(error)}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

const TONES = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
} as const

export type Tone = keyof typeof TONES

export function Pill({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}
