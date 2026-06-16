import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
const host = "127.0.0.1";
const port = 4183;
const baseURL = `http://${host}:${port}`;
const viteCli = resolve(root, "node_modules", "vite", "bin", "vite.js");
const playwrightCli = resolve(root, "node_modules", "@playwright", "test", "cli.js");

const preview = spawn(
  process.execPath,
  [viteCli, "preview", "--host", host, "--port", String(port), "--strictPort"],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) {
      throw new Error(`Vite preview exited early with code ${preview.exitCode}`);
    }

    try {
      const response = await fetch(`${baseURL}/app/`);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${baseURL}`);
}

let exitCode = 1;
try {
  await waitForPreview();
  const tests = spawn(
    process.execPath,
    [playwrightCli, "test", ...process.argv.slice(2)],
    {
      cwd: root,
      env: { ...process.env, E2E_BASE_URL: baseURL },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  [exitCode] = await once(tests, "exit");
} finally {
  if (preview.exitCode === null) preview.kill();
  await Promise.race([once(preview, "exit"), delay(3_000)]);
}

process.exitCode = exitCode ?? 1;
