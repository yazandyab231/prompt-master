import { Component, type ReactNode } from 'react';
import { exportData } from '../lib/backup';
import { defaultState, flush, replaceState } from '../lib/store';

/**
 * Last line of defence: if a screen throws, show a way out instead of a blank page.
 * The data is still in storage, so it can be exported before anything is erased.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; confirm: boolean }> {
  state = { error: null as Error | null, confirm: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <main className="screen">
          <header className="masthead">
            <div>
              <span className="label">Logbook</span>
              <h1 className="display">Something broke</h1>
            </div>
          </header>
          <div className="stack">
            <p className="hint">
              The app hit an error it could not recover from. Your data is still stored on this device. Reloading usually fixes it; if it keeps
              happening, export a backup before erasing.
            </p>
            <p className="mono" style={{ wordBreak: 'break-word' }}>
              {String(this.state.error.message).slice(0, 300)}
            </p>
            <button className="btn wide" onClick={() => location.reload()}>
              Reload
            </button>
            <button className="btn ghost wide" onClick={exportData}>
              Export backup
            </button>
            {this.state.confirm ? (
              <div className="btn-row">
                <button className="btn ghost" onClick={() => this.setState({ confirm: false })}>
                  Cancel
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    replaceState(defaultState());
                    flush();
                    setTimeout(() => location.reload(), 200);
                  }}
                >
                  Erase everything
                </button>
              </div>
            ) : (
              <button className="btn quiet" style={{ color: 'var(--danger)', alignSelf: 'flex-start' }} onClick={() => this.setState({ confirm: true })}>
                Erase all data and start again
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }
}
