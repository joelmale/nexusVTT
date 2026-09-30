import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { CampaignProvider } from './features/campaigns/CampaignProvider';
import { CampaignPage } from './pages/CampaignPage';
import { CodexPage } from './pages/CodexPage';
import { CreateCampaignPage } from './pages/CreateCampaignPage';
import { HomePage } from './pages/HomePage';
import { SessionsPage } from './pages/SessionsPage';
import { WorldsPage } from './pages/WorldsPage';
import { CapabilityNoticeProvider } from './features/capability-notice';
import { StudioNavigationProvider } from './features/studio-shell/StudioNavigationProvider';
import { CampaignOverviewRoute } from './routes/CampaignOverviewRoute';
import { CampaignLandingRoute } from './routes/CampaignLandingRoute';
import { CampaignRootRoute } from './routes/CampaignRootRoute';
import { DemoCampaignOverviewRoute } from './routes/DemoCampaignOverviewRoute';
import {
  LEGACY_REDIRECTS,
  SECTION_ROUTES,
  SECTION_ROUTE_PREFIXES,
} from './routes/sectionRoutes';

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
              {SECTION_ROUTE_PREFIXES.flatMap((prefix) =>
                SECTION_ROUTES.map((route) => (
                  <Route
                    key={`${prefix}/${route.path}`}
                    path={`${prefix}/${route.path}`}
                    element={route.element}
                  />
                )),
              )}
              {LEGACY_REDIRECTS.map((redirect) => (
                <Route
                  key={redirect.from}
                  path={redirect.from}
                  element={<Navigate to={redirect.to} replace />}
                />
              ))}

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
