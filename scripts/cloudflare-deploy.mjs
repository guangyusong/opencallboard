#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
const expectedConfirmation = "deploy-opencallboard-preview";
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (process.env.CALLBOARD_DEPLOY_CONFIRM !== expectedConfirmation) {
  console.error(`Deployment blocked. Set CALLBOARD_DEPLOY_CONFIRM=${expectedConfirmation} only after reviewing docs/cloudflare-preview.md.`);
  process.exit(2);
}

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  console.error("Deployment blocked. Set CLOUDFLARE_ACCOUNT_ID to the exact 32-character ID of the reviewed deployment account.");
  process.exit(2);
}

const message = process.env.CALLBOARD_DEPLOY_MESSAGE?.trim() || `OpenCallboard browser-local preview ${new Date().toISOString()}`;
const result = spawnSync(
  wrangler,
  ["deploy", "--env", "preview", "--strict", "--message", message],
  {
    cwd: root,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, WRANGLER_SEND_METRICS: "false" },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
