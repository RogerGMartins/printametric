import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Node-only build configuration; application code never imports this module.
export default defineConfig({
  // Large generated CAD evidence and browser reports do not need hot reload.
  server: { watch: { ignored: ['**/artifacts/**', '**/playwright-report/**'] } },
  worker: { format: 'es' },
  plugins: [react()],
});
