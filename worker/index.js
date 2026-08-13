import { sendSyntheticGmail, syntheticGmailConfigured } from "./gmail.js";
import { sendTransactionalEmail, transactionalEmailConfigured } from "./transactionalEmail.js";

const STATE_ID = "default";
const MAX_STATE_BYTES = 2_000_000;
const MAX_JSON_BYTES = 256_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SESSION_COOKIE = "callboard_session";
const ACCOUNT_COOKIE = "callboard_account";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ACCOUNT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const ORGANIZER_LOGIN_TTL_SECONDS = 15 * 60;
const GRANT_TTL_SECONDS = 24 * 60 * 60;
const CFP_DRAFT_TTL_SECONDS = 30 * 24 * 60 * 60;
const COMPETITION_JUDGE_EVENT_ID = "event_callboard_judge_demo";
const COMPETITION_JUDGE_USER_ID = "user_callboard_competition_judge";
const COMPETITION_JUDGE_PERSON_ID = "person_callboard_competition_judge";
const COMPETITION_JUDGE_EMAIL = "competition-judge@callboard.invalid";
const COMPETITION_JUDGE_NAME = "Competition Judge";
const ROLES = new Set(["organizer", "reviewer", "speaker"]);
const COMMUNICATIONS_SENDER = "eventops-notifications-test@opencallboard.invalid";
const COMMUNICATIONS_FIRST_CANARY = "eventops-speaker-test@opencallboard.invalid";
const COMMUNICATIONS_FIRST_CANARY_IDENTITY = Object.freeze({
  id: "eventops-speaker-test",
  role: "speaker",
  name: "Event Operations Test Speaker",
  email: COMMUNICATIONS_FIRST_CANARY,
});
const REMINDER_SEGMENTS = new Set([
  "all-speakers",
  "accepted-speakers",
  "pending-submitters",
  "declined-submitters",
  "incomplete-tasks",
]);
const REMINDER_UNITS = new Set([
  "days before event",
  "days before task due",
  "hours before session",
]);
const SEEDED_REMINDER_TEMPLATES = new Map([
  [
    "general-reminder",
    {
      id: "general-reminder",
      name: "Speaker reminder",
      subject: "Reminder: your {{event_name}} speaker details",
      body: "Hi {{first_name}},\n\nA quick reminder to review your details and outstanding items for {{event_name}}.\n\nOpen your portal: {{portal_url}}\n\nThank you!",
      attachCalendar: false,
    },
  ],
  [
    "task-due",
    {
      id: "task-due",
      name: "Task due reminder",
      subject: "Due soon: {{task_title}}",
      body: "Hi {{first_name}},\n\nYour speaker task “{{task_title}}” is due {{task_due_date}}. Please complete it in your portal before the deadline.\n\n{{portal_url}}",
      attachCalendar: false,
    },
  ],
  [
    "session-scheduled",
    {
      id: "session-scheduled",
      name: "Session scheduled",
      subject: "Your {{event_name}} session is scheduled",
      body: "Hi {{first_name}},\n\n“{{session_title}}” is scheduled for {{session_start}} at {{session_location}}. A calendar invitation is attached.\n\nReview your session: {{portal_url}}",
      attachCalendar: true,
    },
  ],
]);
const SYNTHETIC_REMINDER_CONTEXT = Object.freeze({
  first_name: "Speaker",
  full_name: "Event Operations Test Speaker",
  event_name: "Sample Event",
  event_dates: "October 12–14, 2026",
  event_location: "Test Venue",
  portal_url: "https://callboard.invalid/test-speaker-portal",
  submission_title: "Synthetic session proposal",
  submission_status: "Accepted",
  session_title: "Synthetic scheduled session",
  session_start: "October 12, 2026 at 9:00 AM",
  session_location: "Test Room A",
  task_title: "Upload synthetic slides",
  task_due_date: "September 30, 2026",
});
const COMMUNICATIONS_TEST_RECIPIENTS = new Map([
  [
    "eventops-organizer-test@opencallboard.invalid",
    { id: "eventops-organizer-test", role: "organizer" },
  ],
  [
    "eventops-reviewer-test@opencallboard.invalid",
    { id: "eventops-reviewer-test", role: "reviewer" },
  ],
  [
    "eventops-speaker-test@opencallboard.invalid",
    { id: "eventops-speaker-test", role: "speaker" },
  ],
]);
const API_TOKEN_PREFIX = "cbp_";
const API_TOKEN_MAX_DAYS = 90;
const API_SCOPE_RESOURCES = new Set([
  "event",
  "forms",
  "submissions",
  "people",
  "reviews",
  "sessions",
  "tasks",
  "resources",
  "files",
  "embeds",
  "integrations",
  "communications",
  "workspace",
  "webhooks",
]);

const RESOURCE_SPECS = {
  forms: {
    table: "cfp_forms",
    prefix: "form",
    required: ["name"],
    fields: {
      name: ["name", "text"],
      status: ["status", "text"],
      schema: ["schema_json", "json"],
      opensAt: ["opens_at", "text"],
      closesAt: ["closes_at", "text"],
    },
  },
  submissions: {
    table: "submissions",
    prefix: "submission",
    required: ["title"],
    fields: {
      formId: ["form_id", "text"],
      submitterPersonId: ["submitter_person_id", "text"],
      title: ["title", "text"],
      abstract: ["abstract", "text"],
      status: ["status", "text"],
      category: ["category", "text"],
      answers: ["answers_json", "json"],
      reviewRoute: ["review_route", "text"],
      routingRuleId: ["routing_rule_id", "text"],
      round: ["round", "integer"],
    },
  },
  people: {
    table: "people",
    prefix: "person",
    required: ["email", "name"],
    fields: {
      email: ["email", "text"],
      name: ["name", "text"],
      role: ["role", "text"],
      title: ["title", "text"],
      company: ["company", "text"],
      bio: ["bio", "text"],
      headshotUrl: ["headshot_url", "text"],
    },
  },
  reviews: {
    table: "reviews",
    prefix: "review",
    required: ["submissionId", "reviewerUserId"],
    fields: {
      submissionId: ["submission_id", "text"],
      reviewerUserId: ["reviewer_user_id", "text"],
      roundId: ["round_id", "text"],
      round: ["round", "integer"],
      scores: ["scores_json", "json"],
      totalScore: ["total_score", "number"],
      recommendation: ["recommendation", "text"],
      notes: ["notes", "text"],
      status: ["status", "text"],
    },
  },
  "evaluation-rounds": {
    table: "evaluation_rounds",
    prefix: "evaluation_round",
    required: ["name", "number", "criteria"],
    fields: {
      name: ["name", "text"],
      number: ["number", "integer"],
      status: ["status", "text"],
      blind: ["blind", "integer"],
      criteria: ["criteria_json", "json"],
    },
  },
  "evaluation-decisions": {
    table: "evaluation_decisions",
    prefix: "evaluation_decision",
    required: ["roundId", "submissionId", "decision", "createdByUserId"],
    fields: {
      roundId: ["round_id", "text"],
      submissionId: ["submission_id", "text"],
      decision: ["decision", "text"],
      notes: ["notes", "text"],
      createdByUserId: ["created_by_user_id", "text"],
    },
  },
  sessions: {
    table: "agenda_sessions",
    prefix: "session",
    required: ["title"],
    fields: {
      submissionId: ["submission_id", "text"],
      title: ["title", "text"],
      description: ["description", "text"],
      status: ["status", "text"],
      startsAt: ["starts_at", "text"],
      endsAt: ["ends_at", "text"],
      room: ["room", "text"],
      track: ["track", "text"],
    },
  },
  tasks: {
    table: "tasks",
    prefix: "task",
    required: ["title"],
    fields: {
      assigneePersonId: ["assignee_person_id", "text"],
      title: ["title", "text"],
      status: ["status", "text"],
      dueAt: ["due_at", "text"],
      kind: ["kind", "text"],
      instructions: ["instructions", "text"],
    },
  },
  "file-requests": {
    table: "file_requests",
    prefix: "file_request",
    required: ["title", "type"],
    fields: {
      assigneePersonId: ["assignee_person_id", "text"],
      submissionId: ["submission_id", "text"],
      title: ["title", "text"],
      type: ["type", "text"],
      instructions: ["instructions", "text"],
      dueAt: ["due_at", "text"],
      status: ["status", "text"],
    },
  },
  "portal-forms": {
    table: "portal_forms",
    prefix: "portal_form",
    required: ["name", "title", "type"],
    fields: {
      name: ["name", "text"],
      title: ["title", "text"],
      type: ["type", "text"],
      schema: ["schema_json", "json"],
    },
  },
  "communication-templates": {
    table: "communication_templates",
    prefix: "communication_template",
    required: ["name", "subject", "body"],
    fields: {
      name: ["name", "text"],
      category: ["category", "text"],
      segment: ["segment", "text"],
      subject: ["subject", "text"],
      body: ["body", "text"],
      attachCalendar: ["attach_calendar", "integer"],
    },
  },
  "communication-reminders": {
    table: "communication_reminders",
    prefix: "communication_reminder",
    required: ["name", "templateId", "segment", "amount", "unit", "timing"],
    fields: {
      name: ["name", "text"],
      templateId: ["template_id", "text"],
      segment: ["segment", "text"],
      amount: ["amount", "integer"],
      unit: ["unit", "text"],
      timing: ["timing", "text"],
      enabled: ["enabled", "integer"],
    },
  },
  "communication-previews": {
    table: "communication_previews",
    prefix: "communication_preview",
    required: [
      "action",
      "status",
      "templateName",
      "segment",
      "subject",
      "body",
    ],
    fields: {
      action: ["action", "text"],
      status: ["status", "text"],
      provider: ["provider", "text"],
      templateId: ["template_id", "text"],
      templateName: ["template_name", "text"],
      segment: ["segment", "text"],
      recipientCount: ["recipient_count", "integer"],
      recipients: ["recipients_json", "json"],
      subject: ["subject", "text"],
      body: ["body", "text"],
      scheduledFor: ["scheduled_for", "text"],
      attachCalendar: ["attach_calendar", "integer"],
      exactPayload: ["exact_payload_json", "json"],
      matchedRecipientCount: ["matched_recipient_count", "integer"],
      automationKey: ["automation_key", "text"],
      reminderId: ["reminder_id", "text"],
      dueAt: ["due_at", "text"],
      evaluatedAt: ["evaluated_at", "text"],
    },
  },
  resources: {
    table: "resources",
    prefix: "resource",
    required: ["title", "kind"],
    fields: {
      title: ["title", "text"],
      kind: ["kind", "text"],
      url: ["url", "text"],
      content: ["content", "text"],
      audience: ["audience", "text"],
    },
  },
  embeds: {
    table: "embeds",
    prefix: "embed",
    required: ["name"],
    fields: {
      name: ["name", "text"],
      format: ["format", "text"],
      enabled: ["enabled", "integer"],
      config: ["config_json", "json"],
    },
  },
  files: {
    table: "file_metadata",
    prefix: "file",
    required: ["name", "mimeType", "sizeBytes"],
    fields: {
      ownerPersonId: ["owner_person_id", "text"],
      submissionId: ["submission_id", "text"],
      fileRequestId: ["file_request_id", "text"],
      kind: ["kind", "text"],
      name: ["name", "text"],
      mimeType: ["mime_type", "text"],
      sizeBytes: ["size_bytes", "integer"],
      storageKey: ["storage_key", "text"],
      status: ["status", "text"],
    },
  },
};

function json(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function apiError(error, status, details) {
  return json({ error, ...(details ? { details } : {}) }, { status });
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function futureIso(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function apiTokenValue() {
  return `${API_TOKEN_PREFIX}${randomToken()}`;
}

function parseApiScopes(value) {
  try {
    const scopes = JSON.parse(value || "[]");
    return Array.isArray(scopes)
      ? scopes.filter((scope) => typeof scope === "string")
      : [];
  } catch {
    return [];
  }
}

function validApiScope(scope) {
  const [resource, capability, extra] = String(scope || "").split(":");
  return (
    !extra &&
    API_SCOPE_RESOURCES.has(resource) &&
    ["read", "write"].includes(capability)
  );
}

function apiScopeForRequest(url, method) {
  const capability = ["GET", "HEAD"].includes(method) ? "read" : "write";
  const segment = url.pathname.split("/")[2] || "";
  const resource = {
    event: "event",
    forms: "forms",
    submissions: "submissions",
    people: "people",
    reviews: "reviews",
    "evaluation-rounds": "reviews",
    "evaluation-decisions": "reviews",
    reviewers: "reviews",
    sessions: "sessions",
    "agenda-conflicts": "sessions",
    "schedule-release": "sessions",
    tasks: "tasks",
    resources: "resources",
    files: "files",
    "file-requests": "files",
    embeds: "embeds",
    integrations: "integrations",
    "communication-templates": "communications",
    "communication-reminders": "communications",
    "communication-reminder-runs": "communications",
    "communication-previews": "communications",
    "communication-outbox": "communications",
    "workspace-version": "workspace",
    webhooks: "webhooks",
  }[segment];
  return resource ? `${resource}:${capability}` : null;
}

function apiTokenAllows(session, url, method) {
  if (session.authType !== "api_token") return true;
  const required = apiScopeForRequest(url, method);
  return Boolean(required && session.apiScopes?.includes(required));
}

function encodePageCursor(resource, row) {
  return base64url(
    new TextEncoder().encode(
      JSON.stringify({ v: 1, resource, updatedAt: row.updated_at, id: row.id }),
    ),
  );
}

function decodePageCursor(value, resource) {
  if (!value || value.length > 512) return null;
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (
      !parsed ||
      parsed.v !== 1 ||
      parsed.resource !== resource ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.updatedAt ||
      !parsed.id
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(value),
    ),
  );
}

function hexBytes(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deriveWebhookSecret(env, eventId, subscriptionId) {
  if (!env.CALLBOARD_WEBHOOK_SIGNING_KEY) return null;
  return `whsec_${base64url(await hmacSha256(env.CALLBOARD_WEBHOOK_SIGNING_KEY, `callboard-webhook:v1:${eventId}:${subscriptionId}`))}`;
}

async function signWebhookBody(secret, timestamp, body) {
  return `v1=${hexBytes(await hmacSha256(secret, `${timestamp}.${body}`))}`;
}

function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  if (a.length !== b.length || a.length === 0) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1)
    result |= a[index] ^ b[index];
  return result === 0;
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function requestToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return cookieValue(request, SESSION_COOKIE);
}

function setSessionCookie(response, token, maxAge = SESSION_TTL_SECONDS) {
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
  );
  return response;
}

function setAccountCookie(
  response,
  token,
  maxAge = ACCOUNT_SESSION_TTL_SECONDS,
) {
  response.headers.append(
    "set-cookie",
    `${ACCOUNT_COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
  );
  return response;
}

function clearSessionCookie(response) {
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  return response;
}

function clearAccountCookie(response) {
  response.headers.append(
    "set-cookie",
    `${ACCOUNT_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  return response;
}

async function parseJson(request, maxBytes = MAX_JSON_BYTES) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) return { error: "PAYLOAD_TOO_LARGE", status: 413 };
  let payload;
  try {
    payload = await request.json();
  } catch {
    return { error: "INVALID_JSON", status: 400 };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return { error: "INVALID_JSON_OBJECT", status: 400 };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > maxBytes)
    return { error: "PAYLOAD_TOO_LARGE", status: 413 };
  return { payload };
}

function requireDb(env) {
  return env.CALLBOARD_DB ? null : apiError("D1_NOT_CONFIGURED", 503);
}

function requireWrites(env) {
  if (!env.CALLBOARD_DB) return apiError("D1_NOT_CONFIGURED", 503);
  if (env.CALLBOARD_WRITE_ENABLED !== "true")
    return apiError("WRITES_DISABLED", 503);
  return null;
}

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || "").trim());
}

function eventSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

async function verifyTurnstile(request, env, token) {
  if (!env.CALLBOARD_TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.set("secret", env.CALLBOARD_TURNSTILE_SECRET_KEY);
  form.set("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);
  try {
    const response = await (env.CALLBOARD_PROVIDER_FETCH || fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const result = await response.json();
    return Boolean(result?.success);
  } catch {
    return false;
  }
}

function tokenAuthorized(request, env) {
  const authorization = request.headers.get("authorization") || "";
  return Boolean(
    env.CALLBOARD_API_TOKEN &&
    authorization.startsWith("Bearer ") &&
    safeEqual(authorization.slice(7), env.CALLBOARD_API_TOKEN),
  );
}

async function authenticate(request, env) {
  if (!env.CALLBOARD_DB)
    return { response: apiError("D1_NOT_CONFIGURED", 503) };
  const token = requestToken(request);
  if (!token) return { response: apiError("UNAUTHENTICATED", 401) };
  const tokenHash = await sha256(token);
  const timestamp = now();
  const session = await env.CALLBOARD_DB.prepare(
    `
    SELECT s.id AS session_id, s.user_id, s.event_id, s.role, s.expires_at,
      u.email, u.name, m.person_id
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN event_memberships m ON m.event_id = s.event_id AND m.user_id = s.user_id AND m.role = s.role
    WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2
    LIMIT 1
  `,
  )
    .bind(tokenHash, timestamp)
    .first();
  if (
    !session &&
    token.startsWith(API_TOKEN_PREFIX) &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  ) {
    const apiToken = await env.CALLBOARD_DB.prepare(
      `
      SELECT t.id AS api_token_id, t.event_id, t.created_by_user_id AS user_id, t.scopes_json,
        t.expires_at, u.email, u.name, m.person_id
      FROM api_tokens t
      JOIN users u ON u.id = t.created_by_user_id
      JOIN event_memberships m ON m.event_id = t.event_id AND m.user_id = t.created_by_user_id AND m.role = 'organizer'
      WHERE t.token_hash = ?1 AND t.revoked_at IS NULL AND t.expires_at > ?2
      LIMIT 1
    `,
    )
      .bind(tokenHash, timestamp)
      .first();
    if (!apiToken) return { response: apiError("INVALID_API_TOKEN", 401) };
    if (env.CALLBOARD_WRITE_ENABLED === "true") {
      try {
        await env.CALLBOARD_DB.prepare(
          "UPDATE api_tokens SET last_used_at = ?1 WHERE id = ?2",
        )
          .bind(timestamp, apiToken.api_token_id)
          .run();
      } catch {}
    }
    return {
      session: {
        sessionId: null,
        authType: "api_token",
        apiTokenId: apiToken.api_token_id,
        apiScopes: parseApiScopes(apiToken.scopes_json),
        userId: apiToken.user_id,
        eventId: apiToken.event_id,
        role: "organizer",
        expiresAt: apiToken.expires_at,
        email: apiToken.email,
        name: apiToken.name,
        personId: apiToken.person_id || null,
      },
    };
  }
  if (!session)
    return { response: clearSessionCookie(apiError("INVALID_SESSION", 401)) };
  return {
    session: {
      sessionId: session.session_id,
      authType: "browser_session",
      userId: session.user_id,
      eventId: session.event_id,
      role: session.role,
      expiresAt: session.expires_at,
      email: session.email,
      name: session.name,
      personId: session.person_id || null,
    },
  };
}

async function authenticateAccount(request, env) {
  if (!env.CALLBOARD_DB)
    return { response: apiError("D1_NOT_CONFIGURED", 503) };
  const token = cookieValue(request, ACCOUNT_COOKIE);
  if (!token) return { response: apiError("UNAUTHENTICATED", 401) };
  const timestamp = now();
  const row = await env.CALLBOARD_DB.prepare(
    `
    SELECT s.id AS session_id, s.user_id, s.expires_at, u.email, u.name
    FROM account_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2
    LIMIT 1
  `,
  )
    .bind(await sha256(token), timestamp)
    .first();
  if (!row)
    return {
      response: clearAccountCookie(apiError("INVALID_ACCOUNT_SESSION", 401)),
    };
  if (env.CALLBOARD_WRITE_ENABLED === "true") {
    try {
      await env.CALLBOARD_DB.prepare(
        "UPDATE account_sessions SET last_seen_at = ?1 WHERE id = ?2",
      )
        .bind(timestamp, row.session_id)
        .run();
    } catch {}
  }
  return {
    session: {
      sessionId: row.session_id,
      authType: "account_session",
      userId: row.user_id,
      expiresAt: row.expires_at,
      email: row.email,
      name: row.name,
    },
  };
}

async function issueSession(env, identity) {
  const token = randomToken();
  const sessionId = id("auth");
  const issuedAt = now();
  const expiresAt = futureIso(SESSION_TTL_SECONDS);
  await env.CALLBOARD_DB.prepare(
    `
    INSERT INTO auth_sessions (id, token_hash, user_id, event_id, role, expires_at, created_at, last_seen_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
  `,
  )
    .bind(
      sessionId,
      await sha256(token),
      identity.userId,
      identity.eventId,
      identity.role,
      expiresAt,
      issuedAt,
    )
    .run();
  return { token, sessionId, expiresAt };
}

async function issueAccountSession(env, userId) {
  const token = randomToken();
  const sessionId = id("account_auth");
  const issuedAt = now();
  const expiresAt = futureIso(ACCOUNT_SESSION_TTL_SECONDS);
  await env.CALLBOARD_DB.prepare(
    `
    INSERT INTO account_sessions (id, token_hash, user_id, expires_at, created_at, last_seen_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?5)
  `,
  )
    .bind(sessionId, await sha256(token), userId, expiresAt, issuedAt)
    .run();
  return { token, sessionId, expiresAt };
}

async function handleHealth(request, env) {
  const judgeAccessExpiresAt = String(
    env.CALLBOARD_JUDGE_ACCESS_EXPIRES_AT || "",
  ).trim();
  const payload = {
    ok: true,
    service: "callboard",
    persistence: env.CALLBOARD_DB ? "d1" : "localStorage",
    writesEnabled: env.CALLBOARD_WRITE_ENABLED === "true",
    sessionAuthConfigured: Boolean(
      env.CALLBOARD_DB && env.CALLBOARD_BOOTSTRAP_SECRET,
    ),
    selfServeAuthConfigured: Boolean(
      env.CALLBOARD_DB &&
        (env.CALLBOARD_SELF_SERVE_DEV_LINKS === "true" ||
          (env.CALLBOARD_SELF_SERVE_EMAIL_ENABLED === "true" &&
            env.CALLBOARD_EMAIL_QUEUE &&
            transactionalEmailConfigured(env))),
    ),
    turnstileConfigured: Boolean(env.CALLBOARD_TURNSTILE_SECRET_KEY),
    turnstileSiteKey: env.CALLBOARD_TURNSTILE_SECRET_KEY
      ? String(env.CALLBOARD_TURNSTILE_SITE_KEY || "").trim() || null
      : null,
    judgeAccessConfigured: Boolean(
      env.CALLBOARD_DB &&
        env.CALLBOARD_JUDGE_ACCESS_SECRET &&
        judgeAccessExpiresAt,
    ),
    judgeAccessExpiresAt: judgeAccessExpiresAt || null,
    objectStorageConfigured: Boolean(env.CALLBOARD_FILES),
    demoResetEnabled: env.CALLBOARD_DEMO_RESET_ENABLED === "true",
    emailDeliveryConfigured: Boolean(
      env.CALLBOARD_EMAIL_RELEASE_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_QUEUE &&
      transactionalEmailConfigured(env),
    ),
    emailUiReleaseConfigured: Boolean(
      env.CALLBOARD_EMAIL_UI_RELEASE_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_RELEASE_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_QUEUE &&
      transactionalEmailConfigured(env),
    ),
    emailSender: transactionalEmailConfigured(env)
      ? String(env.CALLBOARD_AUTH_SENDER_EMAIL || "").trim() || null
      : null,
    reminderAutomationConfigured: Boolean(
      env.CALLBOARD_DB &&
      env.CALLBOARD_WRITE_ENABLED === "true" &&
      env.CALLBOARD_REMINDER_AUTOMATION_ENABLED === "true",
    ),
    airtableSyncConfigured: Boolean(
      env.AIRTABLE_REAL_SYNC_ENABLED === "true" && env.AIRTABLE_API_TOKEN,
    ),
    expectedSchemaVersion: 21,
    timestamp: now(),
  };
  return request.method === "HEAD"
    ? new Response(null, {
        status: 200,
        headers: { "cache-control": "no-store" },
      })
    : json(payload);
}

async function touchWorkspace(env, eventId, timestamp = now()) {
  await env.CALLBOARD_DB.prepare(
    "UPDATE events SET updated_at = ?1 WHERE id = ?2",
  )
    .bind(timestamp, eventId)
    .run();
}

async function handleWorkspaceVersion(request, env, session) {
  const snapshot = await env.CALLBOARD_DB.prepare(
    "SELECT updated_at, version FROM events WHERE id = ?1 LIMIT 1",
  )
    .bind(session.eventId)
    .first();
  if (!snapshot) return apiError("NOT_FOUND", 404);
  return json({
    version: `${snapshot.updated_at}:${snapshot.version}`,
    updatedAt: snapshot.updated_at,
    pollAfterMs: 5000,
  });
}

function demoCfpSchema() {
  return {
    externalTitle: "DevFlow Conf 2027 Call for Speakers",
    pageHeading: "Welcome!",
    welcomeEnabled: true,
    welcomeMessage:
      "Welcome to the DevFlow Conf 2027 call for speakers.\n\nWe are looking for practical, technically rigorous sessions about developer tooling, AI-assisted engineering, and platform infrastructure. Share a clear audience takeaway, the real problem you solved, and the lessons another team could use.\n\nThe event runs May 12–14, 2027. The configured submission deadline is shown above, and each submitter may keep up to three active drafts or submissions. All information in this competition workspace is synthetic and disposable.",
    kind: "Abstracts",
    collectParticipants: true,
    abstractSection: {
      title: "Tell us about your submission",
      heading: "Submission",
      description:
        "Give the review team enough context to understand the audience, practical takeaway, session format, and program track.",
    },
    participantSection: {
      title: "Tell us about the speakers",
      heading: "Participant",
      description:
        "Add the primary speaker and, when relevant, up to two co-speakers. Use only authorized synthetic identities in this demo.",
    },
    participantRoles: [
      { id: "speaker", label: "Speaker", enabled: true, min: 1, max: 3 },
    ],
    abstractFields: [
      {
        id: "title",
        label: "Title",
        type: "Text",
        required: true,
        max: 255,
        locked: true,
      },
      {
        id: "description",
        label: "Description",
        type: "Wysiwyg",
        required: true,
        max: 5000,
      },
      {
        id: "format",
        label: "Format",
        type: "Dropdown",
        required: true,
        options: [
          "Keynote (45 min)",
          "Talk (30 min)",
          "Lightning Talk (10 min)",
          "Workshop (120 min)",
          "Panel (45 min)",
        ],
      },
      {
        id: "track",
        label: "Track",
        type: "Dropdown",
        required: true,
        options: ["AI Engineering", "Platform & Infra", "Developer Experience"],
      },
      {
        id: "keyTakeaway",
        label: "Key takeaway",
        type: "Text",
        required: true,
        max: 255,
      },
      {
        id: "audienceLevel",
        label: "Audience level",
        type: "Dropdown",
        required: false,
        options: ["Beginner", "Intermediate", "Advanced"],
      },
      {
        id: "workshopPrerequisites",
        label: "Workshop prerequisites",
        type: "Wysiwyg",
        required: false,
        max: 2000,
        conditionField: "Format",
        conditionValue: "Workshop (120 min)",
        condition: "Format is Workshop (120 min)",
      },
    ],
    participantFields: [
      {
        id: "firstName",
        label: "First Name",
        type: "Text",
        required: true,
        locked: true,
      },
      {
        id: "lastName",
        label: "Last Name",
        type: "Text",
        required: true,
        locked: true,
      },
      {
        id: "email",
        label: "Email",
        type: "Email",
        required: true,
        locked: true,
      },
      {
        id: "title",
        label: "Professional Title",
        type: "Text",
        required: false,
        max: 255,
      },
      {
        id: "company",
        label: "Company",
        type: "Text",
        required: false,
        max: 255,
      },
      {
        id: "biography",
        label: "Biography",
        type: "Wysiwyg",
        required: false,
        max: 5000,
      },
    ],
    closeDate: "2027-04-30T23:59:00-07:00",
    setLimit: true,
    submissionLimit: 3,
    allowMultipleDrafts: true,
    autoRedirect: true,
    successMessage:
      "Thank you—your proposal is saved and ready for review. Continue to the speaker portal to track its status, complete onboarding tasks, and access accepted-speaker resources.",
    crossFieldRules: [
      {
        id: "title-description",
        label: "Title + Description",
        fieldIds: ["title", "description"],
        max: 5255,
      },
    ],
    routingRules: [
      {
        id: "platform-infra-route",
        fieldId: "track",
        equals: "Platform & Infra",
        destination: "Round 1 · Technical review",
      },
    ],
    submissionConfirmation: true,
    confirmationSubject: "We received your submission: {{submission.title}}",
    confirmationBody:
      "Hi {{participant.firstName}},\n\nThanks for submitting {{submission.title}} to {{event.name}}. You can use the speaker portal to review the proposal and follow its status.\n\n— Callboard Event Ops",
  };
}

function selfServeCfpSchema(eventName, closesAt) {
  const schema = demoCfpSchema();
  return {
    ...schema,
    externalTitle: `${eventName} Call for Speakers`,
    welcomeMessage:
      `Welcome to the ${eventName} call for speakers.\n\nShare a clear session idea, who it is for, and the practical takeaway attendees can expect. The event team will review your proposal and keep you updated through the speaker portal.`,
    participantSection: {
      ...schema.participantSection,
      description:
        "Add the primary speaker and, when relevant, up to two co-speakers. Each speaker will receive private portal access after submission.",
    },
    abstractFields: schema.abstractFields.map((field) =>
      field.id === "track" ? { ...field, options: ["General"] } : field,
    ),
    closeDate: closesAt,
    routingRules: [],
  };
}

async function handleDemoReset(request, env, session) {
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (env.CALLBOARD_DEMO_RESET_ENABLED !== "true")
    return apiError("DEMO_RESET_DISABLED", 403);
  if (
    request.headers.get("x-callboard-demo-confirm") !==
    "reset-synthetic-judge-event"
  )
    return apiError("DEMO_RESET_CONFIRMATION_REQUIRED", 428);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  if (
    parsed.payload.eventSlug &&
    parsed.payload.eventSlug !== "callboard-judge-demo"
  )
    return apiError("DEMO_EVENT_SCOPE_INVALID", 400);

  const timestamp = now();
  const eventId = "event_callboard_judge_demo";
  const organizerPersonId = "person_callboard_judge_organizer";
  const reviewerPersonId = "person_callboard_judge_reviewer";
  const formId = "form_callboard_judge_cfp";
  const roundId = "round_callboard_judge_one";
  const reviewerGrantId = id("grant");
  const reviewerGrantToken = randomToken();
  const reviewerGrantExpiry = futureIso(GRANT_TTL_SECONDS);
  const reviewerEmail = "eventops-reviewer-test@opencallboard.invalid";
  const reviewerName = "Sam Whitfield";
  const eventSettings = {
    dates: "May 12–14, 2027",
    tracks: ["AI Engineering", "Platform & Infra", "Developer Experience"],
    rooms: ["Main Stage", "Room 2A", "Room 2B", "Workshop Lab"],
    groupTypes: ["Exhibitors", "Sponsors"],
    demoWorkspace: true,
  };
  const criteria = [
    { id: "relevance", label: "Audience relevance", weight: 40 },
    { id: "clarity", label: "Clarity", weight: 30 },
    { id: "practicality", label: "Practical value", weight: 30 },
  ];
  const operations = [
    env.CALLBOARD_DB.prepare(
      "DELETE FROM events WHERE id = ?1 OR slug = 'callboard-judge-demo'",
    ).bind(eventId),
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO events (id, slug, name, short_name, timezone, starts_at, ends_at, location, website_url, event_type, theme, settings_json, version, created_at, updated_at)
      VALUES (?1, 'callboard-judge-demo', 'DevFlow Conf 2027', 'DevFlow Conf', 'America/Los_Angeles', '2027-05-12T09:00:00-07:00', '2027-05-14T17:00:00-07:00', 'Moscone West, San Francisco, CA', 'https://example.test/devflow-conf-2027', 'Conference', 'Technology', ?2, 1, ?3, ?3)
    `,
    ).bind(eventId, JSON.stringify(eventSettings), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'Organizer', 1, ?5, ?5)",
    ).bind(organizerPersonId, eventId, session.email, session.name, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'Reviewer', 1, ?5, ?5)",
    ).bind(reviewerPersonId, eventId, reviewerEmail, reviewerName, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, 'organizer', ?3, ?4)",
    ).bind(eventId, session.userId, organizerPersonId, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO cfp_forms (id, event_id, name, status, schema_json, opens_at, closes_at, version, created_at, updated_at) VALUES (?1, ?2, 'DevFlow Conf 2027 Call for Speakers', 'open', ?3, ?4, '2027-05-01T06:59:00Z', 1, ?4, ?4)",
    ).bind(formId, eventId, JSON.stringify(demoCfpSchema()), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO evaluation_rounds (id, event_id, name, number, status, blind, criteria_json, version, created_at, updated_at) VALUES (?1, ?2, 'Round 1 · Technical review', 1, 'active', 1, ?3, 1, ?4, ?4)",
    ).bind(roundId, eventId, JSON.stringify(criteria), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO embeds (id, event_id, name, format, enabled, config_json, version, created_at, updated_at) VALUES ('embed_callboard_judge_schedule', ?1, 'Schedule Itinerary', 'Styled HTML', 1, ?2, 1, ?3, ?3)",
    ).bind(
      eventId,
      JSON.stringify({
        type: "Schedule",
        fields: ["title", "start", "room", "speakers"],
        layout: "Agenda List",
        color: "#2f62e9",
      }),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO embeds (id, event_id, name, format, enabled, config_json, version, created_at, updated_at) VALUES ('embed_callboard_judge_speakers', ?1, 'Accepted Speaker Gallery', 'Styled HTML', 1, ?2, 1, ?3, ?3)",
    ).bind(
      eventId,
      JSON.stringify({
        type: "Speaker",
        fields: ["name", "role"],
        layout: "Cards",
        color: "#2f62e9",
      }),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO schedule_releases (event_id, status, version, updated_at) VALUES (?1, 'draft', 1, ?2)",
    ).bind(eventId, timestamp),
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO access_grants (id, grant_hash, event_id, email, name, role, person_id, expires_at, created_by, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'reviewer', ?6, ?7, ?8, ?9)
    `,
    ).bind(
      reviewerGrantId,
      await sha256(reviewerGrantToken),
      eventId,
      reviewerEmail,
      reviewerName,
      reviewerPersonId,
      reviewerGrantExpiry,
      session.userId,
      timestamp,
    ),
  ];
  await env.CALLBOARD_DB.batch(operations);
  const issued = await issueSession(env, {
    userId: session.userId,
    eventId,
    role: "organizer",
  });
  const response = json(
    {
      ok: true,
      eventId,
      eventSlug: "callboard-judge-demo",
      formId,
      publicFormPath: `/#/submit/${formId}`,
      organizerPath: "/#/dashboard",
      reviewerAccessPath: `/#/access/${reviewerGrantToken}`,
      reviewerAccessExpiresAt: reviewerGrantExpiry,
      scheduleEmbedPath: "/#/embed/embed_callboard_judge_schedule",
      speakerEmbedPath: "/#/embed/embed_callboard_judge_speakers",
      resetAt: timestamp,
    },
    { status: 201 },
  );
  return setSessionCookie(response, issued.token);
}

function safeFileName(value) {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  })();
  return decoded
    .replace(/[\u0000-\u001f\u007f/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function handleFileUpload(request, env, session) {
  if (!env.CALLBOARD_FILES)
    return apiError("OBJECT_STORAGE_NOT_CONFIGURED", 503);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (!["organizer", "speaker"].includes(session.role))
    return apiError("FORBIDDEN", 403);
  const declaredSize = Number(
    request.headers.get("x-callboard-file-size") || 0,
  );
  if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0)
    return apiError("FILE_SIZE_REQUIRED", 411);
  if (declaredSize > MAX_FILE_BYTES) return apiError("FILE_TOO_LARGE", 413);
  const name = safeFileName(request.headers.get("x-callboard-file-name"));
  if (!name) return apiError("FILE_NAME_REQUIRED", 400);
  const mimeType = String(
    request.headers.get("content-type") || "application/octet-stream",
  ).slice(0, 160);
  const kind = String(
    request.headers.get("x-callboard-file-kind") || "Supporting document",
  )
    .trim()
    .slice(0, 80);
  const ownerPersonId =
    session.role === "speaker"
      ? session.personId
      : String(
          request.headers.get("x-callboard-owner-person-id") ||
            session.personId ||
            "",
        );
  if (!ownerPersonId) return apiError("FILE_OWNER_REQUIRED", 400);
  const owner = await env.CALLBOARD_DB.prepare(
    "SELECT id, bio, headshot_url FROM people WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, ownerPersonId)
    .first();
  if (!owner) return apiError("INVALID_PERSON_REFERENCE", 400);
  const submissionId =
    String(request.headers.get("x-callboard-submission-id") || "").trim() ||
    null;
  if (submissionId) {
    const submission = await env.CALLBOARD_DB.prepare(
      `
      SELECT id, submitter_person_id,
        EXISTS(SELECT 1 FROM submission_people WHERE event_id = ?1 AND submission_id = ?2 AND person_id = ?3) AS is_participant
      FROM submissions WHERE event_id = ?1 AND id = ?2 LIMIT 1
    `,
    )
      .bind(session.eventId, submissionId, session.personId)
      .first();
    if (
      !submission ||
      (session.role === "speaker" &&
        submission.submitter_person_id !== session.personId &&
        !submission.is_participant)
    )
      return apiError("INVALID_SUBMISSION_REFERENCE", 400);
  }
  const fileRequestId =
    String(request.headers.get("x-callboard-file-request-id") || "").trim() ||
    null;
  if (fileRequestId) {
    const fileRequest = await env.CALLBOARD_DB.prepare(
      "SELECT id, assignee_person_id, submission_id FROM file_requests WHERE event_id = ?1 AND id = ?2 LIMIT 1",
    )
      .bind(session.eventId, fileRequestId)
      .first();
    if (!fileRequest) return apiError("INVALID_FILE_REQUEST_REFERENCE", 400);
    if (session.role === "speaker") {
      const ownsSubmissionRequest = fileRequest.submission_id
        ? await env.CALLBOARD_DB.prepare(
            `
        SELECT 1 FROM submissions s
        LEFT JOIN submission_people sp ON sp.event_id = s.event_id AND sp.submission_id = s.id AND sp.person_id = ?3
        WHERE s.event_id = ?1 AND s.id = ?2 AND (s.submitter_person_id = ?3 OR sp.person_id = ?3) LIMIT 1
      `,
          )
            .bind(session.eventId, fileRequest.submission_id, session.personId)
            .first()
        : null;
      const visible =
        fileRequest.assignee_person_id === session.personId ||
        Boolean(ownsSubmissionRequest);
      if (!visible) return apiError("FILE_REQUEST_NOT_ASSIGNED", 403);
      if (
        fileRequest.submission_id &&
        submissionId !== fileRequest.submission_id
      )
        return apiError("FILE_REQUEST_SUBMISSION_MISMATCH", 400);
    }
  }
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return apiError("EMPTY_FILE", 400);
  if (bytes.byteLength > MAX_FILE_BYTES) return apiError("FILE_TOO_LARGE", 413);
  if (bytes.byteLength !== declaredSize)
    return apiError("FILE_SIZE_MISMATCH", 400);
  const fileId = id("file");
  const storageKey = `${session.eventId}/${ownerPersonId}/${fileId}-${name}`;
  const timestamp = now();
  const versionRow = fileRequestId
    ? await env.CALLBOARD_DB.prepare(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM file_metadata WHERE event_id = ?1 AND owner_person_id = ?2 AND file_request_id = ?3",
      )
        .bind(session.eventId, ownerPersonId, fileRequestId)
        .first()
    : await env.CALLBOARD_DB.prepare(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM file_metadata WHERE event_id = ?1 AND owner_person_id = ?2 AND file_request_id IS NULL AND lower(kind) = lower(?3) AND lower(name) = lower(?4)",
      )
        .bind(session.eventId, ownerPersonId, kind, name)
        .first();
  const fileVersion = Math.max(1, Number(versionRow?.next_version || 1));
  await env.CALLBOARD_FILES.put(storageKey, bytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { eventId: session.eventId, ownerPersonId, fileId },
  });
  try {
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO file_metadata (id, event_id, owner_person_id, submission_id, file_request_id, kind, name, mime_type, size_bytes, storage_key, status, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'uploaded', ?11, ?12, ?12)
    `,
    )
      .bind(
        fileId,
        session.eventId,
        ownerPersonId,
        submissionId,
        fileRequestId,
        kind,
        name,
        mimeType,
        bytes.byteLength,
        storageKey,
        fileVersion,
        timestamp,
      )
      .run();
    if (kind.toLowerCase() === "headshot") {
      const headshotUrl = `/api/files/${encodeURIComponent(fileId)}/content`;
      await env.CALLBOARD_DB.prepare(
        "UPDATE people SET headshot_url = ?1, version = version + 1, updated_at = ?2 WHERE event_id = ?3 AND id = ?4",
      )
        .bind(headshotUrl, timestamp, session.eventId, ownerPersonId)
        .run();
      if (String(owner.bio || "").trim())
        await env.CALLBOARD_DB.prepare(
          "UPDATE tasks SET status = 'completed', version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND assignee_person_id = ?3 AND kind = 'contact' AND lower(title) = 'complete your speaker profile'",
        )
          .bind(timestamp, session.eventId, ownerPersonId)
          .run();
    }
    if (fileRequestId)
      await env.CALLBOARD_DB.prepare(
        "UPDATE file_requests SET status = 'completed', version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND id = ?3",
      )
        .bind(timestamp, session.eventId, fileRequestId)
        .run();
  } catch (error) {
    await env.CALLBOARD_FILES.delete(storageKey);
    throw error;
  }
  const row = await fetchResourceRow(
    env,
    RESOURCE_SPECS.files,
    session.eventId,
    fileId,
  );
  await touchWorkspace(env, session.eventId, timestamp);
  const updatedOwner = await fetchResourceRow(
    env,
    RESOURCE_SPECS.people,
    session.eventId,
    ownerPersonId,
  );
  return json(
    {
      item: decodeRow(row, RESOURCE_SPECS.files),
      person: updatedOwner
        ? decodeRow(updatedOwner, RESOURCE_SPECS.people)
        : null,
    },
    { status: 201 },
  );
}

async function handleFileContent(request, env, session, fileId) {
  if (!env.CALLBOARD_FILES)
    return apiError("OBJECT_STORAGE_NOT_CONFIGURED", 503);
  const row = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM file_metadata WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, fileId)
    .first();
  if (!row) return apiError("NOT_FOUND", 404);
  if (session.role !== "organizer" && row.owner_person_id !== session.personId)
    return apiError("FORBIDDEN", 403);
  if (!row.storage_key) return apiError("FILE_CONTENT_NOT_AVAILABLE", 404);
  const object = await env.CALLBOARD_FILES.get(row.storage_key);
  if (!object) return apiError("FILE_CONTENT_NOT_AVAILABLE", 404);
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-disposition": `attachment; filename="${safeFileName(row.name).replaceAll('"', "")}"`,
    "content-type": row.mime_type || "application/octet-stream",
    "x-content-type-options": "nosniff",
  });
  if (object.size != null) headers.set("content-length", String(object.size));
  return request.method === "HEAD"
    ? new Response(null, { status: 200, headers })
    : new Response(object.body, { status: 200, headers });
}

async function handleBootstrap(request, env) {
  const dbError = requireDb(env);
  if (dbError) return dbError;

  if (request.method === "GET") {
    const existing = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM events LIMIT 1",
    ).first();
    return json({
      initialized: Boolean(existing),
      writesEnabled: env.CALLBOARD_WRITE_ENABLED === "true",
      sessionAuthConfigured: Boolean(env.CALLBOARD_BOOTSTRAP_SECRET),
    });
  }

  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (!env.CALLBOARD_BOOTSTRAP_SECRET)
    return apiError("BOOTSTRAP_AUTH_NOT_CONFIGURED", 503);
  if (
    !safeEqual(
      request.headers.get("x-callboard-bootstrap-key"),
      env.CALLBOARD_BOOTSTRAP_SECRET,
    )
  )
    return apiError("INVALID_BOOTSTRAP_KEY", 401);

  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const eventInput = parsed.payload.event || {};
  const organizerInput = parsed.payload.organizer || {};
  if (!eventInput.name || !organizerInput.email || !organizerInput.name)
    return apiError("BOOTSTRAP_FIELDS_REQUIRED", 400, [
      "event.name",
      "organizer.name",
      "organizer.email",
    ]);
  const existing = await env.CALLBOARD_DB.prepare(
    "SELECT id FROM events LIMIT 1",
  ).first();
  if (existing) return apiError("ALREADY_INITIALIZED", 409);

  const eventId = id("event");
  const userId = id("user");
  const personId = id("person");
  const timestamp = now();
  const slug =
    String(eventInput.slug || eventInput.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || eventId;
  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      `INSERT INTO events (id, slug, name, short_name, timezone, starts_at, ends_at, location, website_url, event_type, theme, settings_json, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, ?13, ?13)`,
    ).bind(
      eventId,
      slug,
      String(eventInput.name),
      eventInput.shortName || null,
      eventInput.timezone || "UTC",
      eventInput.startsAt || null,
      eventInput.endsAt || null,
      eventInput.location || null,
      eventInput.website || null,
      eventInput.type || null,
      eventInput.theme || null,
      JSON.stringify(eventInput.settings || {}),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)`,
    ).bind(
      userId,
      String(organizerInput.email).toLowerCase(),
      String(organizerInput.name),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'Organizer', 1, ?5, ?5)`,
    ).bind(
      personId,
      eventId,
      String(organizerInput.email).toLowerCase(),
      String(organizerInput.name),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, 'organizer', ?3, ?4)`,
    ).bind(eventId, userId, personId, timestamp),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO evaluation_rounds (id, event_id, name, number, status, blind, criteria_json, version, created_at, updated_at) VALUES (?1, ?2, 'Round 1 · Technical review', 1, 'open', 1, ?3, 1, ?4, ?4)`,
    ).bind(
      `evaluation_round_1_${eventId}`,
      eventId,
      JSON.stringify([
        { id: "relevance", label: "Program relevance", weight: 30 },
        { id: "originality", label: "Originality", weight: 20 },
        { id: "technical", label: "Technical depth", weight: 30 },
        { id: "practical", label: "Practical value", weight: 20 },
      ]),
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at) VALUES (?1, ?2, 'Incomplete speaker profile', 'general-reminder', 'all-speakers', 7, 'days before event', '7 days before event', 1, 1, ?3, ?3)`,
    ).bind(`communication_reminder_profile_${eventId}`, eventId, timestamp),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at) VALUES (?1, ?2, 'Outstanding task deadline', 'task-due', 'incomplete-tasks', 3, 'days before task due', '3 days before task due', 1, 1, ?3, ?3)`,
    ).bind(`communication_reminder_task_${eventId}`, eventId, timestamp),
    env.CALLBOARD_DB.prepare(
      `INSERT INTO communication_reminders (id, event_id, name, template_id, segment, amount, unit, timing, enabled, version, created_at, updated_at) VALUES (?1, ?2, 'Upcoming session', 'session-scheduled', 'accepted-speakers', 24, 'hours before session', '24 hours before session', 0, 1, ?3, ?3)`,
    ).bind(`communication_reminder_session_${eventId}`, eventId, timestamp),
  ]);
  const issued = await issueSession(env, {
    userId,
    eventId,
    role: "organizer",
  });
  return setSessionCookie(
    json(
      {
        ok: true,
        eventId,
        user: {
          id: userId,
          email: String(organizerInput.email).toLowerCase(),
          name: String(organizerInput.name),
          role: "organizer",
          personId,
        },
        expiresAt: issued.expiresAt,
      },
      { status: 201 },
    ),
    issued.token,
  );
}

