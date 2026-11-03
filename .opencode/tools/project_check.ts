import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@opencode-ai/plugin";

const exec = promisify(execFile);

export default tool({
  description: "Run Printametric's local CI checks. Requires Node.js 26.12.1+ (26.x) and npm ci first.",
  args: {},
  async execute(_args, context) {
    const cwd = context.worktree || context.directory;
    // Use Node from PATH: OpenCode itself may be running under Bun.
    const { stdout, stderr } = await exec("node", ["scripts/run-check.mjs"], {
      cwd,
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      signal: context.abort,
    }).catch((error: Error & { stdout?: string; stderr?: string }) => {
      throw new Error(`${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`);
    });
    return stdout + stderr;
  },
});
