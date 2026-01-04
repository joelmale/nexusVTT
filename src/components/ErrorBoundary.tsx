import React from 'react';

interface ErrorLogEntry {
  name?: string;
  message: string;
  stack?: string;
  timestamp: string;
  location?: string;
  userAgent?: string;
  componentStack?: string;
}

const errorLog: ErrorLogEntry[] = [];

const formatErrorReport = (entries: ErrorLogEntry[]) => {
  return [
    `Nexus VTT Error Report`,
    `Generated: ${new Date().toISOString()}`,
    '',
    ...entries.flatMap((entry, index) => [
      `--- Error ${index + 1} ---`,
      `Name: ${entry.name || 'Unknown'}`,
      `Message: ${entry.message}`,
      `Timestamp: ${entry.timestamp}`,
      `URL: ${entry.location || 'Unknown'}`,
      `User Agent: ${entry.userAgent || 'Unknown'}`,
      entry.stack ? `Stack:\n${entry.stack}` : 'Stack: (none)',
      entry.componentStack
        ? `Component Stack:\n${entry.componentStack}`
        : 'Component Stack: (none)',
      '',
    ]),
  ].join('\n');
};

export interface ErrorBoundaryProps {
  name?: string;
  children: React.ReactNode;
  onReset?: () => void;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    errorLog.push({
      name: this.props.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      location: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      componentStack: info.componentStack ?? undefined,
    });
    console.error('UI error boundary caught:', {
      name: this.props.name,
      error,
      info,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return <>{this.props.fallback}</>;
    }

    return (
      <div className="error-boundary">
        <div className="error-boundary__content">
          <div className="error-boundary__title">
            {this.props.name ? `${this.props.name} crashed` : 'Panel crashed'}
          </div>
          <div className="error-boundary__message">
            Try reloading this panel. If it keeps happening, check the console
            logs.
          </div>
          <div className="error-boundary__actions">
            <button
              type="button"
              className="glass-button small"
              onClick={this.handleReset}
            >
              Retry
            </button>
            <button
              type="button"
              className="glass-button small secondary"
              onClick={() => {
                const content = formatErrorReport(errorLog);
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `nexus-error-report-${new Date()
                  .toISOString()
                  .replace(/[:.]/g, '-')}.txt`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
              }}
            >
              Download report
            </button>
          </div>
        </div>
      </div>
    );
  }
}

type SimpleBoundaryProps = {
  children: React.ReactNode;
  onReset?: () => void;
};

export const CanvasErrorBoundary = ({ children, onReset }: SimpleBoundaryProps) => (
  <ErrorBoundary name="Canvas" onReset={onReset}>
    {children}
  </ErrorBoundary>
);

export const TokenErrorBoundary = ({ children, onReset }: SimpleBoundaryProps) => (
  <ErrorBoundary name="Tokens" onReset={onReset}>
    {children}
  </ErrorBoundary>
);

export const SceneErrorBoundary = ({ children, onReset }: SimpleBoundaryProps) => (
  <ErrorBoundary name="Scene" onReset={onReset}>
    {children}
  </ErrorBoundary>
);
