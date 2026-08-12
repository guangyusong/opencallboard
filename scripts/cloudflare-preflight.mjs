#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "wrangler.toml");
const clientIndex = path.join(root, "dist", "client", "index.html");
const workerPath = path.join(root, "worker", "index.js");
const wrangler = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
const dryRunDir = path.join(root, ".wrangler", "opencallboard-preview-dry-run");

function fail(message) {
  console.error(`Cloudflare preview preflight failed: ${message}`);
  process.exit(1);
}

for (const file of [configPath, clientIndex, workerPath, wrangler]) {
  if (!existsSync(file)) fail(`missing required file ${path.relative(root, file)}`);
}

const config = readFileSync(configPath, "utf8");
const activeConfig = config
  .split(/\r?\n/)
  .map((line) => line.replace(/\s+#.*$/, "").trim())
  .filter((line) => line && !line.startsWith("#"))
  .join("\n");

const required = [
  /^\[env\.preview\]$/m,
  /^name\s*=\s*"opencallboard-preview"$/m,
  /^workers_dev\s*=\s*true$/m,
  /^routes\s*=\s*\[\]$/m,
  /^\[env\.preview\.vars\]$/m,
  /^CALLBOARD_WRITE_ENABLED\s*=\s*"false"$/m,
];

for (const pattern of required) {
  if (!pattern.test(activeConfig)) fail(`wrangler.toml is missing safety invariant ${pattern}`);
}

const forbiddenBindings = [
  "d1_databases",
  "r2_buckets",
  "kv_namespaces",
  "durable_objects",
  "queues",
  "services",
  "dispatch_namespaces",
  "mtls_certificates",
  "vectorize",
  "hyperdrive",
];

for (const binding of forbiddenBindings) {
  const pattern = new RegExp(`^\\[{1,2}(?:env\\.preview\\.)?${binding}(?:\\.|\\])`, "m");
  if (pattern.test(activeConfig)) fail(`preview configuration must not contain ${binding}`);
}

if (/^\s*(?:route|custom_domain|account_id|zone_id)\s*=/m.test(activeConfig)) {
  fail("preview configuration must not pin an account, zone, route, or custom domain");
}

const result = spawnSync(
  wrangler,
  ["deploy", "--dry-run", "--env", "preview", "--outdir", dryRunDir],
  {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  },
);

if (result.error) fail(result.error.message);
if (result.status !== 0) fail(`Wrangler dry run exited with status ${result.status}`);

console.log("Cloudflare preview preflight passed: dry-run only, writes disabled, no resource bindings.");
