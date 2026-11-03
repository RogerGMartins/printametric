// Windows-only diagnostic: sum this probe's Chromium processes and controller RSS.
// Shared pages can be counted more than once. Samples are not a transient-peak proof.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

export async function sampleBrowserMemory(cdp) {
  if (process.platform !== 'win32') throw Error('This memory probe requires Windows');
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  const ids = processInfo.map(info => info.id);
  if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw Error('Invalid browser process list');
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$wanted = @(${ids.join(',')}); (Get-Process | Where-Object { $wanted -contains $_.Id } | Measure-Object WorkingSet64 -Sum).Sum`], { timeout: 5000, windowsHide: true });
  const browserBytes = Number(stdout.trim());
  if (!Number.isFinite(browserBytes) || browserBytes <= 0) throw Error('Browser memory measurement unavailable');
  return browserBytes + process.memoryUsage().rss;
}

export function monitorBrowserMemory(cdp, limit, abort, observe = () => {}) {
  let stopped = false, timer, pending = Promise.resolve(), peakBytes = 0, samples = 0, failure;
  function tick() {
    pending = sampleBrowserMemory(cdp).then(bytes => {
      peakBytes = Math.max(peakBytes, bytes); samples++;
      observe(bytes);
      if (bytes > limit) throw Error('Sampled Chromium plus controller RSS exceeds experiment limit');
    }).catch(async error => {
      failure = String(error);
      if (stopped) return;
      stopped = true; await abort();
    }).finally(() => { if (!stopped) timer = setTimeout(tick, 1000); });
  }
  tick();
  return { async stop() {
    stopped = true; clearTimeout(timer); await pending;
    // Include newly retained acceptance/preview buffers even if the job ends
    // between periodic samples. This still cannot prove the transient peak.
    if (!failure) {
      try {
        const bytes = await sampleBrowserMemory(cdp);
        peakBytes = Math.max(peakBytes, bytes); samples++;
        observe(bytes);
        if (bytes > limit) throw Error('Final Chromium plus controller RSS exceeds experiment limit');
      } catch (error) { failure = String(error); await abort(); }
    }
    return { peakBytes, samples, limit, failure,
      method: 'Chromium CDP process IDs, Windows WorkingSet64 sum plus controller RSS; ~1-second sampling, shared pages may be double-counted' };
  } };
}