async function accountEvents(env, userId) {
  const result = await env.CALLBOARD_DB.prepare(
    `
    SELECT e.id, e.slug, e.name, e.short_name, e.timezone, e.starts_at, e.ends_at,
      e.location, e.updated_at,
      (SELECT id FROM cfp_forms WHERE event_id = e.id ORDER BY created_at ASC LIMIT 1) AS form_id,
      (SELECT id FROM embeds WHERE event_id = e.id AND enabled = 1 AND json_extract(config_json, '$.type') = 'Schedule' ORDER BY created_at ASC LIMIT 1) AS schedule_embed_id,
      (SELECT id FROM embeds WHERE event_id = e.id AND enabled = 1 AND json_extract(config_json, '$.type') = 'Speaker' ORDER BY created_at ASC LIMIT 1) AS speaker_embed_id
    FROM event_memberships m
    JOIN events e ON e.id = m.event_id
    WHERE m.user_id = ?1 AND m.role = 'organizer'
    ORDER BY e.updated_at DESC, e.created_at DESC
  `,
  )
    .bind(userId)
    .all();
  return (result.results || []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    timezone: row.timezone,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    updatedAt: row.updated_at,
    formId: row.form_id || null,
    scheduleEmbedId: row.schedule_embed_id || null,
    speakerEmbedId: row.speaker_embed_id || null,
  }));
}

async function handleOrganizerLoginRequest(request, env) {
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const deliveryAvailable =
    env.CALLBOARD_SELF_SERVE_DEV_LINKS === "true" ||
    (env.CALLBOARD_SELF_SERVE_EMAIL_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_QUEUE &&
      transactionalEmailConfigured(env));
  if (!deliveryAvailable) return apiError("ORGANIZER_LOGIN_DELIVERY_UNAVAILABLE", 503);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const email = String(parsed.payload.email || "").trim().toLowerCase();
  const name = String(parsed.payload.name || "").trim().slice(0, 120);
  if (!validEmail(email)) return apiError("VALID_EMAIL_REQUIRED", 400);
  if (!(await verifyTurnstile(request, env, parsed.payload.turnstileToken)))
    return apiError("TURNSTILE_VERIFICATION_FAILED", 400);

  const ip = String(request.headers.get("CF-Connecting-IP") || "unknown");
  const ipHash = await sha256(`organizer-login:${ip}`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const limits = await env.CALLBOARD_DB.prepare(
    `
    SELECT
      SUM(CASE WHEN email = ?1 COLLATE NOCASE THEN 1 ELSE 0 END) AS email_count,
      SUM(CASE WHEN request_ip_hash = ?2 THEN 1 ELSE 0 END) AS ip_count
    FROM organizer_login_challenges
    WHERE created_at > ?3
  `,
  )
    .bind(email, ipHash, since)
    .first();
  if (Number(limits?.email_count || 0) >= 5 || Number(limits?.ip_count || 0) >= 20)
    return apiError("LOGIN_RATE_LIMITED", 429);

  const token = randomToken();
  const challengeId = id("organizer_login");
  const createdAt = now();
  const expiresAt = futureIso(ORGANIZER_LOGIN_TTL_SECONDS);
  const development = env.CALLBOARD_SELF_SERVE_DEV_LINKS === "true";
  await env.CALLBOARD_DB.prepare(
    `
    INSERT INTO organizer_login_challenges
      (id, token_hash, email, name, request_ip_hash, expires_at, delivery_status, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `,
  )
    .bind(
      challengeId,
      await sha256(token),
      email,
      name || null,
      ipHash,
      expiresAt,
      development ? "development" : "queued",
      createdAt,
    )
    .run();
  if (!development) {
    await env.CALLBOARD_EMAIL_QUEUE.send({
      version: 1,
      type: "organizer_magic_link",
      challengeId,
      token,
    });
  }
  const origin = String(env.CALLBOARD_PUBLIC_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
  return json(
    {
      ok: true,
      expiresAt,
      ...(development
        ? { developmentAccessPath: `/#/organizer-access/${encodeURIComponent(token)}`, developmentAccessUrl: `${origin}/#/organizer-access/${encodeURIComponent(token)}` }
        : {}),
    },
    { status: 202 },
  );
}

async function handleOrganizerLoginRedeem(request, env) {
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const token = String(parsed.payload.token || "").trim();
  if (!token) return apiError("LOGIN_TOKEN_REQUIRED", 400);
  const timestamp = now();
  const challenge = await env.CALLBOARD_DB.prepare(
    `
    SELECT id, email, name
    FROM organizer_login_challenges
    WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2
    LIMIT 1
  `,
  )
    .bind(await sha256(token), timestamp)
    .first();
  if (!challenge) return apiError("INVALID_OR_EXPIRED_LOGIN", 401);
  const claim = await env.CALLBOARD_DB.prepare(
    "UPDATE organizer_login_challenges SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL",
  )
    .bind(timestamp, challenge.id)
    .run();
  if (!claim.meta?.changes) return apiError("INVALID_OR_EXPIRED_LOGIN", 401);

  let user = await env.CALLBOARD_DB.prepare(
    "SELECT id, email, name FROM users WHERE email = ?1 COLLATE NOCASE LIMIT 1",
  )
    .bind(challenge.email)
    .first();
  if (!user) {
    const userId = id("user");
    const fallbackName = String(challenge.name || challenge.email.split("@")[0]).trim().slice(0, 120);
    await env.CALLBOARD_DB.prepare(
      "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
    )
      .bind(userId, challenge.email, fallbackName, timestamp)
      .run();
    user = { id: userId, email: challenge.email, name: fallbackName };
  } else if (challenge.name && challenge.name !== user.name) {
    await env.CALLBOARD_DB.prepare(
      "UPDATE users SET name = ?1, updated_at = ?2 WHERE id = ?3",
    )
      .bind(challenge.name, timestamp, user.id)
      .run();
    user.name = challenge.name;
  }
  const issued = await issueAccountSession(env, user.id);
  const events = await accountEvents(env, user.id);
  return setAccountCookie(
    json(
      {
        authenticated: true,
        sessionType: "account",
        userId: user.id,
        email: user.email,
        name: user.name,
        expiresAt: issued.expiresAt,
        events,
      },
      { status: 201 },
    ),
    issued.token,
  );
}

async function handleAccount(request, env, url) {
  const account = await authenticateAccount(request, env);
  if (account.response) return account.response;
  const session = account.session;
  if (request.method === "GET" && url.pathname === "/api/account")
    return json({ authenticated: true, sessionType: "account", ...session, events: await accountEvents(env, session.userId) });
  if (request.method === "GET" && url.pathname === "/api/account/events")
    return json({ items: await accountEvents(env, session.userId) });
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;

  const selectMatch = url.pathname.match(/^\/api\/account\/events\/([^/]+)\/select$/);
  if (selectMatch) {
    const eventId = decodeURIComponent(selectMatch[1]);
    const membership = await env.CALLBOARD_DB.prepare(
      "SELECT person_id FROM event_memberships WHERE event_id = ?1 AND user_id = ?2 AND role = 'organizer' LIMIT 1",
    )
      .bind(eventId, session.userId)
      .first();
    if (!membership) return apiError("EVENT_ACCESS_DENIED", 403);
    const issued = await issueSession(env, { userId: session.userId, eventId, role: "organizer" });
    return setSessionCookie(
      json({ authenticated: true, userId: session.userId, eventId, role: "organizer", personId: membership.person_id || null, expiresAt: issued.expiresAt }, { status: 201 }),
      issued.token,
    );
  }

  if (url.pathname !== "/api/account/events") return apiError("NOT_FOUND", 404);
  const ownedEventCount = await env.CALLBOARD_DB.prepare(
    "SELECT COUNT(DISTINCT event_id) AS count FROM event_memberships WHERE user_id = ?1 AND role = 'organizer'",
  )
    .bind(session.userId)
    .first();
  if (Number(ownedEventCount?.count || 0) >= 3)
    return apiError("EVENT_LIMIT_REACHED", 409);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const input = parsed.payload;
  const name = String(input.name || "").trim().slice(0, 160);
  const timezone = String(input.timezone || "UTC").trim();
  const startsAt = String(input.startsAt || "").trim();
  const endsAt = String(input.endsAt || "").trim();
  const slug = eventSlug(input.slug || name);
  if (!name || !slug || !validTimezone(timezone))
    return apiError("EVENT_FIELDS_INVALID", 400, ["name", "timezone"]);
  if (startsAt && !Number.isFinite(Date.parse(startsAt)))
    return apiError("EVENT_START_INVALID", 400);
  if (endsAt && (!Number.isFinite(Date.parse(endsAt)) || (startsAt && Date.parse(endsAt) < Date.parse(startsAt))))
    return apiError("EVENT_END_INVALID", 400);
  const existingSlug = await env.CALLBOARD_DB.prepare("SELECT id FROM events WHERE slug = ?1 LIMIT 1").bind(slug).first();
  if (existingSlug) return apiError("EVENT_SLUG_TAKEN", 409);

  const eventId = id("event");
  const personId = id("person");
  const formId = id("form");
  const roundId = id("evaluation_round");
  const scheduleEmbedId = id("embed_schedule");
  const speakerEmbedId = id("embed_speakers");
  const timestamp = now();
  const eventStartMs = startsAt ? Date.parse(startsAt) : Date.now() + 90 * 24 * 60 * 60 * 1000;
  const closesAt = new Date(eventStartMs - 14 * 24 * 60 * 60 * 1000).toISOString();
  const cfpSchema = selfServeCfpSchema(name, closesAt);
  const settings = {
    tracks: ["General"],
    rooms: ["Main Stage"],
    groupTypes: ["Sponsors", "Exhibitors"],
    selfServeWorkspace: true,
  };
  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      `INSERT INTO events (id, slug, name, short_name, timezone, starts_at, ends_at, location, website_url, event_type, theme, settings_json, version, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'Conference', 'Technology', ?10, 1, ?11, ?11)`,
    ).bind(eventId, slug, name, String(input.shortName || name).trim().slice(0, 80), timezone, startsAt || null, endsAt || null, String(input.location || "").trim() || null, String(input.website || "").trim() || null, JSON.stringify(settings), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'Organizer', 1, ?5, ?5)",
    ).bind(personId, eventId, session.email, session.name, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    ).bind(eventId, session.userId, "organizer", personId, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO cfp_forms (id, event_id, name, status, schema_json, opens_at, closes_at, version, created_at, updated_at) VALUES (?1, ?2, ?3, 'open', ?4, ?5, ?6, 1, ?7, ?7)",
    ).bind(formId, eventId, `${name} Call for Speakers`, JSON.stringify(cfpSchema), timestamp, closesAt, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO evaluation_rounds (id, event_id, name, number, status, blind, criteria_json, version, created_at, updated_at) VALUES (?1, ?2, 'Initial Review', 1, 'active', 1, ?3, 1, ?4, ?4)",
    ).bind(roundId, eventId, JSON.stringify([{ id: "relevance", label: "Program relevance", weight: 40 }, { id: "originality", label: "Originality", weight: 30 }, { id: "practical", label: "Practical value", weight: 30 }]), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO schedule_releases (event_id, status, version, updated_at) VALUES (?1, 'draft', 1, ?2)",
    ).bind(eventId, timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO embeds (id, event_id, name, format, enabled, config_json, version, created_at, updated_at) VALUES (?1, ?2, 'Public schedule', 'Styled HTML', 1, ?3, 1, ?4, ?4)",
    ).bind(scheduleEmbedId, eventId, JSON.stringify({ type: "Schedule", fields: ["title", "start", "room", "speakers"], layout: "Agenda List", color: "#2f62e9" }), timestamp),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO embeds (id, event_id, name, format, enabled, config_json, version, created_at, updated_at) VALUES (?1, ?2, 'Speaker gallery', 'Styled HTML', 1, ?3, 1, ?4, ?4)",
    ).bind(speakerEmbedId, eventId, JSON.stringify({ type: "Speaker", fields: ["name", "role", "bio"], layout: "Cards", color: "#2f62e9" }), timestamp),
  ]);
  const issued = await issueSession(env, { userId: session.userId, eventId, role: "organizer" });
  return setSessionCookie(
    json({ item: { id: eventId, slug, name, timezone, startsAt: startsAt || null, endsAt: endsAt || null, formId, scheduleEmbedId, speakerEmbedId }, expiresAt: issued.expiresAt }, { status: 201 }),
    issued.token,
  );
}

async function handleSession(request, env) {
  const dbError = requireDb(env);
  if (dbError) return dbError;

  if (request.method === "GET") {
    const authenticated = await authenticate(request, env);
    if (!authenticated.response)
      return json({ authenticated: true, sessionType: "event", ...authenticated.session });
    const account = await authenticateAccount(request, env);
    if (account.response) return authenticated.response;
    return json({
      authenticated: true,
      sessionType: "account",
      role: "account",
      ...account.session,
      events: await accountEvents(env, account.session.userId),
    });
  }

  if (request.method === "DELETE") {
    const authenticated = await authenticate(request, env);
    const account = await authenticateAccount(request, env);
    if (authenticated.response && account.response)
      return authenticated.response;
    if (!authenticated.response && authenticated.session.authType === "api_token")
      return apiError("BROWSER_SESSION_REQUIRED", 403);
    const timestamp = now();
    const writes = [];
    if (!authenticated.response)
      writes.push(
        env.CALLBOARD_DB.prepare(
          "UPDATE auth_sessions SET revoked_at = ?1 WHERE id = ?2",
        ).bind(timestamp, authenticated.session.sessionId),
      );
    if (!account.response)
      writes.push(
        env.CALLBOARD_DB.prepare(
          "UPDATE account_sessions SET revoked_at = ?1 WHERE id = ?2",
        ).bind(timestamp, account.session.sessionId),
      );
    if (writes.length) await env.CALLBOARD_DB.batch(writes);
    return clearAccountCookie(
      clearSessionCookie(
        new Response(null, {
          status: 204,
          headers: { "cache-control": "no-store" },
        }),
      ),
    );
  }

  const writeError = requireWrites(env);
  if (writeError) return writeError;

  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const grantToken = String(parsed.payload.grantToken || "");
  if (!grantToken) return apiError("GRANT_TOKEN_REQUIRED", 400);
  const timestamp = now();
  const grant = await env.CALLBOARD_DB.prepare(
    `
    SELECT id, event_id, email, name, role, person_id
    FROM access_grants
    WHERE grant_hash = ?1 AND used_at IS NULL AND expires_at > ?2
    LIMIT 1
  `,
  )
    .bind(await sha256(grantToken), timestamp)
    .first();
  if (!grant || !ROLES.has(grant.role))
    return apiError("INVALID_OR_EXPIRED_GRANT", 401);

  const claim = await env.CALLBOARD_DB.prepare(
    "UPDATE access_grants SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL",
  )
    .bind(timestamp, grant.id)
    .run();
  if (!claim.meta?.changes) return apiError("INVALID_OR_EXPIRED_GRANT", 401);

  let user = await env.CALLBOARD_DB.prepare(
    "SELECT id FROM users WHERE email = ?1 LIMIT 1",
  )
    .bind(grant.email)
    .first();
  const userId = user?.id || id("user");
  const personId = grant.person_id || id("person");
  const operations = [];
  if (!user)
    operations.push(
      env.CALLBOARD_DB.prepare(
        "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
      ).bind(userId, grant.email, grant.name, timestamp),
    );
  if (!grant.person_id)
    operations.push(
      env.CALLBOARD_DB.prepare(
        "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)",
      ).bind(
        personId,
        grant.event_id,
        grant.email,
        grant.name,
        grant.role === "speaker" ? "Speaker" : "Reviewer",
        timestamp,
      ),
    );
  operations.push(
    env.CALLBOARD_DB.prepare(
      "INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(event_id, user_id, role) DO UPDATE SET person_id = excluded.person_id",
    ).bind(grant.event_id, userId, grant.role, personId, timestamp),
  );
  await env.CALLBOARD_DB.batch(operations);
  await touchWorkspace(env, grant.event_id, timestamp);
  const issued = await issueSession(env, {
    userId,
    eventId: grant.event_id,
    role: grant.role,
  });
  return setSessionCookie(
    json(
      {
        authenticated: true,
        userId,
        eventId: grant.event_id,
        role: grant.role,
        personId,
        expiresAt: issued.expiresAt,
      },
      { status: 201 },
    ),
    issued.token,
  );
}

async function handleOrganizerSession(request, env) {
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (
    !env.CALLBOARD_BOOTSTRAP_SECRET &&
    !env.CALLBOARD_JUDGE_ACCESS_SECRET
  )
    return apiError("ORGANIZER_AUTH_NOT_CONFIGURED", 503);
  const suppliedKey = request.headers.get("x-callboard-bootstrap-key");
  const operatorAccess = Boolean(
    env.CALLBOARD_BOOTSTRAP_SECRET &&
      safeEqual(suppliedKey, env.CALLBOARD_BOOTSTRAP_SECRET),
  );
  const judgeAccess = Boolean(
    env.CALLBOARD_JUDGE_ACCESS_SECRET &&
      safeEqual(suppliedKey, env.CALLBOARD_JUDGE_ACCESS_SECRET),
  );
  if (!operatorAccess && !judgeAccess)
    return apiError("INVALID_ORGANIZER_KEY", 401);
  if (judgeAccess) {
    const expiresAt = Date.parse(
      String(env.CALLBOARD_JUDGE_ACCESS_EXPIRES_AT || ""),
    );
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      return apiError("JUDGE_ACCESS_EXPIRED", 401);
    const event = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM events WHERE id = ?1 LIMIT 1",
    )
      .bind(COMPETITION_JUDGE_EVENT_ID)
      .first();
    if (!event) return apiError("JUDGE_EVENT_NOT_AVAILABLE", 409);
    const [existingJudgeUser, existingJudgePerson] = await Promise.all([
      env.CALLBOARD_DB.prepare(
        "SELECT id FROM users WHERE email = ?1 COLLATE NOCASE LIMIT 1",
      )
        .bind(COMPETITION_JUDGE_EMAIL)
        .first(),
      env.CALLBOARD_DB.prepare(
        "SELECT id FROM people WHERE event_id = ?1 AND email = ?2 COLLATE NOCASE LIMIT 1",
      )
        .bind(COMPETITION_JUDGE_EVENT_ID, COMPETITION_JUDGE_EMAIL)
        .first(),
    ]);
    const judgeUserId = existingJudgeUser?.id || COMPETITION_JUDGE_USER_ID;
    const judgePersonId =
      existingJudgePerson?.id || COMPETITION_JUDGE_PERSON_ID;
    const timestamp = now();
    const judgeUserWrite = existingJudgeUser
      ? env.CALLBOARD_DB.prepare(
          "UPDATE users SET email = ?1, name = ?2, updated_at = ?3 WHERE id = ?4",
        ).bind(
          COMPETITION_JUDGE_EMAIL,
          COMPETITION_JUDGE_NAME,
          timestamp,
          judgeUserId,
        )
      : env.CALLBOARD_DB.prepare(
          "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        ).bind(
          judgeUserId,
          COMPETITION_JUDGE_EMAIL,
          COMPETITION_JUDGE_NAME,
          timestamp,
        );
    const judgePersonWrite = existingJudgePerson
      ? env.CALLBOARD_DB.prepare(
          "UPDATE people SET email = ?1, name = ?2, role = 'Organizer', version = version + 1, updated_at = ?3 WHERE event_id = ?4 AND id = ?5",
        ).bind(
          COMPETITION_JUDGE_EMAIL,
          COMPETITION_JUDGE_NAME,
          timestamp,
          COMPETITION_JUDGE_EVENT_ID,
          judgePersonId,
        )
      : env.CALLBOARD_DB.prepare(
          "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 'Organizer', 1, ?5, ?5)",
        ).bind(
          judgePersonId,
          COMPETITION_JUDGE_EVENT_ID,
          COMPETITION_JUDGE_EMAIL,
          COMPETITION_JUDGE_NAME,
          timestamp,
        );
    await env.CALLBOARD_DB.batch([
      judgeUserWrite,
      judgePersonWrite,
      env.CALLBOARD_DB.prepare(
        `INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at)
         VALUES (?1, ?2, 'organizer', ?3, ?4)
         ON CONFLICT(event_id, user_id, role) DO UPDATE SET person_id = excluded.person_id`,
      ).bind(
        COMPETITION_JUDGE_EVENT_ID,
        judgeUserId,
        judgePersonId,
        timestamp,
      ),
    ]);
    const issued = await issueSession(env, {
      userId: judgeUserId,
      eventId: COMPETITION_JUDGE_EVENT_ID,
      role: "organizer",
    });
    return setSessionCookie(
      json(
        {
          authenticated: true,
          accessMode: "competition_judge",
          userId: judgeUserId,
          eventId: COMPETITION_JUDGE_EVENT_ID,
          role: "organizer",
          personId: judgePersonId,
          email: COMPETITION_JUDGE_EMAIL,
          name: COMPETITION_JUDGE_NAME,
          expiresAt: issued.expiresAt,
        },
        { status: 201 },
      ),
      issued.token,
    );
  }
  const organizer = await env.CALLBOARD_DB.prepare(
    `
    SELECT m.event_id, m.user_id, m.person_id, u.email, u.name
    FROM event_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.role = 'organizer'
    ORDER BY m.created_at DESC, m.rowid DESC
    LIMIT 1
  `,
  ).first();
  if (!organizer) return apiError("ORGANIZER_NOT_INITIALIZED", 409);
  const issued = await issueSession(env, {
    userId: organizer.user_id,
    eventId: organizer.event_id,
    role: "organizer",
  });
  return setSessionCookie(
    json(
      {
        authenticated: true,
        userId: organizer.user_id,
        eventId: organizer.event_id,
        role: "organizer",
        personId: organizer.person_id,
        email: organizer.email,
        name: organizer.name,
        expiresAt: issued.expiresAt,
      },
      { status: 201 },
    ),
    issued.token,
  );
}

function apiTokenPayload(row) {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    scopes: parseApiScopes(row.scopes_json),
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at || null,
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at,
  };
}

