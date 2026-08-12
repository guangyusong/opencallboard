# OpenCallboard

OpenCallboard is an open-source, Sessionboard-faithful event program operations app. The
current build pairs the source-matched organizer and speaker experiences with a complete
shared Cloudflare workflow. External providers stay behind narrow approval gates.

OpenCallboard is an independent project and is not affiliated with, endorsed by, or
sponsored by Sessionboard. Sessionboard is a trademark of its respective owner.

## Live demo

- [Open the deployed product](https://opencallboard.com)
- [Inspect the OpenAPI 3.1 contract](https://opencallboard.com/openapi.json)

The hosted demo follows one proposal from the public CFP through blind review, organizer
acceptance, agenda publication, and accepted-speaker onboarding. Organizer access is
supplied separately and is never committed to the repository. Narrated walkthroughs are
published only after their visible data passes the same privacy scan as the source release.

## Included now

- Sessionboard-style organizer shell and dashboard system
- Event settings and full submission form builder
- Public five-step CFP flow with shared submissions and drafts
- Abstract review/status management and preferences drawer
- Multi-round evaluation, weighted scoring, blind review, decisions, and local AI assist
- Drag-and-drop agenda views, session creation, tracks, and derived conflict detection
- Speaker portal with profile, submissions, tasks, private R2 file uploads, and resources/wiki
- Organizer portal tasks, forms, file requests, resources, and files
- Lightweight CRM directory with lifecycle stages, notes, tags, segments, analytics,
  CSV import/deduplication, and add-to-event actions
- CMS embed list, editor, live preview, and code-copy surface
- Communications templates, fail-closed Gmail delivery to an explicitly configured
  allowlist, RFC 5545 request/update/cancel attachments, downloadable `.ics`, and provider
  links
- One-way Accelevents field mapping, inspectable dry runs, idempotent local mock sync,
  and history
- One-way Airtable export preview with field mapping, diffs, confirmation, idempotency,
  and run history; real provider writes remain separately gated
- Cloudflare Worker persistence API backed by D1, R2, and Queue, with a local fallback

## Local preview

```bash
npm install
npm run dev
```

The seeded routes include:

- `/#/dashboard`
- `/#/submission-forms`
- `/#/abstracts`
- `/#/evaluation`
- `/#/agenda`
- `/#/marketing`
- `/#/crm`
- `/#/integrations`
- `/#/integrations/airtable`
- `/#/portal-tasks`
- `/#/portal-forms`
- `/#/embeds`
- `/#/embed/embed_callboard_judge_sessions`
- `/#/embed/embed_callboard_judge_agenda`
- `/#/embed/embed_callboard_judge_itinerary`
- `/#/embed/embed_callboard_judge_speaker_list`
- `/#/embed/embed_callboard_judge_gallery`
- `/#/submit`
- `/#/speaker-portal`

## Current safety boundary

Organizer, reviewer, and speaker access is event-scoped. The checked-in identities use the
reserved `.invalid` domain, so the default build cannot accidentally deliver mail. Real
Gmail, Accelevents, and Airtable writes, paid services, and general-purpose production
identity remain disabled by default. The core workflow does not depend on an external
integration.

For production architecture and enablement, see
[`docs/architecture.md`](docs/architecture.md) and
[`docs/CLOUDFLARE_AND_ACCELEVENTS.md`](docs/CLOUDFLARE_AND_ACCELEVENTS.md).
The deployed normalized API is documented in
[`docs/backend-api.md`](docs/backend-api.md), with a machine-readable OpenAPI 3.1
contract at [`public/openapi.json`](public/openapi.json).

## Release history

OpenCallboard was developed in a private engineering repository that retains the complete
implementation and operational audit trail. This repository begins with a reviewed release
snapshot so internal test identities, provider metadata, and deployment evidence are not
published as part of the open-source history.
