# Frontend shared-state migration

## Purpose and non-goals

This document is a static architecture audit of the current frontend state contract and the smallest migration from one browser-owned JSON document to normalized, role-scoped D1 data that works across browsers. It deliberately preserves the existing Sessionboard-faithful UI and its route/component structure.

This is not a deployment or provider-release plan. Email delivery, calendar-provider writes, Accelevents writes, paid services, and credentials remain disabled. The first migration target is shared application state; external effects stay preview-only or mock-only until separately authorized.

## Current boundary

The application exposes one `data` object and one unrestricted `update(recipe)` function to every organizer, public, reviewer-like, and speaker surface (`src/store.jsx:167-218`). The initial object contains the event, an organizer, a globally selected portal person, forms, submissions (named `abstracts`), sessions, participants, tasks, portal configuration, files, embeds, communication history, evaluation data, and integration state (`src/store.jsx:6-75`). Some additional collections are created only on first use: `evaluationDecisions`, `communicationTemplates`, and `communicationReminders` (`src/screens/EvaluationScreens.jsx:82-94`, `src/screens/CommunicationsScreens.jsx:56-78`).

The current persistence sequence is:

1. Hydrate synchronously from `localStorage` and migrate the object in the browser (`src/store.jsx:77-112`, `src/store.jsx:120-174`).
2. Perform one remote `GET /api/state` after mount and accept it only if this browser has not already mutated (`src/store.jsx:178-193`).
3. Apply every recipe optimistically, synchronously overwrite the full local object, then debounce a full-object `PUT /api/state` by 300 ms (`src/store.jsx:195-208`).
4. Store the remote document in a single `app_state` row with ID `default`; the worker increments a version, but the browser never supplies an expected version (`worker/index.js:1-2`, `worker/index.js:42-59`; `schema.sql:4-11`).

This has eight consequences that must be addressed before calling the state shared:

- **One tenant and one mutable identity.** `STATE_ID = "default"` makes all events one document, while `portalPersonId` is persisted inside that document rather than in a browser session (`worker/index.js:1`, `src/store.jsx:21-22`).
- **No usable browser authentication contract.** D1 reads and writes require a server bearer token when configured, but `loadRemote` and `saveRemote` send no authorization header. Supplying that bearer to browser JavaScript would also be the wrong fix (`worker/index.js:11-13`, `worker/index.js:42-47`, `worker/index.js:67-90`; `src/store.jsx:138-159`).
- **Last writer wins.** The worker returns a version but does not compare an expected version, and the client discards the returned version. Two browsers can silently overwrite unrelated work (`worker/index.js:50-59`, `src/store.jsx:138-159`).
- **No live invalidation.** A browser reads remote state once. Later writes from another browser are not observed (`src/store.jsx:178-193`).
- **Routes are treated as roles.** Public CFP, speaker portal, public embed, and organizer screens all run under the same `StoreProvider`; hash routing alone selects the surface (`src/App.jsx:35-81`). Any surface with `update` can mutate any entity.
- **Client clocks and IDs are authoritative.** Many records use `Date.now()`, `new Date().toISOString()`, or locale-formatted timestamps. Concurrent browsers can collide semantically and produce inconsistent audit ordering (for example `src/screens/PortalScreens.jsx:38-39`, `src/screens/ProgramScreens.jsx:217`, `src/lib/accelevents.js:132-138`).
- **Files do not have a durable object boundary.** Some files are embedded as base64 data URLs inside the shared JSON; others retain only browser-selected metadata and lose their bytes (`src/components/SpeakerOnboarding.jsx:17-51`, `src/screens/SettingsScreens.jsx:44-48`, `src/screens/SettingsScreens.jsx:112-115`, `src/screens/PortalScreens.jsx:97-103`). The worker caps the entire document at 2 MB (`worker/index.js:1-2`, `worker/index.js:26-39`).
- **Authorization-sensitive derivations are client-only.** Participant relationships, accepted-speaker membership, task visibility, publishability, and agenda conflicts are computed over the full object in the browser (`src/lib/domain.js:5-66`). In particular, an unassigned task is returned to every participant (`src/lib/domain.js:38-44`), and `acceptedSessions` means only “not declined/withdrawn,” not necessarily accepted (`src/lib/domain.js:47-49`).

## Session and role contract

The shared API should use an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. No shared API bearer or provider credential belongs in frontend state. Every request resolves `{user_id, event_id, role, participant_id?}` server-side and scopes the query before returning data.