async function handleApiTokens(request, env, session, tokenId = null) {
  if (session.role !== "organizer" || session.authType === "api_token")
    return apiError("FORBIDDEN", 403);

  if (request.method === "GET" && !tokenId) {
    const rows = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM api_tokens WHERE event_id = ?1 ORDER BY created_at DESC, id DESC",
    )
      .bind(session.eventId)
      .all();
    return json({ items: (rows.results || []).map(apiTokenPayload) });
  }

  const writeError = requireWrites(env);
  if (writeError) return writeError;

  if (request.method === "POST" && !tokenId) {
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    const name = String(parsed.payload.name || "")
      .trim()
      .slice(0, 80);
    const requestedScopes = Array.isArray(parsed.payload.scopes)
      ? [...new Set(parsed.payload.scopes.map(String))]
      : [];
    const scopes = requestedScopes.length
      ? requestedScopes
      : [
          "event:read",
          "forms:read",
          "submissions:read",
          "people:read",
          "reviews:read",
          "sessions:read",
          "tasks:read",
          "resources:read",
          "files:read",
          "embeds:read",
          "integrations:read",
        ];
    const expiresInDays = Number(parsed.payload.expiresInDays ?? 30);
    if (!name) return apiError("API_TOKEN_NAME_REQUIRED", 400);
    if (scopes.length > 32 || scopes.some((scope) => !validApiScope(scope)))
      return apiError("INVALID_API_TOKEN_SCOPES", 400);
    if (
      !Number.isInteger(expiresInDays) ||
      expiresInDays < 1 ||
      expiresInDays > API_TOKEN_MAX_DAYS
    )
      return apiError("INVALID_API_TOKEN_EXPIRY", 400, {
        maxDays: API_TOKEN_MAX_DAYS,
      });
    const plaintext = apiTokenValue();
    const timestamp = now();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const created = {
      id: id("api_token"),
      name,
      token_prefix: `${plaintext.slice(0, 12)}…`,
      scopes_json: JSON.stringify(scopes),
      expires_at: expiresAt,
      last_used_at: null,
      revoked_at: null,
      created_at: timestamp,
    };
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO api_tokens (id, event_id, created_by_user_id, name, token_hash, token_prefix, scopes_json, expires_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `,
    )
      .bind(
        created.id,
        session.eventId,
        session.userId,
        name,
        await sha256(plaintext),
        created.token_prefix,
        created.scopes_json,
        expiresAt,
        timestamp,
      )
      .run();
    return json(
      { item: apiTokenPayload(created), token: plaintext },
      { status: 201 },
    );
  }

  if (request.method === "DELETE" && tokenId) {
    const revokedAt = now();
    const result = await env.CALLBOARD_DB.prepare(
      "UPDATE api_tokens SET revoked_at = ?1 WHERE id = ?2 AND event_id = ?3 AND revoked_at IS NULL",
    )
      .bind(revokedAt, tokenId, session.eventId)
      .run();
    if (!result.meta?.changes) return apiError("NOT_FOUND", 404);
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}

async function handleAccessGrants(request, env, session) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const role = String(parsed.payload.role || "").toLowerCase();
  const email = String(parsed.payload.email || "")
    .trim()
    .toLowerCase();
  const name = String(parsed.payload.name || "").trim();
  if (!ROLES.has(role) || role === "organizer" || !email || !name)
    return apiError("INVALID_ACCESS_GRANT", 400);
  let personId = String(parsed.payload.personId || "").trim() || null;
  let existingPerson = null;
  if (personId) {
    existingPerson = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM people WHERE event_id = ?1 AND id = ?2 LIMIT 1",
    )
      .bind(session.eventId, personId)
      .first();
    if (!existingPerson) return apiError("INVALID_PERSON_REFERENCE", 400);
    if (String(existingPerson.email || "").toLowerCase() !== email)
      return apiError("PERSON_EMAIL_MISMATCH", 400);
  } else {
    existingPerson = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM people WHERE event_id = ?1 AND email = ?2 COLLATE NOCASE LIMIT 1",
    )
      .bind(session.eventId, email)
      .first();
    personId = existingPerson?.id || null;
  }
  const existingUser = await env.CALLBOARD_DB.prepare(
    "SELECT id FROM users WHERE email = ?1 COLLATE NOCASE LIMIT 1",
  )
    .bind(email)
    .first();
  const userId = existingUser?.id || id("user");
  personId ||= id("person");
  const token = randomToken();
  const grantId = id("grant");
  const createdAt = now();
  const expiresAt = futureIso(GRANT_TTL_SECONDS);
  const operations = [];
  if (!existingUser)
    operations.push(
      env.CALLBOARD_DB.prepare(
        "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
      ).bind(userId, email, name, createdAt),
    );
  if (!existingPerson)
    operations.push(
      env.CALLBOARD_DB.prepare(
        "INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)",
      ).bind(
        personId,
        session.eventId,
        email,
        name,
        role === "speaker" ? "Speaker" : "Reviewer",
        createdAt,
      ),
    );
  operations.push(
    env.CALLBOARD_DB.prepare(
      "INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(event_id, user_id, role) DO UPDATE SET person_id = excluded.person_id",
    ).bind(session.eventId, userId, role, personId, createdAt),
    env.CALLBOARD_DB.prepare(
      `
    INSERT INTO access_grants (id, grant_hash, event_id, email, name, role, person_id, expires_at, created_by, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
  `,
    ).bind(
      grantId,
      await sha256(token),
      session.eventId,
      email,
      name,
      role,
      personId,
      expiresAt,
      session.userId,
      createdAt,
    ),
  );
  await env.CALLBOARD_DB.batch(operations);
  await touchWorkspace(env, session.eventId, createdAt);
  const deliveryRequested = parsed.payload.deliver === true;
  const deliveryConfigured = Boolean(
    env.CALLBOARD_IDENTITY_EMAIL_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_QUEUE &&
      transactionalEmailConfigured(env),
  );
  if (deliveryRequested && deliveryConfigured)
    await env.CALLBOARD_EMAIL_QUEUE.send({
      version: 1,
      type: "role_access_link",
      grantId,
      token,
    });
  const person = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM people WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  ).bind(session.eventId, personId).first();
  return json(
    {
      id: grantId,
      grantToken: token,
      role,
      email,
      name: person?.name || name,
      userId,
      personId,
      person: decodeRow(person, RESOURCE_SPECS.people),
      matchedExistingIdentity: Boolean(existingPerson),
      expiresAt,
      deliveryStatus: deliveryRequested
        ? deliveryConfigured
          ? "queued"
          : "unavailable"
        : "not_requested",
    },
    { status: 201 },
  );
}

function parseStoredJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function sanitizePublicBiography(value) {
  return String(value || "").trim();
}

function publicFormPayload(row) {
  const schema = parseStoredJson(row.schema_json, {});
  return {
    ...schema,
    id: row.id,
    name: row.name,
    status: row.status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    closeDate: row.closes_at || schema.closeDate || "",
    event: {
      id: row.event_id,
      slug: row.event_slug,
      name: row.event_name,
      timezone: row.event_timezone,
    },
  };
}

function comparableRoutingValue(value) {
  return (Array.isArray(value) ? value.join(",") : String(value ?? ""))
    .trim()
    .toLowerCase();
}

function resolvePublicRouting(schema, answers) {
  const rules = Array.isArray(schema?.routingRules) ? schema.routingRules : [];
  return (
    rules.find((rule) => {
      if (!rule || typeof rule !== "object") return false;
      const value = answers?.[rule.fieldId] ?? answers?.[rule.fieldLabel];
      return (
        comparableRoutingValue(value) === comparableRoutingValue(rule.equals)
      );
    }) || null
  );
}

async function findPublicForm(env, formId) {
  return env.CALLBOARD_DB.prepare(
    `
    SELECT f.*, e.slug AS event_slug, e.name AS event_name, e.timezone AS event_timezone,
      e.settings_json AS event_settings_json
    FROM cfp_forms f
    JOIN events e ON e.id = f.event_id
    WHERE f.id = ?1 AND lower(f.status) IN ('open', 'published')
    LIMIT 1
  `,
  )
    .bind(formId)
    .first();
}

function participantPolicy(schema) {
  const enabledRole = Array.isArray(schema.participantRoles)
    ? schema.participantRoles.find((role) => role && role.enabled !== false)
    : null;
  const minimum = Math.max(1, Number(enabledRole?.min || 1));
  const maximum = Math.min(
    10,
    Math.max(minimum, Number(enabledRole?.max || 3)),
  );
  return { label: String(enabledRole?.label || "Speaker"), minimum, maximum };
}

async function publicSubmissionPayload(env, eventId, submissionId) {
  const submission = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM submissions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(eventId, submissionId)
    .first();
  if (!submission) return null;
  const people = await env.CALLBOARD_DB.prepare(
    `
    SELECT p.id, p.name, p.email, p.role, p.title, p.company, p.bio,
           p.headshot_url AS headshotUrl, sp.sort_order
    FROM submission_people sp
    JOIN people p ON p.event_id = sp.event_id AND p.id = sp.person_id
    WHERE sp.event_id = ?1 AND sp.submission_id = ?2
    ORDER BY sp.sort_order ASC
  `,
  )
    .bind(eventId, submissionId)
    .all();
  return {
    id: submission.id,
    formId: submission.form_id,
    submitterPersonId: submission.submitter_person_id,
    title: submission.title,
    abstract: submission.abstract,
    status: submission.status,
    category: submission.category,
    answers: parseStoredJson(submission.answers_json, {}),
    reviewRoute: submission.review_route || "Round 1 · Technical review",
    routingRuleId: submission.routing_rule_id || null,
    round: Number(submission.round || 1),
    version: Number(submission.version || 1),
    participants: people.results || [],
    createdAt: submission.created_at,
    updatedAt: submission.updated_at,
  };
}

async function handlePublicForm(request, env, formId, action) {
  const dbError = requireDb(env);
  if (dbError) return dbError;
  const formRow = await findPublicForm(env, formId);
  if (!formRow) return apiError("PUBLIC_FORM_NOT_FOUND", 404);

  if (request.method === "GET" && !action)
    return json({ form: publicFormPayload(formRow) });
  if (request.method !== "POST" || action !== "submissions")
    return apiError("METHOD_NOT_ALLOWED", 405);

  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (formRow.opens_at && new Date(formRow.opens_at).getTime() > Date.now())
    return apiError("FORM_NOT_OPEN", 409);
  if (formRow.closes_at && new Date(formRow.closes_at).getTime() < Date.now())
    return apiError("FORM_CLOSED", 409);

  const idempotencyKey = String(
    request.headers.get("idempotency-key") || "",
  ).trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120)
    return apiError("IDEMPOTENCY_KEY_REQUIRED", 400);
  const existingKey = await env.CALLBOARD_DB.prepare(
    "SELECT resource_id FROM idempotency_keys WHERE event_id = ?1 AND action = 'public-cfp-submit' AND key = ?2 LIMIT 1",
  )
    .bind(formRow.event_id, idempotencyKey)
    .first();
  if (existingKey) {
    const existing = await publicSubmissionPayload(
      env,
      formRow.event_id,
      existingKey.resource_id,
    );
    return existing
      ? json({ item: existing, replayed: true })
      : apiError("IDEMPOTENCY_RECORD_INVALID", 409);
  }

  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const payload = parsed.payload;
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const title = String(payload.title || "").trim();
  const abstract = String(payload.abstract || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || !title)
    return apiError("PUBLIC_SUBMISSION_FIELDS_REQUIRED", 400, [
      "email",
      "title",
    ]);

  const schema = parseStoredJson(formRow.schema_json, {});
  const draftToken = String(payload.draftToken || "").trim();
  const draftRow = draftToken
    ? await env.CALLBOARD_DB.prepare(
        `
    SELECT * FROM cfp_drafts
    WHERE event_id = ?1 AND form_id = ?2 AND resume_token_hash = ?3
      AND submitted_at IS NULL AND expires_at > ?4
    LIMIT 1
  `,
      )
        .bind(formRow.event_id, formRow.id, await sha256(draftToken), now())
        .first()
    : null;
  if (draftToken && !draftRow) return apiError("DRAFT_NOT_FOUND", 404);
  if (draftRow && String(draftRow.submitter_email).toLowerCase() !== email)
    return apiError("DRAFT_EMAIL_MISMATCH", 409);
  const policy = participantPolicy(schema);
  const submittedParticipants = Array.isArray(payload.participants)
    ? payload.participants
    : [];
  const participants = (
    submittedParticipants.length
      ? submittedParticipants
      : [{ email, name: payload.name || email.split("@")[0] }]
  ).map((participant, index) => ({
    email: String(participant?.email || (index === 0 ? email : ""))
      .trim()
      .toLowerCase(),
    name: String(participant?.name || "").trim(),
    title: String(participant?.title || "").trim().slice(0, 255),
    company: String(participant?.company || "").trim().slice(0, 255),
    bio: String(participant?.bio || "").trim(),
    role: String(participant?.role || policy.label).trim() || policy.label,
  }));
  if (
    participants.length < policy.minimum ||
    participants.length > policy.maximum
  )
    return apiError("PARTICIPANT_LIMIT", 400, {
      minimum: policy.minimum,
      maximum: policy.maximum,
    });
  if (
    participants.some(
      (participant) =>
        !/^\S+@\S+\.\S+$/.test(participant.email) || !participant.name,
    )
  )
    return apiError("INVALID_PARTICIPANT", 400);
  const normalizedEmails = participants.map((participant) => participant.email);
  if (
    new Set(normalizedEmails).size !== normalizedEmails.length ||
    normalizedEmails[0] !== email
  )
    return apiError("INVALID_PARTICIPANT_EMAILS", 400);

  const submissionLimit = schema.setLimit
    ? Math.max(1, Number(schema.submissionLimit || 1))
    : 3;
  const currentCount = await env.CALLBOARD_DB.prepare(
    `
    SELECT COUNT(*) AS count
    FROM submissions s
    JOIN people p ON p.event_id = s.event_id AND p.id = s.submitter_person_id
    WHERE s.event_id = ?1 AND s.form_id = ?2 AND lower(p.email) = ?3 AND lower(s.status) <> 'withdrawn'
  `,
  )
    .bind(formRow.event_id, formRow.id, email)
    .first();
  const activeDraftCount = await env.CALLBOARD_DB.prepare(
    `
    SELECT COUNT(*) AS count FROM cfp_drafts
    WHERE event_id = ?1 AND form_id = ?2 AND submitter_email = ?3 COLLATE NOCASE
      AND submitted_at IS NULL AND expires_at > ?4 AND id <> ?5
  `,
  )
    .bind(formRow.event_id, formRow.id, email, now(), draftRow?.id || "")
    .first();
  if (
    Number(currentCount?.count || 0) + Number(activeDraftCount?.count || 0) >=
    submissionLimit
  )
    return apiError("SUBMISSION_LIMIT_REACHED", 409, {
      limit: submissionLimit,
    });

  const timestamp = now();
  const eventSettings = parseStoredJson(formRow.event_settings_json, {});
  const verifiedPortalRequired = eventSettings.selfServeWorkspace === true;
  const authenticatedRequest = requestToken(request)
    ? await authenticate(request, env)
    : null;
  const verifiedSpeaker =
    authenticatedRequest?.session?.eventId === formRow.event_id &&
    authenticatedRequest.session.role === "speaker"
      ? authenticatedRequest.session
      : null;
  const participantRows = [];
  for (const participant of participants) {
    const existing = await env.CALLBOARD_DB.prepare(
      "SELECT id, name, email, role, title, company, bio FROM people WHERE event_id = ?1 AND email = ?2 COLLATE NOCASE LIMIT 1",
    )
      .bind(formRow.event_id, participant.email)
      .first();
    participantRows.push(
      existing
        ? { ...existing, existing: true }
        : { ...participant, id: id("person"), existing: false },
    );
  }
  const submissionId = id("submission");
  const answers =
    payload.answers &&
    typeof payload.answers === "object" &&
    !Array.isArray(payload.answers)
      ? payload.answers
      : {};
  const routing = resolvePublicRouting(schema, answers);
  const reviewRoute = String(
    routing?.destination || "Round 1 · Technical review",
  ).trim();
  const reviewRound = /round\s*2/i.test(reviewRoute) ? 2 : 1;
  const routedRound = await env.CALLBOARD_DB.prepare(
    "SELECT id, number FROM evaluation_rounds WHERE event_id = ?1 AND number = ?2 LIMIT 1",
  )
    .bind(formRow.event_id, reviewRound)
    .first();
  const reviewerRows = await env.CALLBOARD_DB.prepare(
    `
    SELECT membership.user_id
    FROM event_memberships AS membership
    JOIN users ON users.id = membership.user_id
    WHERE membership.event_id = ?1 AND membership.role = 'reviewer'
    ORDER BY lower(users.email), membership.user_id
  `,
  )
    .bind(formRow.event_id)
    .all();
  const reviewers = reviewerRows.results || [];
  const reviewerIndex = /infrastructure/i.test(reviewRoute)
    ? 1
    : /applied\s*ai/i.test(reviewRoute)
      ? 2
      : 0;
  const routedReviewer = reviewers[reviewerIndex] || reviewers[0] || null;
  const operations = [];
  const verifiedExistingPrimary = Boolean(
    participantRows[0].existing &&
      verifiedSpeaker?.personId === participantRows[0].id,
  );
  // A public CFP can be opened while an organizer or reviewer is already signed in.
  // Never replace that role-scoped session with a new speaker session as a side effect
  // of submitting the public form; the speaker can use a separate access link later.
  const preserveExistingSession = Boolean(authenticatedRequest?.session);
  const instantPortalAccess =
    !verifiedPortalRequired &&
    !participantRows[0].existing &&
    !preserveExistingSession;
  let portalSession = null;
  let portalUserId = null;
  let portalGrant = null;
  participantRows.forEach((participant, index) => {
    if (!participant.existing) {
      const input = participants[index];
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        INSERT INTO people (id, event_id, email, name, role, title, company, bio, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)
      `,
        ).bind(
          participant.id,
          formRow.event_id,
          input.email,
          input.name,
          input.role,
          input.title || null,
          input.company || null,
          input.bio || null,
          timestamp,
        ),
      );
    } else if (verifiedSpeaker?.personId === participant.id) {
      const input = participants[index];
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        UPDATE people
        SET name = ?1, role = ?2, title = ?3, company = ?4, bio = ?5, version = version + 1, updated_at = ?6
        WHERE event_id = ?7 AND id = ?8
      `,
        ).bind(
          input.name,
          input.role,
          input.title || null,
          input.company || null,
          input.bio || null,
          timestamp,
          formRow.event_id,
          participant.id,
        ),
      );
    }
  });
  if (instantPortalAccess) {
    const existingUser = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM users WHERE email = ?1 COLLATE NOCASE LIMIT 1",
    )
      .bind(email)
      .first();
    portalUserId = existingUser?.id || id("user");
    if (!existingUser)
      operations.push(
        env.CALLBOARD_DB.prepare(
          "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        ).bind(portalUserId, email, participants[0].name, timestamp),
      );
    operations.push(
      env.CALLBOARD_DB.prepare(
        "INSERT INTO event_memberships (event_id, user_id, role, person_id, created_at) VALUES (?1, ?2, 'speaker', ?3, ?4) ON CONFLICT(event_id, user_id, role) DO UPDATE SET person_id = excluded.person_id",
      ).bind(formRow.event_id, portalUserId, participantRows[0].id, timestamp),
    );
    const token = randomToken();
    portalSession = {
      token,
      sessionId: id("auth"),
      expiresAt: futureIso(SESSION_TTL_SECONDS),
    };
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
      INSERT INTO auth_sessions (id, token_hash, user_id, event_id, role, expires_at, created_at, last_seen_at)
      VALUES (?1, ?2, ?3, ?4, 'speaker', ?5, ?6, ?6)
    `,
      ).bind(
        portalSession.sessionId,
        await sha256(token),
        portalUserId,
        formRow.event_id,
        portalSession.expiresAt,
        timestamp,
      ),
    );
  }
  if (verifiedPortalRequired && !verifiedExistingPrimary) {
    const organizer = await env.CALLBOARD_DB.prepare(
      "SELECT user_id FROM event_memberships WHERE event_id = ?1 AND role = 'organizer' ORDER BY created_at ASC LIMIT 1",
    )
      .bind(formRow.event_id)
      .first();
    if (!organizer) return apiError("ORGANIZER_NOT_INITIALIZED", 409);
    const existingUser = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM users WHERE email = ?1 COLLATE NOCASE LIMIT 1",
    )
      .bind(email)
      .first();
    portalUserId = existingUser?.id || id("user");
    if (!existingUser)
      operations.push(
        env.CALLBOARD_DB.prepare(
          "INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        ).bind(portalUserId, email, participants[0].name, timestamp),
      );
    portalGrant = {
      id: id("grant"),
      token: randomToken(),
      expiresAt: futureIso(GRANT_TTL_SECONDS),
    };
    operations.push(
      env.CALLBOARD_DB.prepare(
        `INSERT INTO access_grants (id, grant_hash, event_id, email, name, role, person_id, expires_at, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'speaker', ?6, ?7, ?8, ?9)`,
      ).bind(
        portalGrant.id,
        await sha256(portalGrant.token),
        formRow.event_id,
        email,
        participants[0].name,
        participantRows[0].id,
        portalGrant.expiresAt,
        organizer.user_id,
        timestamp,
      ),
    );
  }
  operations.push(
    env.CALLBOARD_DB.prepare(
      `
    INSERT INTO submissions (id, event_id, form_id, submitter_person_id, title, abstract, status, category, answers_json, review_route, routing_rule_id, round, version, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, ?9, ?10, ?11, 1, ?12, ?12)
  `,
    ).bind(
      submissionId,
      formRow.event_id,
      formRow.id,
      participantRows[0].id,
      title,
      abstract || null,
      payload.category || null,
      JSON.stringify(answers),
      reviewRoute,
      routing?.id || null,
      reviewRound,
      timestamp,
    ),
  );
  if (routedRound && routedReviewer) {
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
      INSERT OR IGNORE INTO reviews (id, event_id, submission_id, reviewer_user_id, round_id, round, scores_json, status, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}', 'assigned', 1, ?7, ?7)
    `,
      ).bind(
        id("review"),
        formRow.event_id,
        submissionId,
        routedReviewer.user_id,
        routedRound.id,
        Number(routedRound.number),
        timestamp,
      ),
    );
  }
  participantRows.forEach((participant, index) =>
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
    INSERT INTO submission_people (event_id, submission_id, person_id, role, sort_order, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `,
      ).bind(
        formRow.event_id,
        submissionId,
        participant.id,
        participants[index].role,
        index,
        timestamp,
      ),
    ),
  );
  if (draftRow)
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
    UPDATE cfp_drafts
    SET submission_id = ?1, submitted_at = ?2, updated_at = ?2, version = version + 1
    WHERE id = ?3 AND submitted_at IS NULL
  `,
      ).bind(submissionId, timestamp, draftRow.id),
    );
  operations.push(
    env.CALLBOARD_DB.prepare(
      "INSERT INTO idempotency_keys (event_id, action, key, resource_id, created_at) VALUES (?1, 'public-cfp-submit', ?2, ?3, ?4)",
    ).bind(formRow.event_id, idempotencyKey, submissionId, timestamp),
  );

  try {
    await env.CALLBOARD_DB.batch(operations);
  } catch (error) {
    const raced = await env.CALLBOARD_DB.prepare(
      "SELECT resource_id FROM idempotency_keys WHERE event_id = ?1 AND action = 'public-cfp-submit' AND key = ?2 LIMIT 1",
    )
      .bind(formRow.event_id, idempotencyKey)
      .first();
    if (!raced) throw error;
    const existing = await publicSubmissionPayload(
      env,
      formRow.event_id,
      raced.resource_id,
    );
    return json({ item: existing, replayed: true });
  }
  await touchWorkspace(env, formRow.event_id, timestamp);
  const portalDeliveryConfigured = Boolean(
    portalGrant &&
      env.CALLBOARD_IDENTITY_EMAIL_ENABLED === "true" &&
      env.CALLBOARD_EMAIL_QUEUE &&
      transactionalEmailConfigured(env),
  );
  if (portalDeliveryConfigured)
    await env.CALLBOARD_EMAIL_QUEUE.send({
      version: 1,
      type: "role_access_link",
      grantId: portalGrant.id,
      token: portalGrant.token,
    });
  const created = await publicSubmissionPayload(
    env,
    formRow.event_id,
    submissionId,
  );
  const portalAccess = portalSession || verifiedExistingPrimary
    ? {
        authenticated: true,
        role: "speaker",
        personId: participantRows[0].id,
        expiresAt: portalSession?.expiresAt || verifiedSpeaker.expiresAt,
      }
    : portalGrant
      ? {
          authenticated: false,
          reason: "EMAIL_VERIFICATION_REQUIRED",
          expiresAt: portalGrant.expiresAt,
          deliveryStatus: portalDeliveryConfigured ? "queued" : "unavailable",
          ...(env.CALLBOARD_SELF_SERVE_DEV_LINKS === "true"
            ? { developmentAccessPath: `/#/access/${encodeURIComponent(portalGrant.token)}` }
            : {}),
        }
      : {
        authenticated: false,
        reason: preserveExistingSession
          ? "EXISTING_SESSION_PRESERVED"
          : "EMAIL_VERIFICATION_REQUIRED",
        };
  const response = json(
    { item: created, replayed: false, portalAccess },
    { status: 201 },
  );
  return portalSession
    ? setSessionCookie(response, portalSession.token)
    : response;
}

