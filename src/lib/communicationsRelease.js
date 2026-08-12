import {
  PERSONAL_CANARY_EMAIL_PLACEHOLDER,
  TEST_IDENTITIES,
  TEST_RECIPIENT_IDENTITIES,
  assertAuthorizedTestMailbox,
  assertAuthorizedTestRecipient,
  getTestIdentity,
  normalizeMailbox,
  syntheticMergeContext,
} from "./testIdentities.js";

const MERGE_FIELD_PATTERN = /{{\s*([a-z0-9_]+)\s*}}/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_PATTERN = /\b(?:bearer\s+|api[_-]?key\s*[:=]\s*|token\s*[:=]\s*)[^\s,;]+/gi;
const ALLOWED_MERGE_FIELDS = new Set([
  "first_name", "full_name", "event_name", "event_dates", "event_location",
  "portal_url", "submission_title", "submission_status", "session_title",
  "session_start", "session_location", "task_title", "task_due_date",
]);

export const COMMUNICATIONS_RELEASE_MODES = Object.freeze({ TEST_ALLOWLIST: "test-allowlist", PERSONAL_CANARY: "personal-canary" });

export function syntheticCalendarMetadata({ method = "REQUEST", sequence = 0 } = {}) {
  const normalizedMethod = String(method).toUpperCase() === "CANCEL" ? "CANCEL" : "REQUEST";
  return {
    uid: "session-synthetic@callboard.local",
    method: normalizedMethod,
    sequence: Math.max(0, Number(sequence) || 0),
    status: normalizedMethod === "CANCEL" ? "CANCELLED" : "CONFIRMED",
    start: "2026-10-12T16:00:00.000Z",
    end: "2026-10-12T17:00:00.000Z",
    location: "Test Room A",
  };
}

export class CommunicationsReleaseError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CommunicationsReleaseError";
    this.code = code;
    this.details = details;
  }
}

function redactText(value = "") {
  const redactions = [];
  let text = String(value).replace(EMAIL_PATTERN, (mailbox) => {
    try {
      assertAuthorizedTestMailbox(mailbox);
      return normalizeMailbox(mailbox);
    } catch {
      redactions.push({ type: "email" });
      return "[redacted-email]";
    }
  });
  text = text.replace(SECRET_PATTERN, (secret) => {
    redactions.push({ type: "secret" });
    return secret.toLowerCase().startsWith("bearer") ? "Bearer [redacted-secret]" : "[redacted-secret]";
  });
  return { text, redactions };
}

export function validateSyntheticTemplate(template = {}) {
  const subjectResult = redactText(template.subject);
  const bodyResult = redactText(template.body);
  const errors = [];
  if (!subjectResult.text.trim()) errors.push("A subject is required.");
  if (!bodyResult.text.trim()) errors.push("A message body is required.");
  if (subjectResult.text.length > 998) errors.push("The subject exceeds the safe preview limit.");
  if (bodyResult.text.length > 100_000) errors.push("The message body exceeds the safe preview limit.");
  const unknownFields = [...`${subjectResult.text}\n${bodyResult.text}`.matchAll(MERGE_FIELD_PATTERN)]
    .map((match) => match[1].toLowerCase())
    .filter((field) => !ALLOWED_MERGE_FIELDS.has(field));
  if (unknownFields.length) errors.push(`Unknown merge fields: ${[...new Set(unknownFields)].join(", ")}.`);
  return {
    valid: errors.length === 0,
    errors,
    redactions: [...subjectResult.redactions, ...bodyResult.redactions],
    template: { ...template, subject: subjectResult.text, body: bodyResult.text },
  };
}

function render(value, context) {
  return String(value || "").replace(MERGE_FIELD_PATTERN, (_, key) => context[key] ?? `{{${key}}}`);
}

function safeContext(identity, overrides = {}) {
  const defaults = syntheticMergeContext(identity.id);
  return Object.fromEntries(Object.entries({ ...defaults, ...overrides }).map(([key, value]) => [key, redactText(value).text]));
}