| Session role | How established | Allowed data/actions |
|---|---|---|
| `public` | No login; event/form/embed slug plus an ephemeral anti-abuse/submission token | Read published event/form/embed projections. Create a form submission. Cannot list other submissions, participants, reviews, tasks, files, logs, or provider state. |
| `speaker` | Expiring magic-link or equivalent portal session bound to one `event_id` and `participant_id` | Read/update own profile; read own submissions, sessions, assigned tasks, file requests, files, forms, and audience-visible resources; complete own assignments and upload own files. |
| `reviewer` | Authenticated event membership with reviewer role | Read only assigned submissions and the fields allowed by the round's blind setting; create/update own reviews. No decision, participant-directory, communication, or integration authority. |
| `organizer` | Authenticated event membership with organizer/admin role | Event-scoped CRUD and workflow commands across forms, program, evaluation, agenda, portal setup, embeds, preview communications, and integration configuration/dry runs. |
| `automation` | Server-side service principal, never a browser session | Materialize due reminders, process a separately enabled outbox, and execute separately authorized provider jobs. |
| `migration` | One-time server/admin import capability | Import the legacy version-3 document, report validation/parity, and never expose itself to the UI. |

`portalPersonId` therefore disappears from persisted event state. The speaker bootstrap derives the person from the authenticated portal session. Reviewer identity must likewise come from the session, not a reviewer selector in the evaluation UI. Organizer name/avatar in the shell should come from the current user/membership projection rather than the event document (`src/components/AppShell.jsx:28-54`).

## Compatibility API

To avoid rewriting screen anatomy, introduce a repository under `StoreProvider` that initially returns the familiar aggregate shape:

```text
GET /api/events/:eventId/bootstrap
  -> { data: <role-scoped legacy-shaped aggregate>, revision, cursor, session }

GET /api/events/:eventId/changes?after=:cursor
  -> { changes: [{entityType, entityId, operation, revision}], cursor }
```

The bootstrap is a backend-for-frontend projection, not the storage model. Organizer bootstrap may contain all current event collections. Speaker, reviewer, public-form, and public-embed bootstraps must contain only their authorized projections. Existing components can keep reading `data.event`, `data.forms`, and similar keys while their mutations are replaced incrementally by named repository commands.

All writes should use server-generated IDs/timestamps and accept:

- an `Idempotency-Key` for create/command requests;
- `If-Match: <entity revision>` or an explicit `expectedRevision` for updates;
- an event resolved from the session/path and checked against the target row;
- a transaction for commands that touch multiple tables;
- a response containing changed entities and the new change cursor.

Return `409 Conflict` or `412 Precondition Failed` instead of overwriting a newer row. The store can preserve optimistic UI, but must roll back/reload the affected entities when a precondition fails.

## Complete entity and action map

The proposed endpoints are illustrative REST contracts. Exact names may change, but the role, transaction, and storage boundary should not.

### Core, event, and session

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| `schemaVersion` / browser migration | Read and rewritten during hydration (`src/store.jsx:3-4`, `src/store.jsx:77-112`) | Server migration version; no screen API. `migration` only. | `schema_migrations`, `import_runs` | Keep the client migrator only while legacy local data can still be imported. It must not rewrite authoritative shared rows. |
| `event` read | Settings, shell, public forms, embeds, dashboard, communications, agenda, integrations read the common event projection (`src/store.jsx:8-20`; `src/components/AppShell.jsx:28-54`) | `GET /api/events/:eventId/bootstrap`; all roles receive a role-appropriate event projection | `events` | Public projection excludes private settings and integration data. |
| Event details / group types update | Organizer saves arbitrary event patches, including dynamically added `groupTypes` (`src/screens/SettingsScreens.jsx:51-76`) | `PATCH /api/events/:eventId` with expected revision; `organizer` | `events`, `event_group_types` | Validate timezone, start/end, slug uniqueness, URL, and allowed fields server-side. |
| Logo/background image update | Browser converts images to data URLs and writes them into `event` (`src/screens/SettingsScreens.jsx:44-48`, `src/screens/SettingsScreens.jsx:112-115`) | Signed upload/finalize endpoints, then `PATCH /api/events/:eventId/branding`; `organizer` | `files`, `event_branding` plus object storage | Local/base64 today. Do not place bytes in D1 or the aggregate. |
| `organizer` shell identity | Seeded inside event document and read by the organizer shell (`src/store.jsx:21`, `src/components/AppShell.jsx:28-54`) | `GET /api/session` or bootstrap `session.user`; authenticated member | `users`, `event_memberships`, `auth_sessions` | It is identity, not event content. |
| `portalPersonId` | Global shared selector used as speaker identity (`src/store.jsx:22`, `src/screens/PublicScreens.jsx:200-214`) | No entity endpoint; derive from speaker session | `portal_sessions` / `auth_sessions` | Remove from event bootstrap and imports after translating it only as a local demo hint. |
| Reset entire app | `reset` calls unrestricted `update(initialData)` (`src/store.jsx:210`) | No production UI command. If demo reset is retained, `POST /api/admin/events/:id/reset-demo` with separate explicit capability | `import_runs`, `audit_log` | A shared event must never be reset by a normal organizer mutation. |

