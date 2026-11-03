// Isolated synthetic geometry worker; excluded from the application entry graph.
import { runNativeBatch, batchTransfers } from '../../support/layout-batch.mjs';
self.onmessage = async ({ data }) => {
  try { const batch = await runNativeBatch(data); self.postMessage(batch, batchTransfers(batch)); }
  catch (error) { self.postMessage({ error: String(error) }); }
};
