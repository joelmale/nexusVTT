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

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
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
    </QueryClientProvider>
  )
}

export default App