### Submission forms and public CFP

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Forms list/read | Organizer list/builder and public CFP read full form objects (`src/screens/FormScreens.jsx:82-100`, `src/screens/FormScreens.jsx:145-178`; `src/screens/PublicScreens.jsx:88-121`) | Organizer: `GET /api/events/:id/forms`; public: `GET /api/public/events/:slug/forms/:formId` | `submission_forms`, `form_sections`, `form_fields`, `form_options`, `form_conditions`, `form_routing_rules`, `form_notification_rules` | Public endpoint returns only an open/published version and safe branding/limits. |
| Create/duplicate form | Browser generates an ID and appends a nested object (`src/screens/FormScreens.jsx:82-100`) | `POST /api/events/:id/forms`; `organizer` | Same form tables plus `form_versions` | Duplicate server-side in one transaction. |
| Open/close form | Browser toggles a string status (`src/screens/FormScreens.jsx:95`) | `POST /api/events/:id/forms/:formId/open` or `/close`; `organizer` | `submission_forms`, `audit_log` | Server enforces close date/version and public cache invalidation. |
| Edit form structure/settings | Every builder edit patches the nested form through generic `update` (`src/screens/FormScreens.jsx:145-178`) | `PATCH /api/events/:id/forms/:formId` or field/rule subresources; `organizer` | Form tables above | To preserve current autosave feel, debounce repository commands by form revision, not whole-event snapshots. |
| Copy public link | Uses browser clipboard (`src/screens/FormScreens.jsx:165`) | No write API | None | Local-only and safe. The URL must use the published form slug/version. |
| Submission-limit read | CFP counts existing participant/submission data in the browser (`src/screens/PublicScreens.jsx:88-121`) | Included in public form projection as server-computed `remainingSubmissions` | `submissions`, `submission_forms` | Do not expose other submissions to calculate the limit. Enforce again transactionally on submit. |
| Current public CFP submit | Client validates, upserts participant by email, creates abstract/links, increments form counter, assigns a review round, stores a confirmation preview/log, and changes `portalPersonId` in one recipe (`src/screens/PublicScreens.jsx:122-175`) | `POST /api/public/events/:slug/forms/:formId/submissions`; `public` | `participants`, `participant_emails`, `submissions`, `submission_answers`, `submission_participants`, `review_assignments`, `message_previews`, `audit_log` | One server transaction. Normalize email, enforce dedup/limit, compute route, generate IDs/timestamps, and return a speaker-session bootstrap or portal-link workflow. Never change global identity. |
| Form-file answer | Browser records only the selected filename (`src/screens/PublicScreens.jsx:80-84`) | Public signed upload followed by submission finalize; `public` | `files`, `submission_answer_files` plus object storage | Upload token must be event/form scoped, expiring, size/type limited, and unattached objects must expire. |
| Legacy CFP submit | Unused legacy component appends an abstract and overwrites the first participant (`src/screens/PublicScreens.jsx:34-44`); current routing imports the newer export (`src/App.jsx:20`, `src/App.jsx:44-46`) | Delete/retire with the old route; do not migrate as an API behavior | None | It is unsafe dead-path behavior, not a compatibility requirement. |
| Submission count fields on form | Browser increments `form.submissions` (`src/screens/PublicScreens.jsx:161-175`) | Derived count in form list response | `submissions` query/aggregate | Do not keep a mutable counter unless updated transactionally or materialized from change events. |

