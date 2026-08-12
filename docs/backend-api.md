# D1 backend foundation

Callboard's Worker exposes an event-scoped, normalized API. It is dormant unless a
`CALLBOARD_DB` D1 binding is present, and mutations also require
`CALLBOARD_WRITE_ENABLED="true"`. A shared deployment can configure both; the
browser-local preview does not.

The machine-readable OpenAPI 3.1 contract is [public/openapi.json](../public/openapi.json)
and deploys read-only at `/openapi.json`. It documents the current role, concurrency,
idempotency, public-projection, file, communications-preview, dormant synthetic-email,
and Accelevents-mock
boundaries without claiming a provider operation that has not occurred.

## Session model

- `POST /api/bootstrap` creates the first event and organizer only when the database
  is empty, writes are enabled, `CALLBOARD_BOOTSTRAP_SECRET` is configured, and the
  same value is supplied in `X-Callboard-Bootstrap-Key`.
- An organizer creates a one-time reviewer or speaker grant with
  `POST /api/access-grants`.
- `POST /api/session` consumes that opaque grant once and creates a hashed server-side
  session. The raw session token is returned only in a `Secure`, `HttpOnly`,
  `SameSite=Strict` cookie scoped to `/api`.
- `POST /api/session/organizer` re-establishes the single preview organizer from the
  same strong bootstrap secret. The browser login sends it in a request header and never
  stores it. A production deployment should replace this preview-only operator boundary
  with managed staff identity.
- `GET /api/session` reads the current identity. `DELETE /api/session` revokes it.
- Session rows expire after eight hours. Access grants expire after 24 hours and are
  claimed before a session is issued, so concurrent reuse fails closed.

The server stores only SHA-256 token hashes. Every authenticated lookup joins the
session to an event membership and role. Roles are `organizer`, `reviewer`, and
`speaker`.

Organizer browser sessions can also issue named API tokens through `POST
/api/api-tokens`. These opaque `cbp_` bearer values are returned once, expire in at most
90 days, and are stored only as SHA-256 plus a short display prefix. Every token belongs
to one event and its creator must retain an active organizer membership. Explicit
`resource:read` and `resource:write` scopes reduce authority before normal event, role,
reference, version, idempotency, and provider-safety checks run. API tokens cannot manage
tokens or access grants, invoke demo reset, or use the legacy operator bridge. Organizer
browser sessions list only non-secret token metadata and can revoke a token immediately.

