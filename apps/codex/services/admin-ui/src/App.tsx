import { BrowserRouter as Router, Navigate, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Processing from './pages/Processing'
import Search from './pages/Search'
import Deduplication from './pages/Deduplication'
import DataQuality from './pages/DataQuality'
import BulkUpload from './pages/BulkUpload'
import ElasticSearch from './pages/ElasticSearch'
import Operations from './pages/Operations'
import Reader from './pages/Reader'
import Logs from './pages/Logs'
import Audit from './pages/Audit'
import Administrators from './pages/Administrators'
import AssetsList from './pages/assets/AssetsList'
import AssetDetail from './pages/assets/AssetDetail'
import AssetUpload from './pages/assets/AssetUpload'
import AssetJobs from './pages/assets/AssetJobs'
import RulesList from './pages/rules/RulesList'
import RuleCreate from './pages/rules/RuleCreate'
import RuleEditor from './pages/rules/RuleEditor'
import { RequirePermission } from './components/common'
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
              {/* Documents (Codex) */}
              <Route path="/" element={<RequirePermission action="viewDocuments"><Dashboard /></RequirePermission>} />
              <Route path="/documents" element={<RequirePermission action="viewDocuments"><Documents /></RequirePermission>} />
              <Route path="/processing" element={<RequirePermission action="viewDocuments"><Processing /></RequirePermission>} />
              <Route path="/search" element={<RequirePermission action="viewDocuments"><Search /></RequirePermission>} />
              <Route path="/deduplication" element={<RequirePermission action="viewDocuments"><Deduplication /></RequirePermission>} />
              <Route path="/data-quality" element={<RequirePermission action="viewDocuments"><DataQuality /></RequirePermission>} />
              <Route path="/bulk-upload" element={<RequirePermission action="viewDocuments"><BulkUpload /></RequirePermission>} />
              <Route path="/elasticsearch" element={<RequirePermission action="viewDocuments"><ElasticSearch /></RequirePermission>} />
              <Route path="/logs" element={<RequirePermission action="viewDocuments"><Logs /></RequirePermission>} />
              <Route path="/reader/:id" element={<RequirePermission action="viewDocuments"><Reader /></RequirePermission>} />
              {/* Rules registry */}
              <Route path="/rules" element={<RequirePermission action="viewRules"><RulesList /></RequirePermission>} />
              <Route path="/rules/new" element={<RequirePermission action="editRules"><RuleCreate /></RequirePermission>} />
              <Route path="/rules/:id" element={<RequirePermission action="viewRules"><RuleEditor /></RequirePermission>} />
              {/* Assets */}
              <Route path="/assets" element={<RequirePermission action="viewAssets"><AssetsList /></RequirePermission>} />
              <Route path="/assets/upload" element={<RequirePermission action="editAssets"><AssetUpload /></RequirePermission>} />
              <Route path="/assets/jobs" element={<RequirePermission action="viewAssets"><AssetJobs /></RequirePermission>} />
              <Route path="/assets/:id" element={<RequirePermission action="viewAssets"><AssetDetail /></RequirePermission>} />
              {/* Operations, audit, administrators */}
              <Route path="/operations" element={<RequirePermission action="viewOperations"><Operations /></RequirePermission>} />
              <Route path="/health" element={<Navigate to="/operations" replace />} />
              <Route path="/audit" element={<RequirePermission action="viewAudit"><Audit /></RequirePermission>} />
              <Route path="/administrators" element={<RequirePermission action="manageAdmins"><Administrators /></RequirePermission>} />
            </Routes>
          </Layout>
        </Router>
      </AuthGate>
    </QueryClientProvider>
  )
}

export default App