function publicDraftPayload(row) {
  return {
    id: row.id,
    email: row.submitter_email,
    answers: parseStoredJson(row.answers_json, {}),
    participants: parseStoredJson(row.participants_json, []),
    stepName: row.step_name,
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function normalizeDraftInput(payload) {
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const answers =
    payload.answers &&
    typeof payload.answers === "object" &&
    !Array.isArray(payload.answers)
      ? payload.answers
      : {};
  const participants = Array.isArray(payload.participants)
    ? payload.participants
        .filter(
          (item) => item && typeof item === "object" && !Array.isArray(item),
        )
        .slice(0, 10)
    : [];
  const stepName = ["account", "submission", "participant", "review"].includes(
    payload.stepName,
  )
    ? payload.stepName
    : "submission";
  return { email, answers, participants, stepName };
}

async function handlePublicDraft(request, env, formId, resumeToken = "") {
  const dbError = requireDb(env);
  if (dbError) return dbError;
  const formRow = await findPublicForm(env, formId);
  if (!formRow) return apiError("PUBLIC_FORM_NOT_FOUND", 404);
  const timestamp = now();
  const tokenHash = resumeToken ? await sha256(resumeToken) : "";
  const existing = resumeToken
    ? await env.CALLBOARD_DB.prepare(
        `
    SELECT * FROM cfp_drafts
    WHERE event_id = ?1 AND form_id = ?2 AND resume_token_hash = ?3
      AND submitted_at IS NULL AND expires_at > ?4
    LIMIT 1
  `,
      )
        .bind(formRow.event_id, formRow.id, tokenHash, timestamp)
        .first()
    : null;

  if (request.method === "GET" && resumeToken)
    return existing
      ? json({ item: publicDraftPayload(existing) })
      : apiError("DRAFT_NOT_FOUND", 404);
  if (request.method !== "POST" && request.method !== "PUT")
    return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (formRow.opens_at && new Date(formRow.opens_at).getTime() > Date.now())
    return apiError("FORM_NOT_OPEN", 409);
  if (formRow.closes_at && new Date(formRow.closes_at).getTime() < Date.now())
    return apiError("FORM_CLOSED", 409);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const input = normalizeDraftInput(parsed.payload);
  if (!/^\S+@\S+\.\S+$/.test(input.email))
    return apiError("DRAFT_EMAIL_REQUIRED", 400);
  const schema = parseStoredJson(formRow.schema_json, {});

  if (request.method === "POST") {
    if (resumeToken) return apiError("METHOD_NOT_ALLOWED", 405);
    const activeDrafts = await env.CALLBOARD_DB.prepare(
      `
      SELECT COUNT(*) AS count FROM cfp_drafts
      WHERE event_id = ?1 AND form_id = ?2 AND submitter_email = ?3 COLLATE NOCASE
        AND submitted_at IS NULL AND expires_at > ?4
    `,
    )
      .bind(formRow.event_id, formRow.id, input.email, timestamp)
      .first();
    if (!schema.allowMultipleDrafts && Number(activeDrafts?.count || 0) > 0)
      return apiError("MULTIPLE_DRAFTS_DISABLED", 409);
    const submitted = await env.CALLBOARD_DB.prepare(
      `
      SELECT COUNT(*) AS count FROM submissions s
      JOIN people p ON p.event_id = s.event_id AND p.id = s.submitter_person_id
      WHERE s.event_id = ?1 AND s.form_id = ?2 AND p.email = ?3 COLLATE NOCASE
        AND lower(s.status) <> 'withdrawn'
    `,
    )
      .bind(formRow.event_id, formRow.id, input.email)
      .first();
    const limit = schema.setLimit
      ? Math.max(1, Number(schema.submissionLimit || 1))
      : 3;
    if (
      Number(activeDrafts?.count || 0) + Number(submitted?.count || 0) >=
      limit
    )
      return apiError("SUBMISSION_LIMIT_REACHED", 409, { limit });
    const token = randomToken();
    const draftId = id("draft");
    const expiresAt = futureIso(CFP_DRAFT_TTL_SECONDS);
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO cfp_drafts (
        id, event_id, form_id, resume_token_hash, submitter_email, answers_json,
        participants_json, step_name, expires_at, version, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)
    `,
    )
      .bind(
        draftId,
        formRow.event_id,
        formRow.id,
        await sha256(token),
        input.email,
        JSON.stringify(input.answers),
        JSON.stringify(input.participants),
        input.stepName,
        expiresAt,
        timestamp,
      )
      .run();
    const created = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM cfp_drafts WHERE id = ?1 LIMIT 1",
    )
      .bind(draftId)
      .first();
    return json(
      { item: publicDraftPayload(created), resumeToken: token },
      { status: 201 },
    );
  }

  if (!resumeToken || !existing) return apiError("DRAFT_NOT_FOUND", 404);
  if (String(existing.submitter_email).toLowerCase() !== input.email)
    return apiError("DRAFT_EMAIL_MISMATCH", 409);
  const expectedVersion = Number.parseInt(
    String(request.headers.get("if-match") || "").replaceAll('"', ""),
    10,
  );
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    return apiError("IF_MATCH_REQUIRED", 428);
  if (Number(existing.version) !== expectedVersion)
    return apiError("VERSION_CONFLICT", 409);
  const result = await env.CALLBOARD_DB.prepare(
    `
    UPDATE cfp_drafts
    SET answers_json = ?1, participants_json = ?2, step_name = ?3,
      version = version + 1, updated_at = ?4
    WHERE id = ?5 AND version = ?6 AND submitted_at IS NULL
  `,
  )
    .bind(
      JSON.stringify(input.answers),
      JSON.stringify(input.participants),
      input.stepName,
      timestamp,
      existing.id,
      expectedVersion,
    )
    .run();
  if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
  const updated = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM cfp_drafts WHERE id = ?1 LIMIT 1",
  )
    .bind(existing.id)
    .first();
  return json({ item: publicDraftPayload(updated) });
}

async function handlePublicEmbed(request, env, embedId) {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  const dbError = requireDb(env);
  if (dbError) return dbError;
  const row = await env.CALLBOARD_DB.prepare(
    `
    SELECT e.*, ev.name AS event_name, ev.short_name AS event_short_name, ev.slug AS event_slug,
      ev.timezone AS event_timezone, ev.starts_at AS event_starts_at, ev.ends_at AS event_ends_at
    FROM embeds e JOIN events ev ON ev.id = e.event_id
    WHERE e.id = ?1 AND e.enabled = 1 LIMIT 1
  `,
  )
    .bind(embedId)
    .first();
  if (!row) return apiError("PUBLIC_EMBED_NOT_FOUND", 404);
  const release = await env.CALLBOARD_DB.prepare(
    "SELECT status FROM schedule_releases WHERE event_id = ?1 LIMIT 1",
  )
    .bind(row.event_id)
    .first();
  if (release?.status !== "published")
    return apiError("SCHEDULE_NOT_PUBLISHED", 404);
  const sessionRows = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM agenda_sessions WHERE event_id = ?1 AND lower(status) = 'accepted' ORDER BY starts_at, title",
  )
    .bind(row.event_id)
    .all();
  const sessionItems = await attachSessionPeople(
    env,
    row.event_id,
    (sessionRows.results || []).map((item) =>
      decodeRow(item, RESOURCE_SPECS.sessions),
    ),
  );
  const submissionRows = await env.CALLBOARD_DB.prepare(
    "SELECT id, answers_json FROM submissions WHERE event_id = ?1",
  )
    .bind(row.event_id)
    .all();
  const submissionAnswersById = new Map(
    (submissionRows.results || []).map((submission) => [
      submission.id,
      parseStoredJson(submission.answers_json, {}),
    ]),
  );
  const people = await env.CALLBOARD_DB.prepare(
    "SELECT id, name, role, title, company, bio, headshot_url FROM people WHERE event_id = ?1",
  )
    .bind(row.event_id)
    .all();
  const peopleById = new Map(
    (people.results || []).map((person) => [person.id, person]),
  );
  const personMap = new Map();
  for (const session of sessionItems)
    for (const participant of session.participants || []) {
      const person = peopleById.get(participant.id) || participant;
      const role = participant.role || person.role || "Speaker";
      if (String(role).toLowerCase() !== "speaker") continue;
      const headshotFileId = String(person.headshot_url || "").match(
        /^\/api\/files\/([^/]+)\/content$/,
      )?.[1];
      personMap.set(participant.id, {
        id: participant.id,
        name: person.name || participant.name,
        role,
        title: person.title || participant.title || "",
        company: person.company || participant.company || "",
        bio: sanitizePublicBiography(person.bio),
        publicHeadshotUrl: headshotFileId
          ? `/api/public/embeds/${encodeURIComponent(embedId)}/headshots/${encodeURIComponent(headshotFileId)}`
          : "",
        initials: String(person.name || participant.name || "SP")
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      });
    }
  const embed = decodeRow(row, RESOURCE_SPECS.embeds);
  return json({
    embed: {
      ...(embed.config || {}),
      id: embed.id,
      name: embed.name,
      format: embed.format,
      enabled: Boolean(embed.enabled),
      version: embed.version,
    },
    event: {
      id: row.event_id,
      name: row.event_name,
      shortName: row.event_short_name,
      slug: row.event_slug,
      timezone: row.event_timezone,
      start: row.event_starts_at,
      end: row.event_ends_at,
    },
    sessions: sessionItems.map((session) => {
      const answers = submissionAnswersById.get(session.submissionId) || {};
      const format =
        answers.format ||
        answers.Format ||
        Object.entries(answers).find(([key]) =>
          String(key).toLowerCase().includes("format"),
        )?.[1] ||
        "";
      return {
        ...session,
        format,
        status: String(session.status || "Accepted").replace(
          /^./,
          (character) => character.toUpperCase(),
        ),
        participants: session.participantIds || [],
      };
    }),
    abstracts: sessionItems.map((session) => ({
      id: session.submissionId || `public-${session.id}`,
      status: "Accepted",
      participantIds: session.participantIds || [],
    })),
    participants: [...personMap.values()],
  });
}

async function handlePublicEmbedHeadshot(request, env, embedId, fileId) {
  if (!["GET", "HEAD"].includes(request.method))
    return apiError("METHOD_NOT_ALLOWED", 405);
  const dbError = requireDb(env);
  if (dbError) return dbError;
  if (!env.CALLBOARD_FILES)
    return apiError("OBJECT_STORAGE_NOT_CONFIGURED", 503);
  const row = await env.CALLBOARD_DB.prepare(
    `
    SELECT fm.*
    FROM file_metadata fm
    JOIN people p
      ON p.event_id = fm.event_id
      AND p.id = fm.owner_person_id
      AND p.headshot_url = '/api/files/' || fm.id || '/content'
    JOIN session_people sp
      ON sp.event_id = p.event_id
      AND sp.person_id = p.id
      AND lower(sp.role) = 'speaker'
    JOIN agenda_sessions s
      ON s.event_id = sp.event_id
      AND s.id = sp.session_id
      AND lower(s.status) = 'accepted'
    JOIN embeds e
      ON e.event_id = s.event_id
      AND e.id = ?1
      AND e.enabled = 1
    JOIN schedule_releases sr
      ON sr.event_id = e.event_id
      AND sr.status = 'published'
    WHERE fm.id = ?2
      AND lower(fm.kind) = 'headshot'
      AND lower(fm.mime_type) IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
    LIMIT 1
  `,
  )
    .bind(embedId, fileId)
    .first();
  if (!row || !row.storage_key) return apiError("NOT_FOUND", 404);
  const object = await env.CALLBOARD_FILES.get(row.storage_key);
  if (!object) return apiError("NOT_FOUND", 404);
  const headers = new Headers({
    "cache-control": "public, max-age=300",
    "content-disposition": `inline; filename="${safeFileName(row.name).replaceAll('"', "")}"`,
    "content-type": row.mime_type,
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff",
  });
  if (object.size != null) headers.set("content-length", String(object.size));
  return request.method === "HEAD"
    ? new Response(null, { status: 200, headers })
    : new Response(object.body, { status: 200, headers });
}

function scheduleReleasePayload(row) {
  return row
    ? {
        status: row.status,
        publishedAt: row.published_at,
        version: Number(row.version || 1),
        updatedAt: row.updated_at,
      }
    : { status: "draft", publishedAt: null, version: 0, updatedAt: null };
}

async function handleScheduleRelease(request, env, session) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const current = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM schedule_releases WHERE event_id = ?1 LIMIT 1",
  )
    .bind(session.eventId)
    .first();
  if (request.method === "GET")
    return json({ item: scheduleReleasePayload(current) });
  if (request.method !== "PUT") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const versionHeader = request.headers.get("if-match");
  const expectedVersion =
    versionHeader == null
      ? null
      : Number.parseInt(versionHeader.replaceAll('"', ""), 10);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    return apiError("IF_MATCH_REQUIRED", 428);
  if (Number(current?.version || 0) !== expectedVersion)
    return apiError("VERSION_CONFLICT", 409);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const status = String(parsed.payload.status || "")
    .trim()
    .toLowerCase();
  if (!["draft", "published"].includes(status))
    return apiError("INVALID_SCHEDULE_RELEASE_STATUS", 400);
  const timestamp = now();
  const publishedAt = status === "published" ? timestamp : null;
  if (current) {
    const result = await env.CALLBOARD_DB.prepare(
      `
      UPDATE schedule_releases
      SET status = ?1, published_at = ?2, released_by_user_id = ?3, version = version + 1, updated_at = ?4
      WHERE event_id = ?5 AND version = ?6
    `,
    )
      .bind(
        status,
        publishedAt,
        session.userId,
        timestamp,
        session.eventId,
        expectedVersion,
      )
      .run();
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
  } else {
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO schedule_releases (event_id, status, published_at, released_by_user_id, version, updated_at)
      VALUES (?1, ?2, ?3, ?4, 1, ?5)
    `,
    )
      .bind(session.eventId, status, publishedAt, session.userId, timestamp)
      .run();
  }
  const updated = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM schedule_releases WHERE event_id = ?1 LIMIT 1",
  )
    .bind(session.eventId)
    .first();
  await touchWorkspace(env, session.eventId, timestamp);
  return json({ item: scheduleReleasePayload(updated) });
}

function eventPayload(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    timezone: row.timezone,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    website: row.website_url,
    type: row.event_type,
    theme: row.theme,
    settings: parseStoredJson(row.settings_json, {}),
    version: Number(row.version || 1),
    updatedAt: row.updated_at,
  };
}

async function handleEvent(request, env, session) {
  const current = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM events WHERE id = ?1 LIMIT 1",
  )
    .bind(session.eventId)
    .first();
  if (!current) return apiError("NOT_FOUND", 404);
  if (request.method === "GET") return json({ item: eventPayload(current) });
  if (request.method !== "PATCH" && request.method !== "PUT")
    return apiError("METHOD_NOT_ALLOWED", 405);
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const expectedVersion = ifMatchVersion(request);
  if (!expectedVersion) return apiError("IF_MATCH_REQUIRED", 428);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const fieldMap = {
    slug: ["slug", "text"],
    name: ["name", "text"],
    shortName: ["short_name", "text"],
    timezone: ["timezone", "text"],
    startsAt: ["starts_at", "text"],
    endsAt: ["ends_at", "text"],
    location: ["location", "text"],
    website: ["website_url", "text"],
    type: ["event_type", "text"],
    theme: ["theme", "text"],
    settings: ["settings_json", "json"],
  };
  const fields = Object.entries(parsed.payload)
    .filter(([field]) => fieldMap[field])
    .map(([field, value]) => {
      const [column, type] = fieldMap[field];
      return {
        field,
        column,
        value: type === "json" ? JSON.stringify(value || {}) : value,
      };
    });
  if (!fields.length) return apiError("NO_MUTABLE_FIELDS", 400);
  if (
    fields.some(
      (field) =>
        ["slug", "name", "timezone"].includes(field.field) &&
        !String(field.value || "").trim(),
    )
  )
    return apiError("EVENT_FIELDS_REQUIRED", 400);
  const assignments = fields.map(
    (field, index) => `${field.column} = ?${index + 1}`,
  );
  const values = fields.map((field) => field.value);
  values.push(now(), session.eventId, expectedVersion);
  const updatedAtIndex = fields.length + 1;
  const eventIndex = fields.length + 2;
  const versionIndex = fields.length + 3;
  try {
    const result = await env.CALLBOARD_DB.prepare(
      `UPDATE events SET ${assignments.join(", ")}, version = version + 1, updated_at = ?${updatedAtIndex} WHERE id = ?${eventIndex} AND version = ?${versionIndex}`,
    )
      .bind(...values)
      .run();
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
  } catch (error) {
    if (
      String(error?.message || error)
        .toLowerCase()
        .includes("unique")
    )
      return apiError("EVENT_SLUG_CONFLICT", 409);
    throw error;
  }
  const updated = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM events WHERE id = ?1 LIMIT 1",
  )
    .bind(session.eventId)
    .first();
  const response = json({ item: eventPayload(updated) });
  response.headers.set("etag", `"${updated.version}"`);
  return response;
}

async function handleReviewers(request, env, session) {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const rows = await env.CALLBOARD_DB.prepare(
    `
    SELECT u.id, u.name, u.email, m.created_at
    FROM event_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.event_id = ?1 AND m.role = 'reviewer'
    ORDER BY lower(u.name), lower(u.email)
  `,
  )
    .bind(session.eventId)
    .all();
  return json({
    items: (rows.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    })),
  });
}

function communicationOutboxPayload(row) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    action: row.action,
    status: row.status,
    templateId: row.template_id,
    templateName: row.template_name,
    segment: row.segment,
    recipientCount: parseStoredJson(row.recipients_json, []).length,
    recipients: parseStoredJson(row.recipients_json, []),
    subject: row.subject,
    body: row.body,
    scheduledFor: row.scheduled_for,
    attachCalendar: Boolean(row.calendar_json),
    calendar: parseStoredJson(row.calendar_json, null),
    exactPayload: parseStoredJson(row.exact_payload_json, null),
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    attemptCount: Number(row.attempt_count || 0),
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function communicationAttemptPayload(row) {
  return {
    id: row.id,
    outboxId: row.outbox_id,
    attemptNumber: Number(row.attempt_number),
    mode: row.mode,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function normalizeMailbox(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function validatePreviewOnlyCommunication(payload) {
  const exact = payload.exactPayload;
  const action = String(payload.action || exact?.action || "")
    .trim()
    .toLowerCase();
  const templateName = String(payload.templateName || "").trim();
  const segment = String(payload.segment || "").trim();
  if (!payload.idempotencyKey || !String(payload.idempotencyKey).trim())
    return { error: apiError("IDEMPOTENCY_KEY_REQUIRED", 400) };
  if (!["send", "schedule", "automation"].includes(action))
    return { error: apiError("INVALID_COMMUNICATION_ACTION", 400) };
  if (!templateName || !segment)
    return { error: apiError("COMMUNICATION_METADATA_REQUIRED", 400) };
  if (!exact || typeof exact !== "object" || Array.isArray(exact))
    return { error: apiError("EXACT_PAYLOAD_REQUIRED", 400) };
  if (
    String(exact.action || "")
      .trim()
      .toLowerCase() !== action
  )
    return { error: apiError("COMMUNICATION_ACTION_MISMATCH", 400) };
  if (
    exact.releaseMode !== "test-allowlist" ||
    exact.deliveryMode !== "preview-only" ||
    exact.networkIntent !== false
  )
    return { error: apiError("PREVIEW_ONLY_REQUIRED", 400) };
  if (
    normalizeMailbox(exact.from?.email) !== COMMUNICATIONS_SENDER ||
    normalizeMailbox(exact.replyTo?.email) !== COMMUNICATIONS_SENDER
  )
    return { error: apiError("TEST_SENDER_REQUIRED", 400) };
  if (!Array.isArray(exact.to) || exact.to.length !== 1)
    return { error: apiError("EXACTLY_ONE_RECIPIENT_REQUIRED", 400) };
  const recipient = exact.to[0];
  const expectedIdentity = COMMUNICATIONS_TEST_RECIPIENTS.get(
    normalizeMailbox(recipient?.email),
  );
  if (!expectedIdentity)
    return { error: apiError("RECIPIENT_NOT_ALLOWLISTED", 400) };
  if (
    recipient.id !== expectedIdentity.id ||
    recipient.role !== expectedIdentity.role
  )
    return { error: apiError("TEST_IDENTITY_MISMATCH", 400) };
  if (
    exact.safety?.syntheticContentOnly !== true ||
    exact.safety?.recipientAllowlistEnforced !== true ||
    exact.safety?.outboundEnabled !== false
  )
    return { error: apiError("SYNTHETIC_SAFETY_REQUIRED", 400) };
  const subject = String(exact.subject || "");
  const text = String(exact.text || "");
  if (!subject.trim() || !text.trim())
    return { error: apiError("COMMUNICATION_CONTENT_REQUIRED", 400) };
  if (subject.length > 998 || text.length > 100_000)
    return { error: apiError("COMMUNICATION_CONTENT_TOO_LARGE", 413) };
  if (/{{\s*[a-z0-9_]+\s*}}/i.test(`${subject}\n${text}`))
    return { error: apiError("UNRESOLVED_MERGE_FIELD", 400) };
  const scheduledFor = exact.scheduledFor || null;
  if (
    ["schedule", "automation"].includes(action) &&
    !Number.isFinite(Date.parse(scheduledFor || ""))
  )
    return { error: apiError("VALID_SCHEDULE_REQUIRED", 400) };
  if (action === "send" && scheduledFor)
    return { error: apiError("UNEXPECTED_SCHEDULE", 400) };
  let calendar = null;
  if (exact.calendar != null) {
    const candidate = exact.calendar;
    const method = String(candidate.method || "").toUpperCase();
    const status = String(candidate.status || "").toUpperCase();
    const sequence = Number(candidate.sequence);
    if (
      !String(candidate.uid || "").trim() ||
      !["REQUEST", "CANCEL"].includes(method) ||
      !Number.isInteger(sequence) ||
      sequence < 0
    )
      return { error: apiError("INVALID_CALENDAR_METADATA", 400) };
    if (status !== (method === "CANCEL" ? "CANCELLED" : "CONFIRMED"))
      return { error: apiError("INVALID_CALENDAR_STATUS", 400) };
    if (
      !Number.isFinite(Date.parse(candidate.start || "")) ||
      !Number.isFinite(Date.parse(candidate.end || "")) ||
      Date.parse(candidate.end) <= Date.parse(candidate.start)
    )
      return { error: apiError("INVALID_CALENDAR_RANGE", 400) };
    calendar = {
      uid: String(candidate.uid),
      method,
      sequence,
      status,
      start: candidate.start,
      end: candidate.end,
      location: String(candidate.location || ""),
    };
  }
  const calendarAttachments = Array.isArray(exact.attachments)
    ? exact.attachments.filter((item) => item?.kind === "calendar")
    : [];
  if (
    (calendar && calendarAttachments.length !== 1) ||
    (!calendar && calendarAttachments.length)
  )
    return { error: apiError("CALENDAR_ATTACHMENT_MISMATCH", 400) };
  return {
    value: {
      idempotencyKey: String(payload.idempotencyKey).trim(),
      action,
      templateId: payload.templateId ? String(payload.templateId) : null,
      templateName,
      segment,
      recipient,
      subject,
      text,
      scheduledFor,
      calendar,
      exact,
    },
  };
}

async function validateEventMemberCommunication(payload, env, eventId) {
  const exact = payload.exactPayload;
  const action = String(payload.action || exact?.action || "").trim().toLowerCase();
  const templateName = String(payload.templateName || "").trim();
  const segment = String(payload.segment || "").trim();
  if (!payload.idempotencyKey || !String(payload.idempotencyKey).trim())
    return { error: apiError("IDEMPOTENCY_KEY_REQUIRED", 400) };
  if (!["send", "automation"].includes(action)) return { error: apiError("LIVE_SEND_ONLY", 400) };
  if (!templateName || !segment)
    return { error: apiError("COMMUNICATION_METADATA_REQUIRED", 400) };
  if (!exact || typeof exact !== "object" || Array.isArray(exact))
    return { error: apiError("EXACT_PAYLOAD_REQUIRED", 400) };
  if (String(exact.action || "").trim().toLowerCase() !== action)
    return { error: apiError("COMMUNICATION_ACTION_MISMATCH", 400) };
  if (
    exact.releaseMode !== "event-members" ||
    exact.deliveryMode !== "live" ||
    exact.networkIntent !== true
  )
    return { error: apiError("LIVE_EVENT_MEMBER_DELIVERY_REQUIRED", 400) };
  const sender = normalizeMailbox(env.CALLBOARD_AUTH_SENDER_EMAIL);
  if (!sender || normalizeMailbox(exact.from?.email) !== sender || normalizeMailbox(exact.replyTo?.email) !== sender)
    return { error: apiError("CONFIGURED_SENDER_REQUIRED", 400) };
  if (!Array.isArray(exact.to) || exact.to.length !== 1)
    return { error: apiError("EXACTLY_ONE_RECIPIENT_REQUIRED", 400) };
  const recipient = exact.to[0];
  const recipientEmail = normalizeMailbox(recipient?.email);
  const person = await env.CALLBOARD_DB.prepare(
    "SELECT id, email, name, role FROM people WHERE event_id = ?1 AND id = ?2 AND lower(email) = ?3 LIMIT 1",
  ).bind(eventId, String(recipient?.id || ""), recipientEmail).first();
  if (!person) return { error: apiError("RECIPIENT_NOT_EVENT_MEMBER", 403) };
  if (String(person.role || "").toLowerCase() !== String(recipient?.role || "").toLowerCase())
    return { error: apiError("RECIPIENT_ROLE_MISMATCH", 400) };
  if (
    exact.safety?.recipientAllowlistEnforced !== true ||
    exact.safety?.outboundEnabled !== true
  )
    return { error: apiError("LIVE_DELIVERY_SAFETY_REQUIRED", 400) };
  const subject = String(exact.subject || "");
  const text = String(exact.text || "");
  if (!subject.trim() || !text.trim()) return { error: apiError("COMMUNICATION_CONTENT_REQUIRED", 400) };
  if (subject.length > 998 || text.length > 100_000)
    return { error: apiError("COMMUNICATION_CONTENT_TOO_LARGE", 413) };
  if (/{{\s*[a-z0-9_]+\s*}}/i.test(`${subject}\n${text}`))
    return { error: apiError("UNRESOLVED_MERGE_FIELD", 400) };
  if (exact.scheduledFor) return { error: apiError("LIVE_SCHEDULING_NOT_ENABLED", 400) };
  let calendar = null;
  if (exact.calendar != null) {
    const candidate = exact.calendar;
    const method = String(candidate.method || "").toUpperCase();
    const status = String(candidate.status || "").toUpperCase();
    const sequence = Number(candidate.sequence);
    if (!String(candidate.uid || "").trim() || !["REQUEST", "CANCEL"].includes(method) || !Number.isInteger(sequence) || sequence < 0)
      return { error: apiError("INVALID_CALENDAR_METADATA", 400) };
    if (status !== (method === "CANCEL" ? "CANCELLED" : "CONFIRMED"))
      return { error: apiError("INVALID_CALENDAR_STATUS", 400) };
    if (!Number.isFinite(Date.parse(candidate.start || "")) || !Number.isFinite(Date.parse(candidate.end || "")) || Date.parse(candidate.end) <= Date.parse(candidate.start))
      return { error: apiError("INVALID_CALENDAR_RANGE", 400) };
    calendar = { uid: String(candidate.uid), method, sequence, status, start: candidate.start, end: candidate.end, location: String(candidate.location || "") };
  }
  return {
    value: {
      idempotencyKey: String(payload.idempotencyKey).trim(), action,
      templateId: payload.templateId ? String(payload.templateId) : null,
      templateName, segment,
      recipient: { id: person.id, role: person.role, name: person.name, email: person.email },
      subject, text, scheduledFor: null, calendar, exact, live: true,
    },
  };
}

async function validateCommunication(payload, env, eventId) {
  return payload?.exactPayload?.releaseMode === "event-members"
    ? validateEventMemberCommunication(payload, env, eventId)
    : validatePreviewOnlyCommunication(payload);
}

async function handleCommunicationOutbox(
  request,
  env,
  url,
  session,
  outboxId,
  attemptsRequested,
) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (request.method === "GET") {
    if (attemptsRequested) {
      const parent = await env.CALLBOARD_DB.prepare(
        "SELECT id FROM communication_outbox WHERE event_id = ?1 AND id = ?2 LIMIT 1",
      )
        .bind(session.eventId, outboxId)
        .first();
      if (!parent) return apiError("NOT_FOUND", 404);
      const rows = await env.CALLBOARD_DB.prepare(
        "SELECT * FROM communication_delivery_attempts WHERE event_id = ?1 AND outbox_id = ?2 ORDER BY attempt_number DESC",
      )
        .bind(session.eventId, outboxId)
        .all();
      return json({
        items: (rows.results || []).map(communicationAttemptPayload),
      });
    }
    if (outboxId) {
      const row = await env.CALLBOARD_DB.prepare(
        "SELECT * FROM communication_outbox WHERE event_id = ?1 AND id = ?2 LIMIT 1",
      )
        .bind(session.eventId, outboxId)
        .first();
      if (!row) return apiError("NOT_FOUND", 404);
      return json({ item: communicationOutboxPayload(row) });
    }
    const limit = Math.min(
      Math.max(
        Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100,
        1,
      ),
      250,
    );
    const rows = await env.CALLBOARD_DB.prepare(
      `SELECT * FROM communication_outbox WHERE event_id = ?1 ORDER BY created_at DESC LIMIT ${limit}`,
    )
      .bind(session.eventId)
      .all();
    return json({
      items: (rows.results || []).map(communicationOutboxPayload),
      limit,
    });
  }
  if (request.method !== "POST" || outboxId || attemptsRequested)
    return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const validation = await validateCommunication(parsed.payload, env, session.eventId);
  if (validation.error) return validation.error;
  const input = validation.value;
  const exactPayloadJson = JSON.stringify(input.exact);
  const calendarJson = input.calendar ? JSON.stringify(input.calendar) : null;
  const existing = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_outbox WHERE event_id = ?1 AND idempotency_key = ?2 LIMIT 1",
  )
    .bind(session.eventId, input.idempotencyKey)
    .first();
  if (existing) {
    const compatible =
      existing.action === input.action &&
      existing.template_id === input.templateId &&
      existing.template_name === input.templateName &&
      existing.segment === input.segment &&
      existing.scheduled_for === input.scheduledFor &&
      existing.exact_payload_json === exactPayloadJson &&
      existing.calendar_json === calendarJson;
    if (!compatible) return apiError("IDEMPOTENCY_KEY_REUSED", 409);
    return json({ item: communicationOutboxPayload(existing), replayed: true });
  }
  const timestamp = now();
  const outboxIdNew = id("communication_outbox");
  const attemptId = id("communication_attempt");
  const status = input.live
    ? "prepared_live"
    : input.action === "send" ? "prepared_preview" : "scheduled_preview";
  const operations = [
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO communication_outbox (id, event_id, idempotency_key, action, status, template_id, template_name, segment, recipients_json, subject, body, scheduled_for, calendar_json, exact_payload_json, provider, attempt_count, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'none', 0, 1, ?15, ?15)
    `,
    ).bind(
      outboxIdNew,
      session.eventId,
      input.idempotencyKey,
      input.action,
      status,
      input.templateId,
      input.templateName,
      input.segment,
      JSON.stringify([input.recipient]),
      input.subject,
      input.text,
      input.scheduledFor,
      calendarJson,
      exactPayloadJson,
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO communication_delivery_attempts (id, event_id, outbox_id, attempt_number, mode, status, provider, finished_at, created_at)
      VALUES (?1, ?2, ?3, 0, ?4, 'not_dispatched', 'none', ?5, ?5)
    `,
    ).bind(attemptId, session.eventId, outboxIdNew, input.live ? "live" : "preview", timestamp),
  ];
  if (input.calendar)
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
    INSERT INTO calendar_event_previews (event_id, uid, method, sequence, status, starts_at, ends_at, location, outbox_id, version, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)
    ON CONFLICT(event_id, uid) DO UPDATE SET method = excluded.method, sequence = excluded.sequence, status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, location = excluded.location, outbox_id = excluded.outbox_id, version = calendar_event_previews.version + 1, updated_at = excluded.updated_at
    WHERE excluded.sequence >= calendar_event_previews.sequence
  `,
      ).bind(
        session.eventId,
        input.calendar.uid,
        input.calendar.method,
        input.calendar.sequence,
        input.calendar.status,
        input.calendar.start,
        input.calendar.end,
        input.calendar.location,
        outboxIdNew,
        timestamp,
      ),
    );
  operations.push(
    env.CALLBOARD_DB.prepare(
      "UPDATE events SET updated_at = ?1 WHERE id = ?2",
    ).bind(timestamp, session.eventId),
  );
  await env.CALLBOARD_DB.batch(operations);
  const created = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_outbox WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, outboxIdNew)
    .first();
  const responsePayload = {
    item: communicationOutboxPayload(created),
    replayed: false,
    attempt: {
      id: attemptId,
      attemptNumber: 0,
      mode: input.live ? "live" : "preview",
      status: "not_dispatched",
      provider: "none",
      finishedAt: timestamp,
      createdAt: timestamp,
    },
  };
  if (input.calendar) {
    const canonical = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM calendar_event_previews WHERE event_id = ?1 AND uid = ?2 LIMIT 1",
    )
      .bind(session.eventId, input.calendar.uid)
      .first();
    responsePayload.calendar = canonical
      ? {
          uid: canonical.uid,
          method: canonical.method,
          sequence: Number(canonical.sequence),
          status: canonical.status,
          startsAt: canonical.starts_at,
          endsAt: canonical.ends_at,
          location: canonical.location,
          outboxId: canonical.outbox_id,
          version: Number(canonical.version),
          updatedAt: canonical.updated_at,
        }
      : null;
  }
  const response = json(responsePayload, { status: 201 });
  response.headers.set("location", `/api/communication-outbox/${outboxIdNew}`);
  return response;
}

function communicationReminderRunPayload(row) {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    automationKey: row.automation_key,
    sourceType: row.source_type,
    sourceId: row.source_id || null,
    evaluatedAt: row.evaluated_at,
    dueAt: row.due_at,
    status: row.status,
    matchedRecipientCount: Number(row.matched_recipient_count || 0),
    outboxId: row.outbox_id || null,
    errorCode: row.error_code || null,
    networkIntent: Boolean(row.network_intent),
    createdAt: row.created_at,
  };
}

function renderSyntheticReminderText(value) {
  return String(value || "").replace(
    /{{\s*([a-z0-9_]+)\s*}}/gi,
    (_, key) => SYNTHETIC_REMINDER_CONTEXT[key] ?? `{{${key}}}`,
  );
}

async function reminderTemplate(env, eventId, templateId) {
  const seeded = SEEDED_REMINDER_TEMPLATES.get(templateId);
  if (seeded) return seeded;
  const row = await env.CALLBOARD_DB.prepare(
    "SELECT id, name, subject, body, attach_calendar FROM communication_templates WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(eventId, templateId)
    .first();
  return row
    ? {
        id: row.id,
        name: row.name,
        subject: row.subject,
        body: row.body,
        attachCalendar: Boolean(row.attach_calendar),
      }
    : null;
}

async function reminderSource(env, event, reminder) {
  let sourceType = "event";
  let sourceId = event.id;
  let baseAt = event.starts_at;
  let session = null;
  if (reminder.unit === "days before task due") {
    sourceType = "task";
    const task = await env.CALLBOARD_DB.prepare(
      "SELECT id, title, due_at FROM tasks WHERE event_id = ?1 AND due_at IS NOT NULL AND lower(status) NOT IN ('complete', 'completed', 'done') ORDER BY due_at, id LIMIT 1",
    )
      .bind(event.id)
      .first();
    sourceId = task?.id || null;
    baseAt = task?.due_at || null;
  } else if (reminder.unit === "hours before session") {
    sourceType = "session";
    session = await env.CALLBOARD_DB.prepare(
      "SELECT id, title, room, starts_at, ends_at FROM agenda_sessions WHERE event_id = ?1 AND starts_at IS NOT NULL AND lower(status) = 'accepted' ORDER BY starts_at, id LIMIT 1",
    )
      .bind(event.id)
      .first();
    sourceId = session?.id || null;
    baseAt = session?.starts_at || null;
  }
  const baseTime = Date.parse(baseAt || "");
  const amount = Number(reminder.amount);
  if (!Number.isFinite(baseTime) || !Number.isInteger(amount) || amount < 1)
    return null;
  const milliseconds =
    amount *
    (reminder.unit === "hours before session"
      ? 60 * 60 * 1000
      : 24 * 60 * 60 * 1000);
  return {
    sourceType,
    sourceId,
    dueAt: new Date(baseTime - milliseconds).toISOString(),
    session,
    task: reminder.unit === "days before task due" ? await env.CALLBOARD_DB.prepare("SELECT id, title, due_at FROM tasks WHERE event_id = ?1 AND id = ?2 LIMIT 1").bind(event.id, sourceId).first() : null,
  };
}

async function reminderRecipients(env, eventId, segment) {
  let sql;
  let status = null;
  if (segment === "accepted-speakers") {
    sql = "SELECT DISTINCT p.id, p.name, p.email, p.role FROM people p JOIN session_people sp ON sp.event_id = p.event_id AND sp.person_id = p.id JOIN agenda_sessions s ON s.event_id = sp.event_id AND s.id = sp.session_id WHERE p.event_id = ?1 AND lower(s.status) = 'accepted' ORDER BY lower(p.email)";
  } else if (segment === "incomplete-tasks") {
    sql = "SELECT DISTINCT p.id, p.name, p.email, p.role FROM people p JOIN tasks t ON t.event_id = p.event_id AND t.assignee_person_id = p.id WHERE p.event_id = ?1 AND lower(t.status) NOT IN ('complete', 'completed', 'done') ORDER BY lower(p.email)";
  } else if (["pending-submitters", "declined-submitters"].includes(segment)) {
    status = segment === "pending-submitters" ? "pending" : "declined";
    sql = `SELECT DISTINCT p.id, p.name, p.email, p.role FROM people p JOIN (
      SELECT submitter_person_id AS person_id FROM submissions WHERE event_id = ?1 AND lower(status) = ?2 AND submitter_person_id IS NOT NULL
      UNION SELECT sp.person_id FROM submissions s JOIN submission_people sp ON sp.event_id = s.event_id AND sp.submission_id = s.id WHERE s.event_id = ?1 AND lower(s.status) = ?2
    ) x ON x.person_id = p.id WHERE p.event_id = ?1 ORDER BY lower(p.email)`;
  } else {
    sql = "SELECT id, name, email, role FROM people WHERE event_id = ?1 AND lower(role) IN ('speaker', 'contact') ORDER BY lower(email)";
  }
  const statement = env.CALLBOARD_DB.prepare(sql);
  const rows = status ? await statement.bind(eventId, status).all() : await statement.bind(eventId).all();
  return (rows.results || []).slice(0, 100);
}

function renderLiveReminderText(value, event, person, source, origin) {
  const context = {
    first_name: String(person.name || "Speaker").trim().split(/\s+/)[0],
    full_name: person.name || "Speaker",
    event_name: event.name || "the event",
    event_dates: [event.starts_at, event.ends_at].filter(Boolean).join(" - "),
    event_location: event.location || "To be announced",
    portal_url: `${String(origin || "").replace(/\/$/, "")}/#/speaker-portal`,
    session_title: source.session?.title || "Your session",
    session_start: source.session?.starts_at || "To be announced",
    session_location: source.session?.room || event.location || "To be announced",
    task_title: source.task?.title || "Speaker task",
    task_due_date: source.task?.due_at || "the listed deadline",
    submission_title: "Your submission",
    submission_status: "Pending",
  };
  return String(value || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => context[key] ?? "");
}

async function materializeLiveReminder(env, event, reminder, source, template, evaluatedAt, matchedRecipientCount) {
  const automationKey = `${reminder.id}:${source.dueAt}`;
  const dailyCap = Math.min(Math.max(Number(env.CALLBOARD_EMAIL_DAILY_CAP || 500), 1), 1000);
  const since = new Date(Date.parse(evaluatedAt) - 24 * 60 * 60 * 1000).toISOString();
  const recent = await env.CALLBOARD_DB.prepare(
    "SELECT COUNT(*) AS count FROM communication_outbox WHERE event_id = ?1 AND created_at >= ?2 AND status IN ('queued_for_delivery', 'dispatching', 'sent')",
  ).bind(event.id, since).first();
  const remaining = Math.max(0, dailyCap - Number(recent?.count || 0));
  const recipients = (await reminderRecipients(env, event.id, reminder.segment)).slice(0, remaining);
  if (!recipients.length)
    return { blockedCode: remaining ? "REMINDER_RECIPIENT_SCOPE_EMPTY" : "REMINDER_DAILY_CAP_REACHED" };
  const organizer = await env.CALLBOARD_DB.prepare(
    "SELECT user_id FROM event_memberships WHERE event_id = ?1 AND role = 'organizer' ORDER BY created_at LIMIT 1",
  ).bind(event.id).first();
  if (!organizer || !env.CALLBOARD_EMAIL_QUEUE || !transactionalEmailConfigured(env))
    return { blockedCode: "REMINDER_DELIVERY_NOT_CONFIGURED" };
  const senderEmail = normalizeMailbox(env.CALLBOARD_AUTH_SENDER_EMAIL);
  let firstOutboxId = null;
  let queued = 0;
  for (const person of recipients) {
    const idempotencyKey = `${automationKey}:${person.id}`;
    const existing = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM communication_outbox WHERE event_id = ?1 AND idempotency_key = ?2 LIMIT 1",
    ).bind(event.id, idempotencyKey).first();
    if (existing) { firstOutboxId ||= existing.id; continue; }
    const attachCalendar = Boolean(template.attachCalendar && source.session?.starts_at);
    const exact = {
      schemaVersion: 1, releaseMode: "event-members", deliveryMode: "live", networkIntent: true,
      action: "automation",
      from: { name: event.name || "OpenCallboard", email: senderEmail },
      replyTo: { name: event.name || "OpenCallboard", email: senderEmail },
      to: [{ id: person.id, role: person.role || "Speaker", name: person.name, email: person.email }],
      subject: renderLiveReminderText(template.subject, event, person, source, env.CALLBOARD_PUBLIC_ORIGIN),
      text: renderLiveReminderText(template.body, event, person, source, env.CALLBOARD_PUBLIC_ORIGIN),
      scheduledFor: null,
      attachments: attachCalendar ? [{ kind: "calendar", filename: "opencallboard-session.ics", contentDisposition: "attachment", previewOnly: false }] : [],
      safety: { recipientAllowlistEnforced: true, outboundEnabled: true },
      ...(attachCalendar ? { calendar: { uid: `${source.sourceId}@opencallboard.com`, method: "REQUEST", sequence: 0, status: "CONFIRMED", start: source.session.starts_at, end: source.session.ends_at || new Date(Date.parse(source.session.starts_at) + 60 * 60 * 1000).toISOString(), location: source.session.room || event.location || "" } } : {}),
    };
    const validation = await validateEventMemberCommunication({ idempotencyKey, action: "automation", templateId: template.id, templateName: template.name, segment: reminder.segment, exactPayload: exact }, env, event.id);
    if (validation.error) continue;
    const timestamp = evaluatedAt;
    const outboxId = id("communication_outbox");
    const attemptId = id("communication_attempt");
    const approvalId = id("communication_release");
    const approvalToken = `cbr_${randomToken()}`;
    const exactJson = JSON.stringify(exact);
    const exactHash = await sha256(exactJson);
    await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare("INSERT INTO communication_outbox (id,event_id,idempotency_key,action,status,template_id,template_name,segment,recipients_json,subject,body,scheduled_for,calendar_json,exact_payload_json,provider,attempt_count,version,created_at,updated_at) VALUES (?1,?2,?3,'automation','queued_for_delivery',?4,?5,?6,?7,?8,?9,NULL,?10,?11,'ses',0,1,?12,?12)").bind(outboxId,event.id,idempotencyKey,template.id,template.name,reminder.segment,JSON.stringify(exact.to),exact.subject,exact.text,exact.calendar ? JSON.stringify(exact.calendar) : null,exactJson,timestamp),
      env.CALLBOARD_DB.prepare("INSERT INTO communication_delivery_attempts (id,event_id,outbox_id,attempt_number,mode,status,provider,finished_at,created_at) VALUES (?1,?2,?3,0,'live','not_dispatched','none',?4,?4)").bind(attemptId,event.id,outboxId,timestamp),
      env.CALLBOARD_DB.prepare("INSERT INTO communication_release_approvals (id,event_id,outbox_id,approval_hash,active_slot,exact_payload_hash,sender_email,recipient_email,status,expires_at,enqueued_at,created_by_user_id,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'queued',?9,?10,?11,?10,?10)").bind(approvalId,event.id,outboxId,await sha256(approvalToken),`${event.id}:${outboxId}`,exactHash,senderEmail,normalizeMailbox(person.email),new Date(Date.parse(timestamp)+60*60*1000).toISOString(),timestamp,organizer.user_id),
    ]);
    try {
      await env.CALLBOARD_EMAIL_QUEUE.send({ version: 1, approvalId, approvalToken, eventId: event.id, outboxId });
      queued += 1;
      firstOutboxId ||= outboxId;
    } catch {
      await env.CALLBOARD_DB.batch([
        env.CALLBOARD_DB.prepare("UPDATE communication_release_approvals SET status='failed',active_slot=NULL,used_at=?1,updated_at=?1 WHERE id=?2").bind(now(),approvalId),
        env.CALLBOARD_DB.prepare("UPDATE communication_outbox SET status='failed',last_error='EMAIL_QUEUE_ENQUEUE_FAILED',updated_at=?1 WHERE id=?2").bind(now(),outboxId),
      ]);
    }
  }
  const runId = id("communication_reminder_run");
  await env.CALLBOARD_DB.prepare("INSERT INTO communication_reminder_runs (id,event_id,reminder_id,automation_key,source_type,source_id,evaluated_at,due_at,status,matched_recipient_count,outbox_id,network_intent,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,1,?7)").bind(runId,event.id,reminder.id,automationKey,source.sourceType,source.sourceId,evaluatedAt,source.dueAt,queued ? "queued_live" : "failed_delivery",matchedRecipientCount,firstOutboxId).run();
  const run = await env.CALLBOARD_DB.prepare("SELECT * FROM communication_reminder_runs WHERE id=?1").bind(runId).first();
  return { item: communicationReminderRunPayload(run), replayed: false };
}

