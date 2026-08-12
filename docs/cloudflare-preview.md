# Direct Cloudflare preview deployment

This runbook prepares a reversible preview on a selected Cloudflare account. It does
not provision D1, R2, KV, Durable Objects, Queues, a
custom domain, or a zone route. The only remote write is the explicitly confirmed
Worker deployment itself.

The `preview` environment deploys the static application and Worker to
`opencallboard-preview.<account-subdomain>.workers.dev`. `CALLBOARD_WRITE_ENABLED`
remains `false`, there is no database binding, and every browser keeps its own demo
state in `localStorage`.

## Cost and resource boundary

- The configuration targets Cloudflare Workers on `workers.dev` and does not select
  or upgrade an account plan.
- Cloudflare makes a Workers Free plan available by default, subject to its current
  request and CPU limits. Confirm the selected account's plan before deployment.
- Static assets do not require R2. There are no scheduled jobs, outbound providers,
  custom domains, database migrations, or paid add-ons in this preview.
- The account ID is supplied at command time and is deliberately not committed.

Current Cloudflare references:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

## 1. Reproduce the local package

Use Node 20 or newer and the npm version declared in `package.json`.

```bash
npm ci
npm run cloudflare:check
```

`cloudflare:check` performs the production build and a pinned Wrangler dry run. It
also rejects a preview configuration containing a storage/service binding, custom
route, custom domain, account ID, or enabled remote writes. It does not authenticate,
upload, provision, or deploy anything.

To exercise the same Worker locally:

```bash
npm run cloudflare:dev
```

Open `http://127.0.0.1:8788/`. This remains entirely local.

## 2. Confirm the deployment account

Authentication changes local Wrangler credentials, but does not deploy a Worker:

```bash
npx wrangler login
npm run cloudflare:whoami
```

Copy the exact 32-character ID for the intended account. Do not guess or
store it in `wrangler.toml`.

```bash
export CLOUDFLARE_ACCOUNT_ID="REVIEWED_32_CHARACTER_ACCOUNT_ID"
```

If `whoami` shows the wrong account, stop before deployment.

## 3. Capture the current remote version, then deploy

For an existing preview, capture the current version list first. For a first deploy,
the command may report that the Worker does not yet exist.

```bash
mkdir -p .wrangler/readback
npx wrangler versions list --env preview --json > .wrangler/readback/before-deploy-versions.json
```

Review `wrangler.toml`, the dry-run output, the account ID, and the exact Worker name.
Then provide the explicit deployment confirmation:

```bash
export CALLBOARD_DEPLOY_CONFIRM="deploy-opencallboard-preview"
export CALLBOARD_DEPLOY_MESSAGE="OpenCallboard reviewed browser-local preview"
npm run cloudflare:deploy:preview
```

This runs the local preflight again and then executes:

```bash
wrangler deploy --env preview --strict --message "OpenCallboard reviewed browser-local preview"
```

It creates or updates only the `opencallboard-preview` Worker and its `workers.dev` URL.
It does not create D1/R2 or attach a custom domain.

## 4. Read back the deployed boundary

Copy the exact HTTPS `workers.dev` URL printed by Wrangler:

```bash
export CALLBOARD_PREVIEW_URL="https://opencallboard-preview.ACCOUNT_SUBDOMAIN.workers.dev"
npm run cloudflare:readback:preview
```

Readback is non-mutating. It inspects the active deployment and versions, requests
the app shell, and requires `/api/health` to report:

```json
{
  "service": "callboard",
  "persistence": "localStorage",
  "writesEnabled": false
}
```

Keep the URL private until the user approves public sharing. This preview has no
authentication and contains only per-browser seeded/demo data.

## 5. Roll back an update

Choose one exact version ID from the saved/readback version list. Rollback immediately
changes the active Worker version, so it requires a version-specific confirmation:

```bash
export TARGET_VERSION_ID="EXACT_PREVIOUS_VERSION_ID"
export CALLBOARD_ROLLBACK_CONFIRM="rollback-opencallboard-preview-to-${TARGET_VERSION_ID}"
npm run cloudflare:rollback:preview -- "${TARGET_VERSION_ID}"
npm run cloudflare:readback:preview
```

The wrapper executes `wrangler rollback <version-id> --env preview --yes` and then the
operator separately verifies the live boundary. Cloudflare retains a limited history
of recent versions; preserve the before-deploy readback artifact locally.

## Optional full cleanup

Deleting the Worker removes the preview URL and is not a rollback. Inspect the target,
then use Wrangler's interactive confirmation:

```bash
npx wrangler delete --name opencallboard-preview
```

Only run deletion when the user has explicitly authorized removal. Because this preview
has no D1, R2, KV, routes, or custom domain, there are no companion resources to clean up.
