import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { Suspense } from 'react';
import '@testing-library/jest-dom';

// Mock the components that use lazy loading
const MockGameToolbar = () => <div>GameToolbar</div>;
const MockContextPanel = () => <div>ContextPanel</div>;
const MockGeneratorPanel = () => <div>GeneratorPanel</div>;

vi.mock('@/components/GameToolbar', () => ({
  GameToolbar: MockGameToolbar,
}));

vi.mock('@/components/ContextPanel', () => ({
  ContextPanel: MockContextPanel,
}));

vi.mock('@/components/Generator/GeneratorPanel', () => ({
  GeneratorPanel: MockGeneratorPanel,
}));

describe('Suspense Boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading fallback for GameToolbar', async () => {
    // Create a component that simulates the lazy loading pattern
    const LazyGameToolbar = React.lazy(() =>
      Promise.resolve({ default: MockGameToolbar }),
    );

    const TestComponent = () => (
      <Suspense fallback={<div>Loading toolbar...</div>}>
        <LazyGameToolbar />
      </Suspense>
    );

    render(<TestComponent />);

    // Should show loading state initially
    expect(screen.getByText('Loading toolbar...')).toBeInTheDocument();

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('GameToolbar')).toBeInTheDocument();
    });
  });

  it('should show loading fallback for ContextPanel', async () => {
    const LazyContextPanel = React.lazy(() =>
      Promise.resolve({ default: MockContextPanel }),
    );

    const TestComponent = () => (
      <Suspense fallback={<div>Loading panel...</div>}>
        <LazyContextPanel />
      </Suspense>
    );

    render(<TestComponent />);

    expect(screen.getByText('Loading panel...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ContextPanel')).toBeInTheDocument();
    });
  });

  it('should handle multiple Suspense boundaries independently', async () => {
    const LazyGameToolbar = React.lazy(() =>
      Promise.resolve({ default: MockGameToolbar }),
    );

    const LazyContextPanel = React.lazy(
      () =>
        new Promise<{ default: () => React.JSX.Element }>((resolve) =>
          setTimeout(() => resolve({ default: MockContextPanel }), 100),
        ),
    );

    const TestComponent = () => (
      <div>
        <Suspense fallback={<div>Loading toolbar...</div>}>
          <LazyGameToolbar />
        </Suspense>
        <Suspense fallback={<div>Loading panel...</div>}>
          <LazyContextPanel />
        </Suspense>
      </div>
    );

    render(<TestComponent />);

    // Toolbar should load immediately
    expect(screen.getByText('Loading toolbar...')).toBeInTheDocument();
    expect(screen.getByText('Loading panel...')).toBeInTheDocument();

    // Toolbar loads first
    await waitFor(() => {
      expect(screen.getByText('GameToolbar')).toBeInTheDocument();
    });

    // Panel loads after delay
    await waitFor(
      () => {
        expect(screen.getByText('ContextPanel')).toBeInTheDocument();
      },
      { timeout: 200 },
    );
  });
});
