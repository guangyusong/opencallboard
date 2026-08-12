# Architecture

## Product surfaces

Callboard is one shared event workspace exposed through four distinct surfaces:

1. **Organizer application** — configuration, forms, submissions, evaluation,
   agenda, communications, portals, embeds, dashboards, and integrations.
2. **Public CFP** — event-scoped submission flow generated from the active form schema.
3. **Speaker portal** — profile, submissions, onboarding tasks, files, and resources.
4. **Public embeds** — mobile-friendly speaker and schedule presentations.

They share stable IDs for events, forms, submissions, people, sessions, tasks, files,
evaluation assignments, messages, and integration sync records. A submission is not a
session until it is accepted and promoted; a person can participate in multiple sessions.

## Runtime layers

- React/Vite renders the application and provides fast local development.
- `src/store.jsx` exposes one product store. Local storage keeps the no-credentials demo
  immediately usable; the deployed worker persistence adapter uses the same document
  contract.
- `worker/index.js` serves static assets and the `/api` surface. When a D1 binding exists,
  state is persisted server-side; otherwise the browser remains the source of truth.
- Communication and Accelevents libraries are provider boundaries. Preview/dry-run is
  the default and provider credentials alone do not authorize outbound actions.

## Safety and provider boundaries

- The UI never sends email merely because a template was previewed or a recipient was
  selected. Dry-run events are written to an outbox record.
- Calendar files are generated locally. Google and Outlook controls are compose links;
  they do not modify calendars without the user completing the provider flow.
- Accelevents first builds a field-mapped diff and idempotency plan. Live sync requires
  both configuration and an explicit user action.
- HTML resources render inside sandboxed iframes.
- Uploaded demo files are stored as browser data only when small enough; production
  deployments should configure R2 or another object store.

## Production evolution

The single-document state API is intentionally simple for a competition preview.
`schema.sql` currently defines only that document record. Event-scoped normalized
tables, authenticated sessions, concurrency control, and object storage are production
evolution work; the UI contract uses stable IDs so those layers can be introduced
without redesigning the visible workflows.
