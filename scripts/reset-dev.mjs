/**
 * Stops stray Next dev servers on 3000/3001, clears .next, starts a single dev instance.
 * Use when CSS disappears or you see MODULE_NOT_FOUND / 404 on layout.css.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ports = [3000, 3001];

function getListeningPids(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPort(port) {
  for (const pid of getListeningPids(port)) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`Stopped process ${pid} on port ${port}`);
    } catch {
      /* already gone */
    }
  }
}

console.log("Resetting dev environment…");
for (const port of ports) killPort(port);

const nextDir = path.join(root, ".next");
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("Removed .next cache");
} catch {
  /* ignore */
}

console.log("Starting dev server on http://localhost:3000\n");

const child = spawn("npx", ["next", "dev", "-p", "3000"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
