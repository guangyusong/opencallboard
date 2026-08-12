#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
const versionId = process.argv[2]?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (!versionId || !/^[a-f0-9-]{16,}$/i.test(versionId)) {
  console.error("Rollback blocked. Pass one exact version ID from cloudflare:readback:preview after --.");
  process.exit(2);
}

const expectedConfirmation = `rollback-opencallboard-preview-to-${versionId}`;
if (process.env.CALLBOARD_ROLLBACK_CONFIRM !== expectedConfirmation) {
  console.error(`Rollback blocked. Set CALLBOARD_ROLLBACK_CONFIRM=${expectedConfirmation} after reviewing the selected version.`);
  process.exit(2);
}

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  console.error("Rollback blocked. Set CLOUDFLARE_ACCOUNT_ID to the exact 32-character ID of the reviewed deployment account.");
  process.exit(2);
}

const result = spawnSync(
  wrangler,
  ["rollback", versionId, "--env", "preview", "--yes", "--message", `Rollback Callboard preview to ${versionId}`],
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
