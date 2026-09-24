import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'

/** Signed-in administrator, their roles, and Sign out. */
export default function UserMenu() {
  const { me, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setSigningOut(true)
    setError(null)
    try {
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed')
      setSigningOut(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="text-right">
        <div className="font-medium text-gray-900" data-testid="admin-user">
          {me.user.displayName || me.user.name || me.user.email}
        </div>
        <div className="text-xs text-gray-500" data-testid="admin-roles">
          {me.roles.length > 0 ? me.roles.join(', ') : 'no roles'}
        </div>
      </div>
      <button
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="px-3 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {signingOut ? 'Signing out...' : 'Sign out'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
