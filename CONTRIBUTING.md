# Contributing to Callboard

Thanks for helping improve Callboard. Keep changes narrow, source-faithful, and safe by
default.

## Local workflow

1. Use Node 20 or newer and run `npm install`.
2. Start the app with `npm run dev`.
3. Preserve the organizer, CFP, portal, and embed interaction contracts described in
   `docs/architecture.md`.
4. Before opening a change, run `npm run build`. For Worker or packaging changes, run
   `npm run verify:sites`.

Do not commit credentials, `.dev.vars`, Cloudflare state, generated build output, or
private deployment evidence.

## Pull requests

Describe the user-facing outcome, the routes affected, and what was verified. Clearly
separate local implementation from deployed, externally enabled, or live-proven state.
Real email, calendar modification, provider sync, and deployment must stay approval
gated.
