// Development-only entry for errors that valid native controls cannot produce.
// Production index.html never imports this file.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../../src/app/App';
import { bootstrapFoundation } from '../../src/app/bootstrap';
import { transitionFoundation } from '../../src/app/state';
import '../../src/styles.css';

const bootstrap = bootstrapFoundation(window);
let state = transitionFoundation(bootstrap.initialState, { type: 'preference', field: 'previewBackground', value: 'grid' });
state = transitionFoundation(state, { type: 'preference', field: 'previewBackground', value: 'invalid' });
state = transitionFoundation(state, { type: 'preference', field: 'showWorkspaceTips', value: 'false' });
state = transitionFoundation(state, { type: 'preference', field: 'themePreference', value: null });
const root = document.getElementById('root');
if (!root) throw new Error('Workspace fixture root is missing.');
const reactRoot = createRoot(root);
reactRoot.render(<StrictMode><App {...bootstrap} initialState={state} /></StrictMode>);

// Test-only lifecycle access lets the browser suite verify actual effect cleanup.
export function unmountWorkspace() {
  reactRoot.unmount();
}