async function reminderMatchedRecipientCount(env, eventId, segment) {
  let sql;
  if (segment === "accepted-speakers") {
    sql =
      "SELECT COUNT(DISTINCT p.id) AS count FROM people p JOIN session_people sp ON sp.event_id = p.event_id AND sp.person_id = p.id JOIN agenda_sessions s ON s.event_id = sp.event_id AND s.id = sp.session_id WHERE p.event_id = ?1 AND lower(s.status) = 'accepted'";
  } else if (segment === "incomplete-tasks") {
    sql =
      "SELECT COUNT(DISTINCT p.id) AS count FROM people p JOIN tasks t ON t.event_id = p.event_id AND t.assignee_person_id = p.id WHERE p.event_id = ?1 AND lower(t.status) NOT IN ('complete', 'completed', 'done')";
  } else if (
    segment === "pending-submitters" ||
    segment === "declined-submitters"
  ) {
    const status = segment === "pending-submitters" ? "pending" : "declined";
    const row = await env.CALLBOARD_DB.prepare(
      `
      SELECT COUNT(*) AS count FROM (
        SELECT s.submitter_person_id AS person_id FROM submissions s WHERE s.event_id = ?1 AND lower(s.status) = ?2 AND s.submitter_person_id IS NOT NULL
        UNION
        SELECT sp.person_id FROM submissions s JOIN submission_people sp ON sp.event_id = s.event_id AND sp.submission_id = s.id WHERE s.event_id = ?1 AND lower(s.status) = ?2
      )
    `,
    )
      .bind(eventId, status)
      .first();
    return Number(row?.count || 0);
  } else {
    sql =
      "SELECT COUNT(*) AS count FROM people WHERE event_id = ?1 AND lower(role) IN ('speaker', 'contact')";
  }
  const row = await env.CALLBOARD_DB.prepare(sql).bind(eventId).first();
  return Number(row?.count || 0);
}

function scheduledReminderPayload(template, dueAt, source) {
  const attachCalendar = Boolean(
    template.attachCalendar &&
    source.sourceType === "session" &&
    source.session?.starts_at,
  );
  const start = attachCalendar ? new Date(source.session.starts_at) : null;
  const parsedEnd = attachCalendar
    ? new Date(source.session.ends_at || "")
    : null;
  const end =
    attachCalendar && Number.isFinite(parsedEnd?.getTime()) && parsedEnd > start
      ? parsedEnd
      : attachCalendar
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : null;
  const exact = {
    schemaVersion: 1,
    releaseMode: "test-allowlist",
    deliveryMode: "preview-only",
    networkIntent: false,
    action: "automation",
    from: {
      name: "Event Operations Test Notifications",
      email: COMMUNICATIONS_SENDER,
    },
    replyTo: {
      name: "Event Operations Test Notifications",
      email: COMMUNICATIONS_SENDER,
    },
    to: [COMMUNICATIONS_FIRST_CANARY_IDENTITY],
    subject: renderSyntheticReminderText(template.subject),
    text: renderSyntheticReminderText(template.body),
    scheduledFor: dueAt,
    attachments: attachCalendar
      ? [
          {
            kind: "calendar",
            filename: "callboard-test-session.ics",
            contentDisposition: "attachment",
            previewOnly: true,
          },
        ]
      : [],
    safety: {
      syntheticContentOnly: true,
      recipientAllowlistEnforced: true,
      redactionCount: 0,
      outboundEnabled: false,
    },
  };
  if (attachCalendar)
    exact.calendar = {
      uid: `${source.sourceId}@callboard.local`,
      method: "REQUEST",
      sequence: 0,
      status: "CONFIRMED",
      start: start.toISOString(),
      end: end.toISOString(),
      location: "Test Room A",
    };
  return exact;
}

async function recordReminderRun(
  env,
  {
    eventId,
    reminder,
    automationKey,
    source,
    evaluatedAt,
    status,
    matchedRecipientCount,
    errorCode = null,
  },
) {
  const runId = id("communication_reminder_run");
  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      `
      INSERT OR IGNORE INTO communication_reminder_runs (id, event_id, reminder_id, automation_key, source_type, source_id, evaluated_at, due_at, status, matched_recipient_count, error_code, network_intent, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?7)
    `,
    ).bind(
      runId,
      eventId,
      reminder.id,
      automationKey,
      source.sourceType,
      source.sourceId,
      evaluatedAt,
      source.dueAt,
      status,
      matchedRecipientCount,
      errorCode,
    ),
    env.CALLBOARD_DB.prepare(
      "UPDATE events SET updated_at = ?1 WHERE id = ?2",
    ).bind(evaluatedAt, eventId),
  ]);
  return env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_reminder_runs WHERE event_id = ?1 AND automation_key = ?2 LIMIT 1",
  )
    .bind(eventId, automationKey)
    .first();
}

async function materializeDueReminder(
  env,
  event,
  reminder,
  source,
  evaluatedAt,
) {
  const automationKey = `${reminder.id}:${source.dueAt}`;
  const existing = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_reminder_runs WHERE event_id = ?1 AND automation_key = ?2 LIMIT 1",
  )
    .bind(event.id, automationKey)
    .first();
  if (existing)
    return { item: communicationReminderRunPayload(existing), replayed: true };
  const matchedRecipientCount = await reminderMatchedRecipientCount(
    env,
    event.id,
    reminder.segment,
  );
  if (!matchedRecipientCount) {
    const run = await recordReminderRun(env, {
      eventId: event.id,
      reminder,
      automationKey,
      source,
      evaluatedAt,
      status: "skipped_no_recipients",
      matchedRecipientCount: 0,
    });
    return { item: communicationReminderRunPayload(run), replayed: false };
  }
  const template = await reminderTemplate(env, event.id, reminder.template_id);
  if (!template) {
    const run = await recordReminderRun(env, {
      eventId: event.id,
      reminder,
      automationKey,
      source,
      evaluatedAt,
      status: "blocked_template",
      matchedRecipientCount,
      errorCode: "REMINDER_TEMPLATE_NOT_FOUND",
    });
    return { item: communicationReminderRunPayload(run), replayed: false };
  }
  if (env.CALLBOARD_REMINDER_LIVE_DELIVERY_ENABLED === "true") {
    const live = await materializeLiveReminder(
      env, event, reminder, source, template, evaluatedAt, matchedRecipientCount,
    );
    if (live?.item) return live;
    const run = await recordReminderRun(env, {
      eventId: event.id, reminder, automationKey, source, evaluatedAt,
      status: "blocked_delivery", matchedRecipientCount,
      errorCode: live?.blockedCode || "REMINDER_DELIVERY_NOT_CONFIGURED",
    });
    return { item: communicationReminderRunPayload(run), replayed: false };
  }
  const exactPayload = scheduledReminderPayload(template, source.dueAt, source);
  const validation = validatePreviewOnlyCommunication({
    idempotencyKey: automationKey,
    action: "automation",
    templateId: template.id,
    templateName: template.name,
    segment: reminder.segment,
    exactPayload,
  });
  if (validation.error) {
    const run = await recordReminderRun(env, {
      eventId: event.id,
      reminder,
      automationKey,
      source,
      evaluatedAt,
      status: "blocked_template",
      matchedRecipientCount,
      errorCode: "REMINDER_TEMPLATE_NOT_RELEASE_SAFE",
    });
    return { item: communicationReminderRunPayload(run), replayed: false };
  }
  const input = validation.value;
  const timestamp = evaluatedAt;
  const outboxId = id("communication_outbox");
  const attemptId = id("communication_attempt");
  const runId = id("communication_reminder_run");
  const exactPayloadJson = JSON.stringify(input.exact);
  const calendarJson = input.calendar ? JSON.stringify(input.calendar) : null;
  const operations = [
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO communication_outbox (id, event_id, idempotency_key, action, status, template_id, template_name, segment, recipients_json, subject, body, scheduled_for, calendar_json, exact_payload_json, provider, attempt_count, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, 'automation', 'scheduled_preview', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'none', 0, 1, ?13, ?13)
    `,
    ).bind(
      outboxId,
      event.id,
      automationKey,
      input.templateId,
      input.templateName,
      input.segment,
      JSON.stringify([input.recipient]),
      input.subject,
      input.text,
      input.scheduledFor,
      calendarJson,
      exactPayloadJson,
      timestamp,
    ),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO communication_delivery_attempts (id, event_id, outbox_id, attempt_number, mode, status, provider, finished_at, created_at) VALUES (?1, ?2, ?3, 0, 'preview', 'not_dispatched', 'none', ?4, ?4)",
    ).bind(attemptId, event.id, outboxId, timestamp),
    env.CALLBOARD_DB.prepare(
      `
      INSERT INTO communication_reminder_runs (id, event_id, reminder_id, automation_key, source_type, source_id, evaluated_at, due_at, status, matched_recipient_count, outbox_id, network_intent, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'materialized_preview', ?9, ?10, 0, ?7)
    `,
    ).bind(
      runId,
      event.id,
      reminder.id,
      automationKey,
      source.sourceType,
      source.sourceId,
      timestamp,
      source.dueAt,
      matchedRecipientCount,
      outboxId,
    ),
    env.CALLBOARD_DB.prepare(
      "UPDATE events SET updated_at = ?1 WHERE id = ?2",
    ).bind(timestamp, event.id),
  ];
  if (input.calendar)
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
    INSERT INTO calendar_event_previews (event_id, uid, method, sequence, status, starts_at, ends_at, location, outbox_id, version, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)
    ON CONFLICT(event_id, uid) DO UPDATE SET method = excluded.method, sequence = excluded.sequence, status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, location = excluded.location, outbox_id = excluded.outbox_id, version = calendar_event_previews.version + 1, updated_at = excluded.updated_at
    WHERE excluded.sequence >= calendar_event_previews.sequence
  `,
      ).bind(
        event.id,
        input.calendar.uid,
        input.calendar.method,
        input.calendar.sequence,
        input.calendar.status,
        input.calendar.start,
        input.calendar.end,
        input.calendar.location,
        outboxId,
        timestamp,
      ),
    );
  try {
    await env.CALLBOARD_DB.batch(operations);
  } catch (error) {
    const raced = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM communication_reminder_runs WHERE event_id = ?1 AND automation_key = ?2 LIMIT 1",
    )
      .bind(event.id, automationKey)
      .first();
    if (raced)
      return { item: communicationReminderRunPayload(raced), replayed: true };
    throw error;
  }
  const created = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_reminder_runs WHERE id = ?1 LIMIT 1",
  )
    .bind(runId)
    .first();
  return { item: communicationReminderRunPayload(created), replayed: false };
}

async function evaluateDueReminders(env, evaluatedAt = now(), eventId = null) {
  if (
    !env.CALLBOARD_DB ||
    env.CALLBOARD_WRITE_ENABLED !== "true" ||
    env.CALLBOARD_REMINDER_AUTOMATION_ENABLED !== "true"
  )
    return { configured: false, evaluatedAt, items: [] };
  const parsedTime = Date.parse(evaluatedAt);
  if (!Number.isFinite(parsedTime))
    return {
      configured: true,
      evaluatedAt,
      items: [],
      error: "INVALID_EVALUATION_TIME",
    };
  const events = eventId
    ? await env.CALLBOARD_DB.prepare(
        "SELECT * FROM events WHERE id = ?1 LIMIT 1",
      )
        .bind(eventId)
        .all()
    : await env.CALLBOARD_DB.prepare("SELECT * FROM events ORDER BY id").all();
  const items = [];
  for (const event of events.results || []) {
    const reminders = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM communication_reminders WHERE event_id = ?1 AND enabled = 1 ORDER BY id",
    )
      .bind(event.id)
      .all();
    for (const reminder of reminders.results || []) {
      const source = await reminderSource(env, event, reminder);
      if (!source || Date.parse(source.dueAt) > parsedTime) continue;
      items.push(
        await materializeDueReminder(
          env,
          event,
          reminder,
          source,
          new Date(parsedTime).toISOString(),
        ),
      );
    }
  }
  return {
    configured: true,
    evaluatedAt: new Date(parsedTime).toISOString(),
    items,
  };
}

async function handleReminderAutomation(request, env, url, session, action) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (action === "runs" && request.method === "GET") {
    const limit = Math.min(
      Math.max(
        Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100,
        1,
      ),
      250,
    );
    const rows = await env.CALLBOARD_DB.prepare(
      `SELECT * FROM communication_reminder_runs WHERE event_id = ?1 ORDER BY evaluated_at DESC, id DESC LIMIT ${limit}`,
    )
      .bind(session.eventId)
      .all();
    return json({
      items: (rows.results || []).map(communicationReminderRunPayload),
      limit,
    });
  }
  if (action !== "evaluate" || request.method !== "POST")
    return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (env.CALLBOARD_REMINDER_AUTOMATION_ENABLED !== "true")
    return apiError("REMINDER_AUTOMATION_DISABLED", 403);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  if (parsed.payload.confirm !== "materialize-due-reminder-previews")
    return apiError("REMINDER_EVALUATION_CONFIRMATION_REQUIRED", 428);
  const result = await evaluateDueReminders(env, now(), session.eventId);
  return json(result);
}

function communicationReleasePayload(row) {
  return {
    id: row.id,
    outboxId: row.outbox_id,
    exactPayloadHash: row.exact_payload_hash,
    senderEmail: row.sender_email,
    recipientEmail: row.recipient_email,
    status: row.status,
    expiresAt: row.expires_at,
    enqueuedAt: row.enqueued_at || null,
    dispatchStartedAt: row.dispatch_started_at || null,
    usedAt: row.used_at || null,
    revokedAt: row.revoked_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function validateStoredCommunicationOutbox(row, env, eventId) {
  const exactPayload = parseStoredJson(row.exact_payload_json, null);
  const validation = await validateCommunication({
    idempotencyKey: row.idempotency_key,
    action: row.action,
    templateId: row.template_id,
    templateName: row.template_name,
    segment: row.segment,
    exactPayload,
  }, env, eventId);
  return validation.error
    ? validation
    : { value: { ...validation.value, exactPayload } };
}

async function handleCommunicationReleaseApproval(
  request,
  env,
  session,
  outboxId,
) {
  if (session.role !== "organizer" || session.authType !== "browser_session")
    return apiError("FORBIDDEN", 403);
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (env.CALLBOARD_EMAIL_RELEASE_ENABLED !== "true")
    return apiError("EMAIL_RELEASE_DISABLED", 403);
  if (
    !env.CALLBOARD_EMAIL_QUEUE ||
    !transactionalEmailConfigured(env)
  )
    return apiError("EMAIL_RELEASE_NOT_CONFIGURED", 503);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const operatorRequested =
    parsed.payload.confirm === "release-one-synthetic-email";
  if (
    operatorRequested &&
    !safeEqual(
      request.headers.get("x-callboard-email-release-key"),
      env.CALLBOARD_EMAIL_RELEASE_KEY,
    )
  )
    return apiError("INVALID_EMAIL_RELEASE_KEY", 401);
  const operatorRelease = operatorRequested;
  const uiRelease =
    env.CALLBOARD_EMAIL_UI_RELEASE_ENABLED === "true" &&
    ["release-one-synthetic-email-from-ui", "release-one-event-member-email-from-ui"].includes(parsed.payload.confirm);
  if (!operatorRelease && !uiRelease)
    return apiError("EMAIL_RELEASE_CONFIRMATION_REQUIRED", 428);
  const row = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_outbox WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, outboxId)
    .first();
  if (!row) return apiError("NOT_FOUND", 404);
  // A provider failure can be ambiguous. Require an operator to prepare a fresh
  // outbox rather than re-releasing the same payload and risking a duplicate.
  if (!["prepared_preview", "prepared_live"].includes(row.status))
    return apiError("OUTBOX_NOT_RELEASEABLE", 409, { status: row.status });
  const validation = await validateStoredCommunicationOutbox(row, env, session.eventId);
  if (validation.error) return validation.error;
  const input = validation.value;
  if (!input.live && normalizeMailbox(input.recipient.email) !== COMMUNICATIONS_FIRST_CANARY)
    return apiError("FIRST_CANARY_RECIPIENT_REQUIRED", 403, {
      recipient: COMMUNICATIONS_FIRST_CANARY,
    });
  if (input.live) {
    const dailyCap = Math.min(Math.max(Number(env.CALLBOARD_EMAIL_DAILY_CAP || 500), 1), 1000);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await env.CALLBOARD_DB.prepare(
      "SELECT COUNT(*) AS count FROM communication_outbox WHERE event_id = ?1 AND created_at >= ?2 AND status IN ('queued_for_delivery', 'dispatching', 'sent')",
    ).bind(session.eventId, since).first();
    if (Number(recent?.count || 0) >= dailyCap)
      return apiError("EVENT_EMAIL_DAILY_CAP_REACHED", 429, { dailyCap });
  }
  const exactPayloadHash = await sha256(row.exact_payload_json);
  if (
    operatorRelease &&
    !safeEqual(parsed.payload.exactPayloadHash, exactPayloadHash)
  )
    return apiError("EXACT_PAYLOAD_HASH_MISMATCH", 409, { exactPayloadHash });
  const active = await env.CALLBOARD_DB.prepare(
    "SELECT id, status, expires_at FROM communication_release_approvals WHERE event_id = ?1 AND outbox_id = ?2 AND status IN ('pending_enqueue', 'queued', 'dispatching') ORDER BY created_at DESC LIMIT 1",
  )
    .bind(session.eventId, outboxId)
    .first();
  if (active && active.expires_at > now())
    return apiError("EMAIL_RELEASE_ALREADY_ACTIVE", 409, {
      approvalId: active.id,
      status: active.status,
    });

  const timestamp = now();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const approvalId = id("communication_release");
  const approvalToken = `cbr_${randomToken()}`;
  try {
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO communication_release_approvals (id, event_id, outbox_id, approval_hash, active_slot, exact_payload_hash, sender_email, recipient_email, status, expires_at, created_by_user_id, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending_enqueue', ?9, ?10, ?11, ?11)
    `,
    )
      .bind(
        approvalId,
        session.eventId,
        outboxId,
        await sha256(approvalToken),
        `${session.eventId}:${outboxId}`,
        exactPayloadHash,
        normalizeMailbox(input.exactPayload.from?.email),
        normalizeMailbox(input.recipient.email),
        expiresAt,
        session.userId,
        timestamp,
      )
      .run();
  } catch {
    return apiError("EMAIL_RELEASE_ALREADY_ACTIVE", 409);
  }
  try {
    await env.CALLBOARD_EMAIL_QUEUE.send({
      version: 1,
      approvalId,
      approvalToken,
      eventId: session.eventId,
      outboxId,
    });
  } catch {
    await env.CALLBOARD_DB.prepare(
      "UPDATE communication_release_approvals SET status = 'failed', active_slot = NULL, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'pending_enqueue'",
    )
      .bind(now(), approvalId)
      .run();
    return apiError("EMAIL_QUEUE_ENQUEUE_FAILED", 503);
  }
  const enqueuedAt = now();
  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      "UPDATE communication_release_approvals SET status = 'queued', enqueued_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'pending_enqueue'",
    ).bind(enqueuedAt, approvalId),
    env.CALLBOARD_DB.prepare(
      `UPDATE communication_outbox SET status = ?1, provider = ?2, last_error = NULL, version = version + 1, updated_at = ?3 WHERE event_id = ?4 AND id = ?5`,
    ).bind(input.live ? "queued_for_delivery" : "queued_for_test_delivery", input.live ? "ses" : "gmail", enqueuedAt, session.eventId, outboxId),
    env.CALLBOARD_DB.prepare(
      "UPDATE events SET updated_at = ?1 WHERE id = ?2",
    ).bind(enqueuedAt, session.eventId),
  ]);
  const created = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_release_approvals WHERE id = ?1 LIMIT 1",
  )
    .bind(approvalId)
    .first();
  return json(
    {
      item: communicationReleasePayload(created),
      queued: true,
      providerNetworkIntent: Boolean(input.live),
    },
    { status: 202 },
  );
}

function providerErrorCode(error) {
  return String(error?.code || "EMAIL_DELIVERY_FAILED")
    .replace(/[^A-Z0-9_-]/gi, "_")
    .slice(0, 80);
}

async function deliverApprovedCommunication(env, message) {
  if (
    !env.CALLBOARD_DB ||
    env.CALLBOARD_EMAIL_RELEASE_ENABLED !== "true" ||
    !transactionalEmailConfigured(env)
  )
    return { retry: true, delaySeconds: 60 };
  const body = message?.body;
  if (
    !body ||
    body.version !== 1 ||
    !body.approvalId ||
    !body.approvalToken ||
    !body.eventId ||
    !body.outboxId
  )
    return { final: true };
  const approval = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_release_approvals WHERE id = ?1 AND event_id = ?2 AND outbox_id = ?3 AND approval_hash = ?4 LIMIT 1",
  )
    .bind(
      body.approvalId,
      body.eventId,
      body.outboxId,
      await sha256(body.approvalToken),
    )
    .first();
  if (!approval) return { final: true };
  if (["succeeded", "failed", "revoked", "expired"].includes(approval.status))
    return { final: true };
  const timestamp = now();
  if (approval.expires_at <= timestamp) {
    await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_release_approvals SET status = 'expired', active_slot = NULL, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status IN ('pending_enqueue', 'queued')",
      ).bind(timestamp, approval.id),
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_outbox SET status = CASE WHEN status = 'queued_for_delivery' THEN 'prepared_live' ELSE 'prepared_preview' END, provider = 'none', last_error = 'EMAIL_RELEASE_EXPIRED', version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND id = ?3 AND status IN ('queued_for_test_delivery', 'queued_for_delivery')",
      ).bind(timestamp, body.eventId, body.outboxId),
    ]);
    return { final: true };
  }
  if (approval.status === "pending_enqueue")
    return { retry: true, delaySeconds: 30 };
  if (approval.status !== "queued") return { final: true };
  const outbox = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM communication_outbox WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(body.eventId, body.outboxId)
    .first();
  if (
    !outbox ||
    (await sha256(outbox.exact_payload_json)) !== approval.exact_payload_hash
  ) {
    await env.CALLBOARD_DB.prepare(
      "UPDATE communication_release_approvals SET status = 'revoked', active_slot = NULL, revoked_at = ?1, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'queued'",
    )
      .bind(timestamp, approval.id)
      .run();
    return { final: true };
  }
  const validation = await validateStoredCommunicationOutbox(outbox, env, body.eventId);
  if (
    validation.error ||
    normalizeMailbox(validation.value.recipient.email) !==
      approval.recipient_email ||
    normalizeMailbox(validation.value.exactPayload.from?.email) !==
      approval.sender_email
  ) {
    await env.CALLBOARD_DB.prepare(
      "UPDATE communication_release_approvals SET status = 'revoked', active_slot = NULL, revoked_at = ?1, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'queued'",
    )
      .bind(timestamp, approval.id)
      .run();
    return { final: true };
  }
  const attemptNumber = Number(outbox.attempt_count || 0) + 1;
  const attemptId = id("communication_attempt");
  const live = Boolean(validation.value.live);
  const queuedStatus = live ? "queued_for_delivery" : "queued_for_test_delivery";
  const dispatchingStatus = live ? "dispatching" : "dispatching_test";
  const provider = live ? "ses" : "gmail";
  const [claimed] = await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      "UPDATE communication_release_approvals SET status = 'dispatching', dispatch_started_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'queued'",
    ).bind(timestamp, approval.id),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO communication_delivery_attempts (id, event_id, outbox_id, attempt_number, mode, status, provider, started_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'dispatching', ?6, ?7, ?7)",
    ).bind(attemptId, body.eventId, body.outboxId, attemptNumber, live ? "live" : "live_test", provider, timestamp),
    env.CALLBOARD_DB.prepare(
      "UPDATE communication_outbox SET status = ?1, provider = ?2, attempt_count = ?3, version = version + 1, updated_at = ?4 WHERE event_id = ?5 AND id = ?6 AND status = ?7",
    ).bind(dispatchingStatus, provider, attemptNumber, timestamp, body.eventId, body.outboxId, queuedStatus),
  ]);
  if (!claimed.meta?.changes) return { final: true };

  try {
    const result = live
      ? await sendTransactionalEmail({
          env,
          exactPayload: validation.value.exactPayload,
          idempotencyKey: outbox.id,
          providerFetch: env.CALLBOARD_PROVIDER_FETCH || fetch,
          sentAt: new Date(timestamp),
        })
      : await sendSyntheticGmail({
          credentialsJson: env.CALLBOARD_GMAIL_CREDENTIALS,
          exactPayload: validation.value.exactPayload,
          outboxId: outbox.id,
          providerFetch: env.CALLBOARD_PROVIDER_FETCH || fetch,
          sentAt: new Date(timestamp),
        });
    const finishedAt = now();
    await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_release_approvals SET status = 'succeeded', active_slot = NULL, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'dispatching'",
      ).bind(finishedAt, approval.id),
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_delivery_attempts SET status = 'succeeded', provider_message_id = ?1, finished_at = ?2 WHERE id = ?3 AND status = 'dispatching'",
      ).bind(result.messageId, finishedAt, attemptId),
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_outbox SET status = ?1, provider_message_id = ?2, last_error = NULL, version = version + 1, updated_at = ?3 WHERE event_id = ?4 AND id = ?5 AND status = ?6",
      ).bind(live ? "sent" : "sent_test", result.messageId, finishedAt, body.eventId, body.outboxId, dispatchingStatus),
      env.CALLBOARD_DB.prepare(
        "UPDATE events SET updated_at = ?1 WHERE id = ?2",
      ).bind(finishedAt, body.eventId),
    ]);
    return { final: true, sent: true };
  } catch (error) {
    const finishedAt = now();
    const code = providerErrorCode(error);
    await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_release_approvals SET status = 'failed', active_slot = NULL, used_at = ?1, updated_at = ?1 WHERE id = ?2 AND status = 'dispatching'",
      ).bind(finishedAt, approval.id),
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_delivery_attempts SET status = 'failed', error_code = ?1, error_message = ?1, finished_at = ?2 WHERE id = ?3 AND status = 'dispatching'",
      ).bind(code, finishedAt, attemptId),
      env.CALLBOARD_DB.prepare(
        "UPDATE communication_outbox SET status = ?1, last_error = ?2, version = version + 1, updated_at = ?3 WHERE event_id = ?4 AND id = ?5 AND status = ?6",
      ).bind(live ? "failed" : "failed_test", code, finishedAt, body.eventId, body.outboxId, dispatchingStatus),
      env.CALLBOARD_DB.prepare(
        "UPDATE events SET updated_at = ?1 WHERE id = ?2",
      ).bind(finishedAt, body.eventId),
    ]);
    return { final: true, sent: false };
  }
}

async function deliverOrganizerMagicLink(env, message) {
  if (
    !env.CALLBOARD_DB ||
    env.CALLBOARD_SELF_SERVE_EMAIL_ENABLED !== "true" ||
    !transactionalEmailConfigured(env)
  )
    return { retry: true, delaySeconds: 60 };
  const body = message?.body;
  if (
    !body ||
    body.version !== 1 ||
    body.type !== "organizer_magic_link" ||
    !body.challengeId ||
    !body.token
  )
    return { final: true };
  const challenge = await env.CALLBOARD_DB.prepare(
    `SELECT id, email, name, expires_at, used_at, delivery_status
     FROM organizer_login_challenges
     WHERE id = ?1 AND token_hash = ?2
     LIMIT 1`,
  )
    .bind(body.challengeId, await sha256(body.token))
    .first();
  if (!challenge || challenge.used_at || challenge.expires_at <= now())
    return { final: true };
  if (challenge.delivery_status === "delivered") return { final: true };
  const origin = String(env.CALLBOARD_PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (!origin) return { retry: true, delaySeconds: 60 };
  const senderEmail = String(env.CALLBOARD_AUTH_SENDER_EMAIL || COMMUNICATIONS_SENDER)
    .trim()
    .toLowerCase();
  const firstName = String(challenge.name || challenge.email.split("@")[0]).trim().split(/\s+/)[0];
  const accessUrl = `${origin}/#/organizer-access/${encodeURIComponent(body.token)}`;
  try {
    const result = await sendTransactionalEmail({
      env,
      exactPayload: {
        from: { name: "OpenCallboard", email: senderEmail },
        replyTo: { name: "OpenCallboard", email: senderEmail },
        to: [{ name: challenge.name || challenge.email, email: challenge.email }],
        subject: "Sign in to OpenCallboard",
        text: `Hi ${firstName},\n\nUse this private link to sign in to OpenCallboard. It expires in 15 minutes and can be used once.\n\n${accessUrl}\n\nIf you did not request this link, you can ignore this email.`,
      },
      idempotencyKey: challenge.id,
      providerFetch: env.CALLBOARD_PROVIDER_FETCH || fetch,
      sentAt: new Date(),
    });
    await env.CALLBOARD_DB.prepare(
      "UPDATE organizer_login_challenges SET delivery_status = 'delivered', provider_message_id = ?1 WHERE id = ?2 AND used_at IS NULL",
    )
      .bind(result.messageId, challenge.id)
      .run();
    return { final: true, sent: true };
  } catch (error) {
    const providerErrorCode = String(error?.code || "UNKNOWN").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
    console.error("Organizer magic-link delivery failed", providerErrorCode);
    await env.CALLBOARD_DB.prepare(
      "UPDATE organizer_login_challenges SET delivery_status = 'retrying' WHERE id = ?1 AND used_at IS NULL",
    )
      .bind(challenge.id)
      .run();
    return { retry: true, delaySeconds: 60 };
  }
}

async function deliverRoleAccessLink(env, message) {
  if (
    !env.CALLBOARD_DB ||
    env.CALLBOARD_IDENTITY_EMAIL_ENABLED !== "true" ||
    !transactionalEmailConfigured(env)
  )
    return { retry: true, delaySeconds: 60 };
  const body = message?.body;
  if (
    !body ||
    body.version !== 1 ||
    body.type !== "role_access_link" ||
    !body.grantId ||
    !body.token
  )
    return { final: true };
  const grant = await env.CALLBOARD_DB.prepare(
    `SELECT g.id, g.email, g.name, g.role, g.expires_at, g.used_at, e.name AS event_name
     FROM access_grants g JOIN events e ON e.id = g.event_id
     WHERE g.id = ?1 AND g.grant_hash = ?2 LIMIT 1`,
  )
    .bind(body.grantId, await sha256(body.token))
    .first();
  if (!grant || grant.used_at || grant.expires_at <= now()) return { final: true };
  const origin = String(env.CALLBOARD_PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (!origin) return { retry: true, delaySeconds: 60 };
  const senderEmail = String(env.CALLBOARD_AUTH_SENDER_EMAIL || COMMUNICATIONS_SENDER).trim().toLowerCase();
  const firstName = String(grant.name || grant.email).trim().split(/\s+/)[0];
  const accessUrl = `${origin}/#/access/${encodeURIComponent(body.token)}`;
  try {
    await sendTransactionalEmail({
      env,
      exactPayload: {
        from: { name: grant.event_name, email: senderEmail },
        replyTo: { name: grant.event_name, email: senderEmail },
        to: [{ name: grant.name || grant.email, email: grant.email }],
        subject: `${grant.event_name}: your private ${grant.role} access`,
        text: `Hi ${firstName},\n\nUse this private one-time link to open your ${grant.role} workspace for ${grant.event_name}. It expires in 24 hours.\n\n${accessUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`,
      },
      idempotencyKey: grant.id,
      providerFetch: env.CALLBOARD_PROVIDER_FETCH || fetch,
      sentAt: new Date(),
    });
    return { final: true, sent: true };
  } catch (error) {
    console.error("Role access-link delivery failed", String(error?.code || "UNKNOWN"));
    return { retry: true, delaySeconds: 60 };
  }
}

async function handleCommunicationQueue(batch, env) {
  for (const message of batch.messages || []) {
    try {
      const result = message?.body?.type === "organizer_magic_link"
        ? await deliverOrganizerMagicLink(env, message)
        : message?.body?.type === "role_access_link"
          ? await deliverRoleAccessLink(env, message)
          : await deliverApprovedCommunication(env, message);
      if (result.retry)
        message.retry?.({ delaySeconds: result.delaySeconds || 60 });
      else message.ack?.();
    } catch {
      message.retry?.({ delaySeconds: 60 });
    }
  }
}

const DEFAULT_ACCELEVENTS_SPEAKER_MAPPING = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  title: "title",
  company: "company",
  biography: "bio",
  pronouns: "pronouns",
  photoUrl: "headshotUrl",
};
const DEFAULT_ACCELEVENTS_SESSION_MAPPING = {
  title: "title",
  description: "description",
  startTime: "startsAt",
  endTime: "endsAt",
  format: "format",
  status: "status",
  track: "track",
  room: "room",
};

function safeMapping(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const entries = Object.entries(value)
    .slice(0, 40)
    .filter(
      ([target, source]) =>
        target && typeof source === "string" && source.length <= 80,
    );
  return entries.length ? Object.fromEntries(entries) : fallback;
}

function containsSensitiveIntegrationKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSensitiveIntegrationKey);
  return Object.entries(value).some(
    ([key, child]) =>
      /token|secret|password|credential|api.?key/i.test(key) ||
      containsSensitiveIntegrationKey(child),
  );
}

function integrationConfigPayload(row, runs = []) {
  return row
    ? {
        provider: row.provider,
        enabled: Boolean(row.enabled),
        eventUrl: row.event_url || "",
        eventId: row.external_event_id || "",
        direction: row.direction,
        mode: row.mode,
        speakerMapping: parseStoredJson(
          row.speaker_mapping_json,
          DEFAULT_ACCELEVENTS_SPEAKER_MAPPING,
        ),
        sessionMapping: parseStoredJson(
          row.session_mapping_json,
          DEFAULT_ACCELEVENTS_SESSION_MAPPING,
        ),
        externalSnapshot: parseStoredJson(row.external_snapshot_json, {}),
        syncHistory: runs,
        version: Number(row.version || 1),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : {
        provider: "accelevents",
        enabled: false,
        eventUrl: "",
        eventId: "",
        direction: "CALLBOARD_TO_ACCELEVENTS",
        mode: "mock",
        speakerMapping: DEFAULT_ACCELEVENTS_SPEAKER_MAPPING,
        sessionMapping: DEFAULT_ACCELEVENTS_SESSION_MAPPING,
        externalSnapshot: {},
        syncHistory: [],
        version: 0,
      };
}

function integrationOperationPayload(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    localId: row.local_id,
    action: row.action,
    status: row.status,
    reason: row.reason || "",
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    payload: parseStoredJson(row.payload_json, {}),
    externalId: row.external_id || null,
    error: row.error || null,
    createdAt: row.created_at,
  };
}

async function integrationRuns(env, eventId, limit = 25) {
  const runRows = await env.CALLBOARD_DB.prepare(
    `
    SELECT * FROM integration_sync_runs
    WHERE event_id = ?1 AND provider = 'accelevents'
    ORDER BY completed_at DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `,
  )
    .bind(eventId)
    .all();
  const runs = [];
  for (const run of runRows.results || []) {
    const operationRows = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM integration_sync_operations WHERE event_id = ?1 AND run_id = ?2 ORDER BY created_at, entity_type, local_id",
    )
      .bind(eventId, run.id)
      .all();
    const results = (operationRows.results || []).map(
      integrationOperationPayload,
    );
    runs.push({
      id: run.id,
      provider: run.provider,
      planId: run.plan_id,
      mode: run.mode,
      status: run.status,
      configVersion: Number(run.config_version),
      retryOfRunId: run.retry_of_run_id || null,
      summary: parseStoredJson(run.summary_json, {}),
      networkIntent: Boolean(run.network_intent),
      createdByUserId: run.created_by_user_id,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      results,
      errors: results
        .filter((result) => ["FAILED", "BLOCKED"].includes(result.status))
        .map((result) => ({
          localId: result.localId,
          message: result.error || result.reason || result.status,
        })),
    });
  }
  return runs;
}