### Participants and speaker portal

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Participant directory/relationships | Full participants and abstracts are read, and links fall back to email matching (`src/store.jsx:28-40`, `src/lib/domain.js:5-35`) | Organizer bootstrap; speaker/reviewer receive scoped projections | `participants`, `participant_emails`, `submission_participants`, `session_participants` | Backfill explicit join rows; stop deriving authority from email after import. |
| Speaker “my submissions/sessions/tasks” | Chosen by global `portalPersonId`, then filtered over the full event object (`src/screens/PublicScreens.jsx:200-212`) | `GET /api/events/:id/speaker/bootstrap`; `speaker` | Joins above plus task tables | Query by session participant ID. Never send all event participants/tasks to the portal. |
| Speaker profile update | Browser can patch the selected participant (`src/screens/PublicScreens.jsx:213-214`) | `PATCH /api/events/:id/speaker/profile`; `speaker` | `participants`, `participant_profiles` | Permit only self-service fields; email/role changes require a separate verified flow. |
| Speaker task completion | Browser toggles any task ID present in state (`src/screens/PublicScreens.jsx:213`) | `POST /api/events/:id/speaker/tasks/:assignmentId/complete`; `speaker` | `task_assignments`, `task_completion_events` | Verify assignment belongs to session participant. Make completion idempotent rather than toggle-based. |
| Speaker onboarding reads | Component filters accepted status, resources, file requests, files, submissions, and tasks client-side (`src/components/SpeakerOnboarding.jsx:27-34`) | Included in speaker bootstrap | Portal/task/file/resource tables | Server defines accepted/publishable states consistently. |
| Speaker upload / headshot / task auto-complete | Browser base64-encodes file, writes it to `speakerFiles`, links request IDs, changes participant headshot, and completes matching tasks (`src/components/SpeakerOnboarding.jsx:17-51`) | `POST /api/events/:id/speaker/uploads` -> signed object upload; `POST .../complete`; `speaker` | `files`, `file_request_files`, `participant_profiles`, `task_completion_events` plus object storage | Finalize in a transaction after object verification. Server decides whether the upload satisfies a request/task. |

### Program, evaluation, and agenda

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Submission (`abstract`) list/read | Abstracts screen and dashboards read the entire collection (`src/screens/ProgramScreens.jsx:118-131`; `src/screens/DashboardScreens.jsx:52-78`) | Organizer: `/submissions`; reviewer: `/reviewer/assignments`; speaker: own bootstrap | `submissions`, `submission_answers`, `submission_participants` | Preserve `abstracts` as an aggregate key during UI compatibility, but use “submission” in storage/API. |
| Manual submission create/edit | Organizer patches or appends a browser-generated abstract and calls `syncAcceptedSession` (`src/screens/ProgramScreens.jsx:133-148`) | `POST/PATCH /api/events/:id/submissions`; `organizer` | Submission tables plus, when accepted, session tables | The server transaction owns session promotion and returns both changed entities. |
| Status change / accepted-session synchronization | Client changes status and creates/updates/removes the linked session (`src/screens/ProgramScreens.jsx:61-81`, `src/screens/ProgramScreens.jsx:133-148`) | `POST /api/events/:id/submissions/:submissionId/decision`; `organizer` | `submissions`, `decisions`, `sessions`, `session_participants`, `review_assignments` | Use one canonical decision command for Program and Evaluation screens; make repeated acceptance idempotent. |
| Evaluation rounds/criteria/assignments read and edit | Evaluation screen reads nested rounds and replaces the whole array (`src/screens/EvaluationScreens.jsx:47-67`) | CRUD `/review-rounds`, `/criteria`, `/assignments`; `organizer` | `review_rounds`, `review_criteria`, `review_assignments` | Round assignments must reference authenticated event reviewers/members, not static UI identities. |
| Review save | Browser finds/overwrites a review using a UI-selected reviewer and nested scores (`src/screens/EvaluationScreens.jsx:68-75`) | `PUT /api/events/:id/reviewer/assignments/:assignmentId/review`; `reviewer` | `reviews`, `review_scores`, `review_assignments` | Reviewer derived from session; enforce one review per assignment and the round's criteria. |
| Evaluation decision | One client update changes submission status, accepted session, `evaluationDecisions`, and optional next-round assignment (`src/screens/EvaluationScreens.jsx:82-94`) | Same transactional `POST .../submissions/:id/decision`; `organizer` | `decisions`, submissions, sessions, assignments | This is the same domain command as Program status. Do not maintain two mutation paths. |
| Session list/read | Agenda, embeds, dashboards, communications, and integrations read sessions and participants (`src/store.jsx:34-40`; `src/screens/ProgramScreens.jsx:207-234`) | Role-scoped bootstrap/list; public only published session projection | `sessions`, `session_participants`, `tracks`, `rooms` | Keep current `participants: [id]` aggregate field as a projection from join rows. |
| Manual session create | Browser appends `session-${Date.now()}` (`src/screens/ProgramScreens.jsx:213-218`) | `POST /api/events/:id/sessions`; `organizer` | `sessions`, `session_participants` | Server ID/time and validation. |
| Agenda move/schedule edit | Browser patches session dates/room (`src/screens/ProgramScreens.jsx:220-225`) | `PATCH /api/events/:id/sessions/:sessionId/schedule`; `organizer` | `sessions`, `audit_log` | Require expected revision; return authoritative room/speaker conflicts. |
| Conflict derivation | Browser scans all sessions for time, room, and participant overlap (`src/lib/domain.js:51-66`) | `GET /api/events/:id/agenda/conflicts` and conflicts returned from schedule commands; `organizer` | Derived query; optional `schedule_conflicts` cache | Keep client calculation for immediate visual feedback only; server result decides commit validity/warnings. |

