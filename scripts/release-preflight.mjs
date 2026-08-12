#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function check(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function digest(relative) {
  return createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");
}

const required = [
  "LICENSE", "README.md", "SECURITY.md", "CONTRIBUTING.md", "THIRD_PARTY_NOTICES.md",
  "docs/architecture.md", "docs/backend-api.md", "dist/client/index.html",
  "dist/server/index.js", "dist/.openai/hosting.json",
];
for (const file of required) check(`required:${file}`, existsSync(path.join(root, file)), file);

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
check("package-version", packageJson.version === packageLock.version && packageJson.version === packageLock.packages?.[""]?.version, packageJson.version);
check("npm-private", packageJson.private === true, "Accidental npm publication remains disabled");
check("license", packageJson.license === "MIT", packageJson.license);

const hosting = JSON.parse(read(".openai/hosting.json"));
check("sites-no-implicit-resources", hosting.d1 === null && hosting.r2 === null, JSON.stringify(hosting));
const wrangler = read("wrangler.toml");
check("worker-writes-disabled", /CALLBOARD_WRITE_ENABLED\s*=\s*"false"/.test(wrangler), "CALLBOARD_WRITE_ENABLED=false");
check("worker-token-required", read("worker/index.js").includes("WRITE_AUTH_NOT_CONFIGURED"), "D1 writes fail closed without an operator token");

if (existsSync(path.join(root, "dist/server/index.js"))) {
  check("packaged-worker-current", digest("worker/index.js") === digest("dist/server/index.js"), "Worker source matches packaged Sites worker");
}
if (existsSync(path.join(root, "dist/.openai/hosting.json"))) {
  check("packaged-hosting-current", digest(".openai/hosting.json") === digest("dist/.openai/hosting.json"), "Hosting manifest matches packaged manifest");
}

const assetsDir = path.join(root, "dist/client/assets");
const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
for (const chunk of ["DashboardScreens", "FormScreens", "ProgramScreens", "PublicScreens", "EvaluationScreens", "CommunicationsScreens", "EmbedScreens", "IntegrationScreens"]) {
  check(`route-chunk:${chunk}`, assets.some((file) => file.startsWith(`${chunk}-`) && file.endsWith(".js")), chunk);
}

const branch = git("branch", "--show-current");
const commit = git("rev-parse", "--short", "HEAD");
const status = git("status", "--porcelain");
check("git-repository", Boolean(commit), commit || "No local commit");
check("git-main-branch", branch === "main", branch || "No branch");
check("git-clean", status === "", status || "Working tree clean");

const remote = git("remote", "-v");
const failures = checks.filter((item) => !item.ok);
const report = {
  status: failures.length ? "NOT_READY" : "READY_FOR_REVIEW",
  commit,
  branch,
  remoteConfigured: Boolean(remote),
  externalEffects: "none",
  checks,
  gates: [
    "Review source and generated media for private identifiers",
    "Configure deployment resources and secrets outside Git",
    "Keep external provider writes disabled until explicitly enabled",
  ],
};

if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}  ${item.detail}`);
  console.log(`\n${report.status} · commit ${commit || "none"} · no network or external writes performed`);
  if (!remote) console.log("INFO  No Git remote configured; publication remains unstarted.");
  console.log("GATES " + report.gates.join(" | "));
}

if (failures.length) process.exitCode = 1;
