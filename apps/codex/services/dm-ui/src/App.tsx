import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { CampaignProvider } from './features/campaigns/CampaignProvider';
import { CampaignPage } from './pages/CampaignPage';
import { CodexPage } from './pages/CodexPage';
import { CreateCampaignPage } from './pages/CreateCampaignPage';
import { EncountersPage } from './pages/EncountersPage';
import { HomePage } from './pages/HomePage';
import { JournalsPage } from './pages/JournalsPage';
import { LorePage } from './pages/LorePage';
import { NotesPage } from './pages/NotesPage';
import { NPCsPage } from './pages/NPCsPage';
import { PlotsPage } from './pages/PlotsPage';
import { SessionsPage } from './pages/SessionsPage';
import { WorldsPage } from './pages/WorldsPage';
import { CapabilityNoticeProvider } from './features/capability-notice';
import { StudioNavigationProvider } from './features/studio-shell/StudioNavigationProvider';
import { CampaignOverviewRoute } from './routes/CampaignOverviewRoute';
import { CampaignLandingRoute } from './routes/CampaignLandingRoute';
import { CampaignRootRoute } from './routes/CampaignRootRoute';
import { DemoCampaignOverviewRoute } from './routes/DemoCampaignOverviewRoute';
import { MapPreparationRoute } from './routes/MapPreparationRoute';
import { SessionPlanRoute } from './routes/SessionPlanRoute';

const basename = import.meta.env.BASE_URL || '/codex-dm/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      <CapabilityNoticeProvider>
        <CampaignProvider>
          <StudioNavigationProvider>
            <Routes>
              <Route path="/" element={<CampaignRootRoute />} />
              <Route path="campaigns" element={<CampaignLandingRoute />} />
              <Route
                path="campaigns/:campaignId/overview"
                element={<CampaignOverviewRoute />}
              />
              <Route
                path="demo/:fixtureSlug/overview"
                element={<DemoCampaignOverviewRoute />}
              />
              <Route
                path="demo/ashes-of-veyra/sessions/session-12"
                element={<SessionPlanRoute />}
              />
              <Route
                path="demo/ashes-of-veyra/maps/glass-harbor"
                element={<MapPreparationRoute />}
              />
              <Route
                path="campaigns/ashes-of-veyra/overview"
                element={
                  <Navigate to="/demo/ashes-of-veyra/overview" replace />
                }
              />
              <Route
                path="campaigns/ashes-of-veyra/sessions/session-12"
                element={
                  <Navigate
                    to="/demo/ashes-of-veyra/sessions/session-12"
                    replace
                  />
                }
              />
              <Route
                path="campaigns/ashes-of-veyra/maps/glass-harbor"
                element={
                  <Navigate
                    to="/demo/ashes-of-veyra/maps/glass-harbor"
                    replace
                  />
                }
              />

              <Route path="legacy" element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route
                  path="campaigns"
                  element={<Navigate to="/legacy" replace />}
                />
                <Route path="campaigns/new" element={<CreateCampaignPage />} />
                <Route
                  path="campaigns/:campaignId"
                  element={<CampaignPage />}
                />
                <Route
                  path="campaigns/:campaignId/worlds"
                  element={<WorldsPage />}
                />
                <Route
                  path="campaigns/:campaignId/sessions"
                  element={<SessionsPage />}
                />
                <Route
                  path="campaigns/:campaignId/plots"
                  element={<PlotsPage />}
                />
                <Route
                  path="campaigns/:campaignId/npcs"
                  element={<NPCsPage />}
                />
                <Route
                  path="campaigns/:campaignId/encounters"
                  element={<EncountersPage />}
                />
                <Route
                  path="campaigns/:campaignId/notes"
                  element={<NotesPage />}
                />
                <Route
                  path="campaigns/:campaignId/journals"
                  element={<JournalsPage />}
                />
                <Route
                  path="campaigns/:campaignId/lore"
                  element={<LorePage />}
                />
                <Route path="codex" element={<CodexPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </StudioNavigationProvider>
        </CampaignProvider>
      </CapabilityNoticeProvider>
    </BrowserRouter>
  );
}

export default App;