### Portal configuration, tasks, resources, and files

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Task list/create/edit/duplicate/delete | Organizer mutates `tasks`; each row mixes a reusable task definition, person/submission assignment, and completion (`src/screens/PortalScreens.jsx:28-41`) | CRUD `/task-definitions` plus `/task-assignments`; `organizer` | `task_definitions`, `task_assignments`, `task_completion_events` | Project current rows back into the existing flat UI until a later UI distinction is approved. |
| Task visibility | Client grants person-linked, submission-linked, and all unassigned tasks (`src/lib/domain.js:38-44`) | Speaker task query; `speaker` | Task tables | Server must explicitly encode audience/assignment; an absent assignment is not authorization. |
| Portal forms CRUD | Organizer stores a nested form, questions, and settings; duplicate/delete are whole-array updates (`src/screens/PortalScreens.jsx:46-72`) | CRUD `/portal-forms` and fields; `organizer` | `portal_forms`, `portal_form_fields`, `portal_form_options` | Add `portal_form_responses` before enabling speaker completion; current UI configures forms but does not persist responses. |
| File requests create/read | Organizer creates requests with a nested `files: []`; speaker onboarding reads matching requests (`src/screens/PortalScreens.jsx:75-85`, `src/components/SpeakerOnboarding.jsx:27-34`) | Organizer CRUD `/file-requests`; speaker scoped read/upload | `file_requests`, `file_request_assignments`, `file_request_files` | Assignment/audience must be explicit. Files are join rows, not nested IDs. |
| Resources create/read | Organizer appends resources; speaker onboarding filters audience in the browser (`src/screens/PortalScreens.jsx:88-94`, `src/components/SpeakerOnboarding.jsx:27-34`) | Organizer CRUD `/resources`; speaker scoped read | `resources`, `resource_audiences` | Sanitize HTML embeds server-side. Server evaluates audience. |
| Portal file library upload/read | Organizer stores only name, size, type, and locale date; selected bytes are lost (`src/screens/PortalScreens.jsx:97-103`) | Signed upload/finalize and file CRUD; `organizer` | `files`, `portal_file_links` plus object storage | Current behavior is metadata-only. Download URLs must be short-lived and role scoped. |
| Speaker file read/download | Onboarding reads `speakerFiles` data URLs and request links (`src/components/SpeakerOnboarding.jsx:27-62`) | Scoped file metadata and signed download; `speaker` | `files`, `file_request_files` plus object storage | Never return object-storage credentials or other speakers' file metadata. |

### Embeds and dashboards

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Embed config list/create/edit/duplicate | Organizer mutates `embeds`; clipboard copy is local (`src/screens/EmbedScreens.jsx:19-42`) | CRUD `/embeds`; `organizer` | `embeds`, `embed_field_settings`, `embed_filters` | Clipboard needs no API. Use server IDs/revisions for duplication. |
| Public embed | Route looks up an enabled embed, then renders event/session/participant data from the complete store (`src/App.jsx:48-49`, `src/screens/EmbedScreens.jsx:58-103`) | `GET /api/public/events/:slug/embeds/:embedId`; `public` | Embed tables plus published session projection | Return only enabled embed configuration and explicitly published speakers/sessions. Do not ship organizer bootstrap to an embed. |
| Dashboard overview, forms, participants, reviews, agenda, speaker tracking | Read-only derivations over full state (`src/screens/DashboardScreens.jsx:52-124`, `src/screens/DashboardScreens.jsx:135-160`) | Initially derive from organizer bootstrap; later `GET /api/events/:id/dashboard` | Derived queries/materialized `event_metrics` if needed | No initial screen rewrite is required. Counts become trustworthy once underlying entity commands are authoritative. Dashboard layout/tab state remains local React state. |

