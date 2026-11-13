import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { loadState } from './lib/store';

void loadState().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
});

// The service worker gives offline use and push. Skipped in dev so it never caches hot-reload modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    // On a first visit the page's own files were fetched before the worker took control, so they
    // are not cached yet. Tell the worker what this page loaded so the next launch works offline.
    // Fonts are requested only once text has rendered, so wait for them before taking the list.
    const settled = new Promise((r) => setTimeout(r, 1200)).then(() => document.fonts.ready);
    void Promise.all([navigator.serviceWorker.ready, settled]).then(([reg]) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin) && !u.includes('/ocr/') && !u.includes('/api/'));
      reg.active?.postMessage({ type: 'precache', urls: [location.origin + '/', ...urls] });
    });
  });
}
