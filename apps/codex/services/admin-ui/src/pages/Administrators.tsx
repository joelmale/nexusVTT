import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ADMIN_ROLES,
  grantRole,
  listAdministrators,
  revokeRole,
  type AdminRole,
} from '@/lib/controlPlaneApi'
import { ApiError } from '@/lib/api'
import { ErrorNotice, PageHeader, Pill, Section } from '@/components/common'
import { buttonClass, formatDate, inputClass } from '@/lib/ui'

const ERROR_TEXT: Record<string, string> = {
  user_not_found: 'No Nexus user signed in with Google has that email. They must sign in to Nexus VTT with Google first.',
  already_granted: 'That user already has this role.',
  role_not_active: 'That role is no longer active for this user.',
  last_platform_admin: 'The last platform_admin cannot be removed.',
}

function friendly(error: unknown): unknown {
  if (error instanceof ApiError && error.code && ERROR_TEXT[error.code]) {
    return new Error(ERROR_TEXT[error.code])
  }
  return error
}

/** Grant and revoke admin roles. Both need a recent Google sign-in. */
export default function Administrators() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('auditor')
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const admins = useQuery({ queryKey: ['administrators'], queryFn: listAdministrators })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['administrators'] })

  const grant = useMutation({
    mutationFn: () => grantRole(email.trim(), role),
    onSuccess: () => {
      setNotice(`Granted ${role} to ${email.trim()}.`)
      setEmail('')
      void refresh()
    },
  })
  const revoke = useMutation({
    mutationFn: ({ userId, role: revoked }: { userId: string; role: AdminRole }) => revokeRole(userId, revoked),
    onSuccess: (_result, variables) => {
      setConfirmRevoke(null)
      setNotice(`Revoked ${variables.role}.`)
      void refresh()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setNotice(null)
    grant.mutate()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <PageHeader
        title="Administrators"
        description="Role changes require a Google sign-in within the last 10 minutes and are audited."
      />
      {notice && (
        <p role="status" className="text-sm text-blue-800">
          {notice}
        </p>
      )}

      <Section title="Grant a role">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Grant a role">
          <label className="flex-1 space-y-1 text-sm">
            <span className="block font-medium text-gray-700">Google email</span>
            <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium text-gray-700">Role</span>
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {ADMIN_ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass.primary} disabled={!email.trim() || grant.isPending}>
            {grant.isPending ? 'Granting...' : 'Grant'}
          </button>
        </form>
        <div className="mt-2">
          <ErrorNotice error={friendly(grant.error)} />
        </div>
      </Section>

      <Section title="Current administrators">
        <ErrorNotice error={admins.error} />
        <ErrorNotice error={friendly(revoke.error)} />
        {admins.data && admins.data.length === 0 && <p className="text-sm text-gray-500">No administrators.</p>}
        <ul className="divide-y divide-gray-100">
          {admins.data?.map((admin) => (
            <li key={admin.userId} className="py-3">
              <div className="font-medium text-gray-900">
                {admin.displayName || admin.name || admin.email}
                {!admin.isActive && (
                  <span className="ml-2">
                    <Pill tone="red">inactive user</Pill>
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">{admin.email}</div>
              <ul className="mt-1 flex flex-wrap gap-2">
                {admin.roles.map((grantRecord) => {
                  const key = `${admin.userId}:${grantRecord.role}`
                  return (
                    <li key={key} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 text-xs">
                      <Pill tone="purple">{grantRecord.role}</Pill>
                      <span className="text-gray-500">since {formatDate(grantRecord.grantedAt)}</span>
                      {confirmRevoke === key ? (
                        <>
                          <button
                            className="font-medium text-red-700"
                            disabled={revoke.isPending}
                            onClick={() => revoke.mutate({ userId: admin.userId, role: grantRecord.role })}
                          >
                            Confirm revoke
                          </button>
                          <button className="text-gray-600" onClick={() => setConfirmRevoke(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="text-red-700 hover:text-red-900" onClick={() => setConfirmRevoke(key)}>
                          Revoke
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
