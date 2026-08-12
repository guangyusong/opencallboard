#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const previewUrl = process.env.CALLBOARD_PREVIEW_URL?.trim();

function fail(message, status = 1) {
  console.error(`Cloudflare preview readback failed: ${message}`);
  process.exit(status);
}

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  fail("set CLOUDFLARE_ACCOUNT_ID to the reviewed deployment account ID", 2);
}

let origin;
try {
  const url = new URL(previewUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev")) throw new Error("not a workers.dev HTTPS URL");
  origin = url.origin;
} catch {
  fail("set CALLBOARD_PREVIEW_URL to the exact https://...workers.dev URL printed by deploy", 2);
}

function runWrangler(args) {
  const result = spawnSync(wrangler, args, {
    cwd: root,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`wrangler ${args.join(" ")} exited with status ${result.status}`);
}

runWrangler(["deployments", "status", "--env", "preview", "--json"]);
runWrangler(["versions", "list", "--env", "preview", "--json"]);

const healthResponse = await fetch(`${origin}/api/health`, { headers: { accept: "application/json" } });
if (!healthResponse.ok) fail(`GET /api/health returned ${healthResponse.status}`);
const health = await healthResponse.json();
if (health.service !== "callboard" || health.persistence !== "localStorage" || health.writesEnabled !== false) {
  fail(`unexpected health boundary: ${JSON.stringify(health)}`);
}

const appResponse = await fetch(`${origin}/`, { headers: { accept: "text/html" }, redirect: "error" });
if (!appResponse.ok || !String(appResponse.headers.get("content-type")).includes("text/html")) {
  fail(`GET / did not return the app shell (${appResponse.status} ${appResponse.headers.get("content-type") || "no content type"})`);
}

console.log(`Cloudflare preview readback passed for ${origin}: app shell live, browser-local persistence, remote writes disabled.`);