### Communications and calendar behavior

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Segment/recipient derivation | Full participants, submissions, tasks, sessions, and logs are queried client-side (`src/screens/CommunicationsScreens.jsx:26-53`; `src/lib/communications.js:1-96`) | `POST /api/events/:id/communications/audiences/preview`; `organizer` | Derived query; optional `audience_snapshots` | Return counts/redacted sample first. Do not send participant directory to a non-organizer role. |
| Template create/edit | Browser writes `communicationTemplates` (`src/screens/CommunicationsScreens.jsx:56-60`) | CRUD `/communications/templates`; `organizer` | `communication_templates`, `communication_template_versions` | Retain synthetic-template validation and redaction on both client and server. |
| Exact synthetic test payload | Browser builds a preview-only payload for one allowlisted test identity (`src/screens/CommunicationsScreens.jsx:47-67`; `src/lib/communicationsRelease.js:50-138`) | `POST /api/events/:id/communications/previews`; `organizer` | `message_previews`, `message_recipients`, `audit_log` | Persist the exact inspected payload/hash, redactions, identity, and creator. Keep `deliveryMode=preview-only`, `networkIntent=false`, the four exact test mailboxes, and the explicit non-address personal-canary placeholder. |
| Dry-run message history / `emailLog` | Browser prepends preview/generated entries to `emailLog` (`src/screens/CommunicationsScreens.jsx:64-78`) | Preview and simulation endpoints; `organizer` | `message_previews`, `reminder_runs`, `reminder_run_items` | Rename in storage: these are previews/simulations, not delivered emails. Delivery state must never be inferred from a local log entry. |
| Reminder create/toggle/simulate | Browser writes `communicationReminders` and materializes due entries locally (`src/screens/CommunicationsScreens.jsx:69-78`; `src/lib/communications.js:98-184`) | CRUD `/communications/reminders`; `POST .../reminder-runs/simulate`; `organizer` | `reminder_definitions`, `reminder_runs`, `reminder_run_items` | Simulation has no outbox/network effect. Server uses an explicit clock/timezone and idempotency key. |
| Fail-closed send adapter | Adapter rejects without separate authorization and injected transport; current screen only previews (`src/lib/communicationsRelease.js:141-155`) | No send endpoint in shared-state stages. Later, a separately enabled `POST /communications/releases` creates an outbox job | `outbox_jobs`, `delivery_attempts`, `provider_message_refs` | Preserve fail-closed behavior. Provider credentials are worker secrets, never D1 rows or browser state. A preview does not authorize a release. |
| ICS generation/download | Calendar payload, ICS, Google URL, and Outlook URL are created in-browser; `.ics` download uses an object URL (`src/lib/communications.js:186-256`) | Pure client generation may remain initially; optional audited `POST /calendar-previews` later | Optional `calendar_previews`; no provider table required | Local-only today. A downloaded `.ics` is not proof of calendar insertion. Google/Outlook compose links are user navigation, not server writes. Any future direct provider write needs separate authorization and credentials. |

### Accelevents integration

| Current entity/action | Current source | Target API and role | Normalized D1 ownership | Migration note |
|---|---|---|---|---|
| Integration configuration | Organizer saves enabled flag, event URL/ID, mode, mappings, snapshot, and history in the main object; token remains component state (`src/screens/IntegrationScreens.jsx:62-75`) | `GET/PATCH /api/events/:id/integrations/accelevents`; `organizer` | `integration_configs`, `integration_mappings` | Good current property: token is not persisted. Future token belongs in a secret binding/vault reference; D1 stores at most secret metadata/status. |
| Dry-run plan | Browser maps all speakers, sessions, and associations and creates hashes/timestamps (`src/screens/IntegrationScreens.jsx:77-80`; `src/lib/accelevents.js:81-140`) | `POST /api/events/:id/integrations/accelevents/dry-runs`; `organizer` | `sync_runs`, `sync_operations`, `integration_entity_links` | Server-side plan gives one authoritative snapshot and idempotency key set. It remains network-free. |
| Mock apply | Local adapter synthesizes external IDs; screen stores snapshot/history (`src/screens/IntegrationScreens.jsx:82-94`; `src/lib/accelevents.js:143-170`, `src/lib/accelevents.js:200-212`) | `POST .../mock-runs`; `organizer` | `sync_runs`, `sync_operations`, `integration_entity_links` | Mark every run `mode=mock`; mock IDs are never real sync proof. |
| Real adapter | Requires injected transport/token and `allowWrites`; the module itself does not call `fetch` (`src/lib/accelevents.js:181-197`) | No real endpoint in shared-state stages. Later, explicit privileged job endpoint plus automation worker | Same sync tables; provider secret outside D1 | Preserve fail-closed boundary. Dry-run, config save, or mock apply must never activate a real provider transport. |

## Normalized D1 model

