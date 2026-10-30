// Browser entry point. Keep development tooling outside this import graph.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bootstrapFoundation } from './app/bootstrap';
import { applyColorScheme, effectiveScheme } from './app/theme';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Printametric could not start: the #root element is missing.');
}

const bootstrap = bootstrapFoundation(window);
applyColorScheme(document.documentElement, effectiveScheme(bootstrap.initialState.preferences.themePreference, bootstrap.initialSystemScheme));

createRoot(root).render(
  <StrictMode>
    <App {...bootstrap} />
  </StrictMode>,
);
