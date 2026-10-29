import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CampaignProvider } from './features/campaigns/CampaignProvider';
import { CapabilityNoticeProvider } from './features/capability-notice';
import { MoodProvider } from './features/moods';
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
            <MoodProvider>
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

                <Route
                  path="legacy"
                  element={<Navigate to="/campaigns" replace />}
                />
                <Route
                  path="legacy/*"
                  element={<Navigate to="/campaigns" replace />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MoodProvider>
          </StudioNavigationProvider>
        </CampaignProvider>
      </CapabilityNoticeProvider>
    </BrowserRouter>
  );
}

export default App;
