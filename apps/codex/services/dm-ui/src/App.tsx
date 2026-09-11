import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { CreateCampaignPage } from './pages/CreateCampaignPage';
import { CampaignPage } from './pages/CampaignPage';
import { WorldsPage } from './pages/WorldsPage';
import { SessionsPage } from './pages/SessionsPage';
import { PlotsPage } from './pages/PlotsPage';
import { NPCsPage } from './pages/NPCsPage';
import { EncountersPage } from './pages/EncountersPage';
import { NotesPage } from './pages/NotesPage';
import { JournalsPage} from './pages/JournalsPage';
import { LorePage } from './pages/LorePage';
import { CodexPage } from './pages/CodexPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="campaigns" element={<Navigate to="/" replace />} />
          <Route path="campaigns/new" element={<CreateCampaignPage />} />
          <Route path="campaigns/:campaignId" element={<CampaignPage />} />
          <Route path="campaigns/:campaignId/worlds" element={<WorldsPage />} />
          <Route path="campaigns/:campaignId/sessions" element={<SessionsPage />} />
          <Route path="campaigns/:campaignId/plots" element={<PlotsPage />} />
          <Route path="campaigns/:campaignId/npcs" element={<NPCsPage />} />
          <Route path="campaigns/:campaignId/encounters" element={<EncountersPage />} />
          <Route path="campaigns/:campaignId/notes" element={<NotesPage />} />
          <Route path="campaigns/:campaignId/journals" element={<JournalsPage />} />
          <Route path="campaigns/:campaignId/lore" element={<LorePage />} />
          <Route path="codex" element={<CodexPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