function integrationVersion(request) {
  const raw = String(request.headers.get("if-match") || "").replaceAll('"', "");
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function mockExternalId(entityType, localId) {
  let hash = 0x811c9dc5;
  const text = `${entityType}:${localId}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mock_${entityType}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function validateIntegrationOperation(operation) {
  if (!operation || typeof operation !== "object" || Array.isArray(operation))
    return "INVALID_OPERATION";
  if (
    !/^(speaker|session|sessionSpeaker)$/.test(
      String(operation.entityType || ""),
    )
  )
    return "INVALID_ENTITY_TYPE";
  if (
    !String(operation.localId || "").trim() ||
    String(operation.localId).length > 180
  )
    return "INVALID_LOCAL_ID";
  if (!/^(CREATE|UPDATE|SKIP|BLOCKED)$/.test(String(operation.action || "")))
    return "INVALID_ACTION";
  if (
    !String(operation.idempotencyKey || "").startsWith("accelevents:") ||
    String(operation.idempotencyKey).length > 240
  )
    return "INVALID_IDEMPOTENCY_KEY";
  if (
    !String(operation.payloadHash || "").trim() ||
    String(operation.payloadHash).length > 80
  )
    return "INVALID_PAYLOAD_HASH";
  if (
    !operation.payload ||
    typeof operation.payload !== "object" ||
    Array.isArray(operation.payload) ||
    containsSensitiveIntegrationKey(operation.payload)
  )
    return "INVALID_PAYLOAD";
  return null;
}

async function handleAcceleventsIntegration(request, env, session, action) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const connection = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM integration_connections WHERE event_id = ?1 AND provider = 'accelevents' LIMIT 1",
  )
    .bind(session.eventId)
    .first();

  if (request.method === "GET" && !action)
    return json({
      item: integrationConfigPayload(
        connection,
        await integrationRuns(env, session.eventId),
      ),
    });
  const writeError = requireWrites(env);
  if (writeError) return writeError;

  if (["PUT", "PATCH"].includes(request.method) && !action) {
    const expectedVersion = integrationVersion(request);
    if (expectedVersion === null) return apiError("IF_MATCH_REQUIRED", 428);
    if (Number(connection?.version || 0) !== expectedVersion)
      return apiError("VERSION_CONFLICT", 409);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    if (containsSensitiveIntegrationKey(parsed.payload))
      return apiError("INTEGRATION_SECRET_REJECTED", 400);
    const eventUrl = String(parsed.payload.eventUrl || "")
      .trim()
      .slice(0, 240);
    const eventId = String(parsed.payload.eventId || "")
      .trim()
      .slice(0, 120);
    const speakerMapping = safeMapping(
      parsed.payload.speakerMapping,
      DEFAULT_ACCELEVENTS_SPEAKER_MAPPING,
    );
    const sessionMapping = safeMapping(
      parsed.payload.sessionMapping,
      DEFAULT_ACCELEVENTS_SESSION_MAPPING,
    );
    const timestamp = now();
    if (!connection) {
      await env.CALLBOARD_DB.prepare(
        `
        INSERT INTO integration_connections (event_id, provider, event_url, external_event_id, direction, mode, enabled, speaker_mapping_json, session_mapping_json, external_snapshot_json, version, created_at, updated_at)
        VALUES (?1, 'accelevents', ?2, ?3, 'CALLBOARD_TO_ACCELEVENTS', 'mock', ?4, ?5, ?6, '{}', 1, ?7, ?7)
      `,
      )
        .bind(
          session.eventId,
          eventUrl || null,
          eventId || null,
          eventUrl || eventId ? 1 : 0,
          JSON.stringify(speakerMapping),
          JSON.stringify(sessionMapping),
          timestamp,
        )
        .run();
    } else {
      const result = await env.CALLBOARD_DB.prepare(
        `
        UPDATE integration_connections SET event_url = ?1, external_event_id = ?2, enabled = ?3,
          speaker_mapping_json = ?4, session_mapping_json = ?5, version = version + 1, updated_at = ?6
        WHERE event_id = ?7 AND provider = 'accelevents' AND version = ?8
      `,
      )
        .bind(
          eventUrl || null,
          eventId || null,
          eventUrl || eventId ? 1 : 0,
          JSON.stringify(speakerMapping),
          JSON.stringify(sessionMapping),
          timestamp,
          session.eventId,
          expectedVersion,
        )
        .run();
      if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    }
    await touchWorkspace(env, session.eventId, timestamp);
    const updated = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM integration_connections WHERE event_id = ?1 AND provider = 'accelevents' LIMIT 1",
    )
      .bind(session.eventId)
      .first();
    return json({
      item: integrationConfigPayload(
        updated,
        await integrationRuns(env, session.eventId),
      ),
    });
  }

  if (request.method === "POST" && action === "runs") {
    if (!connection) return apiError("INTEGRATION_CONFIGURATION_REQUIRED", 409);
    if (!connection.enabled)
      return apiError("INTEGRATION_DESTINATION_REQUIRED", 409);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    const payload = parsed.payload;
    if (containsSensitiveIntegrationKey(payload))
      return apiError("INTEGRATION_SECRET_REJECTED", 400);
    if (payload.mode !== "mock" || payload.networkIntent !== false)
      return apiError("REAL_INTEGRATION_DISABLED", 403);
    if (Number(payload.configVersion) !== Number(connection.version))
      return apiError("VERSION_CONFLICT", 409);
    const retryOfRunId = String(payload.retryOfRunId || "").trim() || null;
    let planId = String(payload.plan?.id || "").trim();
    let operations = Array.isArray(payload.plan?.operations)
      ? payload.plan.operations
      : [];
    if (retryOfRunId) {
      const priorRun = await env.CALLBOARD_DB.prepare(
        "SELECT id FROM integration_sync_runs WHERE event_id = ?1 AND provider = 'accelevents' AND id = ?2 LIMIT 1",
      )
        .bind(session.eventId, retryOfRunId)
        .first();
      if (!priorRun) return apiError("RETRY_RUN_NOT_FOUND", 404);
      const retryIds = new Set(
        Array.isArray(payload.retryLocalIds)
          ? payload.retryLocalIds.map(String)
          : [],
      );
      const failedRows = await env.CALLBOARD_DB.prepare(
        "SELECT * FROM integration_sync_operations WHERE event_id = ?1 AND run_id = ?2 AND status = 'FAILED' ORDER BY created_at",
      )
        .bind(session.eventId, retryOfRunId)
        .all();
      const resolvedRows = await env.CALLBOARD_DB.prepare(
        `
        SELECT operation.entity_type, operation.local_id, operation.idempotency_key
        FROM integration_sync_runs child
        JOIN integration_sync_operations operation ON operation.event_id = child.event_id AND operation.run_id = child.id
        WHERE child.event_id = ?1 AND child.provider = 'accelevents' AND child.retry_of_run_id = ?2
          AND operation.status IN ('SUCCEEDED', 'SKIPPED')
      `,
      )
        .bind(session.eventId, retryOfRunId)
        .all();
      const resolved = new Set(
        (resolvedRows.results || []).map(
          (row) => `${row.entity_type}:${row.local_id}:${row.idempotency_key}`,
        ),
      );
      operations = (failedRows.results || [])
        .filter(
          (row) =>
            (!retryIds.size || retryIds.has(row.local_id)) &&
            !resolved.has(
              `${row.entity_type}:${row.local_id}:${row.idempotency_key}`,
            ),
        )
        .map((row) => ({
          entityType: row.entity_type,
          localId: row.local_id,
          action: row.action,
          reason: row.reason,
          idempotencyKey: row.idempotency_key,
          payloadHash: row.payload_hash,
          payload: parseStoredJson(row.payload_json, {}),
          externalId: row.external_id,
        }));
      planId = `retry-${retryOfRunId}`;
      if (!operations.length) return apiError("NO_FAILED_OPERATIONS", 409);
    }
    if (!planId || !operations.length || operations.length > 250)
      return apiError("INVALID_INTEGRATION_PLAN", 400);
    if (
      payload.plan &&
      (payload.plan.provider !== "accelevents" ||
        payload.plan.direction !== "CALLBOARD_TO_ACCELEVENTS" ||
        Number(payload.plan.destructiveOperations || 0) !== 0)
    )
      return apiError("INVALID_INTEGRATION_PLAN", 400);
    for (const operation of operations) {
      const error = validateIntegrationOperation(operation);
      if (error)
        return apiError(error, 400, [operation?.localId].filter(Boolean));
    }
    const operationIds = operations.map(
      (operation) => `${operation.entityType}:${operation.localId}`,
    );
    if (new Set(operationIds).size !== operationIds.length)
      return apiError("DUPLICATE_INTEGRATION_OPERATION", 400);
    const failureIds = new Set(
      Array.isArray(payload.simulateFailureLocalIds)
        ? payload.simulateFailureLocalIds.slice(0, 10).map(String)
        : [],
    );
    const snapshot = parseStoredJson(connection.external_snapshot_json, {});
    for (const operation of operations) {
      if (operation.action === "BLOCKED") continue;
      const previous = snapshot[`${operation.entityType}:${operation.localId}`];
      const expectedAction = !previous
        ? "CREATE"
        : previous.payloadHash === operation.payloadHash
          ? "SKIP"
          : "UPDATE";
      if (operation.action !== expectedAction)
        return apiError("INTEGRATION_ACTION_MISMATCH", 409, [
          operation.localId,
        ]);
    }
    const timestamp = now();
    const runId = id("integration_run");
    const results = operations.map((operation) => {
      const snapshotKey = `${operation.entityType}:${operation.localId}`;
      const previous = snapshot[snapshotKey];
      if (operation.action === "BLOCKED")
        return {
          ...operation,
          status: "BLOCKED",
          externalId: previous?.externalId || null,
          error: operation.reason || "Validation blocked this operation",
        };
      if (operation.action === "SKIP")
        return {
          ...operation,
          status: "SKIPPED",
          externalId: operation.externalId || previous?.externalId || null,
          error: null,
        };
      if (failureIds.has(String(operation.localId)))
        return {
          ...operation,
          status: "FAILED",
          externalId: previous?.externalId || null,
          error: "Injected mock transient failure",
        };
      return {
        ...operation,
        status: "SUCCEEDED",
        externalId:
          operation.externalId ||
          previous?.externalId ||
          mockExternalId(operation.entityType, operation.localId),
        error: null,
      };
    });
    for (const result of results) {
      if (!["SUCCEEDED", "SKIPPED"].includes(result.status)) continue;
      snapshot[`${result.entityType}:${result.localId}`] = {
        externalId: result.externalId,
        payloadHash: result.payloadHash,
        idempotencyKey: result.idempotencyKey,
        syncedAt: timestamp,
      };
    }
    const summary = results.reduce(
      (counts, result) => ({
        ...counts,
        [result.status.toLowerCase()]:
          Number(counts[result.status.toLowerCase()] || 0) + 1,
      }),
      {},
    );
    const status = results.some((result) =>
      ["FAILED", "BLOCKED"].includes(result.status),
    )
      ? "PARTIAL"
      : "SUCCEEDED";
    const statements = [
      env.CALLBOARD_DB.prepare(
        `
        INSERT INTO integration_sync_runs (id, event_id, provider, plan_id, config_version, mode, status, retry_of_run_id, summary_json, network_intent, created_by_user_id, started_at, completed_at)
        VALUES (?1, ?2, 'accelevents', ?3, ?4, 'mock', ?5, ?6, ?7, 0, ?8, ?9, ?9)
      `,
      ).bind(
        runId,
        session.eventId,
        planId,
        Number(connection.version),
        status,
        retryOfRunId,
        JSON.stringify(summary),
        session.userId,
        timestamp,
      ),
      ...results.map((result) =>
        env.CALLBOARD_DB.prepare(
          `
        INSERT INTO integration_sync_operations (id, event_id, run_id, provider, entity_type, local_id, action, status, reason, idempotency_key, payload_hash, payload_json, external_id, error, created_at)
        VALUES (?1, ?2, ?3, 'accelevents', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      `,
        ).bind(
          id("integration_operation"),
          session.eventId,
          runId,
          result.entityType,
          result.localId,
          result.action,
          result.status,
          result.reason || null,
          result.idempotencyKey,
          result.payloadHash,
          JSON.stringify(result.payload),
          result.externalId || null,
          result.error || null,
          timestamp,
        ),
      ),
      env.CALLBOARD_DB.prepare(
        "UPDATE integration_connections SET external_snapshot_json = ?1, version = version + 1, updated_at = ?2 WHERE event_id = ?3 AND provider = 'accelevents' AND version = ?4",
      ).bind(
        JSON.stringify(snapshot),
        timestamp,
        session.eventId,
        Number(connection.version),
      ),
    ];
    await env.CALLBOARD_DB.batch(statements);
    await touchWorkspace(env, session.eventId, timestamp);
    const updated = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM integration_connections WHERE event_id = ?1 AND provider = 'accelevents' LIMIT 1",
    )
      .bind(session.eventId)
      .first();
    const runs = await integrationRuns(env, session.eventId);
    return json(
      {
        item: runs.find((run) => run.id === runId),
        integration: integrationConfigPayload(updated, runs),
      },
      { status: 201 },
    );
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}

const DEFAULT_AIRTABLE_SPEAKER_MAPPING = {
  callboardId: "Callboard ID",
  name: "Name",
  email: "Email",
  role: "Role",
  title: "Professional Title",
  company: "Company",
  bio: "Bio",
  headshotUrl: "Headshot URL",
};
const DEFAULT_AIRTABLE_SESSION_MAPPING = {
  callboardId: "Callboard ID",
  title: "Title",
  description: "Description",
  status: "Status",
  startsAt: "Starts At",
  endsAt: "Ends At",
  room: "Room",
  track: "Track",
};

function airtableConfigPayload(row, runs = []) {
  return row
    ? {
        provider: "airtable",
        enabled: Boolean(row.enabled),
        baseId: row.event_url || "",
        speakersTable: row.external_event_id?.split("|")[0] || "Speakers",
        sessionsTable: row.external_event_id?.split("|")[1] || "Sessions",
        speakerMapping: parseStoredJson(row.speaker_mapping_json, DEFAULT_AIRTABLE_SPEAKER_MAPPING),
        sessionMapping: parseStoredJson(row.session_mapping_json, DEFAULT_AIRTABLE_SESSION_MAPPING),
        externalSnapshot: parseStoredJson(row.external_snapshot_json, {}),
        syncHistory: runs,
        version: Number(row.version || 1),
        configuredSecret: false,
        updatedAt: row.updated_at,
      }
    : {
        provider: "airtable",
        enabled: false,
        baseId: "",
        speakersTable: "Speakers",
        sessionsTable: "Sessions",
        speakerMapping: DEFAULT_AIRTABLE_SPEAKER_MAPPING,
        sessionMapping: DEFAULT_AIRTABLE_SESSION_MAPPING,
        externalSnapshot: {},
        syncHistory: [],
        version: 0,
        configuredSecret: false,
      };
}

async function airtableRuns(env, eventId, limit = 25) {
  const rows = await env.CALLBOARD_DB.prepare(`
    SELECT * FROM integration_sync_runs WHERE event_id = ?1 AND provider = 'airtable'
    ORDER BY completed_at DESC LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `).bind(eventId).all();
  const runs = [];
  for (const run of rows.results || []) {
    const operationRows = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM integration_sync_operations WHERE event_id = ?1 AND run_id = ?2 ORDER BY created_at, entity_type, local_id",
    ).bind(eventId, run.id).all();
    const results = (operationRows.results || []).map(integrationOperationPayload);
    runs.push({
      id: run.id,
      provider: "airtable",
      mode: run.mode,
      status: run.status,
      summary: parseStoredJson(run.summary_json, {}),
      startedAt: run.started_at,
      completedAt: run.completed_at,
      results,
      errors: results.filter((item) => item.status === "FAILED").map((item) => ({ localId: item.localId, message: item.error })),
    });
  }
  return runs;
}

function mapAirtableFields(source, mapping) {
  return Object.fromEntries(Object.entries(mapping).flatMap(([sourceKey, target]) => {
    const value = source[sourceKey];
    return target && value !== undefined && value !== null && value !== "" ? [[target, value]] : [];
  }));
}

function titleCaseStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s_-])([a-z])/g, (_, prefix, letter) => `${prefix === "_" || prefix === "-" ? " " : prefix}${letter.toUpperCase()}`);
}

async function buildAirtablePlan(env, eventId, connection) {
  const [peopleResult, sessionsResult] = await Promise.all([
    env.CALLBOARD_DB.prepare("SELECT id, name, email, role, title, company, bio, headshot_url FROM people WHERE event_id = ?1 AND LOWER(role) = 'speaker' ORDER BY name, id").bind(eventId).all(),
    env.CALLBOARD_DB.prepare("SELECT id, title, description, status, starts_at, ends_at, room, track FROM agenda_sessions WHERE event_id = ?1 AND LOWER(status) = 'accepted' ORDER BY title, id").bind(eventId).all(),
  ]);
  const snapshot = parseStoredJson(connection?.external_snapshot_json, {});
  const speakerMapping = parseStoredJson(connection?.speaker_mapping_json, DEFAULT_AIRTABLE_SPEAKER_MAPPING);
  const sessionMapping = parseStoredJson(connection?.session_mapping_json, DEFAULT_AIRTABLE_SESSION_MAPPING);
  const sources = [
    ...(peopleResult.results || []).map((row) => {
      const source = {
        callboardId: row.id,
        name: row.name,
        email: row.email,
        role: row.role || "Speaker",
        title: row.title || "",
        company: row.company || "",
        bio: row.bio || "",
        headshotUrl: row.headshot_url || "",
      };
      return {
        entityType: "speaker",
        localId: row.id,
        source,
        fields: mapAirtableFields(source, speakerMapping),
      };
    }),
    ...(sessionsResult.results || []).map((row) => ({ entityType: "session", localId: row.id, source: row, fields: mapAirtableFields({ callboardId: row.id, title: row.title, description: row.description || "", status: titleCaseStatus(row.status), startsAt: row.starts_at || "", endsAt: row.ends_at || "", room: row.room || "", track: row.track || "" }, sessionMapping) })),
  ];
  const operations = [];
  for (const item of sources) {
    const payloadHash = await sha256(JSON.stringify(item.fields));
    const previous = snapshot[`${item.entityType}:${item.localId}`];
    operations.push({
      entityType: item.entityType,
      localId: item.localId,
      action: !previous ? "CREATE" : previous.payloadHash === payloadHash ? "SKIP" : "UPDATE",
      status: "PLANNED",
      reason: !previous ? "Not yet linked to Airtable" : previous.payloadHash === payloadHash ? "Payload unchanged" : "Callboard fields changed",
      idempotencyKey: `airtable:${eventId}:${item.entityType}:${item.localId}:${payloadHash.slice(0, 20)}`,
      payloadHash,
      payload: { fields: item.fields },
      externalId: previous?.externalId || null,
    });
  }
  return {
    id: `airtable-plan-${(await sha256(operations.map((item) => item.idempotencyKey).join("|"))).slice(0, 16)}`,
    provider: "airtable",
    direction: "CALLBOARD_TO_AIRTABLE",
    destructiveOperations: 0,
    operations,
    summary: operations.reduce((counts, item) => ({ ...counts, [item.action.toLowerCase()]: Number(counts[item.action.toLowerCase()] || 0) + 1 }), { create: 0, update: 0, skip: 0 }),
  };
}

async function airtableRequest(env, baseId, table, method, body) {
  if (!env.AIRTABLE_API_TOKEN) throw new Error("AIRTABLE_API_TOKEN_NOT_CONFIGURED");
  const response = await fetch(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`, {
    method,
    headers: { authorization: `Bearer ${env.AIRTABLE_API_TOKEN}`, "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AIRTABLE_${response.status}:${payload?.error?.type || payload?.error?.message || "REQUEST_FAILED"}`);
  return payload;
}

async function handleAirtableIntegration(request, env, session, action) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const connection = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM integration_connections WHERE event_id = ?1 AND provider = 'airtable' LIMIT 1",
  ).bind(session.eventId).first();
  if (request.method === "GET" && !action) {
    const item = airtableConfigPayload(connection, await airtableRuns(env, session.eventId));
    item.configuredSecret = Boolean(env.AIRTABLE_API_TOKEN);
    item.realSyncEnabled = env.AIRTABLE_REAL_SYNC_ENABLED === "true";
    return json({ item });
  }
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (["PUT", "PATCH"].includes(request.method) && !action) {
    const expectedVersion = integrationVersion(request);
    if (expectedVersion === null) return apiError("IF_MATCH_REQUIRED", 428);
    if (Number(connection?.version || 0) !== expectedVersion) return apiError("VERSION_CONFLICT", 409);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    if (containsSensitiveIntegrationKey(parsed.payload)) return apiError("INTEGRATION_SECRET_REJECTED", 400);
    const baseId = String(parsed.payload.baseId || "").trim().slice(0, 120);
    const speakersTable = String(parsed.payload.speakersTable || "Speakers").trim().slice(0, 120);
    const sessionsTable = String(parsed.payload.sessionsTable || "Sessions").trim().slice(0, 120);
    if (baseId && !/^app[a-zA-Z0-9]+$/.test(baseId)) return apiError("INVALID_AIRTABLE_BASE_ID", 400);
    const speakerMapping = safeMapping(parsed.payload.speakerMapping, DEFAULT_AIRTABLE_SPEAKER_MAPPING);
    const sessionMapping = safeMapping(parsed.payload.sessionMapping, DEFAULT_AIRTABLE_SESSION_MAPPING);
    const timestamp = now();
    if (!connection) {
      await env.CALLBOARD_DB.prepare(`
        INSERT INTO integration_connections (event_id, provider, event_url, external_event_id, direction, mode, enabled, speaker_mapping_json, session_mapping_json, external_snapshot_json, version, created_at, updated_at)
        VALUES (?1, 'airtable', ?2, ?3, 'CALLBOARD_TO_AIRTABLE', 'real', ?4, ?5, ?6, '{}', 1, ?7, ?7)
      `).bind(session.eventId, baseId || null, `${speakersTable}|${sessionsTable}`, baseId ? 1 : 0, JSON.stringify(speakerMapping), JSON.stringify(sessionMapping), timestamp).run();
    } else {
      const result = await env.CALLBOARD_DB.prepare(`
        UPDATE integration_connections SET event_url=?1, external_event_id=?2, enabled=?3,
          speaker_mapping_json=?4, session_mapping_json=?5, version=version+1, updated_at=?6
        WHERE event_id=?7 AND provider='airtable' AND version=?8
      `).bind(baseId || null, `${speakersTable}|${sessionsTable}`, baseId ? 1 : 0, JSON.stringify(speakerMapping), JSON.stringify(sessionMapping), timestamp, session.eventId, expectedVersion).run();
      if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    }
    await touchWorkspace(env, session.eventId, timestamp);
    const updated = await env.CALLBOARD_DB.prepare("SELECT * FROM integration_connections WHERE event_id=?1 AND provider='airtable'").bind(session.eventId).first();
    const item = airtableConfigPayload(updated, await airtableRuns(env, session.eventId));
    item.configuredSecret = Boolean(env.AIRTABLE_API_TOKEN); item.realSyncEnabled = env.AIRTABLE_REAL_SYNC_ENABLED === "true";
    return json({ item });
  }
  if (request.method === "POST" && action === "preview") {
    if (!connection?.enabled) return apiError("INTEGRATION_CONFIGURATION_REQUIRED", 409);
    return json({ item: await buildAirtablePlan(env, session.eventId, connection) });
  }
  if (request.method === "POST" && action === "runs") {
    if (!connection?.enabled) return apiError("INTEGRATION_CONFIGURATION_REQUIRED", 409);
    if (env.AIRTABLE_REAL_SYNC_ENABLED !== "true" || !env.AIRTABLE_API_TOKEN) return apiError("AIRTABLE_SYNC_NOT_ENABLED", 503);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    if (parsed.payload.confirmation !== "SYNC_TO_AIRTABLE") return apiError("AIRTABLE_SYNC_CONFIRMATION_REQUIRED", 428);
    if (Number(parsed.payload.configVersion) !== Number(connection.version)) return apiError("VERSION_CONFLICT", 409);
    const plan = await buildAirtablePlan(env, session.eventId, connection);
    const tableNames = { speaker: connection.external_event_id?.split("|")[0] || "Speakers", session: connection.external_event_id?.split("|")[1] || "Sessions" };
    const snapshot = parseStoredJson(connection.external_snapshot_json, {});
    const results = [];
    for (const entityType of ["speaker", "session"]) {
      const table = tableNames[entityType];
      const candidates = plan.operations.filter((item) => item.entityType === entityType);
      for (let start = 0; start < candidates.length; start += 10) {
        const batch = candidates.slice(start, start + 10);
        const creates = batch.filter((item) => item.action === "CREATE");
        const updates = batch.filter((item) => item.action === "UPDATE" && item.externalId);
        try {
          const created = creates.length ? await airtableRequest(env, connection.event_url, table, "POST", { records: creates.map((item) => ({ fields: item.payload.fields })) }) : { records: [] };
          creates.forEach((item, index) => results.push({ ...item, status: "SUCCEEDED", externalId: created.records?.[index]?.id || null, error: null }));
          const updated = updates.length ? await airtableRequest(env, connection.event_url, table, "PATCH", { records: updates.map((item) => ({ id: item.externalId, fields: item.payload.fields })) }) : { records: [] };
          updates.forEach((item, index) => results.push({ ...item, status: "SUCCEEDED", externalId: updated.records?.[index]?.id || item.externalId, error: null }));
          batch.filter((item) => item.action === "SKIP").forEach((item) => results.push({ ...item, status: "SKIPPED", error: null }));
          batch.filter((item) => item.action === "UPDATE" && !item.externalId).forEach((item) => results.push({ ...item, status: "FAILED", error: "AIRTABLE_RECORD_LINK_MISSING" }));
        } catch (error) {
          batch.forEach((item) => results.push({ ...item, status: item.action === "SKIP" ? "SKIPPED" : "FAILED", error: item.action === "SKIP" ? null : error.message }));
        }
      }
    }
    const timestamp = now(); const runId = id("integration_run");
    for (const result of results) if (["SUCCEEDED", "SKIPPED"].includes(result.status)) snapshot[`${result.entityType}:${result.localId}`] = { externalId: result.externalId, payloadHash: result.payloadHash, idempotencyKey: result.idempotencyKey, syncedAt: timestamp };
    const summary = results.reduce((counts, item) => ({ ...counts, [item.status.toLowerCase()]: Number(counts[item.status.toLowerCase()] || 0) + 1 }), {});
    const runStatus = results.some((item) => item.status === "FAILED") ? "PARTIAL" : "SUCCEEDED";
    await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare(`INSERT INTO integration_sync_runs (id,event_id,provider,plan_id,config_version,mode,status,retry_of_run_id,summary_json,network_intent,created_by_user_id,started_at,completed_at) VALUES (?1,?2,'airtable',?3,?4,'real',?5,NULL,?6,1,?7,?8,?8)`).bind(runId, session.eventId, plan.id, Number(connection.version), runStatus, JSON.stringify(summary), session.userId, timestamp),
      ...results.map((item) => env.CALLBOARD_DB.prepare(`INSERT INTO integration_sync_operations (id,event_id,run_id,provider,entity_type,local_id,action,status,reason,idempotency_key,payload_hash,payload_json,external_id,error,created_at) VALUES (?1,?2,?3,'airtable',?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`).bind(id("integration_operation"),session.eventId,runId,item.entityType,item.localId,item.action,item.status,item.reason||null,item.idempotencyKey,item.payloadHash,JSON.stringify(item.payload),item.externalId||null,item.error||null,timestamp)),
      env.CALLBOARD_DB.prepare("UPDATE integration_connections SET external_snapshot_json=?1,version=version+1,updated_at=?2 WHERE event_id=?3 AND provider='airtable' AND version=?4").bind(JSON.stringify(snapshot),timestamp,session.eventId,Number(connection.version)),
    ]);
    await touchWorkspace(env, session.eventId, timestamp);
    const updated = await env.CALLBOARD_DB.prepare("SELECT * FROM integration_connections WHERE event_id=?1 AND provider='airtable'").bind(session.eventId).first();
    const runs = await airtableRuns(env, session.eventId);
    const item = airtableConfigPayload(updated, runs); item.configuredSecret = true; item.realSyncEnabled = true;
    return json({ item: runs.find((run) => run.id === runId), integration: item }, { status: 201 });
  }
  return apiError("METHOD_NOT_ALLOWED", 405);
}

function evaluationRoundError(payload) {
  if (
    Object.prototype.hasOwnProperty.call(payload, "number") &&
    (!Number.isInteger(Number(payload.number)) || Number(payload.number) < 1)
  )
    return apiError("INVALID_EVALUATION_ROUND_NUMBER", 400);
  if (!Object.prototype.hasOwnProperty.call(payload, "criteria")) return null;
  if (!Array.isArray(payload.criteria) || !payload.criteria.length)
    return apiError("EVALUATION_CRITERIA_REQUIRED", 400);
  const ids = new Set();
  let total = 0;
  for (const criterion of payload.criteria) {
    const criterionId = String(criterion?.id || "").trim();
    const label = String(criterion?.label || "").trim();
    const weight = Number(criterion?.weight);
    if (
      !criterionId ||
      !label ||
      ids.has(criterionId) ||
      !Number.isFinite(weight) ||
      weight < 0 ||
      weight > 100
    )
      return apiError("INVALID_EVALUATION_CRITERION", 400);
    ids.add(criterionId);
    total += weight;
  }
  return Math.abs(total - 100) > 0.0001
    ? apiError("EVALUATION_WEIGHTS_MUST_TOTAL_100", 400, { total })
    : null;
}

function communicationReminderError(payload, { partial = false } = {}) {
  const required = [
    "name",
    "templateId",
    "segment",
    "amount",
    "unit",
    "timing",
  ];
  if (!partial) {
    const missing = required.filter(
      (field) => payload[field] == null || payload[field] === "",
    );
    if (missing.length) return apiError("FIELDS_REQUIRED", 400, missing);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "name") &&
    !String(payload.name || "").trim()
  )
    return apiError("REMINDER_NAME_REQUIRED", 400);
  if (
    Object.prototype.hasOwnProperty.call(payload, "templateId") &&
    !String(payload.templateId || "").trim()
  )
    return apiError("REMINDER_TEMPLATE_REQUIRED", 400);
  if (
    Object.prototype.hasOwnProperty.call(payload, "segment") &&
    !REMINDER_SEGMENTS.has(String(payload.segment))
  )
    return apiError("INVALID_REMINDER_SEGMENT", 400);
  if (
    Object.prototype.hasOwnProperty.call(payload, "unit") &&
    !REMINDER_UNITS.has(String(payload.unit))
  )
    return apiError("INVALID_REMINDER_UNIT", 400);
  if (Object.prototype.hasOwnProperty.call(payload, "amount")) {
    const amount = Number(payload.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 8760)
      return apiError("INVALID_REMINDER_AMOUNT", 400);
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "enabled") &&
    ![0, 1, false, true].includes(payload.enabled)
  )
    return apiError("INVALID_REMINDER_ENABLED", 400);
  return null;
}

function decodeRow(row, spec) {
  const output = {
    id: row.id,
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  for (const [apiField, [column, type]] of Object.entries(spec.fields)) {
    let value = row[column];
    if (type === "json") {
      try {
        value = value == null ? null : JSON.parse(value);
      } catch {
        value = null;
      }
    }
    output[apiField] = value;
  }
  return output;
}

async function attachSubmissionPeople(env, eventId, items) {
  if (!items.length) return items;
  const joins = await env.CALLBOARD_DB.prepare(
    `
    SELECT sp.submission_id, sp.person_id, sp.role, sp.sort_order,
           p.name, p.email, p.title, p.company, p.bio, p.headshot_url
    FROM submission_people sp
    JOIN people p ON p.event_id = sp.event_id AND p.id = sp.person_id
    WHERE sp.event_id = ?1
    ORDER BY sp.submission_id, sp.sort_order
  `,
  )
    .bind(eventId)
    .all();
  const bySubmission = new Map();
  for (const row of joins.results || []) {
    if (!bySubmission.has(row.submission_id))
      bySubmission.set(row.submission_id, []);
    bySubmission
      .get(row.submission_id)
      .push({
        id: row.person_id,
        name: row.name,
        email: row.email,
        title: row.title,
        company: row.company,
        bio: row.bio,
        headshotUrl: row.headshot_url,
        role: row.role,
        sortOrder: Number(row.sort_order || 0),
      });
  }
  return items.map((item) => {
    const participants = bySubmission.get(item.id) || [];
    return {
      ...item,
      participants,
      participantIds: participants.map((participant) => participant.id),
    };
  });
}

async function attachSessionPeople(env, eventId, items) {
  if (!items.length) return items;
  const joins = await env.CALLBOARD_DB.prepare(
    `
    SELECT sp.session_id, sp.person_id, sp.role,
           p.name, p.email, p.title, p.company, p.bio, p.headshot_url
    FROM session_people sp
    JOIN people p ON p.event_id = sp.event_id AND p.id = sp.person_id
    WHERE sp.event_id = ?1
    ORDER BY sp.session_id, p.name
  `,
  )
    .bind(eventId)
    .all();
  const bySession = new Map();
  for (const row of joins.results || []) {
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, []);
    bySession
      .get(row.session_id)
      .push({
        id: row.person_id,
        name: row.name,
        email: row.email,
        title: row.title,
        company: row.company,
        bio: row.bio,
        headshotUrl: row.headshot_url,
        role: row.role,
      });
  }
  return items.map((item) => {
    const participants = bySession.get(item.id) || [];
    return {
      ...item,
      participants,
      participantIds: participants.map((participant) => participant.id),
    };
  });
}