## Service endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `HEAD` | `/api/health` | Non-sensitive runtime capabilities and expected schema version |
| `GET` | `/api/bootstrap` | Whether the database has been initialized |
| `POST` | `/api/bootstrap` | Secret-gated first organizer/event creation |
| `GET`, `POST`, `DELETE` | `/api/session` | Read, establish from a grant, or revoke a session |
| `POST` | `/api/access-grants` | Organizer-only one-time reviewer/speaker grant |
| `GET`, `POST` | `/api/api-tokens` | Organizer-browser-only list/one-time issuance of scoped API credentials |
| `DELETE` | `/api/api-tokens/:id` | Organizer-browser-only token revocation |
| `GET`, `POST` | `/api/webhooks/subscriptions` | Organizer-only non-secret subscription list and one-time signing-secret issuance |
| `GET`, `PATCH`, `DELETE` | `/api/webhooks/subscriptions/:id` | Versioned subscription read/update/delete; delivery history must be disabled, not erased |
| `GET` | `/api/webhooks/events` | Stable keyset page of append-only lifecycle events |
| `POST` | `/api/webhooks/events/:id/deliveries` | Idempotent signed mock attempts only; real network intent rejected |
| `GET` | `/api/webhooks/deliveries` | Append-only signed mock delivery/retry ledger |
| `POST` | `/api/webhooks/deliveries/:id/retry` | Idempotent retry of one failed mock attempt |
| `GET`, `PATCH`, `PUT` | `/api/event` | Authenticated event read; organizer-only versioned settings write |
| `GET` | `/api/reviewers` | Organizer-only directory of redeemed reviewer memberships |
| `POST` | `/api/submissions/:submissionId/decision` | Organizer-only versioned decision and accepted-session promotion |
| `GET`, `PUT` | `/api/schedule-release` | Organizer-only draft/published schedule boundary with optimistic versioning |
| `GET` | `/api/agenda-conflicts` | Organizer-only deterministic room, participant, and track conflict projection |
| `GET` | `/api/workspace-version` | Authenticated low-cost workspace fingerprint for live role-scoped refresh |
| `GET`, `PUT` | `/api/integrations/accelevents` | Organizer-only shared non-secret destination/mapping configuration |
| `POST` | `/api/integrations/accelevents/runs` | Organizer-only persisted mock plan or targeted failed-operation retry; real transport rejected |
| `GET`, `POST` | `/api/communication-outbox` | Organizer-only preview ledger; provider remains `none` |
| `GET` | `/api/communication-outbox/:id/attempts` | Read append-only preview/delivery attempts |
| `POST` | `/api/communication-outbox/:id/release-approval` | Organizer-browser-only one-time Queue release for the exact approved synthetic Gmail canary |
| `POST` | `/api/communication-reminders/evaluate` | Organizer-only, flag-gated materialization of due preview records; never sends |
| `GET` | `/api/communication-reminder-runs` | Organizer-only durable due/skip/block ledger with `networkIntent=false` |
| `POST` | `/api/files/upload` | Owner-scoped object upload; fails closed while object storage is unbound |
| `GET`, `HEAD` | `/api/files/:id/content` | Owner/organizer private object read; fails closed while object storage is unbound |
| `POST` | `/api/demo/reset` | Organizer-only, flag-disabled deterministic reset of the isolated `callboard-judge-demo` event; requires an exact confirmation header |
| `GET` | `/api/public/forms/:formId` | Published public form definition |
| `POST` | `/api/public/forms/:formId/drafts` | Create a capacity-counted public draft and return one opaque 30-day resume token |
| `GET`, `PUT` | `/api/public/forms/:formId/drafts/:resumeToken` | Resume or version-update one active public draft; plaintext tokens are never stored |
| `POST` | `/api/public/forms/:formId/submissions` | Atomic public submission and participant creation with an idempotency key; an optional draft token consumes that draft |
| `GET` | `/api/public/embeds/:embedId` | Enabled embed configuration plus sanitized public schedule/speaker projection |

## Dormant scheduled-reminder boundary

The private branch now evaluates enabled event-, task-, and session-relative reminder
definitions on the server. Each due definition resolves its earliest authoritative event,
open-task, or accepted-session deadline, counts the matching event-scoped segment, and writes
at most one `scheduled_preview` outbox record plus attempt zero and a durable reminder-run row.
The `(event_id, automation_key)` uniqueness boundary makes repeated or concurrent evaluations
idempotent. Missing templates and empty segments are retained as explicit blocked/skipped runs.

The scheduled handler is inert unless `CALLBOARD_REMINDER_AUTOMATION_ENABLED="true"`, D1 is
bound, and writes are enabled. Even when active, it stores only a fixed synthetic canary payload
with `deliveryMode=preview-only`, provider `none`, attempt `not_dispatched`, and
`networkIntent=false`; it never uses Queue or Gmail and cannot call the one-time release endpoint.
No Cloudflare Cron trigger or runtime flag is configured in the deployed preview.

## Gmail DWD release boundary

The Worker contains a fail-closed delivery adapter for one explicitly configured canary.
The release endpoint requires all of the following at once: an organizer browser session
(API tokens are forbidden), writes enabled, `CALLBOARD_EMAIL_RELEASE_ENABLED="true"`, a
Queue binding, encrypted Gmail credentials, the independent release-key header, the literal
confirmation `release-one-synthetic-email`, the SHA-256 of the persisted exact payload, and
an exact sender and recipient allowlist. The checked-in defaults use the reserved
`opencallboard.invalid` domain and therefore cannot receive mail.

The API stores only a hash of the ten-minute one-time approval token and places the plaintext
token only in the Queue message. The request handler never contacts Google. The Queue consumer
revalidates the token, expiry, sender, recipient, and exact payload before exchanging a DWD JWT
for the narrow Gmail `gmail.send` scope and sending the MIME message with its RFC 5545 calendar
attachment. After any provider attempt, success or failure is terminal for that approval; an
ambiguous failure cannot be automatically retried or re-released from the same outbox. Tests
inject a completely mocked provider transport and therefore send no email.

Unknown `/api/*` paths return JSON `404` and never fall through to the application
shell. API responses are non-cacheable and do not enable cross-origin access.

