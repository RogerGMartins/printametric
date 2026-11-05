/** Opt-in Windows gate wrapper. Keep this verification process and display awake
 * so Modern Standby cannot turn elapsed-time checks into idle-sleep failures.
 * The request belongs to the PowerShell thread and ends on cleanup or its exit;
 * no persistent power setting, test deadline or CI behavior is changed. */
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') throw new Error('check:awake requires Windows. Use npm run check on this platform.');

const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CheckAwake {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@
# ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED.
$previous = [CheckAwake]::SetThreadExecutionState(2147483651)
if ($previous -eq 0) { throw 'Cannot hold the system and display awake for verification.' }
try {
  Write-Output 'Holding system and display awake during this check only.'
  & '${process.execPath.replaceAll("'", "''")}' scripts/run-check.mjs
  $result = $LASTEXITCODE
} finally {
  [void][CheckAwake]::SetThreadExecutionState($previous)
}
exit $result
`;
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
