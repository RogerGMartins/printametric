import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Node-only build configuration; application code never imports this module.
export default defineConfig({
  plugins: [react()],
});
