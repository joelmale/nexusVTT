import React from 'react';

interface LoadingScreenProps {
  /** Text shown beneath the spinner. */
  message?: string;
}

/**
 * Full-screen, centered loading state used for route-level Suspense fallbacks.
 *
 * Note: the `.loading-spinner` element spins; the label is a separate sibling so
 * the text stays upright and readable (previously the whole fallback div carried
 * the spinner class, which rotated the words and pinned them to the top-left).
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading…',
}) => (
  <div className="loading-screen" role="status" aria-live="polite">
    <span className="loading-spinner" aria-hidden="true" />
    <span className="loading-screen__label">{message}</span>
  </div>
);

export default LoadingScreen;
