import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ApiError,
  LOGIN_PATH,
  loadMe,
  logout,
  onPermissionDenied,
  type Me,
} from '@/lib/api'
import { AuthContext, type AuthContextValue } from './AuthContext'

type GateState =
  | { status: 'loading' }
  | { status: 'redirecting' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'signed-out' }
  | { status: 'signed-in'; me: Me }

function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-4" role="status">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {children}
      </div>
    </div>
  )
}

/**
 * Loads `GET /control-api/v1/me` before rendering anything else. Children see
 * the administrator through `useAuth()`. A missing session is redirected to
 * the login flow by the API client.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'loading' })
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const me = await loadMe()
      setState({ status: 'signed-in', me })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: 'redirecting' })
      } else if (error instanceof ApiError && error.status === 403) {
        setState({ status: 'forbidden' })
      } else {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load your admin session',
        })
      }
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => onPermissionDenied(setNotice), [])

  const signOut = useCallback(async () => {
    await logout()
    setNotice(null)
    setState({ status: 'signed-out' })
  }, [])

  const value = useMemo<AuthContextValue | null>(
    () => (state.status === 'signed-in' ? { me: state.me, signOut } : null),
    [state, signOut],
  )

  switch (state.status) {
    case 'loading':
      return <Screen title="Checking your admin session..." />
    case 'redirecting':
      return <Screen title="Redirecting to sign in..." />
    case 'forbidden':
      return (
        <Screen title="No admin access">
          <p className="text-sm text-gray-600">
            Your account is signed in but has no active admin role. Ask a platform
            administrator to grant one.
          </p>
        </Screen>
      )
    case 'error':
      return (
        <Screen title="Admin session unavailable">
          <p className="text-sm text-red-600">{state.message}</p>
          <button
            onClick={() => void load()}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Retry
          </button>
        </Screen>
      )
    case 'signed-out':
      return (
        <Screen title="You have signed out">
          <a href={LOGIN_PATH} className="text-blue-600 hover:text-blue-800">
            Sign in again
          </a>
        </Screen>
      )
    case 'signed-in':
      return (
        <AuthContext.Provider value={value}>
          {notice && (
            <div
              role="alert"
              className="bg-red-50 border-b border-red-200 text-red-800 text-sm px-4 py-2 flex justify-between items-center"
            >
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} className="text-red-700 hover:text-red-900">
                Dismiss
              </button>
            </div>
          )}
          {children}
        </AuthContext.Provider>
      )
  }
}
