import { createContext, useContext } from 'react'
import type { Me } from '@/lib/api'
import { ACTION_PERMISSIONS, hasAnyPermission, type AdminAction } from './permissions'

export interface AuthContextValue {
  me: Me
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** The signed-in administrator. Only valid below <AuthGate>. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthGate>')
  return value
}

/** UI hint: whether the signed-in administrator may perform `action`. */
export function useCan(action: AdminAction): boolean {
  const { me } = useAuth()
  return hasAnyPermission(me.permissions, ACTION_PERMISSIONS[action])
}