The target should use relational ownership and joins, not another collection of JSON blobs. Small presentation settings may remain JSON columns only when they have no independent identity, authorization rule, query requirement, or relationship. Every event-owned row should include `event_id`, `id`, `created_at`, `updated_at`, and an integer `revision`; foreign keys and event-scoped uniqueness should be explicit.

Recommended table groups, in dependency order:

1. **System and concurrency:** `schema_migrations`, `import_runs`, `idempotency_keys`, `audit_log`, `change_log`.
2. **Identity and tenancy:** `users`, `events`, `event_memberships`, `auth_sessions`, `portal_sessions`.
3. **Forms and people:** `participants`, `participant_emails`, `participant_profiles`, `submission_forms`, `form_versions`, `form_sections`, `form_fields`, `form_options`, `form_conditions`, `form_routing_rules`, `form_notification_rules`.
4. **Submissions:** `submissions`, `submission_answers`, `submission_answer_files`, `submission_participants`.
5. **Evaluation:** `review_rounds`, `review_criteria`, `review_assignments`, `reviews`, `review_scores`, `decisions`.
6. **Program and agenda:** `sessions`, `session_participants`, `tracks`, `rooms`.
7. **Portal workflow:** `task_definitions`, `task_assignments`, `task_completion_events`, `portal_forms`, `portal_form_fields`, `portal_form_options`, `portal_form_responses`, `file_requests`, `file_request_assignments`, `resources`, `resource_audiences`.
8. **Files and publishing:** `files`, `file_request_files`, `portal_file_links`, `event_branding`, `embeds`, `embed_field_settings`, `embed_filters`. File bytes live in object storage, not D1.
9. **Communications:** `communication_templates`, `communication_template_versions`, `audience_snapshots`, `message_previews`, `message_recipients`, `reminder_definitions`, `reminder_runs`, `reminder_run_items`. Add `outbox_jobs`, `delivery_attempts`, and provider references only when outbound release is authorized.
10. **Integrations:** `integration_configs`, `integration_mappings`, `integration_entity_links`, `sync_runs`, `sync_operations`. Secrets remain outside D1.

Important constraints include unique normalized participant email per event, unique form slug/version per event, one review per assignment, one accepted-session source link per submission, unique task assignment target, unique provider entity link, and unique idempotency key per event/action.

## Smallest staged migration preserving the UI

### Stage 0 — Freeze the frontend contract and add the repository seam

- Define the current version-3 aggregate as a compatibility DTO, including optional collections created at runtime.
- Put reads/commands behind a repository used by `StoreProvider`; continue exposing `data` so screen markup does not change.
- Introduce named commands next to `update` (`saveEvent`, `saveForm`, `submitCfp`, `saveReview`, `decideSubmission`, `scheduleSession`, and so on). Initially they may adapt to the current local recipe behind a development-only flag.
- Add a session descriptor to the store. Do not expose provider credentials or a shared service bearer.
- Keep provider calls disabled and previews/mock behavior unchanged.

This is the only stage where generic `update` remains a supported bridge. New features should not add new direct recipes.

### Stage 1 — Add normalized schema and an idempotent importer

- Add table groups 1–10 alongside `app_state`; do not delete or mutate the legacy row during import.
- Implement a server-only version-3 importer keyed by `{legacy_state_version, state_checksum}`. Record the `import_run`, generate missing IDs/timestamps once, materialize explicit join rows, and report orphaned participant/session/task/file references.
- Convert `portalPersonId` only into a demo portal-session hint; never persist it as event ownership.
- Convert base64 file fields to migration exceptions until object storage is available. Record metadata and the source path without duplicating bytes into relational rows.
- Build an organizer aggregate query that reconstructs the exact frontend DTO. Shadow-compare canonicalized legacy and reconstructed aggregates, allowing only documented derived/default differences.

### Stage 2 — Establish real sessions and role-scoped reads

- Add secure session-cookie resolution and event memberships.
- Switch organizer bootstrap to the normalized aggregate.
- Add distinct public form, public embed, speaker, and reviewer bootstrap endpoints. These endpoints must query allowed rows rather than fetch-and-filter the organizer object.
- Remove `portalPersonId` and selected reviewer identity from persisted frontend data; derive both from the session.
- Keep localStorage as an event/session-keyed cache only, not an authority. Never let one role hydrate from another role's cached aggregate.

At the end of this stage, multiple browsers can safely read the same event, but writes may still be migrated surface by surface.

### Stage 3 — Migrate writes in domain dependency order

Replace direct recipes with commands in this order so every foreign key and workflow dependency already exists:

