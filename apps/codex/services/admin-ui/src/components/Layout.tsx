import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import CommandPalette from './CommandPalette'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const kibanaUrl = import.meta.env.VITE_KIBANA_URL as string | undefined

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/documents', label: 'Documents' },
    { path: '/bulk-upload', label: 'Bulk Upload' },
    { path: '/processing', label: 'Processing' },
    { path: '/search', label: 'Search' },
    { path: '/deduplication', label: 'Deduplication' },
    { path: '/data-quality', label: 'Data Quality' },
    { path: '/elasticsearch', label: 'ElasticSearch' },
    { path: '/health', label: 'Health' },
    { path: '/logs', label: 'Logs' },
    ...(kibanaUrl ? [{ path: kibanaUrl, label: 'Kibana', external: true }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">NexusCodex Admin</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  item.external ? (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`${
                        location.pathname === item.path
                          ? 'border-indigo-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                    >
                      {item.label}
                    </Link>
                  )
                ))}
              </div>
            </div>
            <div className="hidden sm:flex items-center">
              <button
                onClick={() => setPaletteOpen(true)}
                className="px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-500 hover:text-slate-800"
              >
                Cmd/Ctrl + K
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