export function buildSyntheticCommunicationPayload({ template, identityId = "eventops-speaker-test", action = "preview", scheduledFor = null, context = {}, attachCalendar = false } = {}) {
  const identity = getTestIdentity(identityId);
  if (!identity) throw new CommunicationsReleaseError("UNKNOWN_TEST_IDENTITY", `Unknown test identity: ${identityId}`);
  assertAuthorizedTestRecipient(identity.email);
  const validation = validateSyntheticTemplate(template);
  if (!validation.valid) throw new CommunicationsReleaseError("TEMPLATE_NOT_RELEASE_SAFE", validation.errors.join(" "), { errors: validation.errors });
  const mergeContext = safeContext(identity, context);
  const subject = render(validation.template.subject, mergeContext);
  const body = render(validation.template.body, mergeContext);
  if (/{{\s*[a-z0-9_]+\s*}}/i.test(`${subject}\n${body}`)) throw new CommunicationsReleaseError("UNRESOLVED_MERGE_FIELD", "The exact payload still contains an unresolved merge field.");
  const notifications = getTestIdentity("eventops-notifications-test");
  const payload = {
    schemaVersion: 1,
    releaseMode: COMMUNICATIONS_RELEASE_MODES.TEST_ALLOWLIST,
    deliveryMode: "preview-only",
    networkIntent: false,
    action,
    from: { name: notifications.name, email: notifications.email },
    replyTo: { name: notifications.name, email: notifications.email },
    to: [{ id: identity.id, role: identity.role, name: identity.name, email: identity.email }],
    subject,
    text: body,
    scheduledFor: scheduledFor || null,
    attachments: attachCalendar ? [{ kind: "calendar", filename: "callboard-test-session.ics", contentDisposition: "attachment", previewOnly: true }] : [],
    safety: {
      syntheticContentOnly: true,
      recipientAllowlistEnforced: true,
      redactionCount: validation.redactions.length,
      outboundEnabled: false,
      personalCanary: PERSONAL_CANARY_EMAIL_PLACEHOLDER,
    },
  };
  assertCommunicationPayloadAllowed(payload);
  return payload;
}

export function assertCommunicationPayloadAllowed(payload, { personalCanaryEmail = PERSONAL_CANARY_EMAIL_PLACEHOLDER } = {}) {
  if (!payload || !Array.isArray(payload.to) || payload.to.length !== 1) {
    throw new CommunicationsReleaseError("EXACTLY_ONE_RECIPIENT_REQUIRED", "A release payload must contain exactly one inspected recipient.");
  }
  if (payload.releaseMode === COMMUNICATIONS_RELEASE_MODES.TEST_ALLOWLIST) {
    const identity = assertAuthorizedTestRecipient(payload.to[0].email);
    if (payload.to[0].id !== identity.id || payload.to[0].role !== identity.role) {
      throw new CommunicationsReleaseError("TEST_IDENTITY_MISMATCH", "The recipient metadata does not match its authorized test mailbox.");
    }
  } else if (payload.releaseMode === COMMUNICATIONS_RELEASE_MODES.PERSONAL_CANARY) {
    if (personalCanaryEmail === PERSONAL_CANARY_EMAIL_PLACEHOLDER || !/^\S+@\S+\.\S+$/.test(personalCanaryEmail)) {
      throw new CommunicationsReleaseError("PERSONAL_CANARY_REQUIRED", "Supply the personal canary mailbox explicitly; Callboard will not guess it.");
    }
    if (normalizeMailbox(payload.to[0].email) !== normalizeMailbox(personalCanaryEmail)) {
      throw new CommunicationsReleaseError("PERSONAL_CANARY_MISMATCH", "The payload recipient does not match the explicitly supplied personal canary.");
    }
  } else {
    throw new CommunicationsReleaseError("RELEASE_MODE_NOT_ALLOWED", "The payload has no recognized fail-closed release mode.");
  }
  assertAuthorizedTestMailbox(payload.from?.email);
  assertAuthorizedTestMailbox(payload.replyTo?.email);
  if (!payload.safety?.syntheticContentOnly) throw new CommunicationsReleaseError("SYNTHETIC_CONTENT_REQUIRED", "Only synthetic content is permitted in this release boundary.");
  if (payload.networkIntent !== false || payload.deliveryMode !== "preview-only") throw new CommunicationsReleaseError("PREVIEW_ONLY_REQUIRED", "Prepared payloads must remain preview-only until a separate release authorization.");
  return payload;
}

export function createFailClosedCommunicationsAdapter({ transport = null, authorization = null, personalCanaryEmail = PERSONAL_CANARY_EMAIL_PLACEHOLDER } = {}) {
  return {
    kind: "fail-closed-communications",
    preview(payload) {
      return structuredClone(assertCommunicationPayloadAllowed(payload, { personalCanaryEmail }));
    },
    async send(payload) {
      assertCommunicationPayloadAllowed(payload, { personalCanaryEmail });
      if (!authorization?.outboundEnabled || authorization?.scope !== "communications-test-send" || !authorization?.approvedAt) {
        throw new CommunicationsReleaseError("OUTBOUND_NOT_AUTHORIZED", "Outbound communication is disabled. Preview the exact payload and obtain explicit release authorization first.");
      }
      if (!transport?.send) throw new CommunicationsReleaseError("TRANSPORT_REQUIRED", "No reviewed communications transport has been injected.");
      return transport.send(payload);
    },
  };
}

export { PERSONAL_CANARY_EMAIL_PLACEHOLDER, TEST_IDENTITIES, TEST_RECIPIENT_IDENTITIES };