function encodeFields(payload, spec, allowedFields = Object.keys(spec.fields)) {
  const encoded = [];
  for (const field of allowedFields) {
    if (
      !Object.prototype.hasOwnProperty.call(payload, field) ||
      !spec.fields[field]
    )
      continue;
    const [column, type] = spec.fields[field];
    let value = payload[field];
    if (type === "json") value = value == null ? null : JSON.stringify(value);
    if (type === "integer" && value != null) value = Number.parseInt(value, 10);
    if (type === "number" && value != null) value = Number(value);
    encoded.push({ field, column, value });
  }
  return encoded;
}

function webhookSubjectType(resource) {
  return (
    {
      forms: "form",
      submissions: "submission",
      people: "person",
      sessions: "session",
      tasks: "task",
      resources: "resource",
      files: "file",
      embeds: "embed",
      reviews: "review",
    }[resource] || resource.replaceAll("-", "_").replace(/s$/, "")
  );
}

function webhookEventStatement(
  env,
  {
    eventId,
    resource,
    resourceId,
    action,
    version,
    payload,
    timestamp,
    onlyIfPreviousChanged = false,
  },
) {
  const subjectType = webhookSubjectType(resource);
  const eventType = `${subjectType}.${action}`;
  const eventIdValue = `webhook_event_${action}_${resourceId}_${version}`;
  const idempotencyKey = `${eventType}:${resourceId}:${version}`;
  const values = [
    eventIdValue,
    eventId,
    eventType,
    subjectType,
    resourceId,
    JSON.stringify({ resource, id: resourceId, version, ...payload }),
    idempotencyKey,
    timestamp,
  ];
  const sql = onlyIfPreviousChanged
    ? "INSERT OR IGNORE INTO webhook_events (id, event_id, type, subject_type, subject_id, payload_json, idempotency_key, occurred_at, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8 WHERE changes() > 0"
    : "INSERT OR IGNORE INTO webhook_events (id, event_id, type, subject_type, subject_id, payload_json, idempotency_key, occurred_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)";
  return env.CALLBOARD_DB.prepare(sql).bind(...values);
}

function deriveAgendaConflicts(sessions) {
  const conflicts = [];
  for (let left = 0; left < sessions.length; left += 1)
    for (let right = left + 1; right < sessions.length; right += 1) {
      const first = sessions[left];
      const second = sessions[right];
      const firstStart = Date.parse(first.startsAt || "");
      const firstEnd = Date.parse(first.endsAt || "");
      const secondStart = Date.parse(second.startsAt || "");
      const secondEnd = Date.parse(second.endsAt || "");
      if (
        ![firstStart, firstEnd, secondStart, secondEnd].every(
          Number.isFinite,
        ) ||
        firstStart >= secondEnd ||
        secondStart >= firstEnd
      )
        continue;
      const pair = {
        sessionIds: [first.id, second.id],
        sessionTitles: [first.title, second.title],
      };
      if (first.room && first.room === second.room)
        conflicts.push({
          id: `room-${first.id}-${second.id}`,
          type: "room",
          reason: `${first.title} and ${second.title} overlap in ${first.room}.`,
          rule: "One session per room at a time",
          ...pair,
        });
      const participantIds = (first.participantIds || []).filter((personId) =>
        (second.participantIds || []).includes(personId),
      );
      if (participantIds.length)
        conflicts.push({
          id: `participant-${first.id}-${second.id}`,
          type: "participant",
          reason: `${first.title} and ${second.title} share a participant at the same time.`,
          participantIds,
          rule: "A participant cannot attend two sessions at once",
          ...pair,
        });
      if (first.track && first.track === second.track)
        conflicts.push({
          id: `track-${first.id}-${second.id}`,
          type: "track",
          reason: `${first.title} and ${second.title} overlap in ${first.track}.`,
          rule: "One session per track at a time",
          ...pair,
        });
    }
  return conflicts;
}

async function handleAgendaConflicts(request, env, session) {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const rows = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM agenda_sessions WHERE event_id = ?1 AND lower(status) NOT IN ('declined', 'withdrawn') ORDER BY starts_at, title, id",
  )
    .bind(session.eventId)
    .all();
  const sessions = await attachSessionPeople(
    env,
    session.eventId,
    (rows.results || []).map((row) => decodeRow(row, RESOURCE_SPECS.sessions)),
  );
  return json({
    items: deriveAgendaConflicts(sessions),
    sessionVersion: sessions
      .map((item) => `${item.id}:${item.version}`)
      .join(","),
  });
}

function readScope(session, resource) {
  if (session.role === "organizer") return { clause: "", values: [] };
  if (resource === "embeds") return { denied: true };
  if (resource === "evaluation-decisions") return { denied: true };
  if (resource.startsWith("communication-")) return { denied: true };
  if (resource === "portal-forms" && session.role === "reviewer")
    return { denied: true };
  if (resource === "portal-forms" && session.role === "speaker")
    return {
      clause:
        " AND EXISTS (SELECT 1 FROM agenda_sessions accepted_session JOIN session_people accepted_person ON accepted_person.event_id = accepted_session.event_id AND accepted_person.session_id = accepted_session.id WHERE accepted_session.event_id = ? AND accepted_person.person_id = ? AND lower(accepted_session.status) = 'accepted')",
      values: [session.eventId, session.personId],
    };
  if (resource === "file-requests" && session.role === "reviewer")
    return { denied: true };
  if (resource === "file-requests" && session.role === "speaker")
    return {
      clause:
        " AND (assignee_person_id = ? OR submission_id IN (SELECT s.id FROM submissions s LEFT JOIN submission_people sp ON sp.event_id = s.event_id AND sp.submission_id = s.id WHERE s.event_id = ? AND (s.submitter_person_id = ? OR sp.person_id = ?)))",
      values: [
        session.personId,
        session.eventId,
        session.personId,
        session.personId,
      ],
    };
  if (resource === "forms")
    return { clause: " AND lower(status) = 'published'", values: [] };
  if (resource === "submissions" && session.role === "reviewer")
    return {
      clause:
        " AND id IN (SELECT submission_id FROM reviews WHERE event_id = ? AND reviewer_user_id = ?)",
      values: [session.eventId, session.userId],
    };
  if (resource === "submissions")
    return {
      clause: " AND submitter_person_id = ?",
      values: [session.personId],
    };
  if (resource === "people")
    return { clause: " AND id = ?", values: [session.personId] };
  if (resource === "reviews" && session.role === "reviewer")
    return { clause: " AND reviewer_user_id = ?", values: [session.userId] };
  if (resource === "reviews") return { denied: true };
  if (resource === "evaluation-rounds" && session.role === "reviewer")
    return {
      clause:
        " AND id IN (SELECT round_id FROM reviews WHERE event_id = ? AND reviewer_user_id = ?)",
      values: [session.eventId, session.userId],
    };
  if (resource === "evaluation-rounds") return { denied: true };
  if (resource === "sessions" && session.role === "speaker")
    return {
      clause:
        " AND id IN (SELECT session_id FROM session_people WHERE event_id = ? AND person_id = ?)",
      values: [session.eventId, session.personId],
    };
  if (resource === "tasks" || resource === "files") {
    const column =
      resource === "tasks" ? "assignee_person_id" : "owner_person_id";
    return { clause: ` AND ${column} = ?`, values: [session.personId] };
  }
  if (resource === "resources" && session.role === "speaker")
    return {
      clause: ` AND (
      lower(audience) IN ('all', 'all portal users', 'speaker', 'speakers', 'contact', 'contacts')
      OR (lower(audience) = 'accepted speakers' AND EXISTS (
        SELECT 1 FROM agenda_sessions accepted_session
        JOIN session_people accepted_person ON accepted_person.event_id = accepted_session.event_id AND accepted_person.session_id = accepted_session.id
        WHERE accepted_session.event_id = ? AND accepted_person.person_id = ? AND lower(accepted_session.status) = 'accepted'
      ))
    )`,
      values: [session.eventId, session.personId],
    };
  if (resource === "resources" && session.role === "reviewer")
    return {
      clause:
        " AND lower(audience) IN ('all', 'all portal users', 'reviewer', 'reviewers')",
      values: [],
    };
  return { clause: "", values: [] };
}

function speakerPortalFormItem(item, personId) {
  const schema =
    item.schema && typeof item.schema === "object" ? item.schema : {};
  const responses =
    schema.responses && typeof schema.responses === "object"
      ? schema.responses
      : {};
  return {
    ...item,
    schema: {
      ...schema,
      responses: undefined,
      response: responses[personId] || null,
    },
  };
}

async function handlePortalFormResponse(request, env, session, formId) {
  if (session.role !== "speaker" || !session.personId)
    return apiError("FORBIDDEN", 403);
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const accepted = await env.CALLBOARD_DB.prepare(
    `
    SELECT 1 FROM agenda_sessions accepted_session
    JOIN session_people accepted_person ON accepted_person.event_id = accepted_session.event_id AND accepted_person.session_id = accepted_session.id
    WHERE accepted_session.event_id = ?1 AND accepted_person.person_id = ?2 AND lower(accepted_session.status) = 'accepted' LIMIT 1
  `,
  )
    .bind(session.eventId, session.personId)
    .first();
  if (!accepted) return apiError("ACCEPTED_SPEAKER_REQUIRED", 403);
  const row = await fetchResourceRow(
    env,
    RESOURCE_SPECS["portal-forms"],
    session.eventId,
    formId,
  );
  if (!row) return apiError("NOT_FOUND", 404);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const answers =
    parsed.payload.answers &&
    typeof parsed.payload.answers === "object" &&
    !Array.isArray(parsed.payload.answers)
      ? parsed.payload.answers
      : null;
  if (!answers) return apiError("FORM_ANSWERS_REQUIRED", 400);
  const schema = parseStoredJson(row.schema_json, {});
  const questions = Array.isArray(schema.questions) ? schema.questions : [];
  const missing = questions
    .filter(
      (question) => {
        const conditionallyRequired =
          (question.id === "arrival_date" &&
            String(answers.needs_hotel || "").toLowerCase() === "yes") ||
          (question.id === "departure_city" &&
            String(answers.needs_reimbursement || "").toLowerCase() === "yes");
        return (
          (question.required || conditionallyRequired) &&
          !String(answers[question.id] ?? "").trim()
        );
      },
    )
    .map((question) => question.id);
  if (missing.length) return apiError("FIELDS_REQUIRED", 400, missing);
  const timestamp = now();
  const response = { answers, submittedAt: timestamp };
  const nextSchema = {
    ...schema,
    responses: { ...(schema.responses || {}), [session.personId]: response },
  };
  const taskId = `task_portal_form_${formId}_${session.personId}`;
  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare(
      "UPDATE portal_forms SET schema_json = ?1, version = version + 1, updated_at = ?2 WHERE event_id = ?3 AND id = ?4",
    ).bind(JSON.stringify(nextSchema), timestamp, session.eventId, formId),
    env.CALLBOARD_DB.prepare(
      "UPDATE tasks SET status = 'completed', version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND id = ?3",
    ).bind(timestamp, session.eventId, taskId),
    env.CALLBOARD_DB.prepare(
      "UPDATE events SET updated_at = ?1 WHERE id = ?2",
    ).bind(timestamp, session.eventId),
  ]);
  const updated = await fetchResourceRow(
    env,
    RESOURCE_SPECS["portal-forms"],
    session.eventId,
    formId,
  );
  return json({
    item: speakerPortalFormItem(
      decodeRow(updated, RESOURCE_SPECS["portal-forms"]),
      session.personId,
    ),
    response,
    completedTaskIds: [taskId],
  });
}

function creationAllowed(session, resource) {
  if (session.role === "organizer") return true;
  if (session.role === "speaker")
    return ["submissions", "files"].includes(resource);
  return false;
}

function mutationFields(session, resource, row) {
  if (session.role === "organizer")
    return Object.keys(RESOURCE_SPECS[resource].fields);
  if (
    session.role === "reviewer" &&
    resource === "reviews" &&
    row.reviewer_user_id === session.userId
  )
    return ["scores", "totalScore", "recommendation", "notes", "status"];
  if (
    session.role === "speaker" &&
    resource === "people" &&
    row.id === session.personId
  )
    return ["name", "title", "company", "bio", "headshotUrl"];
  if (
    session.role === "speaker" &&
    resource === "submissions" &&
    row.submitter_person_id === session.personId &&
    ["draft", "pending"].includes(String(row.status).toLowerCase())
  )
    return ["title", "abstract", "category", "answers"];
  if (
    session.role === "speaker" &&
    resource === "tasks" &&
    row.assignee_person_id === session.personId &&
    row.kind !== "form"
  )
    return ["status"];
  if (
    session.role === "speaker" &&
    resource === "files" &&
    row.owner_person_id === session.personId
  )
    return ["name", "kind", "status"];
  return [];
}

function deletionAllowed(session, resource, row) {
  if (session.role === "organizer") return true;
  return (
    session.role === "speaker" &&
    resource === "files" &&
    row.owner_person_id === session.personId
  );
}

function ifMatchVersion(request) {
  const value = request.headers.get("if-match");
  if (!value) return null;
  const parsed = Number.parseInt(value.replaceAll('"', ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function validateReferences(env, session, resource, payload) {
  const references = {
    submissions: { formId: "cfp_forms", submitterPersonId: "people" },
    reviews: { submissionId: "submissions", roundId: "evaluation_rounds" },
    "evaluation-decisions": {
      submissionId: "submissions",
      roundId: "evaluation_rounds",
    },
    sessions: { submissionId: "submissions" },
    tasks: { assigneePersonId: "people" },
    "file-requests": {
      assigneePersonId: "people",
      submissionId: "submissions",
    },
    files: {
      ownerPersonId: "people",
      submissionId: "submissions",
      fileRequestId: "file_requests",
    },
  };
  for (const [field, table] of Object.entries(references[resource] || {})) {
    if (!payload[field]) continue;
    const found = await env.CALLBOARD_DB.prepare(
      `SELECT id FROM ${table} WHERE event_id = ?1 AND id = ?2 LIMIT 1`,
    )
      .bind(session.eventId, payload[field])
      .first();
    if (!found) return apiError("INVALID_EVENT_REFERENCE", 400, [field]);
  }
  if (resource === "reviews" && payload.reviewerUserId) {
    const reviewer = await env.CALLBOARD_DB.prepare(
      "SELECT user_id FROM event_memberships WHERE event_id = ?1 AND user_id = ?2 AND role = 'reviewer' LIMIT 1",
    )
      .bind(session.eventId, payload.reviewerUserId)
      .first();
    if (!reviewer) return apiError("INVALID_REVIEWER_REFERENCE", 400);
  }
  return null;
}

async function fetchResourceRow(env, spec, eventId, resourceId) {
  return env.CALLBOARD_DB.prepare(
    `SELECT * FROM ${spec.table} WHERE event_id = ?1 AND id = ?2 LIMIT 1`,
  )
    .bind(eventId, resourceId)
    .first();
}

async function handleResource(
  request,
  env,
  url,
  session,
  resource,
  resourceId,
) {
  const spec = RESOURCE_SPECS[resource];
  const scope = readScope(session, resource);
  if (scope.denied) return apiError("FORBIDDEN", 403);

  if (request.method === "GET") {
    const values = [session.eventId, ...scope.values];
    if (resourceId) {
      values.push(resourceId);
      const row = await env.CALLBOARD_DB.prepare(
        `SELECT * FROM ${spec.table} WHERE event_id = ?${scope.clause} AND id = ? LIMIT 1`,
      )
        .bind(...values)
        .first();
      if (!row) return apiError("NOT_FOUND", 404);
      const decoded = decodeRow(row, spec);
      let item = decoded;
      if (resource === "submissions" && session.role !== "reviewer")
        item = (
          await attachSubmissionPeople(env, session.eventId, [decoded])
        )[0];
      if (resource === "sessions")
        item = (await attachSessionPeople(env, session.eventId, [decoded]))[0];
      if (resource === "portal-forms" && session.role === "speaker")
        item = speakerPortalFormItem(item, session.personId);
      const response = json({ item });
      response.headers.set("etag", `"${row.version || 1}"`);
      return response;
    }
    const limit = Math.min(
      Math.max(
        Number.parseInt(url.searchParams.get("limit") || "100", 10) || 100,
        1,
      ),
      250,
    );
    const cursorValue = url.searchParams.get("cursor");
    const cursor = cursorValue ? decodePageCursor(cursorValue, resource) : null;
    if (cursorValue && !cursor) return apiError("INVALID_CURSOR", 400);
    const cursorClause = cursor
      ? " AND (updated_at < ? OR (updated_at = ? AND id < ?))"
      : "";
    const cursorValues = cursor
      ? [cursor.updatedAt, cursor.updatedAt, cursor.id]
      : [];
    const rows = await env.CALLBOARD_DB.prepare(
      `SELECT * FROM ${spec.table} WHERE event_id = ?${scope.clause}${cursorClause} ORDER BY updated_at DESC, id DESC LIMIT ${limit + 1}`,
    )
      .bind(...values, ...cursorValues)
      .all();
    const pageRows = (rows.results || []).slice(0, limit);
    const nextCursor =
      (rows.results || []).length > limit && pageRows.length
        ? encodePageCursor(resource, pageRows.at(-1))
        : null;
    let items = pageRows.map((row) => decodeRow(row, spec));
    if (resource === "submissions" && session.role !== "reviewer")
      items = await attachSubmissionPeople(env, session.eventId, items);
    if (resource === "sessions")
      items = await attachSessionPeople(env, session.eventId, items);
    if (resource === "portal-forms" && session.role === "speaker")
      items = items.map((item) =>
        speakerPortalFormItem(item, session.personId),
      );
    return json({ items, limit, nextCursor });
  }

  const writeError = requireWrites(env);
  if (writeError) return writeError;

  if (request.method === "POST" && !resourceId) {
    if (!creationAllowed(session, resource)) return apiError("FORBIDDEN", 403);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    const payload = { ...parsed.payload };
    if (resource === "submissions" && session.role === "speaker") {
      payload.submitterPersonId = session.personId;
      payload.status = "draft";
    }
    if (resource === "files" && session.role === "speaker")
      payload.ownerPersonId = session.personId;
    if (resource === "evaluation-decisions")
      payload.createdByUserId = session.userId;
    if (resource === "reviews") {
      const requestedRound = Number(payload.round || 1);
      const roundRow = payload.roundId
        ? await env.CALLBOARD_DB.prepare(
            "SELECT id, number FROM evaluation_rounds WHERE event_id = ?1 AND id = ?2 LIMIT 1",
          )
            .bind(session.eventId, payload.roundId)
            .first()
        : await env.CALLBOARD_DB.prepare(
            "SELECT id, number FROM evaluation_rounds WHERE event_id = ?1 AND number = ?2 LIMIT 1",
          )
            .bind(session.eventId, requestedRound)
            .first();
      if (!roundRow) return apiError("INVALID_EVALUATION_ROUND", 400);
      payload.roundId = roundRow.id;
      payload.round = Number(roundRow.number);
    }
    if (
      resource === "reviews" &&
      session.role === "organizer" &&
      !payload.reviewerUserId
    )
      return apiError("REVIEWER_REQUIRED", 400);
    if (resource === "evaluation-rounds") {
      const roundError = evaluationRoundError(payload);
      if (roundError) return roundError;
    }
    if (resource === "communication-reminders") {
      const reminderError = communicationReminderError(payload);
      if (reminderError) return reminderError;
    }
    const missing = spec.required.filter(
      (field) => payload[field] == null || payload[field] === "",
    );
    if (missing.length) return apiError("FIELDS_REQUIRED", 400, missing);
    const referenceError = await validateReferences(
      env,
      session,
      resource,
      payload,
    );
    if (referenceError) return referenceError;
    const participantIds =
      ["sessions", "submissions"].includes(resource) &&
      Array.isArray(payload.participantIds)
        ? [...new Set(payload.participantIds.filter(Boolean))]
        : [];
    for (const personId of participantIds) {
      const person = await env.CALLBOARD_DB.prepare(
        "SELECT id FROM people WHERE event_id = ?1 AND id = ?2 LIMIT 1",
      )
        .bind(session.eventId, personId)
        .first();
      if (!person)
        return apiError("INVALID_EVENT_REFERENCE", 400, ["participantIds"]);
    }
    const fields = encodeFields(payload, spec);
    const resourceIdNew = id(spec.prefix);
    const timestamp = now();
    const columns = [
      "id",
      "event_id",
      ...fields.map((field) => field.column),
      "version",
      "created_at",
      "updated_at",
    ];
    const values = [
      resourceIdNew,
      session.eventId,
      ...fields.map((field) => field.value),
      1,
      timestamp,
      timestamp,
    ];
    const placeholders = values.map((_, index) => `?${index + 1}`);
    const insert = env.CALLBOARD_DB.prepare(
      `INSERT INTO ${spec.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`,
    ).bind(...values);
    try {
      const operations = [
        insert,
        ...participantIds.map((personId, index) =>
          resource === "sessions"
            ? env.CALLBOARD_DB.prepare(
                "INSERT INTO session_people (event_id, session_id, person_id, role, created_at) VALUES (?1, ?2, ?3, 'Speaker', ?4)",
              ).bind(session.eventId, resourceIdNew, personId, timestamp)
            : env.CALLBOARD_DB.prepare(
                "INSERT INTO submission_people (event_id, submission_id, person_id, role, sort_order, created_at) VALUES (?1, ?2, ?3, 'Speaker', ?4, ?5)",
              ).bind(
                session.eventId,
                resourceIdNew,
                personId,
                index,
                timestamp,
              ),
        ),
        webhookEventStatement(env, {
          eventId: session.eventId,
          resource,
          resourceId: resourceIdNew,
          action: "created",
          version: 1,
          payload: { data: payload },
          timestamp,
        }),
      ];
      await env.CALLBOARD_DB.batch(operations);
    } catch (error) {
      if (
        String(error?.message || error)
          .toLowerCase()
          .includes("unique")
      )
        return apiError("RESOURCE_CONFLICT", 409);
      throw error;
    }
    const row = await fetchResourceRow(
      env,
      spec,
      session.eventId,
      resourceIdNew,
    );
    await touchWorkspace(env, session.eventId, timestamp);
    let created = decodeRow(row, spec);
    if (resource === "submissions")
      created = (await attachSubmissionPeople(env, session.eventId, [created]))[0];
    if (resource === "sessions")
      created = (await attachSessionPeople(env, session.eventId, [created]))[0];
    const response = json({ item: created }, { status: 201 });
    response.headers.set("etag", '"1"');
    response.headers.set("location", `/api/${resource}/${resourceIdNew}`);
    return response;
  }

  if (!resourceId) return apiError("METHOD_NOT_ALLOWED", 405);
  const row = await fetchResourceRow(env, spec, session.eventId, resourceId);
  if (!row) return apiError("NOT_FOUND", 404);
  const expectedVersion = ifMatchVersion(request);
  if (!expectedVersion) return apiError("IF_MATCH_REQUIRED", 428);

  if (request.method === "PATCH" || request.method === "PUT") {
    const allowed = mutationFields(session, resource, row);
    if (!allowed.length) return apiError("FORBIDDEN", 403);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    if (resource === "evaluation-rounds") {
      const roundError = evaluationRoundError(parsed.payload);
      if (roundError) return roundError;
    }
    if (resource === "communication-reminders") {
      const reminderError = communicationReminderError(parsed.payload, {
        partial: true,
      });
      if (reminderError) return reminderError;
    }
    const referenceError = await validateReferences(
      env,
      session,
      resource,
      parsed.payload,
    );
    if (referenceError) return referenceError;
    const fields = encodeFields(parsed.payload, spec, allowed);
    if (!fields.length) return apiError("NO_MUTABLE_FIELDS", 400);
    const assignments = fields.map(
      (field, index) => `${field.column} = ?${index + 1}`,
    );
    const values = fields.map((field) => field.value);
    values.push(now(), session.eventId, resourceId, expectedVersion);
    const updatedAtIndex = fields.length + 1;
    const eventIndex = fields.length + 2;
    const idIndex = fields.length + 3;
    const versionIndex = fields.length + 4;
    let result;
    try {
      const update = env.CALLBOARD_DB.prepare(
        `UPDATE ${spec.table} SET ${assignments.join(", ")}, version = version + 1, updated_at = ?${updatedAtIndex} WHERE event_id = ?${eventIndex} AND id = ?${idIndex} AND version = ?${versionIndex}`,
      ).bind(...values);
      [result] = await env.CALLBOARD_DB.batch([
        update,
        webhookEventStatement(env, {
          eventId: session.eventId,
          resource,
          resourceId,
          action: "updated",
          version: expectedVersion + 1,
          payload: { changes: parsed.payload },
          timestamp: values[updatedAtIndex - 1],
          onlyIfPreviousChanged: true,
        }),
      ]);
    } catch (error) {
      if (
        String(error?.message || error)
          .toLowerCase()
          .includes("unique")
      )
        return apiError("RESOURCE_CONFLICT", 409);
      throw error;
    }
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    await touchWorkspace(env, session.eventId);
    const updated = await fetchResourceRow(
      env,
      spec,
      session.eventId,
      resourceId,
    );
    if (resource === "people" && session.role === "speaker") {
      const profile = decodeRow(updated, spec);
      if (
        String(profile.bio || "").trim() &&
        String(profile.headshotUrl || "").trim()
      )
        await env.CALLBOARD_DB.prepare(
          "UPDATE tasks SET status = 'completed', version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND assignee_person_id = ?3 AND kind = 'contact' AND lower(title) = 'complete your speaker profile'",
        )
          .bind(now(), session.eventId, session.personId)
          .run();
    }
    const response = json({ item: decodeRow(updated, spec) });
    response.headers.set("etag", `"${updated.version}"`);
    return response;
  }

  if (request.method === "DELETE") {
    if (!deletionAllowed(session, resource, row))
      return apiError("FORBIDDEN", 403);
    const deletedAt = now();
    const [result] = await env.CALLBOARD_DB.batch([
      env.CALLBOARD_DB.prepare(
        `DELETE FROM ${spec.table} WHERE event_id = ?1 AND id = ?2 AND version = ?3`,
      ).bind(session.eventId, resourceId, expectedVersion),
      webhookEventStatement(env, {
        eventId: session.eventId,
        resource,
        resourceId,
        action: "deleted",
        version: expectedVersion,
        payload: { previous: decodeRow(row, spec) },
        timestamp: deletedAt,
        onlyIfPreviousChanged: true,
      }),
    ]);
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    if (resource === "files") {
      if (row.storage_key && env.CALLBOARD_FILES)
        await env.CALLBOARD_FILES.delete(row.storage_key);
      await env.CALLBOARD_DB.prepare(
        "UPDATE people SET headshot_url = NULL, version = version + 1, updated_at = ?1 WHERE event_id = ?2 AND id = ?3 AND headshot_url = ?4",
      )
        .bind(
          deletedAt,
          session.eventId,
          row.owner_person_id,
          `/api/files/${encodeURIComponent(resourceId)}/content`,
        )
        .run();
    }
    await touchWorkspace(env, session.eventId);
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function webhookSubscriptionPayload(row) {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.target_url,
    eventTypes: parseJsonArray(row.event_types_json),
    enabled: Boolean(row.enabled),
    secretVersion: Number(row.secret_version || 1),
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function webhookEventPayload(row) {
  return {
    id: row.id,
    type: row.type,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    payload: parseJsonObject(row.payload_json),
    idempotencyKey: row.idempotency_key,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function webhookDeliveryPayload(row) {
  return {
    id: row.id,
    webhookEventId: row.webhook_event_id,
    subscriptionId: row.subscription_id,
    attemptNumber: Number(row.attempt_number),
    retryOfDeliveryId: row.retry_of_delivery_id || null,
    requestIdempotencyKey: row.request_idempotency_key,
    mode: row.mode,
    status: row.status,
    signature: row.signature,
    signatureTimestamp: row.signature_timestamp,
    body: parseJsonObject(row.body_json),
    externalId: row.external_id || null,
    error: row.error || null,
    networkIntent: Boolean(row.network_intent),
    createdAt: row.created_at,
  };
}

function validatedWebhookUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function validatedWebhookEventTypes(value) {
  if (!Array.isArray(value) || !value.length || value.length > 32) return null;
  const types = [...new Set(value.map((item) => String(item || "").trim()))];
  return types.every(
    (type) => type === "*" || /^[a-z][a-z0-9_.-]{2,79}$/.test(type),
  )
    ? types
    : null;
}

async function handleWebhookSubscriptions(
  request,
  env,
  session,
  subscriptionId = null,
) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (request.method === "GET" && !subscriptionId) {
    const rows = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM webhook_subscriptions WHERE event_id = ?1 ORDER BY updated_at DESC, id DESC",
    )
      .bind(session.eventId)
      .all();
    return json({
      items: (rows.results || []).map(webhookSubscriptionPayload),
    });
  }
  if (request.method === "GET" && subscriptionId) {
    const row = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM webhook_subscriptions WHERE id = ?1 AND event_id = ?2",
    )
      .bind(subscriptionId, session.eventId)
      .first();
    return row
      ? json({ item: webhookSubscriptionPayload(row) })
      : apiError("NOT_FOUND", 404);
  }
  const writeError = requireWrites(env);
  if (writeError) return writeError;

  if (request.method === "POST" && !subscriptionId) {
    if (!env.CALLBOARD_WEBHOOK_SIGNING_KEY)
      return apiError("WEBHOOK_SIGNING_NOT_CONFIGURED", 503);
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    const name = String(parsed.payload.name || "")
      .trim()
      .slice(0, 100);
    const targetUrl = validatedWebhookUrl(parsed.payload.targetUrl);
    const eventTypes = validatedWebhookEventTypes(parsed.payload.eventTypes);
    if (!name || !targetUrl || !eventTypes)
      return apiError("INVALID_WEBHOOK_SUBSCRIPTION", 400);
    const timestamp = now();
    const idValue = id("webhook_subscription");
    await env.CALLBOARD_DB.prepare(
      `
      INSERT INTO webhook_subscriptions (id, event_id, name, target_url, event_types_json, enabled, secret_version, version, created_by_user_id, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, 1, ?7, ?8, ?8)
    `,
    )
      .bind(
        idValue,
        session.eventId,
        name,
        targetUrl,
        JSON.stringify(eventTypes),
        parsed.payload.enabled === false ? 0 : 1,
        session.userId,
        timestamp,
      )
      .run();
    const row = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM webhook_subscriptions WHERE id = ?1 AND event_id = ?2",
    )
      .bind(idValue, session.eventId)
      .first();
    return json(
      {
        item: webhookSubscriptionPayload(row),
        signingSecret: await deriveWebhookSecret(env, session.eventId, idValue),
      },
      { status: 201 },
    );
  }

  if (!subscriptionId) return apiError("METHOD_NOT_ALLOWED", 405);
  const row = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_subscriptions WHERE id = ?1 AND event_id = ?2",
  )
    .bind(subscriptionId, session.eventId)
    .first();
  if (!row) return apiError("NOT_FOUND", 404);
  const expectedVersion = ifMatchVersion(request);
  if (!expectedVersion) return apiError("IF_MATCH_REQUIRED", 428);

  if (["PATCH", "PUT"].includes(request.method)) {
    const parsed = await parseJson(request);
    if (parsed.error) return apiError(parsed.error, parsed.status);
    const name = Object.hasOwn(parsed.payload, "name")
      ? String(parsed.payload.name || "")
          .trim()
          .slice(0, 100)
      : row.name;
    const targetUrl = Object.hasOwn(parsed.payload, "targetUrl")
      ? validatedWebhookUrl(parsed.payload.targetUrl)
      : row.target_url;
    const eventTypes = Object.hasOwn(parsed.payload, "eventTypes")
      ? validatedWebhookEventTypes(parsed.payload.eventTypes)
      : parseJsonArray(row.event_types_json);
    const enabled = Object.hasOwn(parsed.payload, "enabled")
      ? parsed.payload.enabled
        ? 1
        : 0
      : Number(row.enabled);
    if (!name || !targetUrl || !eventTypes)
      return apiError("INVALID_WEBHOOK_SUBSCRIPTION", 400);
    const timestamp = now();
    const result = await env.CALLBOARD_DB.prepare(
      "UPDATE webhook_subscriptions SET name = ?1, target_url = ?2, event_types_json = ?3, enabled = ?4, version = version + 1, updated_at = ?5 WHERE id = ?6 AND event_id = ?7 AND version = ?8",
    )
      .bind(
        name,
        targetUrl,
        JSON.stringify(eventTypes),
        enabled,
        timestamp,
        subscriptionId,
        session.eventId,
        expectedVersion,
      )
      .run();
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    const updated = await env.CALLBOARD_DB.prepare(
      "SELECT * FROM webhook_subscriptions WHERE id = ?1 AND event_id = ?2",
    )
      .bind(subscriptionId, session.eventId)
      .first();
    const response = json({ item: webhookSubscriptionPayload(updated) });
    response.headers.set("etag", `"${updated.version}"`);
    return response;
  }

  if (request.method === "DELETE") {
    const delivery = await env.CALLBOARD_DB.prepare(
      "SELECT id FROM webhook_deliveries WHERE event_id = ?1 AND subscription_id = ?2 LIMIT 1",
    )
      .bind(session.eventId, subscriptionId)
      .first();
    if (delivery)
      return apiError("WEBHOOK_SUBSCRIPTION_HAS_DELIVERIES", 409, {
        disableInstead: true,
      });
    const result = await env.CALLBOARD_DB.prepare(
      "DELETE FROM webhook_subscriptions WHERE id = ?1 AND event_id = ?2 AND version = ?3",
    )
      .bind(subscriptionId, session.eventId, expectedVersion)
      .run();
    if (!result.meta?.changes) return apiError("VERSION_CONFLICT", 409);
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  return apiError("METHOD_NOT_ALLOWED", 405);
}

async function listWebhookEvents(env, url, session) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const limit = Math.min(
    Math.max(
      Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50,
      1,
    ),
    250,
  );
  const cursorValue = url.searchParams.get("cursor");
  const cursor = cursorValue
    ? decodePageCursor(cursorValue, "webhook-events")
    : null;
  if (cursorValue && !cursor) return apiError("INVALID_CURSOR", 400);
  const cursorClause = cursor
    ? " AND (occurred_at < ?2 OR (occurred_at = ?2 AND id < ?3))"
    : "";
  const values = cursor
    ? [session.eventId, cursor.updatedAt, cursor.id]
    : [session.eventId];
  const rows = await env.CALLBOARD_DB.prepare(
    `SELECT * FROM webhook_events WHERE event_id = ?1${cursorClause} ORDER BY occurred_at DESC, id DESC LIMIT ${limit + 1}`,
  )
    .bind(...values)
    .all();
  const pageRows = (rows.results || []).slice(0, limit);
  const cursorRow = pageRows.at(-1);
  const nextCursor =
    (rows.results || []).length > limit && cursorRow
      ? encodePageCursor("webhook-events", {
          id: cursorRow.id,
          updated_at: cursorRow.occurred_at,
        })
      : null;
  return json({ items: pageRows.map(webhookEventPayload), limit, nextCursor });
}

async function createWebhookDeliveryAttempt(
  env,
  session,
  event,
  subscription,
  {
    attemptNumber,
    retryOfDeliveryId = null,
    requestIdempotencyKey,
    simulateFailure = false,
  },
) {
  const secret = await deriveWebhookSecret(
    env,
    session.eventId,
    subscription.id,
  );
  if (!secret)
    return { error: apiError("WEBHOOK_SIGNING_NOT_CONFIGURED", 503) };
  const signatureTimestamp = now();
  const bodyObject = {
    id: event.id,
    type: event.type,
    occurredAt: event.occurred_at,
    data: parseJsonObject(event.payload_json),
  };
  const bodyJson = JSON.stringify(bodyObject);
  const signature = await signWebhookBody(secret, signatureTimestamp, bodyJson);
  const externalId = simulateFailure
    ? null
    : `mock_webhook_${(await sha256(`${subscription.id}:${event.id}`)).slice(0, 20)}`;
  const delivery = {
    id: id("webhook_delivery"),
    event_id: session.eventId,
    webhook_event_id: event.id,
    subscription_id: subscription.id,
    attempt_number: attemptNumber,
    retry_of_delivery_id: retryOfDeliveryId,
    request_idempotency_key: requestIdempotencyKey,
    mode: "mock",
    status: simulateFailure ? "FAILED" : "SUCCEEDED",
    signature,
    signature_timestamp: signatureTimestamp,
    body_json: bodyJson,
    external_id: externalId,
    error: simulateFailure ? "Injected mock transient failure" : null,
    network_intent: 0,
    created_at: signatureTimestamp,
  };
  return {
    delivery,
    statement: env.CALLBOARD_DB.prepare(
      `
    INSERT INTO webhook_deliveries (id, event_id, webhook_event_id, subscription_id, attempt_number, retry_of_delivery_id, request_idempotency_key, mode, status, signature, signature_timestamp, body_json, external_id, error, network_intent, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'mock', ?8, ?9, ?10, ?11, ?12, ?13, 0, ?14)
  `,
    ).bind(
      delivery.id,
      delivery.event_id,
      delivery.webhook_event_id,
      delivery.subscription_id,
      delivery.attempt_number,
      delivery.retry_of_delivery_id,
      delivery.request_idempotency_key,
      delivery.status,
      delivery.signature,
      delivery.signature_timestamp,
      delivery.body_json,
      delivery.external_id,
      delivery.error,
      delivery.created_at,
    ),
  };
}

async function handleWebhookEventDeliveries(
  request,
  env,
  session,
  webhookEventId,
) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (!env.CALLBOARD_WEBHOOK_SIGNING_KEY)
    return apiError("WEBHOOK_SIGNING_NOT_CONFIGURED", 503);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  if (parsed.payload.mode !== "mock" || parsed.payload.networkIntent !== false)
    return apiError("WEBHOOK_MOCK_ONLY", 403);
  const requestIdempotencyKey = String(
    request.headers.get("idempotency-key") ||
      parsed.payload.idempotencyKey ||
      "",
  ).trim();
  if (!requestIdempotencyKey || requestIdempotencyKey.length > 180)
    return apiError("IDEMPOTENCY_KEY_REQUIRED", 400);
  const existing = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_deliveries WHERE event_id = ?1 AND webhook_event_id = ?2 AND request_idempotency_key = ?3 ORDER BY subscription_id",
  )
    .bind(session.eventId, webhookEventId, requestIdempotencyKey)
    .all();
  if ((existing.results || []).length)
    return json({
      items: existing.results.map(webhookDeliveryPayload),
      replayed: true,
    });
  const event = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_events WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, webhookEventId)
    .first();
  if (!event) return apiError("NOT_FOUND", 404);
  const subscriptions = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_subscriptions WHERE event_id = ?1 AND enabled = 1 ORDER BY id",
  )
    .bind(session.eventId)
    .all();
  const matching = (subscriptions.results || []).filter((subscription) => {
    const types = parseJsonArray(subscription.event_types_json);
    return types.includes("*") || types.includes(event.type);
  });
  if (!matching.length)
    return apiError("NO_MATCHING_WEBHOOK_SUBSCRIPTIONS", 409);
  const failureIds = new Set(
    Array.isArray(parsed.payload.simulateFailureSubscriptionIds)
      ? parsed.payload.simulateFailureSubscriptionIds.map(String)
      : [],
  );
  const attempts = [];
  for (const subscription of matching) {
    const attempt = await createWebhookDeliveryAttempt(
      env,
      session,
      event,
      subscription,
      {
        attemptNumber: 1,
        requestIdempotencyKey,
        simulateFailure: failureIds.has(subscription.id),
      },
    );
    if (attempt.error) return attempt.error;
    attempts.push(attempt);
  }
  await env.CALLBOARD_DB.batch(attempts.map((attempt) => attempt.statement));
  return json(
    {
      items: attempts.map((attempt) =>
        webhookDeliveryPayload(attempt.delivery),
      ),
      replayed: false,
      networkIntent: false,
    },
    { status: 201 },
  );
}