## Event resources

The following collection and item routes support `GET`, organizer `POST`, versioned
`PATCH`/`PUT`, and versioned `DELETE` where the role permits:

- `/api/forms`
- `/api/submissions`
- `/api/people`
- `/api/tasks`
- `/api/resources`
- `/api/files`
- `/api/embeds`
- `/api/file-requests`
- `/api/portal-forms`
- `/api/communication-templates`
- `/api/communication-reminders`
- `/api/communication-previews`

Every normalized collection supports bounded keyset pagination with `?limit=1..250` and
an optional opaque `cursor`. Responses retain the backward-compatible `items` array and
add `limit` plus nullable `nextCursor`. Ordering is stable on `updated_at DESC, id DESC`;
the versioned cursor also binds its resource name, so malformed or cross-resource cursors
fail with `400 INVALID_CURSOR`. Event and role predicates are always applied independently
of the cursor.

Every row carries `event_id`, `version`, `created_at`, and `updated_at`. Item updates
and deletes require `If-Match: "<version>"`; stale writes return `409
VERSION_CONFLICT`, while a missing precondition returns `428 IF_MATCH_REQUIRED`.
References are verified to belong to the authenticated event before writes.

Normalized writes touch the event workspace timestamp without changing the event settings
version. Active clients poll `/api/workspace-version` every five seconds while visible and
on window focus; unchanged fingerprints cost one event-row read, while a changed fingerprint
triggers one role-scoped workspace hydration. Hidden tabs pause polling, and a refresh that
started before a local mutation cannot overwrite that newer local result.

The event singleton exposes its name, slug, short name, timezone, start/end instants,
location, website, type, theme, and non-secret display settings to authenticated event
members. Only organizers may update it, and writes require `If-Match` against the current
event version. Event times are stored as UTC instants while the UI edits event-local wall
time through the configured IANA timezone.

Organizer submission decisions also require `If-Match`. Accepting creates or updates one
agenda session linked to the submission and copies every `submission_people` relationship
into `session_people`. Moving away from accepted removes that linked agenda row. Session
collection responses include their participant joins, and organizer-created sessions may
include validated `participantIds`.

The accepted decision transaction also creates deterministic, idempotent `Complete your
speaker profile` and `Review accepted session details` tasks for every linked participant,
plus one event-level accepted-speaker quick-start resource. Repeating the decision does not
duplicate onboarding rows and does not reopen completed tasks. Moving away from accepted
removes only those generated tasks. The response includes the onboarding rows so organizer
screens can converge immediately while the normalized task/resource endpoints remain the
durable source of truth.

`GET /api/agenda-conflicts` derives stable conflict IDs from the authoritative session
pairs. Each result names both sessions, the violated one-room, one-participant, or one-track
rule, and the exact participant IDs when applicable. It is organizer-only and recomputes on
every read, so a versioned session move removes the conflict without a stale secondary row.

Evaluation rounds own their name, sequence, open/closed state, blind-review flag, and a
validated criterion list whose weights must total 100%. Review rows are independently
versioned reviewer assignments and retain their round ID, draft/final state, scores,
recommendation, and notes. Advancing writes an immutable round decision, increments the
submission round, and can create the next-round assignment in the same D1 transaction.
Final decisions retain their round provenance and use the same transactional
submission/session promotion boundary.

Role boundaries:

- Organizers manage all resources in their event and issue reviewer/speaker grants.
- Reviewers see submissions assigned through their review rows and may edit only their
  own score, recommendation, and notes.
- Speakers see and edit only their own profile, draft/pending submissions, task status,
  and file metadata. They see published forms, assigned agenda sessions, and resources
  intended for their audience. File-request reads are limited to requests assigned to the
  speaker or to a submission they participate in; the upload path rechecks the same
  ownership. Reviewers cannot read file requests; portal-form administration remains
  organizer-only.
- Communication templates, reminder definitions, preview/simulation records, and the
  normalized outbox/attempt ledger are organizer-only. The deployed ledger remains
  preview-only: its provider is `none`, attempt zero is `not_dispatched`, and the Worker
  has no delivery transport. Non-organizer reads return `403`.
