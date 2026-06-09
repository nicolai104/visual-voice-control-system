// Syntax-checks every JS source file with `node --check`.
// Works on DOM-dependent files too (parse-only, no execution).
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const ROOTS = [".", "js", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".git", "test", "__pycache__"]);

async function collect() {
  const files = [];
  for (const dir of ROOTS) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (/\.(mjs|js)$/.test(entry.name)) {
        files.push(dir === "." ? entry.name : join(dir, entry.name));
      }
    }
  }
  return files;
}

const files = await collect();
let failed = 0;

for (const file of files) {
  try {
    await run(process.execPath, ["--check", file]);
    console.log(`  ok   ${file}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${file}`);
    console.error(error.stderr || error.message);
  }
}

console.log(`\nSyntax check: ${files.length - failed}/${files.length} passed`);
if (failed > 0) process.exit(1);
