# Cloudflare persistence and Accelevents boundary

This repository is prepared for Cloudflare Workers and optional D1 persistence, but it does not create resources, deploy, or contact Accelevents by itself.

## Runtime behavior

- The Worker serves built static assets and preserves the single-page application fallback.
- `GET /api/health` reports whether a `CALLBOARD_DB` D1 binding is available.
- `GET /api/state` reads the single demo workspace from D1 only for an authenticated
  operator request.
- `PUT /api/state` updates that workspace only when D1 is bound, writes are enabled,
  and the operator token is valid.
- `POST /api/seed` initializes state under the same gates. It refuses to overwrite
  existing state unless `?force=true` is supplied.
- `GET /api/export` returns a JSON state export only for an authenticated operator.
- Without D1, reads report `localStorage` and writes return `D1_NOT_CONFIGURED`; the React store continues using browser storage.

The Worker limits state payloads to 2 MB. `CALLBOARD_WRITE_ENABLED` is `false` in
`wrangler.toml`. D1 reads and writes require `CALLBOARD_API_TOKEN` as a Worker secret
and `Authorization: Bearer <token>` on the operator request. The browser prototype
intentionally does not retain or send that secret, so its safe public-deployment mode
continues to use browser-local data. Shared browser persistence requires a real
authenticated session layer and is not enabled by this repository.

## Preparing D1 later

The following are intentionally unexecuted deployment-owner steps:

1. Create a D1 database and copy its ID into the commented `[[d1_databases]]` block in
   `wrangler.toml`.
2. Apply `schema.sql` to that database.
3. Configure `CALLBOARD_API_TOKEN` with `wrangler secret put`; optionally configure a
   distinct `CALLBOARD_SEED_KEY`.
4. Keep browser writes disabled until authenticated sessions exist. If an operator-only
   write window is intentionally needed, set `CALLBOARD_WRITE_ENABLED = "true"`, make
   the exact authorized request, then turn it off again.
5. Run `npm run verify:sites` and inspect the output before deploying.

Before any forced seed or migration, export the current D1 database using Wrangler's
`d1 export` command and retain the generated SQL as the rollback artifact. None of these
commands are executed automatically.

`.openai/hosting.json` keeps D1 and R2 as `null`, so a Sites handoff continues to use localStorage and does not implicitly provision external resources.

## Accelevents sync boundary

`src/lib/accelevents.js` provides:

- deterministic speaker/session mapping;
- canonical payload hashes and per-operation idempotency keys;
- a dry-run plan with `CREATE`, `UPDATE`, and `SKIP` operations;
- an idempotent local mock adapter;
- a real adapter boundary that requires an API token, destination event, injected reviewed transport, and explicit write approval.

The UI calls only the mock adapter. It never stores an Accelevents token and never invokes a real transport. Deletes are deliberately excluded from the plan. A future production transport should upsert speakers, then sessions, then speaker-session associations, persisting returned external IDs after each successful operation.