- File endpoints store metadata only. Bytes require a separately reviewed object-store
  binding. The implemented private boundary remains dormant without `CALLBOARD_FILES`:
  raw uploads require a declared and verified size up to 10 MB, object keys are event and
  owner scoped, downloads require the owner or organizer session, and deletes remove both
  metadata and the object. No R2 bucket is currently bound or created.

## Webhook outbox boundary

Normalized resource creates, successful versioned updates, and successful deletes append
event-scoped lifecycle rows such as `task.created`. The write and its webhook event share one
D1 batch; a stale `If-Match` therefore produces neither a resource change nor a false event.
Each event has a stable event/type/subject tuple and event-scoped idempotency key. Event lists
use the same opaque, resource-bound keyset cursor rules as normalized collections.

Organizers can register HTTPS subscription metadata and event-type filters. A derived
`whsec_` signing secret is returned only on creation and is never stored in D1; subscription
lists expose only its version. Delivery requests require an idempotency key plus the explicit
body `{ "mode": "mock", "networkIntent": false }`. Callboard signs the exact canonical JSON
body as `v1=HMAC_SHA256(secret, timestamp + "." + body)`, records a deterministic mock ID or
an explicitly injected failure, and performs no `fetch` or provider call. Failed records may
be retried once to success with an immutable `retryOfDeliveryId` lineage; repeated keys replay
the original record. The database enforces `network_intent = 0`, and subscriptions with
delivery history can be disabled but not deleted through the API.

This first webhook slice covers generic normalized resource lifecycles. Specialized CFP,
evaluation-decision, schedule-release, and provider-result event families remain future
additions. No signing key or webhook transport is configured in the live shared preview.

## Public CFP boundary

- `GET /api/public/forms/:formId` returns only an open or published form plus its
  public event identity. It does not return the organizer workspace.
- `POST /api/public/forms/:formId/submissions` accepts an unauthenticated CFP
  transaction when D1 and the write flag are enabled. It requires an idempotency key,
  enforces the form window, per-email submission limit, participant min/max, unique
  participant emails, and creates people, the submission, and participant joins in one
  D1 batch.
- Retrying the same idempotency key returns the original submission. If the primary
  participant is a newly created event identity, the same transaction creates an
  event-scoped speaker membership/session and returns only a portal-ready flag while the
  cookie remains HttpOnly. If the email already belongs to an event person, no session is
  issued and verified identity-email access remains required.
- This boundary does not yet include abuse controls such as Turnstile or rate limiting;
  those are required before broad public release.

## Public embed boundary

- Organizers create and version embed configuration through `/api/embeds`.
- Newly configured events remain in `draft` schedule-release state. An organizer must
  publish through versioned `/api/schedule-release` before any public embed can read the
  schedule; returning the release to draft immediately closes that public projection.
- `GET /api/public/embeds/:embedId` returns only enabled configuration, public event
  identity, non-declined agenda sessions, and the names/roles of speakers attached to those
  sessions. It never returns email addresses, bios, tasks, reviews, files, or organizer state.
- Disabled and unknown embeds return the same public `404` shape. An enabled embed whose
  schedule has not been released returns `404 SCHEDULE_NOT_PUBLISHED`.

## Legacy bridge

`/api/state`, `/api/seed`, and `/api/export` remain temporarily available for the
existing local-first client, but D1 access requires the separate operator bearer token
and mutations also require the write flag. New shared workflows should use the
normalized endpoints. The compatibility table is isolated as `app_state` and should
be retired after the frontend uses the normalized API.

## Applying the schema later

`schema.sql` is idempotent and records schema version 18. Migration
`0015_scoped_api_tokens_and_cursor_pagination.sql` adds the event-scoped hashed token table
and index. Migration `0016_webhook_event_outbox_and_mock_delivery.sql` adds only event-scoped
subscription, lifecycle-event, and mock-delivery ledger tables plus indexes. Migration
`0017_one_time_communication_release_approvals.sql` adds only the hashed, expiring release
approval ledger. Migration `0018_scheduled_reminder_preview_runs.sql` adds the idempotent,
zero-network scheduler evidence table. Local tests use an in-memory SQLite adapter and do not
contact Cloudflare or Google. The shared preview remains on schema 14 until all four migrations,
a generated isolated signing secret, and the mock/dormant-release Worker deployment are separately
briefed, approved, applied, and read back. Cron/Queue/Gmail configuration and an actual canary
remain later, independent approvals.
