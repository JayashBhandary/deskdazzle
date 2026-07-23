import React from 'react';
import { trackEvent } from '../firebaseConfig';
import { logger } from '../lib/logger';

// Class component (React error boundaries must be classes). Catches render/
// lifecycle errors in its subtree so one broken tool can't blank the whole app.
// `label` names the boundary for telemetry; `fallback` optionally overrides UI.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Consent-gated telemetry (trackEvent no-ops without opt-in). Keep the
    // payload small — no PII, just where and what.
    trackEvent('error_boundary', {
      boundary: this.props.label || 'app',
      message: String(error?.message || error).slice(0, 200),
    });
    // Surface in the console for local debugging.
    logger.error(`[ErrorBoundary:${this.props.label || 'app'}]`, error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return (
      <div
        role="alert"
        className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center"
      >
        <span className="text-3xl" aria-hidden="true">💥</span>
        <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.props.label ? `The "${this.props.label}" view hit an error.` : 'This part of the app hit an error.'}{' '}
          Your saved data is safe. Try again, or reload the page.
        </p>
        {this.state.error?.message && (
          <details className="max-w-md text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">Error details</summary>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-left text-xs whitespace-pre-wrap break-all">
              {String(this.state.error.message)}
              {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
