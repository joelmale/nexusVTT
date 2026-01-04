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
  onError?: (error: Error, info: React.ErrorInfo) => void;
  title?: string;
  icon?: string;
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
    if (this.props.onError) {
      this.props.onError(error, info);
    }
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

    const title =
      this.props.title ||
      (this.props.name ? `${this.props.name} Error` : 'Something went wrong');
    const showDetails =
      process.env.NODE_ENV === 'development' && this.state.error;

    return (
      <div className="error-boundary">
        <div className="error-boundary__content">
          <div className="error-boundary__title">
            {this.props.icon ? (
              <span className="error-boundary__icon">{this.props.icon}</span>
            ) : null}
            {title}
          </div>
          <div className="error-boundary__message">
            An error occurred while rendering this component.
          </div>
          {showDetails ? (
            <div className="error-boundary__details">
              {this.state.error?.message}
            </div>
          ) : null}
          <div className="error-boundary__actions">
            <button
              type="button"
              className="glass-button small"
              onClick={this.handleReset}
            >
              Try Again
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
  <ErrorBoundary name="Canvas" title="Canvas Error" icon="🎨" onReset={onReset}>
    {children}
  </ErrorBoundary>
);

export const TokenErrorBoundary = ({ children, onReset }: SimpleBoundaryProps) => (
  <ErrorBoundary name="Tokens" title="Token Error" icon="⚔️" onReset={onReset}>
    {children}
  </ErrorBoundary>
);

export const SceneErrorBoundary = ({ children, onReset }: SimpleBoundaryProps) => (
  <ErrorBoundary name="Scene" title="Scene Error" icon="🎭" onReset={onReset}>
    {children}
  </ErrorBoundary>
);
