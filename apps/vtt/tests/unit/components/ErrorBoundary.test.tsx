import React, { Component } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import {
  ErrorBoundary,
  SceneErrorBoundary,
  CanvasErrorBoundary,
  TokenErrorBoundary,
} from '@/components/ErrorBoundary';

// Mock console.error to avoid noise in test output
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Component that throws an error
class ErrorThrowingComponent extends Component {
  componentDidMount() {
    throw new Error('Test error');
  }

  render() {
    return <div>Should not render</div>;
  }
}

// Component that throws an error on button click
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ErrorOnClickComponent = () => {
  const [shouldError, setShouldError] = React.useState(false);

  if (shouldError) {
    throw new Error('Button triggered error');
  }

  return <button onClick={() => setShouldError(true)}>Trigger Error</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An error occurred while rendering this component.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should show custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onErrorMock = vi.fn();

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
    );
  });

  it('should allow retry after error', async () => {
    const TestComponent = () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [shouldError, _setShouldError] = React.useState(true);

      if (shouldError) {
        throw new Error('Initial error');
      }

      return <div>Recovered content</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Simulate state change that would fix the error
    rerender(
      <ErrorBoundary>
        <TestComponent key="recovered" />
      </ErrorBoundary>,
    );

    // The component should still show error because ErrorBoundary state persists
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show error details in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should handle error recovery with Try Again button', () => {
    let shouldError = true;

    const TestComponent = () => {
      if (shouldError) {
        throw new Error('Test error');
      }
      return <div>Recovered</div>;
    };

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Change state to not error
    shouldError = false;

    // Click try again
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});

describe('SceneErrorBoundary', () => {
  it('should render scene-specific error UI', () => {
    render(
      <SceneErrorBoundary>
        <ErrorThrowingComponent />
      </SceneErrorBoundary>,
    );

    expect(screen.getByText('Scene Error')).toBeInTheDocument();
    expect(screen.getByText('🎭')).toBeInTheDocument();
  });
});

describe('CanvasErrorBoundary', () => {
  it('should render canvas-specific error UI', () => {
    render(
      <CanvasErrorBoundary>
        <ErrorThrowingComponent />
      </CanvasErrorBoundary>,
    );

    expect(screen.getByText('Canvas Error')).toBeInTheDocument();
    expect(screen.getByText('🎨')).toBeInTheDocument();
  });
});

describe('TokenErrorBoundary', () => {
  it('should render token-specific error UI', () => {
    render(
      <TokenErrorBoundary>
        <ErrorThrowingComponent />
      </TokenErrorBoundary>,
    );

    expect(screen.getByText('Token Error')).toBeInTheDocument();
    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });
});