async function handleWebhookDeliveryRetry(request, env, session, deliveryId) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  if (parsed.payload.mode !== "mock" || parsed.payload.networkIntent !== false)
    return apiError("WEBHOOK_MOCK_ONLY", 403);
  const requestIdempotencyKey = String(
    request.headers.get("idempotency-key") ||
      parsed.payload.idempotencyKey ||
      "",
  ).trim();
  if (!requestIdempotencyKey || requestIdempotencyKey.length > 180)
    return apiError("IDEMPOTENCY_KEY_REQUIRED", 400);
  const original = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_deliveries WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, deliveryId)
    .first();
  if (!original) return apiError("NOT_FOUND", 404);
  const existingByKey = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_deliveries WHERE event_id = ?1 AND subscription_id = ?2 AND request_idempotency_key = ?3 LIMIT 1",
  )
    .bind(session.eventId, original.subscription_id, requestIdempotencyKey)
    .first();
  if (existingByKey) {
    if (existingByKey.retry_of_delivery_id !== original.id)
      return apiError("IDEMPOTENCY_CONFLICT", 409);
    return json({
      item: webhookDeliveryPayload(existingByKey),
      replayed: true,
    });
  }
  if (original.status !== "FAILED")
    return apiError("DELIVERY_NOT_RETRYABLE", 409);
  const successfulRetry = await env.CALLBOARD_DB.prepare(
    "SELECT id FROM webhook_deliveries WHERE event_id = ?1 AND retry_of_delivery_id = ?2 AND status = 'SUCCEEDED' LIMIT 1",
  )
    .bind(session.eventId, deliveryId)
    .first();
  if (successfulRetry) return apiError("DELIVERY_ALREADY_RETRIED", 409);
  const event = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_events WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, original.webhook_event_id)
    .first();
  const subscription = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_subscriptions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, original.subscription_id)
    .first();
  if (!event || !subscription) return apiError("NOT_FOUND", 404);
  const attempt = await createWebhookDeliveryAttempt(
    env,
    session,
    event,
    subscription,
    {
      attemptNumber: Number(original.attempt_number) + 1,
      retryOfDeliveryId: original.id,
      requestIdempotencyKey,
      simulateFailure: parsed.payload.simulateFailure === true,
    },
  );
  if (attempt.error) return attempt.error;
  await attempt.statement.run();
  return json(
    {
      item: webhookDeliveryPayload(attempt.delivery),
      replayed: false,
      networkIntent: false,
    },
    { status: 201 },
  );
}

async function handleWebhookDeliveries(request, env, session) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  const rows = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM webhook_deliveries WHERE event_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 250",
  )
    .bind(session.eventId)
    .all();
  return json({ items: (rows.results || []).map(webhookDeliveryPayload) });
}

async function handleSubmissionDecision(request, env, session, submissionId) {
  if (session.role !== "organizer") return apiError("FORBIDDEN", 403);
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  const expectedVersion = ifMatchVersion(request);
  if (!expectedVersion) return apiError("IF_MATCH_REQUIRED", 428);
  const parsed = await parseJson(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const decision = String(parsed.payload.decision || "")
    .trim()
    .toLowerCase();
  if (
    ![
      "advance",
      "accepted",
      "accept_queue",
      "pending",
      "decline_queue",
      "waitlisted",
      "declined",
      "withdrawn",
      "draft",
    ].includes(decision)
  )
    return apiError("INVALID_DECISION", 400);
  const submission = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM submissions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, submissionId)
    .first();
  if (!submission) return apiError("NOT_FOUND", 404);
  if (Number(submission.version) !== expectedVersion)
    return apiError("VERSION_CONFLICT", 409);

  const currentRound = parsed.payload.roundId
    ? await env.CALLBOARD_DB.prepare(
        "SELECT * FROM evaluation_rounds WHERE event_id = ?1 AND id = ?2 LIMIT 1",
      )
        .bind(session.eventId, parsed.payload.roundId)
        .first()
    : await env.CALLBOARD_DB.prepare(
        "SELECT * FROM evaluation_rounds WHERE event_id = ?1 AND number = ?2 LIMIT 1",
      )
        .bind(session.eventId, Number(submission.round || 1))
        .first();
  if (!currentRound) return apiError("INVALID_EVALUATION_ROUND", 400);
  const nextRound =
    decision === "advance"
      ? await env.CALLBOARD_DB.prepare(
          "SELECT * FROM evaluation_rounds WHERE event_id = ?1 AND number = ?2 LIMIT 1",
        )
          .bind(session.eventId, Number(currentRound.number) + 1)
          .first()
      : null;
  if (decision === "advance" && !nextRound)
    return apiError("NEXT_EVALUATION_ROUND_REQUIRED", 409);
  const reviewerUserId = String(parsed.payload.reviewerUserId || "").trim();
  if (reviewerUserId) {
    const reviewer = await env.CALLBOARD_DB.prepare(
      "SELECT user_id FROM event_memberships WHERE event_id = ?1 AND user_id = ?2 AND role = 'reviewer' LIMIT 1",
    )
      .bind(session.eventId, reviewerUserId)
      .first();
    if (!reviewer) return apiError("INVALID_REVIEWER_REFERENCE", 400);
  }

  const timestamp = now();
  const linkedPeople = await env.CALLBOARD_DB.prepare(
    "SELECT person_id, role, sort_order FROM submission_people WHERE event_id = ?1 AND submission_id = ?2 ORDER BY sort_order",
  )
    .bind(session.eventId, submissionId)
    .all();
  const linkedPersonRows = linkedPeople.results || [];
  const onboardingForms = [
    {
      id: `portal_form_hotel_${session.eventId}`,
      name: "Hotel stay requirements",
      title: "Hotel stay requirements",
      schema: {
        sectionTitle: "Hotel stay requirements",
        instructions:
          "Tell the event team whether you need a hotel room and your arrival details.",
        questions: [
          {
            id: "needs_hotel",
            label: "Do you need a hotel room?",
            type: "dropdown",
            options: ["Yes", "No"],
            required: true,
          },
          {
            id: "arrival_date",
            label: "Arrival date",
            type: "date",
            required: false,
          },
        ],
      },
    },
    {
      id: `portal_form_travel_${session.eventId}`,
      name: "Flight reimbursement",
      title: "Flight reimbursement",
      schema: {
        sectionTitle: "Flight reimbursement",
        instructions:
          "Share the information the event team needs to coordinate eligible travel reimbursement.",
        questions: [
          {
            id: "needs_reimbursement",
            label: "Will you request flight reimbursement?",
            type: "dropdown",
            options: ["Yes", "No"],
            required: true,
          },
          {
            id: "departure_city",
            label: "Departure city",
            type: "text",
            required: false,
          },
        ],
      },
    },
  ];
  const onboardingTaskIds = linkedPersonRows.flatMap((person) => [
    `task_accepted_profile_${submissionId}_${person.person_id}`,
    `task_accepted_session_${submissionId}_${person.person_id}`,
    ...onboardingForms.map(
      (form) => `task_portal_form_${form.id}_${person.person_id}`,
    ),
  ]);
  const acceptedGuideId = `resource_accepted_speaker_guide_${session.eventId}`;
  const existingSession = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM agenda_sessions WHERE event_id = ?1 AND submission_id = ?2 LIMIT 1",
  )
    .bind(session.eventId, submissionId)
    .first();
  const submissionStatus = decision === "advance" ? "pending" : decision;
  const submissionRound =
    decision === "advance"
      ? Number(nextRound.number)
      : Number(submission.round || currentRound.number || 1);
  const decisionId = id("evaluation_decision");
  const operations = [
    env.CALLBOARD_DB.prepare(
      "UPDATE submissions SET status = ?1, round = ?2, version = version + 1, updated_at = ?3 WHERE event_id = ?4 AND id = ?5 AND version = ?6",
    ).bind(
      submissionStatus,
      submissionRound,
      timestamp,
      session.eventId,
      submissionId,
      expectedVersion,
    ),
    env.CALLBOARD_DB.prepare(
      "INSERT INTO evaluation_decisions (id, event_id, round_id, submission_id, decision, notes, created_by_user_id, version, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)",
    ).bind(
      decisionId,
      session.eventId,
      currentRound.id,
      submissionId,
      decision,
      String(parsed.payload.notes || "").trim() || null,
      session.userId,
      timestamp,
    ),
  ];
  if (decision === "advance" && reviewerUserId) {
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
      INSERT OR IGNORE INTO reviews (id, event_id, submission_id, reviewer_user_id, round_id, round, scores_json, status, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, '{}', 'assigned', 1, ?7, ?7)
    `,
      ).bind(
        id("review"),
        session.eventId,
        submissionId,
        reviewerUserId,
        nextRound.id,
        Number(nextRound.number),
        timestamp,
      ),
    );
  }
  let agendaId = existingSession?.id || null;

  if (submissionStatus === "accepted") {
    agendaId = existingSession?.id || id("session");
    if (existingSession) {
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        UPDATE agenda_sessions SET title = ?1, description = ?2, status = 'accepted', track = ?3, version = version + 1, updated_at = ?4
        WHERE event_id = ?5 AND id = ?6
      `,
        ).bind(
          submission.title,
          submission.abstract || null,
          submission.category || null,
          timestamp,
          session.eventId,
          agendaId,
        ),
      );
      operations.push(
        env.CALLBOARD_DB.prepare(
          "DELETE FROM session_people WHERE event_id = ?1 AND session_id = ?2",
        ).bind(session.eventId, agendaId),
      );
    } else {
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        INSERT INTO agenda_sessions (id, event_id, submission_id, title, description, status, track, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 'accepted', ?6, 1, ?7, ?7)
      `,
        ).bind(
          agendaId,
          session.eventId,
          submissionId,
          submission.title,
          submission.abstract || null,
          submission.category || null,
          timestamp,
        ),
      );
    }
    for (const form of onboardingForms)
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
      INSERT OR IGNORE INTO portal_forms (id, event_id, name, title, type, schema_json, version, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 'Contact', ?5, 1, ?6, ?6)
    `,
        ).bind(
          form.id,
          session.eventId,
          form.name,
          form.title,
          JSON.stringify(form.schema),
          timestamp,
        ),
      );
    for (const person of linkedPersonRows) {
      operations.push(
        env.CALLBOARD_DB.prepare(
          "INSERT INTO session_people (event_id, session_id, person_id, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        ).bind(
          session.eventId,
          agendaId,
          person.person_id,
          person.role || "Speaker",
          timestamp,
        ),
      );
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        INSERT OR IGNORE INTO tasks (id, event_id, assignee_person_id, title, status, kind, instructions, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, 'Complete your speaker profile', 'open', 'contact', ?4, 1, ?5, ?5)
      `,
        ).bind(
          `task_accepted_profile_${submissionId}_${person.person_id}`,
          session.eventId,
          person.person_id,
          `Add your biography and approved speaker details for ${submission.title}.`,
          timestamp,
        ),
      );
      operations.push(
        env.CALLBOARD_DB.prepare(
          `
        INSERT OR IGNORE INTO tasks (id, event_id, assignee_person_id, title, status, kind, instructions, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, 'Review accepted session details', 'open', 'submission', ?4, 1, ?5, ?5)
      `,
        ).bind(
          `task_accepted_session_${submissionId}_${person.person_id}`,
          session.eventId,
          person.person_id,
          `Confirm the title, abstract, and speaker lineup for ${submission.title}.`,
          timestamp,
        ),
      );
      for (const form of onboardingForms)
        operations.push(
          env.CALLBOARD_DB.prepare(
            `
        INSERT OR IGNORE INTO tasks (id, event_id, assignee_person_id, title, status, kind, instructions, version, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 'open', 'form', ?5, 1, ?6, ?6)
      `,
          ).bind(
            `task_portal_form_${form.id}_${person.person_id}`,
            session.eventId,
            person.person_id,
            form.title,
            `Complete the ${form.title.toLowerCase()} form in your speaker portal.`,
            timestamp,
          ),
        );
    }
    operations.push(
      env.CALLBOARD_DB.prepare(
        `
      INSERT OR IGNORE INTO resources (id, event_id, title, kind, content, audience, version, created_at, updated_at)
      VALUES (?1, ?2, 'Accepted speaker quick-start', 'Article', ?3, 'accepted speakers', 1, ?4, ?4)
    `,
      ).bind(
        acceptedGuideId,
        session.eventId,
        "Review your session details, complete the assigned portal tasks, and use the event resources to prepare for the program.",
        timestamp,
      ),
    );
  } else if (existingSession && decision !== "advance") {
    operations.push(
      env.CALLBOARD_DB.prepare(
        "DELETE FROM agenda_sessions WHERE event_id = ?1 AND id = ?2",
      ).bind(session.eventId, existingSession.id),
    );
  }
  if (submissionStatus !== "accepted" && decision !== "advance") {
    for (const taskId of onboardingTaskIds)
      operations.push(
        env.CALLBOARD_DB.prepare(
          "DELETE FROM tasks WHERE event_id = ?1 AND id = ?2",
        ).bind(session.eventId, taskId),
      );
  }

  const results = await env.CALLBOARD_DB.batch(operations);
  if (!results[0]?.meta?.changes) return apiError("VERSION_CONFLICT", 409);
  await touchWorkspace(env, session.eventId, timestamp);
  const updatedSubmissionRow = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM submissions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, submissionId)
    .first();
  const updatedSubmission = (
    await attachSubmissionPeople(env, session.eventId, [
      decodeRow(updatedSubmissionRow, RESOURCE_SPECS.submissions),
    ])
  )[0];
  const agenda =
    agendaId && submissionStatus === "accepted"
      ? await env.CALLBOARD_DB.prepare(
          "SELECT * FROM agenda_sessions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
        )
          .bind(session.eventId, agendaId)
          .first()
      : null;
  const agendaItem = agenda
    ? (
        await attachSessionPeople(env, session.eventId, [
          decodeRow(agenda, RESOURCE_SPECS.sessions),
        ])
      )[0]
    : null;
  const decisionRow = await env.CALLBOARD_DB.prepare(
    "SELECT * FROM evaluation_decisions WHERE event_id = ?1 AND id = ?2 LIMIT 1",
  )
    .bind(session.eventId, decisionId)
    .first();
  const onboardingTasks = [];
  if (submissionStatus === "accepted")
    for (const taskId of onboardingTaskIds) {
      const taskRow = await fetchResourceRow(
        env,
        RESOURCE_SPECS.tasks,
        session.eventId,
        taskId,
      );
      if (taskRow)
        onboardingTasks.push(decodeRow(taskRow, RESOURCE_SPECS.tasks));
    }
  const acceptedGuide =
    submissionStatus === "accepted"
      ? await fetchResourceRow(
          env,
          RESOURCE_SPECS.resources,
          session.eventId,
          acceptedGuideId,
        )
      : null;
  return json({
    item: updatedSubmission,
    session: agendaItem,
    decision: decodeRow(decisionRow, RESOURCE_SPECS["evaluation-decisions"]),
    onboarding: {
      taskIds: onboardingTaskIds,
      tasks: onboardingTasks,
      resource: acceptedGuide
        ? decodeRow(acceptedGuide, RESOURCE_SPECS.resources)
        : null,
    },
  });
}

async function readLegacyState(env) {
  if (!env.CALLBOARD_DB)
    return {
      state: null,
      version: 0,
      updatedAt: null,
      persistence: "localStorage",
    };
  const row = await env.CALLBOARD_DB.prepare(
    "SELECT state_json, version, updated_at FROM app_state WHERE id = ?1",
  )
    .bind(STATE_ID)
    .first();
  if (!row)
    return { state: null, version: 0, updatedAt: null, persistence: "d1" };
  return {
    state: JSON.parse(row.state_json),
    version: row.version,
    updatedAt: row.updated_at,
    persistence: "d1",
  };
}

async function parseLegacyStateRequest(request) {
  const parsed = await parseJson(request, MAX_STATE_BYTES + 64);
  if (parsed.error) return parsed;
  const state = parsed.payload.state;
  if (!state || typeof state !== "object" || Array.isArray(state))
    return { error: "INVALID_STATE", status: 400 };
  const stateJson = JSON.stringify(state);
  if (new TextEncoder().encode(stateJson).byteLength > MAX_STATE_BYTES)
    return { error: "STATE_TOO_LARGE", status: 413 };
  return { state, stateJson };
}

async function writeLegacyState(request, env, { seed = false } = {}) {
  const writeError = requireWrites(env);
  if (writeError) return writeError;
  if (!env.CALLBOARD_API_TOKEN)
    return apiError("WRITE_AUTH_NOT_CONFIGURED", 503);
  if (!tokenAuthorized(request, env)) return apiError("UNAUTHORIZED", 401);
  if (
    seed &&
    env.CALLBOARD_SEED_KEY &&
    request.headers.get("x-callboard-seed-key") !== env.CALLBOARD_SEED_KEY
  )
    return apiError("INVALID_SEED_KEY", 401);
  const parsed = await parseLegacyStateRequest(request);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  const current = await env.CALLBOARD_DB.prepare(
    "SELECT version FROM app_state WHERE id = ?1",
  )
    .bind(STATE_ID)
    .first();
  if (
    seed &&
    current &&
    new URL(request.url).searchParams.get("force") !== "true"
  )
    return apiError("STATE_ALREADY_EXISTS", 409);
  const version = Number(current?.version || 0) + 1;
  const updatedAt = now();
  await env.CALLBOARD_DB.prepare(
    `INSERT INTO app_state (id, state_json, version, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, version = excluded.version, updated_at = excluded.updated_at`,
  )
    .bind(STATE_ID, parsed.stateJson, version, updatedAt)
    .run();
  return json({
    ok: true,
    version,
    updatedAt,
    persistence: "d1",
    seeded: seed,
  });
}

async function handleLegacyApi(request, env, url) {
  if (url.pathname === "/api/state" && request.method === "GET") {
    if (env.CALLBOARD_DB && !tokenAuthorized(request, env))
      return apiError("UNAUTHORIZED", 401);
    try {
      return json(await readLegacyState(env));
    } catch {
      return apiError("STATE_READ_FAILED", 500);
    }
  }
  if (url.pathname === "/api/state" && request.method === "PUT")
    return writeLegacyState(request, env);
  if (url.pathname === "/api/seed" && request.method === "POST")
    return writeLegacyState(request, env, { seed: true });
  if (url.pathname === "/api/export" && request.method === "GET") {
    if (env.CALLBOARD_DB && !tokenAuthorized(request, env))
      return apiError("UNAUTHORIZED", 401);
    const state = await readLegacyState(env);
    if (!state.state) return apiError("NO_PERSISTED_STATE", 404);
    const response = json(state);
    response.headers.set(
      "content-disposition",
      `attachment; filename="callboard-export-${now().slice(0, 10)}.json"`,
    );
    return response;
  }
  return null;
}

async function handleApi(request, env, url) {
  try {
    if (
      url.pathname === "/api/health" &&
      ["GET", "HEAD"].includes(request.method)
    )
      return handleHealth(request, env);
    if (
      url.pathname === "/api/bootstrap" &&
      ["GET", "POST"].includes(request.method)
    )
      return handleBootstrap(request, env);
    if (
      url.pathname === "/api/session" &&
      ["GET", "POST", "DELETE"].includes(request.method)
    )
      return handleSession(request, env);
    if (url.pathname === "/api/session/organizer" && request.method === "POST")
      return handleOrganizerSession(request, env);
    if (url.pathname === "/api/auth/organizer/request" && request.method === "POST")
      return handleOrganizerLoginRequest(request, env);
    if (url.pathname === "/api/auth/organizer/redeem" && request.method === "POST")
      return handleOrganizerLoginRedeem(request, env);
    if (
      (url.pathname === "/api/account" ||
        url.pathname === "/api/account/events" ||
        /^\/api\/account\/events\/[^/]+\/select$/.test(url.pathname)) &&
      ["GET", "POST"].includes(request.method)
    )
      return handleAccount(request, env, url);

    const publicFormMatch = url.pathname.match(
      /^\/api\/public\/forms\/([^/]+)(?:\/(submissions|drafts)(?:\/([^/]+))?)?$/,
    );
    if (publicFormMatch) {
      const formId = decodeURIComponent(publicFormMatch[1]);
      const action = publicFormMatch[2] || null;
      if (action === "drafts")
        return handlePublicDraft(
          request,
          env,
          formId,
          publicFormMatch[3] ? decodeURIComponent(publicFormMatch[3]) : "",
        );
      return handlePublicForm(request, env, formId, action);
    }
    const publicEmbedMatch = url.pathname.match(
      /^\/api\/public\/embeds\/([^/]+)(?:\/headshots\/([^/]+))?$/,
    );
    if (publicEmbedMatch) {
      const embedId = decodeURIComponent(publicEmbedMatch[1]);
      return publicEmbedMatch[2]
        ? handlePublicEmbedHeadshot(
            request,
            env,
            embedId,
            decodeURIComponent(publicEmbedMatch[2]),
          )
        : handlePublicEmbed(request, env, embedId);
    }

    const legacy = await handleLegacyApi(request, env, url);
    if (legacy) return legacy;

    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
          "cache-control": "no-store",
        },
      });

    const isAccessGrantRequest =
      url.pathname === "/api/access-grants" && request.method === "POST";
    const isFileUploadRequest =
      url.pathname === "/api/files/upload" && request.method === "POST";
    const fileContentMatch = url.pathname.match(
      /^\/api\/files\/([^/]+)\/content$/,
    );
    const submissionDecisionMatch = url.pathname.match(
      /^\/api\/submissions\/([^/]+)\/decision$/,
    );
    const isScheduleReleaseRequest = url.pathname === "/api/schedule-release";
    const isAgendaConflictsRequest = url.pathname === "/api/agenda-conflicts";
    const isWorkspaceVersionRequest = url.pathname === "/api/workspace-version";
    const isDemoResetRequest = url.pathname === "/api/demo/reset";
    const isEventRequest = url.pathname === "/api/event";
    const isReviewersRequest = url.pathname === "/api/reviewers";
    const apiTokenMatch = url.pathname.match(
      /^\/api\/api-tokens(?:\/([^/]+))?$/,
    );
    const webhookSubscriptionMatch = url.pathname.match(
      /^\/api\/webhooks\/subscriptions(?:\/([^/]+))?$/,
    );
    const isWebhookEventsRequest = url.pathname === "/api/webhooks/events";
    const webhookEventDeliveriesMatch = url.pathname.match(
      /^\/api\/webhooks\/events\/([^/]+)\/deliveries$/,
    );
    const isWebhookDeliveriesRequest =
      url.pathname === "/api/webhooks/deliveries";
    const webhookDeliveryRetryMatch = url.pathname.match(
      /^\/api\/webhooks\/deliveries\/([^/]+)\/retry$/,
    );
    const acceleventsIntegrationMatch = url.pathname.match(
      /^\/api\/integrations\/accelevents(?:\/(runs))?$/,
    );
    const airtableIntegrationMatch = url.pathname.match(
      /^\/api\/integrations\/airtable(?:\/(preview|runs))?$/,
    );
    const reminderAutomationMatch = url.pathname.match(
      /^\/api\/(communication-reminder-runs|communication-reminders\/evaluate)$/,
    );
    const communicationReleaseMatch = url.pathname.match(
      /^\/api\/communication-outbox\/([^/]+)\/release-approval$/,
    );
    const communicationOutboxMatch = url.pathname.match(
      /^\/api\/communication-outbox(?:\/([^/]+)(\/attempts)?)?$/,
    );
    const portalFormResponseMatch = url.pathname.match(
      /^\/api\/portal-forms\/([^/]+)\/responses$/,
    );
    const match = url.pathname.match(
      /^\/api\/(forms|submissions|people|reviews|evaluation-rounds|evaluation-decisions|sessions|tasks|resources|files|embeds|file-requests|portal-forms|communication-templates|communication-reminders|communication-previews)(?:\/([^/]+))?$/,
    );
    if (
      !isAccessGrantRequest &&
      !isFileUploadRequest &&
      !fileContentMatch &&
      !submissionDecisionMatch &&
      !isScheduleReleaseRequest &&
      !isAgendaConflictsRequest &&
      !isWorkspaceVersionRequest &&
      !isDemoResetRequest &&
      !isEventRequest &&
      !isReviewersRequest &&
      !apiTokenMatch &&
      !webhookSubscriptionMatch &&
      !isWebhookEventsRequest &&
      !webhookEventDeliveriesMatch &&
      !isWebhookDeliveriesRequest &&
      !webhookDeliveryRetryMatch &&
      !acceleventsIntegrationMatch &&
      !airtableIntegrationMatch &&
      !reminderAutomationMatch &&
      !communicationReleaseMatch &&
      !communicationOutboxMatch &&
      !portalFormResponseMatch &&
      !match
    )
      return apiError("API_NOT_FOUND", 404);

    const authenticated = await authenticate(request, env);
    if (authenticated.response) return authenticated.response;
    if (apiTokenMatch)
      return handleApiTokens(
        request,
        env,
        authenticated.session,
        apiTokenMatch[1] ? decodeURIComponent(apiTokenMatch[1]) : null,
      );
    if (
      authenticated.session.authType === "api_token" &&
      (isAccessGrantRequest ||
        isDemoResetRequest ||
        communicationReleaseMatch ||
        !apiTokenAllows(authenticated.session, url, request.method))
    )
      return apiError("API_SCOPE_REQUIRED", 403, {
        required: apiScopeForRequest(url, request.method),
      });
    if (webhookSubscriptionMatch)
      return handleWebhookSubscriptions(
        request,
        env,
        authenticated.session,
        webhookSubscriptionMatch[1]
          ? decodeURIComponent(webhookSubscriptionMatch[1])
          : null,
      );
    if (isWebhookEventsRequest && request.method === "GET")
      return listWebhookEvents(env, url, authenticated.session);
    if (webhookEventDeliveriesMatch)
      return handleWebhookEventDeliveries(
        request,
        env,
        authenticated.session,
        decodeURIComponent(webhookEventDeliveriesMatch[1]),
      );
    if (isWebhookDeliveriesRequest)
      return handleWebhookDeliveries(request, env, authenticated.session);
    if (webhookDeliveryRetryMatch)
      return handleWebhookDeliveryRetry(
        request,
        env,
        authenticated.session,
        decodeURIComponent(webhookDeliveryRetryMatch[1]),
      );
    if (isAccessGrantRequest)
      return handleAccessGrants(request, env, authenticated.session);
    if (isFileUploadRequest)
      return handleFileUpload(request, env, authenticated.session);
    if (fileContentMatch && ["GET", "HEAD"].includes(request.method))
      return handleFileContent(
        request,
        env,
        authenticated.session,
        decodeURIComponent(fileContentMatch[1]),
      );
    if (submissionDecisionMatch && request.method === "POST")
      return handleSubmissionDecision(
        request,
        env,
        authenticated.session,
        decodeURIComponent(submissionDecisionMatch[1]),
      );
    if (isScheduleReleaseRequest)
      return handleScheduleRelease(request, env, authenticated.session);
    if (isAgendaConflictsRequest)
      return handleAgendaConflicts(request, env, authenticated.session);
    if (isWorkspaceVersionRequest && request.method === "GET")
      return handleWorkspaceVersion(request, env, authenticated.session);
    if (isDemoResetRequest)
      return handleDemoReset(request, env, authenticated.session);
    if (isEventRequest) return handleEvent(request, env, authenticated.session);
    if (isReviewersRequest)
      return handleReviewers(request, env, authenticated.session);
    if (acceleventsIntegrationMatch)
      return handleAcceleventsIntegration(
        request,
        env,
        authenticated.session,
        acceleventsIntegrationMatch[1] || null,
      );
    if (airtableIntegrationMatch)
      return handleAirtableIntegration(
        request,
        env,
        authenticated.session,
        airtableIntegrationMatch[1] || null,
      );
    if (reminderAutomationMatch)
      return handleReminderAutomation(
        request,
        env,
        url,
        authenticated.session,
        reminderAutomationMatch[1] === "communication-reminder-runs"
          ? "runs"
          : "evaluate",
      );
    if (communicationReleaseMatch)
      return handleCommunicationReleaseApproval(
        request,
        env,
        authenticated.session,
        decodeURIComponent(communicationReleaseMatch[1]),
      );
    if (communicationOutboxMatch)
      return handleCommunicationOutbox(
        request,
        env,
        url,
        authenticated.session,
        communicationOutboxMatch[1]
          ? decodeURIComponent(communicationOutboxMatch[1])
          : null,
        Boolean(communicationOutboxMatch[2]),
      );
    if (portalFormResponseMatch)
      return handlePortalFormResponse(
        request,
        env,
        authenticated.session,
        decodeURIComponent(portalFormResponseMatch[1]),
      );
    if (match)
      return handleResource(
        request,
        env,
        url,
        authenticated.session,
        match[1],
        match[2] ? decodeURIComponent(match[2]) : null,
      );
    return apiError("API_NOT_FOUND", 404);
  } catch (error) {
    console.error("Callboard API failure", error);
    return apiError("INTERNAL_ERROR", 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);

    const directAppRoutes = new Set([
      "/sessions",
      "/schedule",
      "/agenda",
      "/speakers",
      "/gallery",
    ]);
    if (
      directAppRoutes.has(url.pathname) &&
      ["GET", "HEAD"].includes(request.method)
    ) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/";
      indexUrl.search = "";
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (
      response.status !== 404 ||
      !acceptsHtml ||
      !["GET", "HEAD"].includes(request.method)
    )
      return response;

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
  async queue(batch, env) {
    return handleCommunicationQueue(batch, env);
  },
  async scheduled(controller, env) {
    const scheduledAt = Number.isFinite(controller?.scheduledTime)
      ? new Date(controller.scheduledTime).toISOString()
      : now();
    return evaluateDueReminders(env, scheduledAt);
  },
};
