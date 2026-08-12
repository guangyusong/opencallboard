const DEFAULT_SPEAKER_MAPPING = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  title: "title",
  company: "company",
  biography: "bio",
  pronouns: "pronouns",
  photoUrl: "headshotUrl",
};

const DEFAULT_SESSION_MAPPING = {
  title: "title",
  description: "description",
  startTime: "startsAt",
  endTime: "endsAt",
  format: "format",
  status: "status",
  track: "track",
  room: "room",
};

export const defaultAcceleventsConfig = {
  enabled: false,
  eventUrl: "ai-engineer-sandbox-event",
  eventId: "",
  mode: "mock",
  speakerMapping: DEFAULT_SPEAKER_MAPPING,
  sessionMapping: DEFAULT_SESSION_MAPPING,
  externalSnapshot: {},
  syncHistory: [],
};

function splitName(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function readSource(source, key) {
  if (key === "firstName" || key === "lastName") return splitName(source.name)[key];
  return source[key] ?? "";
}

export function mapSpeakerToAccelevents(person, mapping = DEFAULT_SPEAKER_MAPPING) {
  return Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, readSource(person, source)]));
}

export function mapSessionToAccelevents(session, mapping = DEFAULT_SESSION_MAPPING) {
  const payload = Object.fromEntries(Object.entries(mapping).map(([target, source]) => [target, readSource(session, source)]));
  return {
    ...payload,
    status: String(payload.status || "Accepted").toUpperCase() === "DRAFT" ? "HIDDEN" : "VISIBLE",
    format: payload.format || "BREAKOUT_SESSION",
    speakerLocalIds: [...(session.participants || [])],
  };
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) return value.map(sortForCanonicalJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortForCanonicalJson(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

export function stableHash(value) {
  const text = typeof value === "string" ? value : canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function operationFor({ eventKey, entityType, localId, payload, snapshot, validationError = "" }) {
  const snapshotKey = `${entityType}:${localId}`;
  const payloadHash = stableHash(payload);
  const previous = snapshot[snapshotKey];
  const action = validationError ? "BLOCKED" : !previous ? "CREATE" : previous.payloadHash !== payloadHash ? "UPDATE" : "SKIP";
  return {
    id: snapshotKey,
    snapshotKey,
    entityType,
    localId,
    action,
    payload,
    payloadHash,
    externalId: previous?.externalId || null,
    idempotencyKey: `accelevents:${eventKey}:${entityType}:${localId}:${payloadHash}`,
    reason: validationError || (action === "CREATE" ? "No Accelevents link exists" : action === "UPDATE" ? "Mapped fields changed" : "Payload is unchanged"),
  };
}

export function buildAcceleventsSyncPlan({ data, config = defaultAcceleventsConfig }) {
  const snapshot = config.externalSnapshot || {};
  const eventKey = config.eventId || config.eventUrl || data.event.slug;
  const publishableSpeakers = data.participants
    .filter((person) => person.role === "Speaker" || !person.role);
  const speakerIds = new Set(publishableSpeakers.map((person) => person.id));
  const speakers = publishableSpeakers.map((person) => {
    const payload = mapSpeakerToAccelevents(person, config.speakerMapping);
    const validationError = !String(payload.email || "").match(/^\S+@\S+\.\S+$/) ? "Blocked: speaker email is missing or invalid" : !String(payload.firstName || payload.lastName || "").trim() ? "Blocked: speaker name is missing" : "";
    return operationFor({
      eventKey,
      entityType: "speaker",
      localId: person.id,
      payload,
      snapshot,
      validationError,
    });
  });
  const sessions = data.sessions
    .filter((session) => !["Declined", "Withdrawn"].includes(session.status))
    .map((session) => {
      const payload = mapSessionToAccelevents(session, config.sessionMapping);
      return operationFor({
        eventKey,
        entityType: "session",
        localId: session.id,
        payload,
        snapshot,
        validationError: !String(payload.title || "").trim() ? "Blocked: session title is missing" : "",
      });
    });
  const publishableSessionIds = new Set(data.sessions.filter((session) => !["Declined", "Withdrawn"].includes(session.status)).map((session) => session.id));
  const associations = data.sessions.filter((session) => publishableSessionIds.has(session.id)).flatMap((session) => (session.participants || []).map((personId) => operationFor({
    eventKey,
    entityType: "sessionSpeaker",
    localId: `${session.id}:${personId}`,
    payload: { sessionLocalId: session.id, speakerLocalId: personId },
    snapshot,
    validationError: speakerIds.has(personId) ? "" : "Blocked: linked speaker is not publishable",
  })));
  const operations = [...speakers, ...sessions, ...associations];
  const summary = operations.reduce((result, operation) => ({ ...result, [operation.action.toLowerCase()]: result[operation.action.toLowerCase()] + 1 }), { create: 0, update: 0, skip: 0, blocked: 0 });
  return {
    id: `plan-${stableHash({ eventKey, operations: operations.map(({ idempotencyKey }) => idempotencyKey) })}`,
    provider: "accelevents",
    eventKey,
    direction: "CALLBOARD_TO_ACCELEVENTS",
    destructiveOperations: 0,
    createdAt: new Date().toISOString(),
    summary,
    operations,
  };
}

export function createMockAcceleventsAdapter({ failLocalIds = [] } = {}) {
  return {
    kind: "mock",
    async validateConnection() {
      return { ok: true, provider: "accelevents", mode: "mock", message: "Local mock adapter is ready." };
    },
    async apply(plan) {
      const results = plan.operations.map((operation) => {
        if (operation.action === "BLOCKED") return { ...operation, status: "BLOCKED", error: operation.reason };
        if (operation.action === "SKIP") return { ...operation, status: "SKIPPED", externalId: operation.externalId };
        if (failLocalIds.includes(operation.localId)) return { ...operation, status: "FAILED", error: "Injected mock failure" };
        return {
          ...operation,
          status: "SUCCEEDED",
          externalId: operation.externalId || `mock_${operation.entityType}_${stableHash(operation.localId)}`,
        };
      });
      return {
        id: `sync-${Date.now()}`,
        provider: "accelevents",
        mode: "mock",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: results.some((result) => ["FAILED", "BLOCKED"].includes(result.status)) ? "PARTIAL" : "SUCCEEDED",
        results,
        errors: results.filter((result) => ["FAILED", "BLOCKED"].includes(result.status)).map((result) => ({ localId: result.localId, message: result.error })),
      };
    },
  };
}

export class AcceleventsAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AcceleventsAdapterError";
    this.code = code;
  }
}

// The real boundary has no built-in transport. Production wiring must inject a
// reviewed transport and explicitly allow writes; this module never calls fetch.
export function createRealAcceleventsAdapter({ apiToken, eventUrl, eventId, transport, allowWrites = false } = {}) {
  if (!apiToken) throw new AcceleventsAdapterError("TOKEN_REQUIRED", "An Accelevents API token is required.");
  if (!eventUrl && !eventId) throw new AcceleventsAdapterError("EVENT_REQUIRED", "An Accelevents event URL or event ID is required.");
  return {
    kind: "real",
    async validateConnection() {
      if (!transport?.validateConnection) throw new AcceleventsAdapterError("TRANSPORT_REQUIRED", "A reviewed Accelevents transport must be injected.");
      return transport.validateConnection({ apiToken, eventUrl, eventId });
    },
    async apply(plan) {
      if (!allowWrites) throw new AcceleventsAdapterError("WRITE_APPROVAL_REQUIRED", "Real Accelevents writes are disabled until explicitly approved.");
      if (!transport?.apply) throw new AcceleventsAdapterError("TRANSPORT_REQUIRED", "A reviewed Accelevents transport must be injected.");
      return transport.apply({ apiToken, eventUrl, eventId, plan });
    },
  };
}

export function snapshotFromSyncRun(previousSnapshot = {}, syncRun) {
  const next = { ...previousSnapshot };
  for (const result of syncRun.results || []) {
    if (!["SUCCEEDED", "SKIPPED"].includes(result.status)) continue;
    next[result.snapshotKey] = {
      externalId: result.externalId,
      payloadHash: result.payloadHash,
      idempotencyKey: result.idempotencyKey,
      syncedAt: syncRun.completedAt,
    };
  }
  return next;
}
