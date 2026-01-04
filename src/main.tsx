// Import self-hosted fonts (critical weights only)
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/600.css'; // Semi-bold
import '@fontsource/inter/700.css'; // Bold

import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Providers } from './components/Providers';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LinearWelcomePage } from './components/LinearWelcomePage';
import { PlayerSetupPage } from './components/PlayerSetupPage';
import { DMSetupPage } from './components/DMSetupPage';
import { LinearGameLayout } from './components/LinearGameLayout';

// Lazy load heavy components
const Dashboard = React.lazy(() =>
  import('./components/Dashboard').then((module) => ({
    default: module.Dashboard,
  })),
);
const AdminPage = React.lazy(() =>
  import('./components/AdminPage').then((module) => ({
    default: module.AdminPage,
  })),
);
import './styles/critical-bundle.css';
import './styles/utilities.css';
import './styles/accessibility.css';
import './styles/spell-overlays.css';
import './styles/spell-overlay-properties.css';
import {
  logCSSLoadingReport,
  getCSSLoadStats,
  getCSSQueueStatus,
} from './utils/cssLoader';
import { initializeTheme } from './utils/themeManager';
import { propAssetManager } from './services/propAssets';

// Load non-critical assets after initial render for better performance
const loadNonCriticalAssets = async () => {
  try {
    // Initialize theme system (loads appropriate theme styles)
    await initializeTheme();

    // Initialize prop asset manager
    await propAssetManager.initialize();
    console.log('🎭 Props: Asset manager initialized');

    console.debug('✅ Non-critical assets loaded successfully');
  } catch (error) {
    console.warn('⚠️ Failed to load some non-critical assets:', error);
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Providers>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/lobby" replace />} />

          {/* Lobby routes - linear flow for creating/joining games */}
          <Route path="/lobby" element={<LinearWelcomePage />} />
          <Route path="/lobby/player-setup" element={<PlayerSetupPage />} />
          <Route path="/lobby/dm-setup" element={<DMSetupPage />} />
          <Route
            path="/lobby/game/:roomCode"
            element={
              <ProtectedRoute requireUser requireSession>
                <LinearGameLayout />
              </ProtectedRoute>
            }
          />

          {/* User dashboard (authenticated users) */}
          <Route
            path="/dashboard"
            element={
              <Suspense
                fallback={
                  <div className="loading-spinner">Loading dashboard...</div>
                }
              >
                <Dashboard />
              </Suspense>
            }
          />

          {/* Admin panel (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <Route
              path="/admin"
              element={
                <Suspense
                  fallback={
                    <div className="loading-spinner">Loading admin...</div>
                  }
                >
                  <AdminPage />
                </Suspense>
              }
            />
          )}

          {/* Fallback - redirect unknown routes to lobby */}
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </Providers>
      <Toaster />
    </BrowserRouter>
  </React.StrictMode>,
);

// Load non-critical assets after initial render
loadNonCriticalAssets();

// Register service worker for PWA support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        console.log('🔄 New content available! Please refresh.');
        // You could show a toast notification here
      },
      onOfflineReady() {
        console.log('✅ App ready to work offline!');
      },
      onRegistered(registration) {
        console.log('✅ Service Worker registered:', registration);
      },
      onRegisterError(error) {
        console.error('❌ Service Worker registration failed:', error);
      },
    });
  });
}

// Add CSS debugging utilities to window for development
if (import.meta.env.DEV) {
  interface CssDebug {
    logReport: () => void;
    getStats: () => void;
    getQueueStatus: () => void;
  }

  (window as Window & typeof globalThis & { cssDebug: CssDebug }).cssDebug = {
    logReport: logCSSLoadingReport,
    getStats: getCSSLoadStats,
    getQueueStatus: getCSSQueueStatus,
  };
}
