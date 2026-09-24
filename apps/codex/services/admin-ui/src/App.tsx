import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Processing from './pages/Processing'
import Search from './pages/Search'
import Deduplication from './pages/Deduplication'
import DataQuality from './pages/DataQuality'
import BulkUpload from './pages/BulkUpload'
import ElasticSearch from './pages/ElasticSearch'
import Health from './pages/Health'
import Reader from './pages/Reader'
import Logs from './pages/Logs'
import Layout from './components/Layout'
import AuthGate from './auth/AuthGate'
import { ApiError } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 is already redirecting and a 403 will not change on retry.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && (error.status === 401 || error.status === 403)) &&
        failureCount < 3,
    },
  },
})

// Follows Vite's `base` (ADMIN_UI_BASE at build time, `/` by default).
const basename = import.meta.env.BASE_URL

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Router basename={basename}>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/processing" element={<Processing />} />
              <Route path="/search" element={<Search />} />
              <Route path="/deduplication" element={<Deduplication />} />
              <Route path="/data-quality" element={<DataQuality />} />
              <Route path="/bulk-upload" element={<BulkUpload />} />
              <Route path="/elasticsearch" element={<ElasticSearch />} />
              <Route path="/health" element={<Health />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/reader/:id" element={<Reader />} />
            </Routes>
          </Layout>
        </Router>
      </AuthGate>
    </QueryClientProvider>
  )
}

export default App
