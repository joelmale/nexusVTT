import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CommandPalette from './CommandPalette'
import UserMenu from './UserMenu'
import { useAuth } from '@/auth/AuthContext'
import { visibleNavGroups, activeNavGroup } from './navigation'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { me } = useAuth()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const kibanaUrl = import.meta.env.VITE_KIBANA_URL as string | undefined
  const groups = visibleNavGroups(me.permissions)
  const active = activeNavGroup(groups, location.pathname)
  const canSearchCodex = me.permissions.includes('codex:read')

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (canSearchCodex && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [canSearchCodex])

  const subItems = [
    ...(active?.items ?? []),
    ...(active?.id === 'documents' && kibanaUrl ? [{ path: kibanaUrl, label: 'Kibana', external: true }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b" aria-label="Main">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-gray-900">Nexus Admin</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-6">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    to={group.items[0].path}
                    aria-current={active?.id === group.id ? 'page' : undefined}
                    className={`${
                      active?.id === group.id
                        ? 'border-indigo-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {group.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {canSearchCodex && (
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="hidden sm:inline-block px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-500 hover:text-slate-800"
                >
                  Cmd/Ctrl + K
                </button>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
        {subItems.length > 1 && (
          <div className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap gap-4 py-2" aria-label={`${active?.label} pages`}>
              {subItems.map((item) =>
                'external' in item && item.external ? (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-800"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`text-sm ${
                      location.pathname === item.path ? 'font-medium text-indigo-700' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        )}
        {/* Small screens: every visible group and page in one list. */}
        <div className="sm:hidden border-t border-gray-100 px-4 py-2 flex flex-wrap gap-3">
          {groups.flatMap((group) => group.items).map((item) => (
            <Link key={item.path} to={item.path} className="text-sm text-gray-600">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main>{children}</main>
      {canSearchCodex && <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