1. Event details, branding metadata, and memberships.
2. Submission forms/fields/rules and public projections.
3. Participants, public CFP transaction, submissions/answers/participant links.
4. Review rounds, criteria, reviewer assignments, and reviews.
5. The single submission-decision command, accepted-session promotion, and next-round assignment.
6. Sessions, session participants, and agenda scheduling/conflict validation.
7. Task definitions/assignments/completions, portal forms, file requests, and resources.
8. Embed configuration and published embed projections.
9. Communication templates, reminders, previews, and simulations.
10. Accelevents config, dry runs, and mock runs.

Each command returns changed DTO fragments so the current UI can update without a full reload. Keep the generic recipe only for unmigrated keys, log its use in development, and remove it once the last screen is converted.

### Stage 4 — Add multi-browser convergence

- Every successful transaction appends `change_log` rows in the same D1 transaction.
- Start with bounded polling of `/changes?after=cursor`; add SSE only if the hosting/runtime path supports it reliably. Polling is enough for correctness and is simpler to release.
- Merge/invalidate by `{entityType, entityId, revision}`, not by overwriting the aggregate.
- Use expected revisions for edits and idempotency keys for creates/commands. On conflict, refetch affected entities and show the existing screen's save feedback as conflict/retry feedback without redesigning the screen.
- Maintain an event-level aggregate revision only as a cache validator; do not use it to serialize every unrelated entity edit.

### Stage 5 — Move file bytes out of shared state

- Add signed, scoped object uploads and server finalize calls for event branding, CFP answers, speaker onboarding, file requests, and the portal file library.
- Store metadata, ownership, checksum, object key, and scan/status in D1. Return expiring signed downloads.
- Backfill existing base64 speaker/event images only through an explicit migration with size/type validation. Metadata-only portal files cannot be recovered; label/import them as missing objects rather than pretending they are downloadable.
- Remove data URLs and browser `File` objects from the aggregate. This also removes the current 2 MB whole-state ceiling as a workflow limit.

### Stage 6 — Move preview/simulation history to the server, still with no outbound effects

- Persist communication exact previews, reminder simulations, calendar previews if desired, Accelevents dry runs, and Accelevents mock runs.
- Preserve synthetic-only validation, exact allowlisting, redaction, the explicit personal-canary placeholder, and fail-closed adapters.
- Keep ICS browser download available. Record it as a generated preview/download, never as provider insertion.
- Continue to expose no real email or Accelevents transport.

### Stage 7 — Optional provider release, only after separate authorization

- Add secrets as worker bindings or a dedicated secret store, never frontend/D1 values.
- Add explicit release records containing the inspected payload hash, approver, scope, and expiry.
- Enqueue idempotent jobs; a server worker performs the effect and records provider IDs/attempts. The browser never talks directly to a provider with privileged credentials.
- Start with the approved synthetic allowlist/canary scope. Bulk or real-recipient release is a separate decision.
- Apply the same preview/approval/job/readback boundary to Accelevents.

### Stage 8 — Retire the blob authority

- After aggregate parity, command coverage, multi-browser conflict checks, and backup/export verification, stop reading/writing `app_state` in normal operation.
- Keep a dated immutable export for rollback, then archive the table on a separately approved maintenance step.
- Keep localStorage only as a role/event-scoped cache that can always be discarded.

## Cutover invariants

The migration is complete only when all of these hold:

- Two organizer browsers can edit unrelated entities without overwriting one another, and conflicting edits to the same entity produce a visible conflict rather than silent loss.
- A speaker browser cannot read or mutate another participant, task, submission, review, or file by changing a hash route or entity ID.
- A reviewer receives only assigned, appropriately blinded submission fields and can write only their own review.
- Public CFP and embed routes never receive the organizer aggregate.
- CFP submission and organizer decision each commit their multi-entity effects atomically and are safe to retry.
- Session promotion has one canonical rule and one canonical command across Program and Evaluation screens.
- Dashboard counts, agenda conflicts, submission limits, and task visibility are based on authoritative server relationships.
- File bytes are outside D1/aggregate state, with scoped upload/download authorization.
- Preview/simulation records are not labeled or interpreted as delivered email, inserted calendar events, or real Accelevents syncs.
- Email and Accelevents transports remain unreachable until a separate, audited release capability is explicitly enabled.

## Recommended first implementation slice

The smallest end-to-end proof is: session/event tables + form/participant/submission tables + role-scoped bootstrap + `POST public submission` + organizer abstract list. It exercises tenancy, public-to-organizer data flow, an atomic multi-table command, and two-browser visibility while leaving the visual UI untouched. Add change polling immediately after that slice, then migrate evaluation/decision/session promotion as the next connected workflow.
