import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";

class NodeD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.bindings = [];
    const numbered = [...sql.matchAll(/\?(\d+)/g)].map((match) => Number(match[1]) - 1);
    this.bindingOrder = numbered.length ? numbered : null;
    this.statement = database.prepare(numbered.length ? sql.replace(/\?\d+/g, "?") : sql);
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  parameters() {
    return this.bindingOrder ? this.bindingOrder.map((index) => this.bindings[index]) : this.bindings;
  }

  async first() {
    return this.statement.get(...this.parameters()) || null;
  }

  async all() {
    return { success: true, results: this.statement.all(...this.parameters()) };
  }

  async run() {
    const result = this.statement.run(...this.parameters());
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class NodeD1 {
  constructor() {
    this.database = new DatabaseSync(":memory:");
    this.database.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  }

  prepare(sql) {
    return new NodeD1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

class MemoryR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    const bytes = new Uint8Array(value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer());
    this.objects.set(key, { bytes, options });
    return { key, size: bytes.byteLength };
  }

  async get(key) {
    const object = this.objects.get(key);
    return object ? { body: object.bytes, size: object.bytes.byteLength } : null;
  }

  async delete(key) {
    this.objects.delete(key);
  }
}

class MemoryQueue {
  constructor() {
    this.messages = [];
  }

  async send(message) {
    this.messages.push(structuredClone(message));
  }
}

function testEnv(overrides = {}) {
  return {
    CALLBOARD_DB: new NodeD1(),
    CALLBOARD_WRITE_ENABLED: "true",
    CALLBOARD_BOOTSTRAP_SECRET: "bootstrap-test-secret",
    CALLBOARD_WEBHOOK_SIGNING_KEY: "webhook-signing-test-key",
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
    ...overrides,
  };
}

function api(path, init = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { ...init, headers });
}

function cookie(response) {
  return response.headers.get("set-cookie")?.split(";", 1)[0] || "";
}

async function body(response) {
  return response.status === 204 ? null : response.json();
}

async function bootstrap(env) {
  const response = await worker.fetch(api("/api/bootstrap", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_BOOTSTRAP_SECRET },
    body: JSON.stringify({
      event: { name: "AI Engineer World's Fair", slug: "ai-engineer-worlds-fair", timezone: "America/Los_Angeles" },
      organizer: { name: "Organizer One", email: "organizer@example.test" },
    }),
  }), env);
  assert.equal(response.status, 201);
  return { cookie: cookie(response), payload: await body(response) };
}

async function createGrant(env, organizerCookie, role, email, name) {
  const response = await worker.fetch(api("/api/access-grants", {
    method: "POST",
    headers: { cookie: organizerCookie },
    body: JSON.stringify({ role, email, name }),
  }), env);
  assert.equal(response.status, 201);
  return body(response);
}

async function redeemGrant(env, grantToken) {
  const response = await worker.fetch(api("/api/session", {
    method: "POST",
    body: JSON.stringify({ grantToken }),
  }), env);
  assert.equal(response.status, 201);
  return { cookie: cookie(response), payload: await body(response) };
}

test("health and bootstrap fail closed, then issue a server session", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());

  const health = await worker.fetch(api("/api/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(Object.fromEntries(Object.entries(await body(health)).filter(([key]) => ["persistence", "writesEnabled", "sessionAuthConfigured", "expectedSchemaVersion"].includes(key))), {
    persistence: "d1",
    writesEnabled: true,
    sessionAuthConfigured: true,
    expectedSchemaVersion: 21,
  });

  const denied = await worker.fetch(api("/api/bootstrap", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": "wrong" },
    body: JSON.stringify({ event: { name: "Event" }, organizer: { name: "Owner", email: "owner@example.test" } }),
  }), env);
  assert.equal(denied.status, 401);
  assert.equal((await body(denied)).error, "INVALID_BOOTSTRAP_KEY");

  const initialized = await bootstrap(env);
  assert.match(initialized.cookie, /^callboard_session=/);
  assert.equal(initialized.payload.user.role, "organizer");

  const current = await worker.fetch(api("/api/session", { headers: { cookie: initialized.cookie } }), env);
  assert.equal(current.status, 200);
  assert.equal((await body(current)).role, "organizer");

  const signedBackIn = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_BOOTSTRAP_SECRET },
  }), env);
  assert.equal(signedBackIn.status, 201);
  assert.match(cookie(signedBackIn), /^callboard_session=/);

  const wrongOrganizerKey = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": "wrong" },
  }), env);
  assert.equal(wrongOrganizerKey.status, 401);

  const unauthenticated = await worker.fetch(api("/api/forms"), env);
  assert.equal(unauthenticated.status, 401);

  const repeated = await worker.fetch(api("/api/bootstrap", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_BOOTSTRAP_SECRET },
    body: JSON.stringify({ event: { name: "Other" }, organizer: { name: "Other", email: "other@example.test" } }),
  }), env);
  assert.equal(repeated.status, 409);
});

test("self-serve organizers create isolated event workspaces with one-time login links", async (t) => {
  const env = testEnv({ CALLBOARD_SELF_SERVE_DEV_LINKS: "true" });
  t.after(() => env.CALLBOARD_DB.close());

  async function createAccount(email, name) {
    const requested = await worker.fetch(api("/api/auth/organizer/request", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }), env);
    assert.equal(requested.status, 202);
    const requestPayload = await body(requested);
    const token = decodeURIComponent(requestPayload.developmentAccessPath.split("/").at(-1));
    const redeemed = await worker.fetch(api("/api/auth/organizer/redeem", {
      method: "POST",
      body: JSON.stringify({ token }),
    }), env);
    assert.equal(redeemed.status, 201);
    const accountCookie = cookie(redeemed);
    assert.match(accountCookie, /^callboard_account=/);
    const replay = await worker.fetch(api("/api/auth/organizer/redeem", {
      method: "POST",
      body: JSON.stringify({ token }),
    }), env);
    assert.equal(replay.status, 401);
    return accountCookie;
  }

  async function createEvent(accountCookie, name, slug) {
    const response = await worker.fetch(api("/api/account/events", {
      method: "POST",
      headers: { cookie: accountCookie },
      body: JSON.stringify({
        name,
        slug,
        timezone: "America/Los_Angeles",
        startsAt: "2027-10-12T16:00:00.000Z",
        endsAt: "2027-10-14T23:00:00.000Z",
      }),
    }), env);
    assert.equal(response.status, 201);
    return { eventCookie: cookie(response), payload: await body(response) };
  }

  const accountA = await createAccount("ada@example.test", "Ada Organizer");
  const eventA = await createEvent(accountA, "Ada Summit", "ada-summit");
  const accountB = await createAccount("grace@example.test", "Grace Organizer");
  const eventB = await createEvent(accountB, "Grace Summit", "grace-summit");
  assert.notEqual(eventA.payload.item.id, eventB.payload.item.id);

  const denied = await worker.fetch(api(`/api/account/events/${eventB.payload.item.id}/select`, {
    method: "POST",
    headers: { cookie: accountA },
    body: JSON.stringify({}),
  }), env);
  assert.equal(denied.status, 403);

  const eventARead = await worker.fetch(api("/api/event", { headers: { cookie: eventA.eventCookie } }), env);
  assert.equal(eventARead.status, 200);
  assert.equal((await body(eventARead)).item.id, eventA.payload.item.id);
  const eventBRead = await worker.fetch(api("/api/event", { headers: { cookie: eventB.eventCookie } }), env);
  assert.equal(eventBRead.status, 200);
  assert.equal((await body(eventBRead)).item.id, eventB.payload.item.id);

  const eventAForm = await worker.fetch(api(`/api/public/forms/${eventA.payload.item.formId}`), env);
  assert.equal(eventAForm.status, 200);
  const eventAFormPayload = await body(eventAForm);
  assert.equal(eventAFormPayload.form.externalTitle, "Ada Summit Call for Speakers");
  assert.match(eventAFormPayload.form.welcomeMessage, /Welcome to the Ada Summit call for speakers/);
  assert.doesNotMatch(eventAFormPayload.form.welcomeMessage, /DevFlow|synthetic|demo/i);
  assert.deepEqual(eventAFormPayload.form.abstractFields.find((field) => field.id === "track").options, ["General"]);
  assert.doesNotMatch(eventAFormPayload.form.participantSection.description, /synthetic|demo/i);

  const accountAEvents = await worker.fetch(api("/api/account/events", { headers: { cookie: accountA } }), env);
  assert.equal(accountAEvents.status, 200);
  const accountAItems = (await body(accountAEvents)).items;
  assert.deepEqual(accountAItems.map((item) => item.id), [eventA.payload.item.id]);
  assert.ok(accountAItems[0].formId);
  assert.ok(accountAItems[0].scheduleEmbedId);
  assert.ok(accountAItems[0].speakerEmbedId);

  await createEvent(accountA, "Ada Workshop", "ada-workshop");
  await createEvent(accountA, "Ada Retreat", "ada-retreat");
  const overLimit = await worker.fetch(api("/api/account/events", {
    method: "POST",
    headers: { cookie: accountA },
    body: JSON.stringify({ name: "Ada Event Four", timezone: "UTC" }),
  }), env);
  assert.equal(overLimit.status, 409);
  assert.equal((await body(overLimit)).error, "EVENT_LIMIT_REACHED");
});

test("self-serve organizer links queue and deliver through the branded transactional provider", async (t) => {
  const queue = new MemoryQueue();
  const providerCalls = [];
  const env = testEnv({
    CALLBOARD_SELF_SERVE_EMAIL_ENABLED: "true",
    CALLBOARD_EMAIL_QUEUE: queue,
    CALLBOARD_RESEND_API_KEY: "re_test_key",
    CALLBOARD_AUTH_SENDER_EMAIL: "hello@opencallboard.com",
    CALLBOARD_PUBLIC_ORIGIN: "https://app.opencallboard.com",
    CALLBOARD_PROVIDER_FETCH: async (url, init) => {
      providerCalls.push({ url: String(url), init });
      return Response.json({ id: "resend-organizer-login-1" });
    },
  });
  t.after(() => env.CALLBOARD_DB.close());

  const requested = await worker.fetch(api("/api/auth/organizer/request", {
    method: "POST",
    body: JSON.stringify({ email: "organizer@example.test", name: "Test Organizer" }),
  }), env);
  assert.equal(requested.status, 202);
  assert.equal((await body(requested)).developmentAccessPath, undefined);
  assert.equal(queue.messages.length, 1);

  let acknowledged = false;
  let retried = false;
  await worker.queue({ messages: [{
    body: queue.messages[0],
    ack: () => { acknowledged = true; },
    retry: () => { retried = true; },
  }] }, env);
  assert.equal(acknowledged, true);
  assert.equal(retried, false);
  assert.equal(providerCalls.length, 1);
  const exact = JSON.parse(providerCalls[0].init.body);
  assert.equal(exact.from, "OpenCallboard <hello@opencallboard.com>");
  assert.deepEqual(exact.to, ["organizer@example.test"]);
  assert.match(exact.text, /https:\/\/app\.opencallboard\.com\/#\/organizer-access\//);
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT delivery_status FROM organizer_login_challenges LIMIT 1").get().delivery_status, "delivered");
});

test("Turnstile is mandatory when configured and its public site key is exposed safely", async (t) => {
  const providerCalls = [];
  const env = testEnv({
    CALLBOARD_SELF_SERVE_DEV_LINKS: "true",
    CALLBOARD_TURNSTILE_SECRET_KEY: "turnstile-secret",
    CALLBOARD_TURNSTILE_SITE_KEY: "turnstile-public-site-key",
    CALLBOARD_PROVIDER_FETCH: async (url, init) => {
      providerCalls.push({ url: String(url), init });
      return Response.json({ success: true });
    },
  });
  t.after(() => env.CALLBOARD_DB.close());
  const health = await worker.fetch(api("/api/health"), env);
  const healthPayload = await body(health);
  assert.equal(healthPayload.turnstileConfigured, true);
  assert.equal(healthPayload.turnstileSiteKey, "turnstile-public-site-key");

  const missing = await worker.fetch(api("/api/auth/organizer/request", {
    method: "POST",
    body: JSON.stringify({ email: "organizer@example.test", name: "Test Organizer" }),
  }), env);
  assert.equal(missing.status, 400);
  assert.equal((await body(missing)).error, "TURNSTILE_VERIFICATION_FAILED");

  const verified = await worker.fetch(api("/api/auth/organizer/request", {
    method: "POST",
    headers: { "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify({ email: "organizer@example.test", name: "Test Organizer", turnstileToken: "valid-token" }),
  }), env);
  assert.equal(verified.status, 202);
  assert.equal(providerCalls.length, 1);
  assert.equal(providerCalls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
});

test("organizer login requests are rate limited per email", async (t) => {
  const env = testEnv({ CALLBOARD_SELF_SERVE_DEV_LINKS: "true" });
  t.after(() => env.CALLBOARD_DB.close());
  for (let index = 0; index < 5; index += 1) {
    const response = await worker.fetch(api("/api/auth/organizer/request", {
      method: "POST",
      body: JSON.stringify({ email: "rate-limit@example.test", name: "Rate Limit" }),
    }), env);
    assert.equal(response.status, 202);
  }
  const blocked = await worker.fetch(api("/api/auth/organizer/request", {
    method: "POST",
    body: JSON.stringify({ email: "rate-limit@example.test", name: "Rate Limit" }),
  }), env);
  assert.equal(blocked.status, 429);
});

test("self-serve public submissions require a one-time speaker identity handoff", async (t) => {
  const env = testEnv({ CALLBOARD_SELF_SERVE_DEV_LINKS: "true" });
  t.after(() => env.CALLBOARD_DB.close());

  const requested = await worker.fetch(api("/api/auth/organizer/request", {
    method: "POST",
    body: JSON.stringify({ email: "owner@example.test", name: "Event Owner" }),
  }), env);
  const loginPath = (await body(requested)).developmentAccessPath;
  const organizerToken = decodeURIComponent(loginPath.split("/").at(-1));
  const redeemed = await worker.fetch(api("/api/auth/organizer/redeem", {
    method: "POST",
    body: JSON.stringify({ token: organizerToken }),
  }), env);
  const accountCookie = cookie(redeemed);
  const createdEvent = await worker.fetch(api("/api/account/events", {
    method: "POST",
    headers: { cookie: accountCookie },
    body: JSON.stringify({
      name: "Identity Proof Summit",
      timezone: "America/Los_Angeles",
      startsAt: "2027-10-12T16:00:00.000Z",
      endsAt: "2027-10-14T23:00:00.000Z",
    }),
  }), env);
  assert.equal(createdEvent.status, 201);
  const event = (await body(createdEvent)).item;

  const submitted = await worker.fetch(api(`/api/public/forms/${event.formId}/submissions`, {
    method: "POST",
    headers: { "idempotency-key": "self-serve-speaker-identity-proof" },
    body: JSON.stringify({
      email: "speaker@example.test",
      title: "Operating reliable agent workflows",
      abstract: "A practical session about safe production agent systems.",
      category: "General",
      answers: { Format: "Talk (30 min)", Track: "General" },
      participants: [{
        email: "speaker@example.test",
        name: "Speaker One",
        bio: "Builds reliable production systems.",
      }],
    }),
  }), env);
  assert.equal(submitted.status, 201);
  assert.equal(cookie(submitted), "");
  const submissionPayload = await body(submitted);
  assert.equal(submissionPayload.portalAccess.authenticated, false);
  assert.equal(submissionPayload.portalAccess.reason, "EMAIL_VERIFICATION_REQUIRED");
  assert.equal(submissionPayload.portalAccess.deliveryStatus, "unavailable");
  assert.match(submissionPayload.portalAccess.developmentAccessPath, /^\/#\/access\//);

  const speakerToken = decodeURIComponent(submissionPayload.portalAccess.developmentAccessPath.split("/").at(-1));
  const speaker = await worker.fetch(api("/api/session", {
    method: "POST",
    body: JSON.stringify({ grantToken: speakerToken }),
  }), env);
  assert.equal(speaker.status, 201);
  assert.match(cookie(speaker), /^callboard_session=/);
  assert.equal((await body(speaker)).role, "speaker");
  const replay = await worker.fetch(api("/api/session", {
    method: "POST",
    body: JSON.stringify({ grantToken: speakerToken }),
  }), env);
  assert.equal(replay.status, 401);
});

test("temporary judge access is expiring, event-scoped, and distinct from the operator", async (t) => {
  const env = testEnv({
    CALLBOARD_DEMO_RESET_ENABLED: "true",
    CALLBOARD_JUDGE_ACCESS_SECRET: "temporary-judge-test-secret",
    CALLBOARD_JUDGE_ACCESS_EXPIRES_AT: "2099-01-01T00:00:00Z",
  });
  t.after(() => env.CALLBOARD_DB.close());
  const operator = await bootstrap(env);
  const seeded = await worker.fetch(api("/api/demo/reset", {
    method: "POST",
    headers: {
      cookie: operator.cookie,
      "x-callboard-demo-confirm": "reset-synthetic-judge-event",
    },
    body: JSON.stringify({ eventSlug: "callboard-judge-demo" }),
  }), env);
  assert.equal(seeded.status, 201);

  const signedIn = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_JUDGE_ACCESS_SECRET },
  }), env);
  assert.equal(signedIn.status, 201);
  assert.match(cookie(signedIn), /^callboard_session=/);
  const payload = await body(signedIn);
  assert.equal(payload.accessMode, "competition_judge");
  assert.equal(payload.eventId, "event_callboard_judge_demo");
  assert.equal(payload.userId, "user_callboard_competition_judge");
  assert.equal(payload.role, "organizer");

  const membership = await env.CALLBOARD_DB.prepare(
    "SELECT person_id FROM event_memberships WHERE event_id = ?1 AND user_id = ?2 AND role = 'organizer'",
  )
    .bind(payload.eventId, payload.userId)
    .first();
  assert.equal(membership.person_id, "person_callboard_competition_judge");

  await env.CALLBOARD_DB.prepare(
    "DELETE FROM event_memberships WHERE event_id = ?1 AND user_id = ?2 AND role = 'organizer'",
  )
    .bind(payload.eventId, payload.userId)
    .run();
  await env.CALLBOARD_DB.prepare(
    "DELETE FROM people WHERE event_id = ?1 AND id = 'person_callboard_competition_judge'",
  )
    .bind(payload.eventId)
    .run();
  await env.CALLBOARD_DB.prepare(
    `INSERT INTO people (id, event_id, email, name, role, version, created_at, updated_at)
     VALUES ('person_existing_judge_email', ?1, 'competition-judge@callboard.invalid', 'Existing judge identity', 'Organizer', 1, ?2, ?2)`,
  )
    .bind(payload.eventId, new Date().toISOString())
    .run();
  const signedInWithExistingEmail = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_JUDGE_ACCESS_SECRET },
  }), env);
  assert.equal(signedInWithExistingEmail.status, 201);
  assert.equal((await body(signedInWithExistingEmail)).personId, "person_existing_judge_email");

  env.CALLBOARD_JUDGE_ACCESS_EXPIRES_AT = "2000-01-01T00:00:00Z";
  const expired = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_JUDGE_ACCESS_SECRET },
  }), env);
  assert.equal(expired.status, 401);
  assert.equal((await body(expired)).error, "JUDGE_ACCESS_EXPIRED");
});

test("workspace version changes after a shared task mutation and requires authentication", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const unauthenticated = await worker.fetch(api("/api/workspace-version"), env);
  assert.equal(unauthenticated.status, 401);

  const beforeResponse = await worker.fetch(api("/api/workspace-version", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(beforeResponse.status, 200);
  const before = await body(beforeResponse);
  assert.equal(before.pollAfterMs, 5000);

  const createdResponse = await worker.fetch(api("/api/tasks", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Poll-visible task", status: "open", kind: "contact" }),
  }), env);
  assert.equal(createdResponse.status, 201);

  const afterResponse = await worker.fetch(api("/api/workspace-version", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(afterResponse.status, 200);
  const after = await body(afterResponse);
  assert.notEqual(after.version, before.version);
});

test("judge demo reset is isolated, confirmation-gated, deterministic, and disabled by default", async (t) => {
  const disabledEnv = testEnv();
  t.after(() => disabledEnv.CALLBOARD_DB.close());
  const disabledOrganizer = await bootstrap(disabledEnv);
  const disabled = await worker.fetch(api("/api/demo/reset", {
    method: "POST",
    headers: { cookie: disabledOrganizer.cookie, "x-callboard-demo-confirm": "reset-synthetic-judge-event" },
    body: JSON.stringify({ eventSlug: "callboard-judge-demo" }),
  }), disabledEnv);
  assert.equal(disabled.status, 403);
  assert.equal((await body(disabled)).error, "DEMO_RESET_DISABLED");

  const env = testEnv({ CALLBOARD_DEMO_RESET_ENABLED: "true" });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const unconfirmed = await worker.fetch(api("/api/demo/reset", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ eventSlug: "callboard-judge-demo" }),
  }), env);
  assert.equal(unconfirmed.status, 428);

  const reset = await worker.fetch(api("/api/demo/reset", {
    method: "POST",
    headers: { cookie: organizer.cookie, "x-callboard-demo-confirm": "reset-synthetic-judge-event" },
    body: JSON.stringify({ eventSlug: "callboard-judge-demo" }),
  }), env);
  assert.equal(reset.status, 201);
  const resetPayload = await body(reset);
  const demoCookie = cookie(reset);
  assert.equal(resetPayload.eventId, "event_callboard_judge_demo");
  assert.equal(resetPayload.formId, "form_callboard_judge_cfp");
  assert.match(resetPayload.reviewerAccessPath, /^\/#\/access\//);
  assert.notEqual(demoCookie, organizer.cookie);

  const demoEvent = await worker.fetch(api("/api/event", { headers: { cookie: demoCookie } }), env);
  const demoEventPayload = (await body(demoEvent)).item;
  assert.equal(demoEventPayload.name, "DevFlow Conf 2027");
  assert.equal(demoEventPayload.startsAt, "2027-05-12T09:00:00-07:00");
  const demoForm = await worker.fetch(api("/api/public/forms/form_callboard_judge_cfp"), env);
  assert.equal(demoForm.status, 200);
  const demoFormPayload = await body(demoForm);
  assert.equal(demoFormPayload.form.allowMultipleDrafts, true);
  assert.equal(demoFormPayload.form.autoRedirect, true);
  assert.match(demoFormPayload.form.welcomeMessage, /May 12–14, 2027/);
  assert.deepEqual(demoFormPayload.form.abstractFields.find((field) => field.id === "track").options, ["AI Engineering", "Platform & Infra", "Developer Experience"]);
  assert.equal(demoFormPayload.form.abstractFields.find((field) => field.id === "workshopPrerequisites").conditionValue, "Workshop (120 min)");
  const eventCount = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS count FROM events").first();
  assert.equal(Number(eventCount.count), 2);

  const signedIntoLatestWorkspace = await worker.fetch(api("/api/session/organizer", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_BOOTSTRAP_SECRET },
  }), env);
  assert.equal(signedIntoLatestWorkspace.status, 201);
  assert.equal((await body(signedIntoLatestWorkspace)).eventId, "event_callboard_judge_demo");

  const reviewerToken = resetPayload.reviewerAccessPath.split("/").pop();
  const reviewer = await redeemGrant(env, reviewerToken);
  assert.equal(reviewer.payload.role, "reviewer");
  assert.equal(reviewer.payload.eventId, "event_callboard_judge_demo");

  const resetAgain = await worker.fetch(api("/api/demo/reset", {
    method: "POST",
    headers: { cookie: organizer.cookie, "x-callboard-demo-confirm": "reset-synthetic-judge-event" },
    body: JSON.stringify({ eventSlug: "callboard-judge-demo" }),
  }), env);
  assert.equal(resetAgain.status, 201);
  const deterministicCount = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS count FROM events WHERE id = 'event_callboard_judge_demo'").first();
  assert.equal(Number(deterministicCount.count), 1);
});

test("event settings are versioned and organizer-only", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const initial = await worker.fetch(api("/api/event", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(initial.status, 200);
  const initialEvent = (await body(initial)).item;
  assert.equal(initialEvent.timezone, "America/Los_Angeles");
  assert.equal(initialEvent.version, 1);

  const updated = await worker.fetch(api("/api/event", {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({
      location: "New York, NY",
      website: "https://ai.engineer",
      type: "Conference",
      theme: "A practical gathering for engineers building reliable AI systems.",
      startsAt: "2026-10-12T16:00:00.000Z",
      endsAt: "2026-10-15T00:00:00.000Z",
      settings: { groupTypes: ["Exhibitors", "Sponsors"], dates: "Oct 12–14, 2026" },
    }),
  }), env);
  assert.equal(updated.status, 200);
  assert.equal(updated.headers.get("etag"), '"2"');
  const updatedEvent = (await body(updated)).item;
  assert.equal(updatedEvent.version, 2);
  assert.equal(updatedEvent.location, "New York, NY");
  assert.equal(updatedEvent.settings.dates, "Oct 12–14, 2026");

  const stale = await worker.fetch(api("/api/event", {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ location: "Stale update" }),
  }), env);
  assert.equal(stale.status, 409);

  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "event-speaker@example.test", "Event Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const speakerRead = await worker.fetch(api("/api/event", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerRead.status, 200);
  const speakerWrite = await worker.fetch(api("/api/event", {
    method: "PATCH",
    headers: { cookie: speaker.cookie, "if-match": '"2"' },
    body: JSON.stringify({ location: "Forbidden update" }),
  }), env);
  assert.equal(speakerWrite.status, 403);
});

test("evaluation rounds, assignments, reviews, and advancement remain independently versioned", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const seededRoundsResponse = await worker.fetch(api("/api/evaluation-rounds", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(seededRoundsResponse.status, 200);
  const roundOne = (await body(seededRoundsResponse)).items[0];
  assert.equal(roundOne.number, 1);
  assert.equal(roundOne.criteria.reduce((total, criterion) => total + criterion.weight, 0), 100);

  const invalidRound = await worker.fetch(api("/api/evaluation-rounds", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Invalid round", number: 2, status: "upcoming", blind: 0, criteria: [{ id: "only", label: "Only", weight: 80 }] }),
  }), env);
  assert.equal(invalidRound.status, 400);
  assert.equal((await body(invalidRound)).error, "EVALUATION_WEIGHTS_MUST_TOTAL_100");

  const roundTwoResponse = await worker.fetch(api("/api/evaluation-rounds", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Round 2 · Program committee", number: 2, status: "upcoming", blind: 0, criteria: [{ id: "program", label: "Program fit", weight: 60 }, { id: "readiness", label: "Speaker readiness", weight: 40 }] }),
  }), env);
  assert.equal(roundTwoResponse.status, 201);
  const roundTwo = (await body(roundTwoResponse)).item;

  const configured = await worker.fetch(api(`/api/evaluation-rounds/${roundOne.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ name: "Round 1 · Blind technical review", status: "open", blind: 1, criteria: roundOne.criteria }),
  }), env);
  assert.equal(configured.status, 200);
  assert.equal((await body(configured)).item.version, 2);

  const formResponse = await worker.fetch(api("/api/forms", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ name: "Evaluation CFP", status: "published", schema: {} }) }), env);
  const form = (await body(formResponse)).item;
  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "evaluated-speaker@example.test", "Evaluated Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const submissionResponse = await worker.fetch(api("/api/submissions", { method: "POST", headers: { cookie: speaker.cookie }, body: JSON.stringify({ formId: form.id, title: "Shared multi-round review" }) }), env);
  const submission = (await body(submissionResponse)).item;

  const reviewerGrant = await createGrant(env, organizer.cookie, "reviewer", "multi-round-reviewer@example.test", "Multi Round Reviewer");
  const reviewer = await redeemGrant(env, reviewerGrant.grantToken);
  const reviewersResponse = await worker.fetch(api("/api/reviewers", { headers: { cookie: organizer.cookie } }), env);
  assert.deepEqual((await body(reviewersResponse)).items.map((item) => item.id), [reviewer.payload.userId]);

  const assignmentResponse = await worker.fetch(api("/api/reviews", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ submissionId: submission.id, reviewerUserId: reviewer.payload.userId, roundId: roundOne.id, scores: {}, status: "assigned" }),
  }), env);
  assert.equal(assignmentResponse.status, 201);
  const assignment = (await body(assignmentResponse)).item;
  assert.equal(assignment.roundId, roundOne.id);
  const duplicateAssignment = await worker.fetch(api("/api/reviews", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ submissionId: submission.id, reviewerUserId: reviewer.payload.userId, roundId: roundOne.id, scores: {}, status: "assigned" }),
  }), env);
  assert.equal(duplicateAssignment.status, 409);
  assert.equal((await body(duplicateAssignment)).error, "RESOURCE_CONFLICT");

  const reviewerRoundsBefore = await worker.fetch(api("/api/evaluation-rounds", { headers: { cookie: reviewer.cookie } }), env);
  assert.deepEqual((await body(reviewerRoundsBefore)).items.map((item) => item.id), [roundOne.id]);
  const draftReview = await worker.fetch(api(`/api/reviews/${assignment.id}`, {
    method: "PATCH",
    headers: { cookie: reviewer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ scores: { relevance: 5, originality: 4, technical: 5, practical: 4 }, totalScore: 4.6, recommendation: "advance", notes: "Synthetic draft", status: "draft" }),
  }), env);
  assert.equal(draftReview.status, 200);
  const finalReview = await worker.fetch(api(`/api/reviews/${assignment.id}`, {
    method: "PATCH",
    headers: { cookie: reviewer.cookie, "if-match": '"2"' },
    body: JSON.stringify({ status: "submitted" }),
  }), env);
  assert.equal(finalReview.status, 200);

  const advancedResponse = await worker.fetch(api(`/api/submissions/${submission.id}/decision`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ decision: "advance", roundId: roundOne.id, reviewerUserId: reviewer.payload.userId }),
  }), env);
  assert.equal(advancedResponse.status, 200);
  const advanced = await body(advancedResponse);
  assert.equal(advanced.item.round, 2);
  assert.equal(advanced.decision.roundId, roundOne.id);

  const reviewerRoundsAfter = await worker.fetch(api("/api/evaluation-rounds", { headers: { cookie: reviewer.cookie } }), env);
  assert.deepEqual((await body(reviewerRoundsAfter)).items.map((item) => item.id).sort(), [roundOne.id, roundTwo.id].sort());
  const reviewerAssignments = await worker.fetch(api("/api/reviews", { headers: { cookie: reviewer.cookie } }), env);
  assert.deepEqual((await body(reviewerAssignments)).items.map((item) => item.roundId).sort(), [roundOne.id, roundTwo.id].sort());

  const decisionsResponse = await worker.fetch(api("/api/evaluation-decisions", { headers: { cookie: organizer.cookie } }), env);
  assert.deepEqual((await body(decisionsResponse)).items.map((item) => item.decision), ["advance"]);
  const reviewerDecisions = await worker.fetch(api("/api/evaluation-decisions", { headers: { cookie: reviewer.cookie } }), env);
  assert.equal(reviewerDecisions.status, 403);
});

test("organizer CRUD is event-scoped and uses optimistic versions", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const created = await worker.fetch(api("/api/forms", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Main CFP", status: "published", schema: { questions: [{ id: "title", type: "text" }] } }),
  }), env);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("etag"), '"1"');
  const createdForm = (await body(created)).item;
  assert.equal(createdForm.schema.questions[0].id, "title");

  const list = await worker.fetch(api("/api/forms", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(list.status, 200);
  assert.deepEqual((await body(list)).items.map((item) => item.id), [createdForm.id]);

  const missingVersion = await worker.fetch(api(`/api/forms/${createdForm.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Updated CFP" }),
  }), env);
  assert.equal(missingVersion.status, 428);

  const updated = await worker.fetch(api(`/api/forms/${createdForm.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ name: "Updated CFP" }),
  }), env);
  assert.equal(updated.status, 200);
  assert.equal((await body(updated)).item.version, 2);

  const stale = await worker.fetch(api(`/api/forms/${createdForm.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ name: "Stale update" }),
  }), env);
  assert.equal(stale.status, 409);

  const removed = await worker.fetch(api(`/api/forms/${createdForm.id}`, { method: "DELETE", headers: { cookie: organizer.cookie, "if-match": '"2"' } }), env);
  assert.equal(removed.status, 204);

  const timestamp = new Date().toISOString();
  await env.CALLBOARD_DB.prepare("INSERT INTO events (id, slug, name, timezone, created_at, updated_at) VALUES (?1, ?2, ?3, 'UTC', ?4, ?4)").bind("event_foreign", "foreign", "Foreign event", timestamp).run();
  await env.CALLBOARD_DB.prepare("INSERT INTO cfp_forms (id, event_id, name, status, version, created_at, updated_at) VALUES (?1, ?2, ?3, 'published', 1, ?4, ?4)").bind("form_foreign", "event_foreign", "Foreign form", timestamp).run();
  const crossEvent = await worker.fetch(api("/api/submissions", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ formId: "form_foreign", title: "Cross-event attempt" }),
  }), env);
  assert.equal(crossEvent.status, 400);
  assert.equal((await body(crossEvent)).error, "INVALID_EVENT_REFERENCE");
});

test("normalized organizer collections persist people, agenda, tasks, resources, and file metadata", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const personResponse = await worker.fetch(api("/api/people", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Speaker Two", email: "speaker-two@example.test", role: "Speaker", bio: "Systems builder" }),
  }), env);
  assert.equal(personResponse.status, 201);
  const person = (await body(personResponse)).item;

  const resources = [
    ["submissions", { title: "Reliable evaluations proposal", status: "pending", participantIds: [person.id] }],
    ["sessions", { title: "Reliable evaluations", status: "scheduled", room: "A", track: "Agents", participantIds: [person.id] }],
    ["tasks", { title: "Upload slides", status: "open", kind: "file", instructions: "Upload a 16:9 PDF.", assigneePersonId: person.id }],
    ["file-requests", { title: "Final presentation deck", type: "Submission", instructions: "Upload the reviewed PDF." }],
    ["portal-forms", { name: "Speaker contact update", title: "Update your speaker profile", type: "Contact", schema: { questions: [{ id: "bio", label: "Biography" }] } }],
    ["resources", { title: "Speaker guide", kind: "article", audience: "speaker", content: "Arrive early." }],
    ["files", { name: "slides.pdf", mimeType: "application/pdf", sizeBytes: 2048, kind: "slides", ownerPersonId: person.id, status: "pending" }],
  ];

  for (const [resource, payload] of resources) {
    const created = await worker.fetch(api(`/api/${resource}`, { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify(payload) }), env);
    assert.equal(created.status, 201, resource);
    const item = (await body(created)).item;
    assert.equal(item.version, 1, resource);
    if (["submissions", "sessions"].includes(resource)) assert.deepEqual(item.participantIds, [person.id]);
    if (resource === "tasks") assert.equal(item.instructions, "Upload a 16:9 PDF.");
    const listed = await worker.fetch(api(`/api/${resource}`, { headers: { cookie: organizer.cookie } }), env);
    const listedItems = (await body(listed)).items;
    assert.deepEqual(listedItems.map((entry) => entry.id), [item.id], resource);
    if (["submissions", "sessions"].includes(resource)) assert.deepEqual(listedItems[0].participantIds, [person.id]);
  }
});

test("agenda conflicts are deterministic, explainable, and disappear after a shared move", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const personResponse = await worker.fetch(api("/api/people", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Shared Speaker", email: "shared-speaker@example.test", role: "Speaker" }),
  }), env);
  const person = (await body(personResponse)).item;
  const firstResponse = await worker.fetch(api("/api/sessions", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Opening agents", status: "accepted", room: "Main Stage", track: "Agents", startsAt: "2026-10-12T18:00:00.000Z", endsAt: "2026-10-12T19:00:00.000Z", participantIds: [person.id] }),
  }), env);
  const secondResponse = await worker.fetch(api("/api/sessions", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Production agents", status: "accepted", room: "Main Stage", track: "Agents", startsAt: "2026-10-12T18:30:00.000Z", endsAt: "2026-10-12T19:30:00.000Z", participantIds: [person.id] }),
  }), env);
  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  const second = (await body(secondResponse)).item;

  const conflictsResponse = await worker.fetch(api("/api/agenda-conflicts", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(conflictsResponse.status, 200);
  const conflicts = (await body(conflictsResponse)).items;
  assert.deepEqual(conflicts.map((item) => item.type), ["room", "participant", "track"]);
  assert.ok(conflicts.every((item) => item.sessionIds.length === 2 && item.rule));
  assert.deepEqual(conflicts.find((item) => item.type === "participant").participantIds, [person.id]);

  const movedResponse = await worker.fetch(api(`/api/sessions/${second.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": `"${second.version}"` },
    body: JSON.stringify({ startsAt: "2026-10-12T19:00:00.000Z", endsAt: "2026-10-12T20:00:00.000Z" }),
  }), env);
  assert.equal(movedResponse.status, 200);
  const resolvedResponse = await worker.fetch(api("/api/agenda-conflicts", { headers: { cookie: organizer.cookie } }), env);
  assert.deepEqual((await body(resolvedResponse)).items, []);

  const reviewerGrant = await createGrant(env, organizer.cookie, "reviewer", "agenda-reviewer@example.test", "Agenda Reviewer");
  const reviewer = await redeemGrant(env, reviewerGrant.grantToken);
  const reviewerResponse = await worker.fetch(api("/api/agenda-conflicts", { headers: { cookie: reviewer.cookie } }), env);
  assert.equal(reviewerResponse.status, 403);
});

test("preview-only communications persist without opening a provider boundary", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const seeded = await worker.fetch(api("/api/communication-reminders", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(seeded.status, 200);
  const reminders = (await body(seeded)).items;
  assert.equal(reminders.length, 3);

  const templateResponse = await worker.fetch(api("/api/communication-templates", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Speaker update", category: "Custom", segment: "accepted-speakers", subject: "Synthetic update", body: "Preview only.", attachCalendar: 1 }),
  }), env);
  assert.equal(templateResponse.status, 201);
  const template = (await body(templateResponse)).item;
  assert.equal(template.attachCalendar, 1);

  const reminderUpdate = await worker.fetch(api(`/api/communication-reminders/${reminders[0].id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ enabled: 0 }),
  }), env);
  assert.equal(reminderUpdate.status, 200);
  assert.equal((await body(reminderUpdate)).item.enabled, 0);

  const previewResponse = await worker.fetch(api("/api/communication-previews", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ action: "send", status: "Queued · dry run", provider: "Shared preview only", templateId: template.id, templateName: template.name, segment: template.segment, recipientCount: 1, recipients: [{ email: "synthetic@example.test" }], subject: template.subject, body: template.body, attachCalendar: 1, exactPayload: { networkIntent: false } }),
  }), env);
  assert.equal(previewResponse.status, 201);
  const preview = (await body(previewResponse)).item;
  assert.deepEqual(preview.exactPayload, { networkIntent: false });
  assert.equal(preview.provider, "Shared preview only");

  const exactPayload = {
    schemaVersion: 1,
    releaseMode: "test-allowlist",
    deliveryMode: "preview-only",
    networkIntent: false,
    action: "schedule",
    from: { name: "Event Operations Test Notifications", email: "eventops-notifications-test@opencallboard.invalid" },
    replyTo: { name: "Event Operations Test Notifications", email: "eventops-notifications-test@opencallboard.invalid" },
    to: [{ id: "eventops-speaker-test", role: "speaker", name: "Event Operations Test Speaker", email: "eventops-speaker-test@opencallboard.invalid" }],
    subject: "Synthetic schedule update",
    text: "This is a synthetic preview. Nothing is transmitted.",
    scheduledFor: "2026-09-30T16:00:00.000Z",
    attachments: [{ kind: "calendar", filename: "callboard-test-session.ics", contentDisposition: "attachment", previewOnly: true }],
    safety: { syntheticContentOnly: true, recipientAllowlistEnforced: true, outboundEnabled: false },
    calendar: { uid: "session-synthetic@callboard.local", method: "REQUEST", sequence: 1, status: "CONFIRMED", start: "2026-10-12T16:00:00.000Z", end: "2026-10-12T17:00:00.000Z", location: "Test Room A" },
  };
  const missingKey = await worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ action: "schedule", templateName: "Session scheduled", segment: "accepted-speakers", exactPayload }),
  }), env);
  assert.equal(missingKey.status, 400);
  assert.equal((await body(missingKey)).error, "IDEMPOTENCY_KEY_REQUIRED");

  const unauthorizedRecipient = structuredClone(exactPayload);
  unauthorizedRecipient.to[0] = { id: "outside", role: "speaker", name: "Outside", email: "outside@example.test" };
  const blocked = await worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "blocked-recipient", action: "schedule", templateName: "Session scheduled", segment: "accepted-speakers", exactPayload: unauthorizedRecipient }),
  }), env);
  assert.equal(blocked.status, 400);
  assert.equal((await body(blocked)).error, "RECIPIENT_NOT_ALLOWLISTED");

  const createOutbox = () => worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "calendar-update-1", action: "schedule", templateId: template.id, templateName: "Session scheduled", segment: "accepted-speakers", exactPayload }),
  }), env);
  const outboxResponse = await createOutbox();
  assert.equal(outboxResponse.status, 201);
  const outbox = await body(outboxResponse);
  assert.equal(outbox.item.status, "scheduled_preview");
  assert.equal(outbox.item.provider, "none");
  assert.equal(outbox.item.attemptCount, 0);
  assert.equal(outbox.attempt.status, "not_dispatched");
  assert.equal(outbox.calendar.sequence, 1);

  const replayResponse = await createOutbox();
  assert.equal(replayResponse.status, 200);
  const replay = await body(replayResponse);
  assert.equal(replay.replayed, true);
  assert.equal(replay.item.id, outbox.item.id);

  const attemptsResponse = await worker.fetch(api(`/api/communication-outbox/${outbox.item.id}/attempts`, { headers: { cookie: organizer.cookie } }), env);
  assert.equal(attemptsResponse.status, 200);
  assert.deepEqual((await body(attemptsResponse)).items.map((item) => [item.attemptNumber, item.mode, item.status, item.provider]), [[0, "preview", "not_dispatched", "none"]]);

  const cancellationPayload = structuredClone(exactPayload);
  cancellationPayload.action = "send";
  cancellationPayload.scheduledFor = null;
  cancellationPayload.calendar = { ...cancellationPayload.calendar, method: "CANCEL", sequence: 2, status: "CANCELLED" };
  const cancellationResponse = await worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "calendar-cancel-2", action: "send", templateName: "Session cancelled", segment: "accepted-speakers", exactPayload: cancellationPayload }),
  }), env);
  assert.equal(cancellationResponse.status, 201);
  assert.deepEqual(Object.fromEntries(Object.entries((await body(cancellationResponse)).calendar).filter(([key]) => ["method", "sequence", "status"].includes(key))), { method: "CANCEL", sequence: 2, status: "CANCELLED" });

  const stalePayload = structuredClone(exactPayload);
  stalePayload.calendar.location = "Stale room";
  const staleResponse = await worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "calendar-stale-1", action: "schedule", templateName: "Stale update", segment: "accepted-speakers", exactPayload: stalePayload }),
  }), env);
  assert.equal(staleResponse.status, 201);
  const canonical = (await body(staleResponse)).calendar;
  assert.deepEqual({ method: canonical.method, sequence: canonical.sequence, status: canonical.status, location: canonical.location }, { method: "CANCEL", sequence: 2, status: "CANCELLED", location: "Test Room A" });
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT COUNT(*) AS count FROM communication_outbox").get().count, 3);
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT COUNT(*) AS count FROM communication_delivery_attempts").get().count, 3);

  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "communications-speaker@example.test", "Communications Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  for (const resource of ["communication-templates", "communication-reminders", "communication-previews", "communication-outbox"]) {
    const denied = await worker.fetch(api(`/api/${resource}`, { headers: { cookie: speaker.cookie } }), env);
    assert.equal(denied.status, 403, resource);
  }
});

test("scheduled reminder evaluation materializes shared previews once without provider intent", async (t) => {
  const env = testEnv({ CALLBOARD_REMINDER_AUTOMATION_ENABLED: "true" });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  await env.CALLBOARD_DB.prepare("UPDATE events SET starts_at = ?1 WHERE id = ?2").bind("2026-10-12T16:00:00.000Z", organizer.payload.eventId).run();

  const personResponse = await worker.fetch(api("/api/people", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Synthetic Reminder Speaker", email: "eventops-speaker-test@opencallboard.invalid", role: "Speaker" }),
  }), env);
  assert.equal(personResponse.status, 201);
  const person = (await body(personResponse)).item;
  const taskResponse = await worker.fetch(api("/api/tasks", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ assigneePersonId: person.id, title: "Upload synthetic slides", status: "open", dueAt: "2026-10-10T16:00:00.000Z" }),
  }), env);
  assert.equal(taskResponse.status, 201);

  const evaluatedAt = "2026-10-08T16:00:00.000Z";
  const first = await worker.scheduled({ scheduledTime: Date.parse(evaluatedAt) }, env);
  assert.equal(first.configured, true);
  assert.equal(first.evaluatedAt, evaluatedAt);
  assert.equal(first.items.length, 2);
  assert.ok(first.items.every((result) => result.replayed === false));
  assert.deepEqual(first.items.map((result) => result.item.status), ["materialized_preview", "materialized_preview"]);
  assert.ok(first.items.every((result) => result.item.matchedRecipientCount === 1 && result.item.networkIntent === false));

  const outboxRows = env.CALLBOARD_DB.database.prepare("SELECT action, status, provider, exact_payload_json FROM communication_outbox ORDER BY id").all();
  assert.equal(outboxRows.length, 2);
  for (const row of outboxRows) {
    assert.equal(row.action, "automation");
    assert.equal(row.status, "scheduled_preview");
    assert.equal(row.provider, "none");
    const exactPayload = JSON.parse(row.exact_payload_json);
    assert.equal(exactPayload.networkIntent, false);
    assert.equal(exactPayload.deliveryMode, "preview-only");
    assert.equal(exactPayload.to[0].email, "eventops-speaker-test@opencallboard.invalid");
    assert.equal(exactPayload.from.email, "eventops-notifications-test@opencallboard.invalid");
  }
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT COUNT(*) AS count FROM communication_delivery_attempts WHERE mode = 'preview' AND status = 'not_dispatched' AND provider = 'none'").get().count, 2);
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT SUM(network_intent) AS total FROM communication_reminder_runs").get().total, 0);

  const replay = await worker.scheduled({ scheduledTime: Date.parse(evaluatedAt) }, env);
  assert.equal(replay.items.length, 2);
  assert.ok(replay.items.every((result) => result.replayed === true));
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT COUNT(*) AS count FROM communication_outbox").get().count, 2);

  const runsResponse = await worker.fetch(api("/api/communication-reminder-runs", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(runsResponse.status, 200);
  const runs = (await body(runsResponse)).items;
  assert.equal(runs.length, 2);
  assert.ok(runs.every((run) => run.outboxId && run.networkIntent === false));
});

test("scheduled reminder live delivery queues capped SES jobs only for event people", async (t) => {
  const queue = new MemoryQueue();
  const env = testEnv({
    CALLBOARD_REMINDER_AUTOMATION_ENABLED: "true",
    CALLBOARD_REMINDER_LIVE_DELIVERY_ENABLED: "true",
    CALLBOARD_EMAIL_RELEASE_ENABLED: "true",
    CALLBOARD_EMAIL_QUEUE: queue,
    CALLBOARD_EMAIL_DAILY_CAP: "1",
    CALLBOARD_AUTH_SENDER_EMAIL: "hello@opencallboard.com",
    CALLBOARD_EMAIL_PROVIDER: "ses",
    CALLBOARD_SES_REGION: "us-east-1",
    CALLBOARD_SES_ACCESS_KEY_ID: "AKIATEST",
    CALLBOARD_SES_SECRET_ACCESS_KEY: "ses-test-secret",
    CALLBOARD_PUBLIC_ORIGIN: "https://app.opencallboard.com",
  });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  await env.CALLBOARD_DB.prepare("UPDATE events SET starts_at = ?1 WHERE id = ?2")
    .bind("2026-10-12T16:00:00.000Z", organizer.payload.eventId)
    .run();

  const member = await worker.fetch(api("/api/people", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Event Speaker", email: "eventops-speaker-test@opencallboard.invalid", role: "Speaker" }),
  }), env);
  assert.equal(member.status, 201);
  const person = (await body(member)).item;
  const task = await worker.fetch(api("/api/tasks", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ assigneePersonId: person.id, title: "Upload slides", status: "open", dueAt: "2026-10-10T16:00:00.000Z" }),
  }), env);
  assert.equal(task.status, 201);

  const evaluatedAt = "2026-10-08T16:00:00.000Z";
  const evaluation = await worker.scheduled({ scheduledTime: Date.parse(evaluatedAt) }, env);
  assert.equal(evaluation.configured, true);
  assert.equal(queue.messages.length, 1);
  const outbox = env.CALLBOARD_DB.database.prepare("SELECT status, provider, exact_payload_json FROM communication_outbox").get();
  assert.equal(outbox.status, "queued_for_delivery");
  assert.equal(outbox.provider, "ses");
  const exact = JSON.parse(outbox.exact_payload_json);
  assert.equal(exact.to.length, 1);
  assert.equal(exact.to[0].id, person.id);
  assert.equal(exact.to[0].email, "eventops-speaker-test@opencallboard.invalid");
  assert.equal(exact.from.email, "hello@opencallboard.com");
  assert.equal(exact.deliveryMode, "live");
  assert.equal(exact.networkIntent, true);
  assert.match(exact.text, /https:\/\/app\.opencallboard\.com\/#\/speaker-portal/);
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT COUNT(*) AS count FROM communication_outbox").get().count, 1);
  assert.equal(env.CALLBOARD_DB.database.prepare("SELECT SUM(network_intent) AS total FROM communication_reminder_runs").get().total, 1);
});

test("one-time Gmail release queues and sends only the exact synthetic canary", async (t) => {
  const queue = new MemoryQueue();
  const providerCalls = [];
  const env = testEnv({
    CALLBOARD_EMAIL_RELEASE_ENABLED: "true",
    CALLBOARD_EMAIL_UI_RELEASE_ENABLED: "true",
    CALLBOARD_EMAIL_RELEASE_KEY: "email-release-test-key",
    CALLBOARD_EMAIL_QUEUE: queue,
    CALLBOARD_GMAIL_CREDENTIALS: JSON.stringify({
      mode: "oauth-refresh-token",
      clientId: "synthetic-oauth-client-id",
      clientSecret: "synthetic-oauth-client-secret",
      refreshToken: "synthetic-oauth-refresh-token",
      senderEmail: "eventops-notifications-test@opencallboard.invalid",
    }),
    CALLBOARD_PROVIDER_FETCH: async (url, init) => {
      providerCalls.push({ url: String(url), init });
      if (String(url) === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-gmail-access-token", token_type: "Bearer", expires_in: 3600 });
      if (String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") return Response.json({ id: "gmail-synthetic-message-1", threadId: "gmail-synthetic-thread-1" });
      return new Response("unexpected provider URL", { status: 500 });
    },
  });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const exactPayload = {
    schemaVersion: 1,
    releaseMode: "test-allowlist",
    deliveryMode: "preview-only",
    networkIntent: false,
    action: "send",
    from: { name: "Event Operations Test Notifications", email: "eventops-notifications-test@opencallboard.invalid" },
    replyTo: { name: "Event Operations Test Notifications", email: "eventops-notifications-test@opencallboard.invalid" },
    to: [{ id: "eventops-speaker-test", role: "speaker", name: "Event Operations Test Speaker", email: "eventops-speaker-test@opencallboard.invalid" }],
    subject: "Synthetic Callboard calendar canary",
    text: "Synthetic test only. This message contains no customer, repository, credential, or private project information.",
    scheduledFor: null,
    attachments: [{ kind: "calendar", filename: "callboard-test-session.ics", contentDisposition: "attachment", previewOnly: true }],
    safety: { syntheticContentOnly: true, recipientAllowlistEnforced: true, outboundEnabled: false },
    calendar: { uid: "session-synthetic@callboard.local", method: "REQUEST", sequence: 1, status: "CONFIRMED", start: "2026-10-12T16:00:00.000Z", end: "2026-10-12T17:00:00.000Z", location: "Synthetic Test Room A" },
  };
  const outboxResponse = await worker.fetch(api("/api/communication-outbox", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "synthetic-gmail-canary-1", action: "send", templateName: "Synthetic canary", segment: "accepted-speakers", exactPayload }),
  }), env);
  assert.equal(outboxResponse.status, 201);
  const outbox = (await body(outboxResponse)).item;
  assert.equal(outbox.status, "prepared_preview");

  const storedOutbox = await env.CALLBOARD_DB.prepare("SELECT exact_payload_json FROM communication_outbox WHERE id = ?1").bind(outbox.id).first();
  const exactPayloadHash = createHash("sha256").update(storedOutbox.exact_payload_json).digest("hex");
  const wrongKey = await worker.fetch(api(`/api/communication-outbox/${outbox.id}/release-approval`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "x-callboard-email-release-key": "wrong" },
    body: JSON.stringify({ confirm: "release-one-synthetic-email", exactPayloadHash }),
  }), env);
  assert.equal(wrongKey.status, 401);
  assert.equal(queue.messages.length, 0);

  const wrongHash = await worker.fetch(api(`/api/communication-outbox/${outbox.id}/release-approval`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "x-callboard-email-release-key": env.CALLBOARD_EMAIL_RELEASE_KEY },
    body: JSON.stringify({ confirm: "release-one-synthetic-email", exactPayloadHash: "0".repeat(64) }),
  }), env);
  assert.equal(wrongHash.status, 409);
  assert.equal(queue.messages.length, 0);

  const releaseResponse = await worker.fetch(api(`/api/communication-outbox/${outbox.id}/release-approval`, {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ confirm: "release-one-synthetic-email-from-ui" }),
  }), env);
  assert.equal(releaseResponse.status, 202);
  const release = await body(releaseResponse);
  assert.equal(release.queued, true);
  assert.equal(release.providerNetworkIntent, false);
  assert.equal(release.item.recipientEmail, "eventops-speaker-test@opencallboard.invalid");
  assert.equal(Object.hasOwn(release, "approvalToken"), false);
  assert.equal(queue.messages.length, 1);
  assert.match(queue.messages[0].approvalToken, /^cbr_/);
  const storedApproval = await env.CALLBOARD_DB.prepare("SELECT approval_hash, exact_payload_hash, status FROM communication_release_approvals WHERE id = ?1").bind(release.item.id).first();
  assert.equal(storedApproval.approval_hash.length, 64);
  assert.equal(storedApproval.approval_hash.includes(queue.messages[0].approvalToken), false);
  assert.equal(storedApproval.exact_payload_hash, exactPayloadHash);
  assert.equal(storedApproval.status, "queued");

  const duplicateRelease = await worker.fetch(api(`/api/communication-outbox/${outbox.id}/release-approval`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "x-callboard-email-release-key": env.CALLBOARD_EMAIL_RELEASE_KEY },
    body: JSON.stringify({ confirm: "release-one-synthetic-email", exactPayloadHash }),
  }), env);
  assert.equal(duplicateRelease.status, 409);
  assert.equal(queue.messages.length, 1);

  let acknowledged = 0;
  let retried = 0;
  const queueMessage = { body: queue.messages[0], ack: () => { acknowledged += 1; }, retry: () => { retried += 1; } };
  await worker.queue({ messages: [queueMessage] }, env);
  assert.equal(acknowledged, 1);
  assert.equal(retried, 0);
  assert.equal(providerCalls.length, 2);
  const oauthRefreshRequest = new URLSearchParams(providerCalls[0].init.body);
  assert.equal(oauthRefreshRequest.get("grant_type"), "refresh_token");
  assert.equal(oauthRefreshRequest.get("client_id"), "synthetic-oauth-client-id");
  assert.equal(oauthRefreshRequest.get("client_secret"), "synthetic-oauth-client-secret");
  assert.equal(oauthRefreshRequest.get("refresh_token"), "synthetic-oauth-refresh-token");
  const gmailRequest = JSON.parse(providerCalls[1].init.body);
  const mime = Buffer.from(gmailRequest.raw.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8");
  assert.match(mime, /eventops-notifications-test@opencallboard\.invalid/);
  assert.match(mime, /eventops-speaker-test@opencallboard\.invalid/);
  assert.match(mime, /Content-Type: text\/calendar/);
  assert.match(mime, /Message-ID: <communication_outbox_/);
  assert.equal(mime.includes("synthetic-gmail-access-token"), false);

  const deliveredResponse = await worker.fetch(api(`/api/communication-outbox/${outbox.id}`, { headers: { cookie: organizer.cookie } }), env);
  const delivered = (await body(deliveredResponse)).item;
  assert.equal(delivered.status, "sent_test");
  assert.equal(delivered.provider, "gmail");
  assert.equal(delivered.providerMessageId, "gmail-synthetic-message-1");
  assert.equal(delivered.attemptCount, 1);
  const completedApproval = await env.CALLBOARD_DB.prepare("SELECT status, active_slot FROM communication_release_approvals WHERE id = ?1").bind(release.item.id).first();
  assert.equal(completedApproval.status, "succeeded");
  assert.equal(completedApproval.active_slot, null);
  const attempts = await body(await worker.fetch(api(`/api/communication-outbox/${outbox.id}/attempts`, { headers: { cookie: organizer.cookie } }), env));
  assert.deepEqual(attempts.items.map((item) => [item.attemptNumber, item.mode, item.status, item.provider]), [[1, "live_test", "succeeded", "gmail"], [0, "preview", "not_dispatched", "none"]]);

  await worker.queue({ messages: [{ ...queueMessage, ack: () => { acknowledged += 1; } }] }, env);
  assert.equal(providerCalls.length, 2);
  assert.equal(acknowledged, 2);
});

test("organizer can send one SES message only to a person in the event", async (t) => {
  const queue = new MemoryQueue();
  const providerCalls = [];
  const env = testEnv({
    CALLBOARD_EMAIL_RELEASE_ENABLED: "true",
    CALLBOARD_EMAIL_UI_RELEASE_ENABLED: "true",
    CALLBOARD_EMAIL_QUEUE: queue,
    CALLBOARD_AUTH_SENDER_EMAIL: "hello@opencallboard.com",
    CALLBOARD_SES_ACCESS_KEY_ID: "AKIATESTACCESSKEY",
    CALLBOARD_SES_SECRET_ACCESS_KEY: "test-secret-access-key",
    CALLBOARD_SES_REGION: "us-east-1",
    CALLBOARD_EMAIL_DAILY_CAP: "5",
    CALLBOARD_PROVIDER_FETCH: async (url, init) => {
      providerCalls.push({ url: String(url), init });
      return Response.json({ MessageId: "ses-event-message-1" });
    },
  });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const createdPerson = await worker.fetch(api("/api/people", {
    method: "POST", headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Event Speaker", email: "speaker@example.test", role: "Speaker" }),
  }), env);
  const person = (await body(createdPerson)).item;
  const exactPayload = {
    schemaVersion: 1, releaseMode: "event-members", deliveryMode: "live", networkIntent: true,
    action: "send",
    from: { name: "AI Engineer", email: "hello@opencallboard.com" },
    replyTo: { name: "AI Engineer", email: "hello@opencallboard.com" },
    to: [{ id: person.id, role: person.role, name: person.name, email: person.email }],
    subject: "Your proposal was accepted", text: "We are excited to welcome you.",
    scheduledFor: null, attachments: [],
    safety: { recipientAllowlistEnforced: true, outboundEnabled: true },
  };
  const outside = structuredClone(exactPayload);
  outside.to[0] = { id: "outside", role: "Speaker", name: "Outside", email: "outside@example.test" };
  const blocked = await worker.fetch(api("/api/communication-outbox", {
    method: "POST", headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "outside-1", action: "send", templateName: "Acceptance", segment: "accepted-speakers", exactPayload: outside }),
  }), env);
  assert.equal(blocked.status, 403);
  assert.equal((await body(blocked)).error, "RECIPIENT_NOT_EVENT_MEMBER");

  const preparedResponse = await worker.fetch(api("/api/communication-outbox", {
    method: "POST", headers: { cookie: organizer.cookie },
    body: JSON.stringify({ idempotencyKey: "member-1", action: "send", templateName: "Acceptance", segment: "accepted-speakers", exactPayload }),
  }), env);
  assert.equal(preparedResponse.status, 201);
  const prepared = (await body(preparedResponse)).item;
  assert.equal(prepared.status, "prepared_live");
  const releasedResponse = await worker.fetch(api(`/api/communication-outbox/${prepared.id}/release-approval`, {
    method: "POST", headers: { cookie: organizer.cookie },
    body: JSON.stringify({ confirm: "release-one-event-member-email-from-ui" }),
  }), env);
  assert.equal(releasedResponse.status, 202);
  const released = await body(releasedResponse);
  assert.equal(released.providerNetworkIntent, true);
  assert.equal(released.item.recipientEmail, "speaker@example.test");
  assert.equal(queue.messages.length, 1);

  let acknowledged = 0;
  await worker.queue({ messages: [{ body: queue.messages[0], ack: () => { acknowledged += 1; }, retry: () => {} }] }, env);
  assert.equal(acknowledged, 1);
  assert.equal(providerCalls.length, 1);
  const providerPayload = JSON.parse(providerCalls[0].init.body);
  assert.deepEqual(providerPayload.Destination.ToAddresses, ["speaker@example.test"]);
  const delivered = await body(await worker.fetch(api(`/api/communication-outbox/${prepared.id}`, { headers: { cookie: organizer.cookie } }), env));
  assert.equal(delivered.item.status, "sent");
  assert.equal(delivered.item.provider, "ses");
  assert.equal(delivered.item.providerMessageId, "ses-event-message-1");
});

test("one-time grants establish speaker and reviewer role boundaries", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const formResponse = await worker.fetch(api("/api/forms", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Speaker CFP", status: "published", schema: {} }),
  }), env);
  const form = (await body(formResponse)).item;

  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "speaker@example.test", "Speaker One");
  assert.ok(speakerGrant.personId);
  assert.ok(speakerGrant.userId);
  const provisionedSpeaker = await env.CALLBOARD_DB.prepare(
    "SELECT name, role FROM people WHERE event_id = ?1 AND id = ?2",
  ).bind(organizer.payload.eventId, speakerGrant.personId).first();
  assert.equal(provisionedSpeaker.name, "Speaker One");
  assert.equal(provisionedSpeaker.role, "Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  assert.equal(speaker.payload.role, "speaker");

  const reused = await worker.fetch(api("/api/session", { method: "POST", body: JSON.stringify({ grantToken: speakerGrant.grantToken }) }), env);
  assert.equal(reused.status, 401);

  const forbiddenForm = await worker.fetch(api("/api/forms", {
    method: "POST",
    headers: { cookie: speaker.cookie },
    body: JSON.stringify({ name: "Unauthorized form" }),
  }), env);
  assert.equal(forbiddenForm.status, 403);

  const submissionResponse = await worker.fetch(api("/api/submissions", {
    method: "POST",
    headers: { cookie: speaker.cookie },
    body: JSON.stringify({ formId: form.id, title: "Trustworthy agent systems", abstract: "A practical session." }),
  }), env);
  assert.equal(submissionResponse.status, 201);
  const submission = (await body(submissionResponse)).item;
  assert.equal(submission.submitterPersonId, speaker.payload.personId);
  assert.equal(submission.status, "draft");

  const unassignedResponse = await worker.fetch(api("/api/submissions", {
    method: "POST",
    headers: { cookie: speaker.cookie },
    body: JSON.stringify({ formId: form.id, title: "Unassigned proposal" }),
  }), env);
  assert.equal(unassignedResponse.status, 201);

  const fileResponse = await worker.fetch(api("/api/files", {
    method: "POST",
    headers: { cookie: speaker.cookie },
    body: JSON.stringify({ name: "headshot.png", mimeType: "image/png", sizeBytes: 12345, kind: "headshot" }),
  }), env);
  assert.equal(fileResponse.status, 201);
  assert.equal((await body(fileResponse)).item.ownerPersonId, speaker.payload.personId);

  const requestResponse = await worker.fetch(api("/api/file-requests", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Upload final deck", type: "Contact", assigneePersonId: speaker.payload.personId, instructions: "PDF only", dueAt: "2026-10-11T20:00:00Z" }),
  }), env);
  assert.equal(requestResponse.status, 201);
  const speakerRequests = await worker.fetch(api("/api/file-requests", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerRequests.status, 200);
  assert.deepEqual((await body(speakerRequests)).items.map((item) => item.title), ["Upload final deck"]);
  const speakerPortalForms = await worker.fetch(api("/api/portal-forms", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerPortalForms.status, 200);
  assert.deepEqual((await body(speakerPortalForms)).items, []);

  const reviewerGrant = await createGrant(env, organizer.cookie, "reviewer", "reviewer@example.test", "Reviewer One");
  const reviewersBeforeRedeem = await worker.fetch(api("/api/reviewers", { headers: { cookie: organizer.cookie } }), env);
  assert.deepEqual((await body(reviewersBeforeRedeem)).items.map((item) => item.email), ["reviewer@example.test"]);
  const reviewer = await redeemGrant(env, reviewerGrant.grantToken);
  const reviewerRequests = await worker.fetch(api("/api/file-requests", { headers: { cookie: reviewer.cookie } }), env);
  assert.equal(reviewerRequests.status, 403);
  const reviewResponse = await worker.fetch(api("/api/reviews", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ submissionId: submission.id, reviewerUserId: reviewer.payload.userId, round: 1, scores: {} }),
  }), env);
  assert.equal(reviewResponse.status, 201);
  const review = (await body(reviewResponse)).item;

  const assigned = await worker.fetch(api("/api/submissions", { headers: { cookie: reviewer.cookie } }), env);
  assert.deepEqual((await body(assigned)).items.map((item) => item.id), [submission.id]);

  const scored = await worker.fetch(api(`/api/reviews/${review.id}`, {
    method: "PATCH",
    headers: { cookie: reviewer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ scores: { relevance: 5, clarity: 4 }, totalScore: 4.5, recommendation: "advance", status: "submitted" }),
  }), env);
  assert.equal(scored.status, 200);
  assert.equal((await body(scored)).item.totalScore, 4.5);

  const speakerReviews = await worker.fetch(api("/api/reviews", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerReviews.status, 403);
});

test("portal resources preserve sandboxed HTML and enforce accepted-speaker audiences", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "resource-speaker@example.test", "Resource Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const reviewerGrant = await createGrant(env, organizer.cookie, "reviewer", "resource-reviewer@example.test", "Resource Reviewer");
  const reviewer = await redeemGrant(env, reviewerGrant.grantToken);

  const html = '<article><h2>Speaker checklist</h2><script>top.location="https://example.test"</script></article>';
  const createResource = async (title, audience) => {
    const response = await worker.fetch(api("/api/resources", {
      method: "POST",
      headers: { cookie: organizer.cookie },
      body: JSON.stringify({ title, kind: "HTML Embed", audience, content: title === "Portal checklist" ? html : "Accepted preparation" }),
    }), env);
    assert.equal(response.status, 201);
    return (await body(response)).item;
  };
  const portalResource = await createResource("Portal checklist", "All portal users");
  const acceptedResource = await createResource("Accepted guide", "Accepted speakers");

  const speakerBefore = await worker.fetch(api("/api/resources", { headers: { cookie: speaker.cookie } }), env);
  assert.deepEqual((await body(speakerBefore)).items.map((item) => item.id), [portalResource.id]);
  const reviewerResources = await worker.fetch(api("/api/resources", { headers: { cookie: reviewer.cookie } }), env);
  assert.deepEqual((await body(reviewerResources)).items.map((item) => item.id), [portalResource.id]);

  const acceptedSessionResponse = await worker.fetch(api("/api/sessions", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Accepted resource proof", status: "Accepted", participantIds: [speaker.payload.personId] }),
  }), env);
  assert.equal(acceptedSessionResponse.status, 201);

  const speakerAfter = await worker.fetch(api("/api/resources", { headers: { cookie: speaker.cookie } }), env);
  const visible = (await body(speakerAfter)).items;
  assert.deepEqual(new Set(visible.map((item) => item.id)), new Set([portalResource.id, acceptedResource.id]));
  assert.equal(visible.find((item) => item.id === portalResource.id).content, html);
  assert.equal(visible.find((item) => item.id === portalResource.id).kind, "HTML Embed");
});

test("private object files are owner scoped, organizer readable, and reviewer denied", async (t) => {
  const bucket = new MemoryR2();
  const env = testEnv({ CALLBOARD_FILES: bucket });
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "file-speaker@example.test", "File Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const requestResponse = await worker.fetch(api("/api/file-requests", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ title: "Supporting document", type: "Contact", assigneePersonId: speaker.payload.personId }) }), env);
  const fileRequest = (await body(requestResponse)).item;

  const upload = await worker.fetch(api("/api/files/upload", {
    method: "POST",
    headers: { cookie: speaker.cookie, "content-type": "image/png", "x-callboard-file-name": encodeURIComponent("speaker-headshot.png"), "x-callboard-file-kind": "Headshot", "x-callboard-file-request-id": fileRequest.id, "x-callboard-file-size": String(Buffer.byteLength("Synthetic file content")) },
    body: "Synthetic file content",
  }), env);
  assert.equal(upload.status, 201);
  const file = (await body(upload)).item;
  assert.equal(file.ownerPersonId, speaker.payload.personId);
  assert.equal(file.fileRequestId, fileRequest.id);
  assert.equal(file.status, "uploaded");
  assert.equal(bucket.objects.size, 1);
  const completedRequest = await worker.fetch(api(`/api/file-requests/${fileRequest.id}`, { headers: { cookie: speaker.cookie } }), env);
  assert.equal(completedRequest.status, 200);
  assert.equal((await body(completedRequest)).item.status, "completed");
  const updatedSpeaker = await worker.fetch(api(`/api/people/${speaker.payload.personId}`, { headers: { cookie: speaker.cookie } }), env);
  assert.equal((await body(updatedSpeaker)).item.headshotUrl, `/api/files/${file.id}/content`);

  const ownerDownload = await worker.fetch(api(`/api/files/${file.id}/content`, { headers: { cookie: speaker.cookie } }), env);
  assert.equal(ownerDownload.status, 200);
  assert.equal(await ownerDownload.text(), "Synthetic file content");
  assert.match(ownerDownload.headers.get("content-disposition"), /speaker-headshot\.png/);

  const otherGrant = await createGrant(env, organizer.cookie, "speaker", "other-speaker@example.test", "Other Speaker");
  const other = await redeemGrant(env, otherGrant.grantToken);
  const hiddenRequest = await worker.fetch(api("/api/file-requests", { headers: { cookie: other.cookie } }), env);
  assert.equal(hiddenRequest.status, 200);
  assert.deepEqual((await body(hiddenRequest)).items, []);
  const forbiddenUpload = await worker.fetch(api("/api/files/upload", {
    method: "POST",
    headers: { cookie: other.cookie, "content-type": "text/plain", "x-callboard-file-name": encodeURIComponent("intruder.txt"), "x-callboard-file-kind": "Supporting document", "x-callboard-file-request-id": fileRequest.id, "x-callboard-file-size": "1" },
    body: "x",
  }), env);
  assert.equal(forbiddenUpload.status, 403);
  assert.equal((await body(forbiddenUpload)).error, "FILE_REQUEST_NOT_ASSIGNED");
  const forbidden = await worker.fetch(api(`/api/files/${file.id}/content`, { headers: { cookie: other.cookie } }), env);
  assert.equal(forbidden.status, 403);

  const reviewerGrant = await createGrant(env, organizer.cookie, "reviewer", "file-reviewer@example.test", "File Reviewer");
  const reviewer = await redeemGrant(env, reviewerGrant.grantToken);
  const reviewerForbidden = await worker.fetch(api(`/api/files/${file.id}/content`, { headers: { cookie: reviewer.cookie } }), env);
  assert.equal(reviewerForbidden.status, 403);

  const organizerDownload = await worker.fetch(api(`/api/files/${file.id}/content`, { headers: { cookie: organizer.cookie } }), env);
  assert.equal(organizerDownload.status, 200);

  const removed = await worker.fetch(api(`/api/files/${file.id}`, { method: "DELETE", headers: { cookie: speaker.cookie, "if-match": '"1"' } }), env);
  assert.equal(removed.status, 204);
  assert.equal(bucket.objects.size, 0);
  const clearedSpeaker = await worker.fetch(api(`/api/people/${speaker.payload.personId}`, { headers: { cookie: speaker.cookie } }), env);
  assert.equal((await body(clearedSpeaker)).item.headshotUrl, null);
});

test("public embeds expose only enabled schedule and speaker projections", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const personResponse = await worker.fetch(api("/api/people", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ name: "Public Speaker", email: "private-speaker@example.test", role: "Speaker" }) }), env);
  const person = (await body(personResponse)).item;
  const sessionResponse = await worker.fetch(api("/api/sessions", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ title: "Published session", status: "accepted", room: "Main Stage", startsAt: "2026-10-12T11:00:00Z", participantIds: [person.id] }) }), env);
  const session = (await body(sessionResponse)).item;
  assert.deepEqual(session.participantIds, [person.id]);
  const draftSessionResponse = await worker.fetch(api("/api/sessions", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ title: "Private draft", status: "draft", room: "Hall B", startsAt: "2026-10-12T12:00:00Z", participantIds: [person.id] }) }), env);
  assert.equal(draftSessionResponse.status, 201);
  const embedResponse = await worker.fetch(api("/api/embeds", { method: "POST", headers: { cookie: organizer.cookie }, body: JSON.stringify({ name: "Public itinerary", format: "Styled HTML", enabled: 1, config: { view: "Schedule Itinerary", theme: "light", accent: "#2877c7", fields: { speakers: true } } }) }), env);
  assert.equal(embedResponse.status, 201);
  const embed = (await body(embedResponse)).item;

  const privateDraft = await worker.fetch(api(`/api/public/embeds/${embed.id}`), env);
  assert.equal(privateDraft.status, 404);
  assert.equal((await body(privateDraft)).error, "SCHEDULE_NOT_PUBLISHED");

  const releaseDraft = await worker.fetch(api("/api/schedule-release", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(releaseDraft.status, 200);
  assert.deepEqual((await body(releaseDraft)).item, { status: "draft", publishedAt: null, version: 0, updatedAt: null });
  const release = await worker.fetch(api("/api/schedule-release", { method: "PUT", headers: { cookie: organizer.cookie, "if-match": '"0"' }, body: JSON.stringify({ status: "published" }) }), env);
  assert.equal(release.status, 200);
  assert.equal((await body(release)).item.version, 1);
  const staleRelease = await worker.fetch(api("/api/schedule-release", { method: "PUT", headers: { cookie: organizer.cookie, "if-match": '"0"' }, body: JSON.stringify({ status: "draft" }) }), env);
  assert.equal(staleRelease.status, 409);

  const published = await worker.fetch(api(`/api/public/embeds/${embed.id}`), env);
  assert.equal(published.status, 200);
  const projection = await body(published);
  assert.equal(projection.embed.name, "Public itinerary");
  assert.equal(projection.sessions[0].title, "Published session");
  assert.equal(projection.sessions.length, 1);
  assert.deepEqual(projection.sessions[0].participants, [person.id]);
  assert.equal(projection.participants[0].name, "Public Speaker");
  assert.equal("email" in projection.participants[0], false);

  const disabled = await worker.fetch(api(`/api/embeds/${embed.id}`, { method: "PATCH", headers: { cookie: organizer.cookie, "if-match": '"1"' }, body: JSON.stringify({ enabled: 0 }) }), env);
  assert.equal(disabled.status, 200);
  const unavailable = await worker.fetch(api(`/api/public/embeds/${embed.id}`), env);
  assert.equal(unavailable.status, 404);
});

test("public CFP submission is atomic, multi-participant, idempotent, and organizer-visible", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  await env.CALLBOARD_DB.batch([
    env.CALLBOARD_DB.prepare("INSERT INTO users (id, email, name, created_at, updated_at) VALUES ('reviewer-routing-test', 'reviewer-routing@example.test', 'Routing Reviewer', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"),
    env.CALLBOARD_DB.prepare("INSERT INTO event_memberships (event_id, user_id, role, created_at) VALUES (?1, 'reviewer-routing-test', 'reviewer', CURRENT_TIMESTAMP)").bind(organizer.payload.eventId),
  ]);

  const formResponse = await worker.fetch(api("/api/forms", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({
      name: "Public CFP",
      status: "published",
      schema: {
        externalTitle: "Submit a Session",
        setLimit: true,
        submissionLimit: 2,
        participantRoles: [{ label: "Speaker", enabled: true, min: 1, max: 3 }],
        routingRules: [{ id: "agents-specialists", fieldId: "reviewer-audience", fieldLabel: "Reviewer audience", equals: "Specialists", destination: "Agents reviewer pool" }],
      },
    }),
  }), env);
  const form = (await body(formResponse)).item;

  const publicForm = await worker.fetch(api(`/api/public/forms/${form.id}`), env);
  assert.equal(publicForm.status, 200);
  assert.equal((await body(publicForm)).form.externalTitle, "Submit a Session");

  const requestPayload = {
    email: "primary@example.test",
    title: "Evaluation systems in practice",
    abstract: "A contained public submission.",
    category: "Agents",
    answers: { Format: "Talk", "reviewer-audience": "Specialists" },
    participants: [
      { email: "primary@example.test", name: "Primary Speaker", title: "Principal Engineer", company: "Example Labs", bio: "Primary bio" },
      { email: "additional@example.test", name: "Additional Speaker", title: "Staff Engineer", company: "Example Labs", bio: "Additional bio" },
    ],
  };
  const submitted = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: { "idempotency-key": "public-submit-proof-1" },
    body: JSON.stringify(requestPayload),
  }), env);
  assert.equal(submitted.status, 201);
  const submittedPayload = await body(submitted);
  const created = submittedPayload.item;
  assert.equal(created.status, "pending");
  assert.equal(created.reviewRoute, "Agents reviewer pool");
  assert.equal(created.routingRuleId, "agents-specialists");
  assert.equal(created.round, 1);
  assert.deepEqual(created.participants.map((person) => person.email), ["primary@example.test", "additional@example.test"]);
  assert.deepEqual(created.participants.map((person) => person.title), ["Principal Engineer", "Staff Engineer"]);
  assert.deepEqual(created.participants.map((person) => person.company), ["Example Labs", "Example Labs"]);
  assert.equal(submittedPayload.portalAccess.authenticated, true);
  assert.equal(submittedPayload.portalAccess.personId, created.submitterPersonId);
  const continuationCookie = cookie(submitted);
  assert.match(continuationCookie, /^callboard_session=/);
  const continuationSession = await worker.fetch(api("/api/session", { headers: { cookie: continuationCookie } }), env);
  const continuationSessionPayload = await body(continuationSession);
  assert.equal(continuationSessionPayload.role, "speaker");
  assert.equal(continuationSessionPayload.personId, created.submitterPersonId);
  const continuedSubmissions = await worker.fetch(api("/api/submissions", { headers: { cookie: continuationCookie } }), env);
  assert.deepEqual((await body(continuedSubmissions)).items.map((item) => item.id), [created.id]);

  const organizerSessionSubmission = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: {
      cookie: organizer.cookie,
      "idempotency-key": "organizer-session-preservation-proof",
    },
    body: JSON.stringify({
      email: "organizer-tab-speaker@example.test",
      title: "Public submission without replacing organizer access",
      participants: [{
        email: "organizer-tab-speaker@example.test",
        name: "Organizer Tab Speaker",
      }],
    }),
  }), env);
  assert.equal(organizerSessionSubmission.status, 201);
  assert.equal(cookie(organizerSessionSubmission), "");
  const organizerSessionSubmissionPayload = await body(organizerSessionSubmission);
  assert.deepEqual(organizerSessionSubmissionPayload.portalAccess, {
    authenticated: false,
    reason: "EXISTING_SESSION_PRESERVED",
  });
  const preservedOrganizerSession = await worker.fetch(api("/api/session", {
    headers: { cookie: organizer.cookie },
  }), env);
  assert.equal(preservedOrganizerSession.status, 200);
  assert.equal((await body(preservedOrganizerSession)).role, "organizer");

  const replayed = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: { "idempotency-key": "public-submit-proof-1" },
    body: JSON.stringify(requestPayload),
  }), env);
  assert.equal(replayed.status, 200);
  assert.equal((await body(replayed)).replayed, true);

  const organizerSubmissions = await worker.fetch(api("/api/submissions", { headers: { cookie: organizer.cookie } }), env);
  const organizerPeople = await worker.fetch(api("/api/people", { headers: { cookie: organizer.cookie } }), env);
  const organizerSubmissionItems = (await body(organizerSubmissions)).items;
  assert.deepEqual(new Set(organizerSubmissionItems.map((item) => item.id)), new Set([
    created.id,
    organizerSessionSubmissionPayload.item.id,
  ]));
  const organizerCreatedItem = organizerSubmissionItems.find((item) => item.id === created.id);
  assert.equal(organizerCreatedItem.reviewRoute, "Agents reviewer pool");
  assert.equal(organizerCreatedItem.routingRuleId, "agents-specialists");
  assert.deepEqual(organizerCreatedItem.participantIds, created.participants.map((person) => person.id));
  const organizerReviews = await worker.fetch(api("/api/reviews", { headers: { cookie: organizer.cookie } }), env);
  const routedAssignments = (await body(organizerReviews)).items;
  assert.equal(routedAssignments.length, 2);
  const createdAssignment = routedAssignments.find((item) => item.submissionId === created.id);
  assert.equal(createdAssignment.reviewerUserId, "reviewer-routing-test");
  assert.equal(createdAssignment.roundId, `evaluation_round_1_${organizer.payload.eventId}`);
  assert.deepEqual((await body(organizerPeople)).items.map((person) => person.email).sort(), ["additional@example.test", "organizer-tab-speaker@example.test", "organizer@example.test", "primary@example.test"]);

  const accepted = await worker.fetch(api(`/api/submissions/${created.id}/decision`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "if-match": '"1"' },
    body: JSON.stringify({ decision: "accepted" }),
  }), env);
  assert.equal(accepted.status, 200);
  const acceptedPayload = await body(accepted);
  assert.equal(acceptedPayload.item.status, "accepted");
  assert.equal(acceptedPayload.session.submissionId, created.id);
  assert.equal(acceptedPayload.onboarding.tasks.length, 8);
  assert.deepEqual(new Set(acceptedPayload.onboarding.tasks.map((task) => task.kind)), new Set(["contact", "submission", "form"]));
  assert.equal(acceptedPayload.onboarding.resource.title, "Accepted speaker quick-start");
  const sessionPeople = await env.CALLBOARD_DB.prepare("SELECT person_id FROM session_people WHERE event_id = ?1 AND session_id = ?2 ORDER BY person_id").bind(organizer.payload.eventId, acceptedPayload.session.id).all();
  assert.deepEqual(sessionPeople.results.map((row) => row.person_id).sort(), created.participants.map((person) => person.id).sort());

  const primaryGrant = await createGrant(env, organizer.cookie, "speaker", "primary@example.test", "Primary Speaker");
  const primary = await redeemGrant(env, primaryGrant.grantToken);
  const primaryTasksResponse = await worker.fetch(api("/api/tasks", { headers: { cookie: primary.cookie } }), env);
  const primaryTasks = (await body(primaryTasksResponse)).items;
  assert.equal(primaryTasks.length, 4);
  const primaryFormsResponse = await worker.fetch(api("/api/portal-forms", { headers: { cookie: primary.cookie } }), env);
  assert.equal(primaryFormsResponse.status, 200);
  const primaryForms = (await body(primaryFormsResponse)).items;
  assert.equal(primaryForms.length, 2);
  assert.ok(primaryForms.every((form) => !form.schema.responses));
  const hotelForm = primaryForms.find((form) => form.name === "Hotel stay requirements");
  const incompleteHotelResponse = await worker.fetch(api(`/api/portal-forms/${hotelForm.id}/responses`, {
    method: "POST",
    headers: { cookie: primary.cookie },
    body: JSON.stringify({ answers: { needs_hotel: "Yes" } }),
  }), env);
  assert.equal(incompleteHotelResponse.status, 400);
  assert.equal((await body(incompleteHotelResponse)).error, "FIELDS_REQUIRED");
  const onboardingFormResponse = await worker.fetch(api(`/api/portal-forms/${hotelForm.id}/responses`, {
    method: "POST",
    headers: { cookie: primary.cookie },
    body: JSON.stringify({ answers: { needs_hotel: "Yes", arrival_date: "2026-10-11" } }),
  }), env);
  assert.equal(onboardingFormResponse.status, 200);
  const formPayload = await body(onboardingFormResponse);
  assert.equal(formPayload.response.answers.needs_hotel, "Yes");
  assert.equal(formPayload.completedTaskIds.length, 1);
  const primaryResourcesResponse = await worker.fetch(api("/api/resources", { headers: { cookie: primary.cookie } }), env);
  assert.equal((await body(primaryResourcesResponse)).items.some((resource) => resource.id === acceptedPayload.onboarding.resource.id), true);
  const manualTask = primaryTasks.find((task) => task.kind !== "form");
  const completedTaskResponse = await worker.fetch(api(`/api/tasks/${manualTask.id}`, {
    method: "PATCH",
    headers: { cookie: primary.cookie, "if-match": `"${manualTask.version}"` },
    body: JSON.stringify({ status: "completed" }),
  }), env);
  assert.equal(completedTaskResponse.status, 200);
  const organizerTasksResponse = await worker.fetch(api("/api/tasks", { headers: { cookie: organizer.cookie } }), env);
  assert.equal((await body(organizerTasksResponse)).items.find((task) => task.id === manualTask.id).status, "completed");

  const acceptedAgain = await worker.fetch(api(`/api/submissions/${created.id}/decision`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "if-match": '"2"' },
    body: JSON.stringify({ decision: "accepted" }),
  }), env);
  assert.equal(acceptedAgain.status, 200);
  const tasksAfterReplay = await worker.fetch(api("/api/tasks", { headers: { cookie: organizer.cookie } }), env);
  const replayedTasks = (await body(tasksAfterReplay)).items;
  assert.equal(replayedTasks.length, 8);
  assert.equal(replayedTasks.find((task) => task.id === manualTask.id).status, "completed");
  assert.equal(replayedTasks.find((task) => task.id === formPayload.completedTaskIds[0]).status, "completed");

  const existingPersonResponse = await worker.fetch(api("/api/people", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Existing Event Person", email: "existing@example.test", role: "Speaker" }),
  }), env);
  assert.equal(existingPersonResponse.status, 201);
  const existingIdentitySubmission = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: { "idempotency-key": "existing-identity-submit-proof" },
    body: JSON.stringify({
      email: "existing@example.test",
      title: "Existing identity cannot be claimed",
      participants: [{ email: "existing@example.test", name: "Unverified Name Change" }],
    }),
  }), env);
  assert.equal(existingIdentitySubmission.status, 201);
  assert.equal(cookie(existingIdentitySubmission), "");
  assert.deepEqual((await body(existingIdentitySubmission)).portalAccess, {
    authenticated: false,
    reason: "EMAIL_VERIFICATION_REQUIRED",
  });
  const protectedExistingPerson = await env.CALLBOARD_DB.prepare(
    "SELECT name FROM people WHERE event_id = ?1 AND email = 'existing@example.test' LIMIT 1",
  ).bind(organizer.payload.eventId).first();
  assert.equal(protectedExistingPerson.name, "Existing Event Person");

  const authenticatedIdentitySubmission = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: {
      cookie: continuationCookie,
      "idempotency-key": "authenticated-identity-update-proof",
    },
    body: JSON.stringify({
      email: "primary@example.test",
      title: "Authenticated identity profile update",
      participants: [{
        email: "primary@example.test",
        name: "Priya Raman",
        title: "Director of Engineering",
        company: "Latticework Systems",
        bio: "Updated by the authenticated speaker during submission.",
      }],
    }),
  }), env);
  assert.equal(authenticatedIdentitySubmission.status, 201);
  assert.equal((await body(authenticatedIdentitySubmission)).portalAccess.authenticated, true);
  const updatedPrimaryPerson = await env.CALLBOARD_DB.prepare(
    "SELECT name, title, company, bio FROM people WHERE event_id = ?1 AND email = 'primary@example.test' LIMIT 1",
  ).bind(organizer.payload.eventId).first();
  assert.equal(updatedPrimaryPerson.name, "Priya Raman");
  assert.equal(updatedPrimaryPerson.title, "Director of Engineering");
  assert.equal(updatedPrimaryPerson.company, "Latticework Systems");
  assert.equal(updatedPrimaryPerson.bio, "Updated by the authenticated speaker during submission.");
});

test("public CFP drafts are separate, resumable by opaque link, versioned, and counted toward capacity", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);
  const formResponse = await worker.fetch(api("/api/forms", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({
      name: "Multiple draft CFP",
      status: "published",
      schema: { allowMultipleDrafts: true, setLimit: true, submissionLimit: 2, participantRoles: [{ label: "Speaker", enabled: true, min: 1, max: 2 }] },
    }),
  }), env);
  const form = (await body(formResponse)).item;

  const createDraft = async (title) => {
    const response = await worker.fetch(api(`/api/public/forms/${form.id}/drafts`, {
      method: "POST",
      body: JSON.stringify({ email: "draft-speaker@example.test", answers: { title }, participants: [], stepName: "submission" }),
    }), env);
    assert.equal(response.status, 201);
    return body(response);
  };
  const first = await createDraft("First idea");
  const second = await createDraft("Second idea");
  assert.notEqual(first.resumeToken, second.resumeToken);

  const stored = await env.CALLBOARD_DB.prepare("SELECT resume_token_hash FROM cfp_drafts WHERE id = ?1").bind(first.item.id).first();
  assert.notEqual(stored.resume_token_hash, first.resumeToken);

  const updatedResponse = await worker.fetch(api(`/api/public/forms/${form.id}/drafts/${first.resumeToken}`, {
    method: "PUT",
    headers: { "if-match": '"1"' },
    body: JSON.stringify({ email: "draft-speaker@example.test", answers: { title: "First idea revised", description: "Saved on device one" }, participants: [{ Email: "co-speaker@example.test" }], stepName: "review" }),
  }), env);
  assert.equal(updatedResponse.status, 200);
  assert.equal((await body(updatedResponse)).item.version, 2);

  const resumedResponse = await worker.fetch(api(`/api/public/forms/${form.id}/drafts/${first.resumeToken}`), env);
  assert.equal(resumedResponse.status, 200);
  const resumed = (await body(resumedResponse)).item;
  assert.equal(resumed.answers.title, "First idea revised");
  assert.equal(resumed.stepName, "review");

  const submittedResponse = await worker.fetch(api(`/api/public/forms/${form.id}/submissions`, {
    method: "POST",
    headers: { "idempotency-key": "submit-resumed-draft-proof" },
    body: JSON.stringify({
      draftToken: first.resumeToken,
      email: "draft-speaker@example.test",
      title: "First idea revised",
      abstract: "Saved on device one",
      participants: [{ email: "draft-speaker@example.test", name: "Draft Speaker" }],
    }),
  }), env);
  assert.equal(submittedResponse.status, 201);

  const consumedResponse = await worker.fetch(api(`/api/public/forms/${form.id}/drafts/${first.resumeToken}`), env);
  assert.equal(consumedResponse.status, 404);
  const secondStillResumes = await worker.fetch(api(`/api/public/forms/${form.id}/drafts/${second.resumeToken}`), env);
  assert.equal(secondStillResumes.status, 200);
  const atCapacity = await worker.fetch(api(`/api/public/forms/${form.id}/drafts`, {
    method: "POST",
    body: JSON.stringify({ email: "draft-speaker@example.test", answers: { title: "Third idea" }, stepName: "submission" }),
  }), env);
  assert.equal(atCapacity.status, 409);
  assert.equal((await body(atCapacity)).error, "SUBMISSION_LIMIT_REACHED");
});

test("shared Accelevents preflight persists blocked operations and retries only failed mock records", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const initialResponse = await worker.fetch(api("/api/integrations/accelevents", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(initialResponse.status, 200);
  assert.equal((await body(initialResponse)).item.version, 0);

  const secretRejected = await worker.fetch(api("/api/integrations/accelevents", {
    method: "PUT",
    headers: { cookie: organizer.cookie, "if-match": '"0"' },
    body: JSON.stringify({ eventUrl: "synthetic-event", apiToken: "forbidden-secret" }),
  }), env);
  assert.equal(secretRejected.status, 400);
  assert.equal((await body(secretRejected)).error, "INTEGRATION_SECRET_REJECTED");

  const savedResponse = await worker.fetch(api("/api/integrations/accelevents", {
    method: "PUT",
    headers: { cookie: organizer.cookie, "if-match": '"0"' },
    body: JSON.stringify({
      eventUrl: "synthetic-judge-event",
      speakerMapping: { firstName: "firstName", lastName: "lastName", email: "email" },
      sessionMapping: { title: "title", description: "description" },
    }),
  }), env);
  assert.equal(savedResponse.status, 200);
  const saved = (await body(savedResponse)).item;
  assert.equal(saved.version, 1);
  assert.equal(saved.mode, "mock");

  const realRunDenied = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ mode: "real", networkIntent: true, configVersion: 1 }),
  }), env);
  assert.equal(realRunDenied.status, 403);
  assert.equal((await body(realRunDenied)).error, "REAL_INTEGRATION_DISABLED");

  const changedOperation = {
    id: "session:session-one",
    entityType: "session",
    localId: "session-one",
    action: "CREATE",
    reason: "No Accelevents link exists",
    idempotencyKey: "accelevents:synthetic-judge-event:session:session-one:abc12345",
    payloadHash: "abc12345",
    payload: { title: "Durable integration proof", description: "Synthetic data only" },
    externalId: null,
  };
  const blockedOperation = {
    id: "speaker:speaker-invalid",
    entityType: "speaker",
    localId: "speaker-invalid",
    action: "BLOCKED",
    reason: "Blocked: speaker email is missing or invalid",
    idempotencyKey: "accelevents:synthetic-judge-event:speaker:speaker-invalid:def67890",
    payloadHash: "def67890",
    payload: { firstName: "Synthetic", lastName: "Speaker", email: "" },
    externalId: null,
  };
  const plan = {
    id: "plan-focused-shared-preflight",
    provider: "accelevents",
    direction: "CALLBOARD_TO_ACCELEVENTS",
    destructiveOperations: 0,
    operations: [changedOperation, blockedOperation],
  };
  const firstRunResponse = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ mode: "mock", networkIntent: false, configVersion: 1, plan, simulateFailureLocalIds: ["session-one"] }),
  }), env);
  assert.equal(firstRunResponse.status, 201);
  const firstPayload = await body(firstRunResponse);
  assert.equal(firstPayload.item.status, "PARTIAL");
  assert.equal(firstPayload.item.networkIntent, false);
  assert.equal(firstPayload.integration.version, 2);
  assert.equal(firstPayload.item.results.find((item) => item.localId === "session-one").status, "FAILED");
  assert.equal(firstPayload.item.results.find((item) => item.localId === "speaker-invalid").status, "BLOCKED");
  assert.deepEqual(firstPayload.integration.externalSnapshot, {});

  const staleRun = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ mode: "mock", networkIntent: false, configVersion: 1, plan }),
  }), env);
  assert.equal(staleRun.status, 409);
  assert.equal((await body(staleRun)).error, "VERSION_CONFLICT");

  const retryResponse = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({
      mode: "mock",
      networkIntent: false,
      configVersion: 2,
      retryOfRunId: firstPayload.item.id,
      retryLocalIds: ["session-one", "speaker-invalid"],
    }),
  }), env);
  assert.equal(retryResponse.status, 201);
  const retryPayload = await body(retryResponse);
  assert.equal(retryPayload.item.status, "SUCCEEDED");
  assert.equal(retryPayload.item.results.length, 1);
  assert.equal(retryPayload.item.results[0].localId, "session-one");
  assert.equal(retryPayload.item.results[0].idempotencyKey, changedOperation.idempotencyKey);
  assert.match(retryPayload.item.results[0].externalId, /^mock_session_/);
  assert.equal(retryPayload.integration.version, 3);

  const repeatedRetryResponse = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ mode: "mock", networkIntent: false, configVersion: 3, retryOfRunId: firstPayload.item.id, retryLocalIds: ["session-one"] }),
  }), env);
  assert.equal(repeatedRetryResponse.status, 409);
  assert.equal((await body(repeatedRetryResponse)).error, "NO_FAILED_OPERATIONS");

  const unchangedPlan = {
    ...plan,
    id: "plan-focused-shared-preflight-unchanged",
    operations: [{ ...changedOperation, action: "SKIP", reason: "Payload is unchanged", externalId: retryPayload.item.results[0].externalId }],
  };
  const unchangedResponse = await worker.fetch(api("/api/integrations/accelevents/runs", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ mode: "mock", networkIntent: false, configVersion: 3, plan: unchangedPlan }),
  }), env);
  assert.equal(unchangedResponse.status, 201);
  const unchangedPayload = await body(unchangedResponse);
  assert.equal(unchangedPayload.item.status, "SUCCEEDED");
  assert.equal(unchangedPayload.item.results[0].status, "SKIPPED");
  assert.equal(unchangedPayload.item.results[0].externalId, retryPayload.item.results[0].externalId);
  assert.equal(unchangedPayload.integration.version, 4);

  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "integration-speaker@example.test", "Integration Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const speakerDenied = await worker.fetch(api("/api/integrations/accelevents", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerDenied.status, 403);

  const reloadedResponse = await worker.fetch(api("/api/integrations/accelevents", { headers: { cookie: organizer.cookie } }), env);
  const reloaded = (await body(reloadedResponse)).item;
  assert.equal(reloaded.version, 4);
  assert.equal(reloaded.syncHistory.length, 3);
  assert.equal(reloaded.externalSnapshot["session:session-one"].externalId, retryPayload.item.results[0].externalId);
  assert.equal(reloaded.externalSnapshot["speaker:speaker-invalid"], undefined);

  const runSafety = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS total, SUM(network_intent) AS network_intent FROM integration_sync_runs").first();
  assert.equal(runSafety.total, 3);
  assert.equal(runSafety.network_intent, 0);
  const secretSafety = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS matches FROM integration_sync_operations WHERE payload_json LIKE '%forbidden-secret%'").first();
  assert.equal(secretSafety.matches, 0);
});

test("Airtable sync persists only destination metadata, previews exact changes, and keeps real writes gated", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const initialResponse = await worker.fetch(
    api("/api/integrations/airtable", { headers: { cookie: organizer.cookie } }),
    env,
  );
  assert.equal(initialResponse.status, 200);
  assert.equal((await body(initialResponse)).item.version, 0);

  const secretRejected = await worker.fetch(
    api("/api/integrations/airtable", {
      method: "PUT",
      headers: { cookie: organizer.cookie, "if-match": '"0"' },
      body: JSON.stringify({
        baseId: "appSyntheticJudge",
        personalAccessToken: "forbidden-secret",
      }),
    }),
    env,
  );
  assert.equal(secretRejected.status, 400);
  assert.equal((await body(secretRejected)).error, "INTEGRATION_SECRET_REJECTED");

  const savedResponse = await worker.fetch(
    api("/api/integrations/airtable", {
      method: "PUT",
      headers: { cookie: organizer.cookie, "if-match": '"0"' },
      body: JSON.stringify({
        baseId: "appSyntheticJudge",
        speakersTable: "Speakers",
        sessionsTable: "Sessions",
        speakerMapping: { callboardId: "Callboard ID", name: "Name", email: "Email" },
        sessionMapping: { callboardId: "Callboard ID", title: "Title", status: "Status" },
      }),
    }),
    env,
  );
  assert.equal(savedResponse.status, 200);
  const saved = (await body(savedResponse)).item;
  assert.equal(saved.version, 1);
  assert.equal(saved.enabled, true);
  assert.equal(saved.configuredSecret, false);

  const speakerResponse = await worker.fetch(
    api("/api/people", {
      method: "POST",
      headers: { cookie: organizer.cookie },
      body: JSON.stringify({
        name: "Airtable Speaker",
        email: "airtable-speaker@example.test",
        role: "Speaker",
      }),
    }),
    env,
  );
  const speakerPerson = (await body(speakerResponse)).item;
  const sessionResponse = await worker.fetch(
    api("/api/sessions", {
      method: "POST",
      headers: { cookie: organizer.cookie },
      body: JSON.stringify({
        title: "Airtable session",
        status: "Accepted",
        participantIds: [speakerPerson.id],
      }),
    }),
    env,
  );
  assert.equal(sessionResponse.status, 201);

  const previewResponse = await worker.fetch(
    api("/api/integrations/airtable/preview", {
      method: "POST",
      headers: { cookie: organizer.cookie },
    }),
    env,
  );
  assert.equal(previewResponse.status, 200);
  const preview = (await body(previewResponse)).item;
  assert.equal(preview.direction, "CALLBOARD_TO_AIRTABLE");
  assert.equal(preview.destructiveOperations, 0);
  assert.equal(preview.operations.length, 2);
  assert.equal(preview.operations.every((item) => item.action === "CREATE"), true);
  assert.equal(preview.operations.every((item) => !JSON.stringify(item).includes("forbidden-secret")), true);

  const realRunDenied = await worker.fetch(
    api("/api/integrations/airtable/runs", {
      method: "POST",
      headers: { cookie: organizer.cookie },
      body: JSON.stringify({ confirmation: "SYNC_TO_AIRTABLE", configVersion: 1 }),
    }),
    env,
  );
  assert.equal(realRunDenied.status, 503);
  assert.equal((await body(realRunDenied)).error, "AIRTABLE_SYNC_NOT_ENABLED");

  const speakerGrant = await createGrant(
    env,
    organizer.cookie,
    "speaker",
    "airtable-denied-speaker@example.test",
    "Airtable Denied Speaker",
  );
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const speakerDenied = await worker.fetch(
    api("/api/integrations/airtable", { headers: { cookie: speaker.cookie } }),
    env,
  );
  assert.equal(speakerDenied.status, 403);
});

test("scoped API tokens paginate stable collections and revoke without exposing stored secrets", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  for (const name of ["API Form A", "API Form B", "API Form C"]) {
    const created = await worker.fetch(api("/api/forms", {
      method: "POST",
      headers: { cookie: organizer.cookie },
      body: JSON.stringify({ name, status: "published", schema: {} }),
    }), env);
    assert.equal(created.status, 201);
  }

  const issuedResponse = await worker.fetch(api("/api/api-tokens", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ name: "Judge read-only client", scopes: ["forms:read", "submissions:read"], expiresInDays: 7 }),
  }), env);
  assert.equal(issuedResponse.status, 201);
  const issued = await body(issuedResponse);
  assert.match(issued.token, /^cbp_[A-Za-z0-9_-]+$/);
  assert.equal(issued.item.tokenPrefix.includes(issued.token), false);
  assert.deepEqual(issued.item.scopes, ["forms:read", "submissions:read"]);

  const stored = env.CALLBOARD_DB.database.prepare("SELECT token_hash, token_prefix FROM api_tokens WHERE id = ?").get(issued.item.id);
  assert.equal(stored.token_hash.length, 64);
  assert.equal(stored.token_hash.includes(issued.token), false);
  assert.equal(stored.token_prefix, issued.item.tokenPrefix);

  const authorization = { authorization: `Bearer ${issued.token}` };
  const firstPageResponse = await worker.fetch(api("/api/forms?limit=2", { headers: authorization }), env);
  assert.equal(firstPageResponse.status, 200);
  const firstPage = await body(firstPageResponse);
  assert.equal(firstPage.items.length, 2);
  assert.equal(typeof firstPage.nextCursor, "string");

  const secondPageResponse = await worker.fetch(api(`/api/forms?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`, { headers: authorization }), env);
  assert.equal(secondPageResponse.status, 200);
  const secondPage = await body(secondPageResponse);
  assert.equal(secondPage.items.length, 1);
  assert.equal(secondPage.nextCursor, null);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size, 3);

  const invalidCursor = await worker.fetch(api("/api/forms?cursor=not-a-cursor", { headers: authorization }), env);
  assert.equal(invalidCursor.status, 400);
  assert.equal((await body(invalidCursor)).error, "INVALID_CURSOR");
  const crossResourceCursor = await worker.fetch(api(`/api/submissions?cursor=${encodeURIComponent(firstPage.nextCursor)}`, { headers: authorization }), env);
  assert.equal(crossResourceCursor.status, 400);
  assert.equal((await body(crossResourceCursor)).error, "INVALID_CURSOR");

  const deniedWrite = await worker.fetch(api("/api/submissions", {
    method: "POST",
    headers: authorization,
    body: JSON.stringify({ title: "Token write must fail" }),
  }), env);
  assert.equal(deniedWrite.status, 403);
  assert.deepEqual(await body(deniedWrite), { error: "API_SCOPE_REQUIRED", details: { required: "submissions:write" } });

  const deniedTokenManagement = await worker.fetch(api("/api/api-tokens", { headers: authorization }), env);
  assert.equal(deniedTokenManagement.status, 403);

  const listResponse = await worker.fetch(api("/api/api-tokens", { headers: { cookie: organizer.cookie } }), env);
  const listed = await body(listResponse);
  assert.equal(listed.items.length, 1);
  assert.equal(Object.hasOwn(listed.items[0], "token"), false);
  assert.equal(Object.hasOwn(listed.items[0], "tokenHash"), false);

  const revokeResponse = await worker.fetch(api(`/api/api-tokens/${issued.item.id}`, { method: "DELETE", headers: { cookie: organizer.cookie } }), env);
  assert.equal(revokeResponse.status, 204);
  const revokedUse = await worker.fetch(api("/api/forms", { headers: authorization }), env);
  assert.equal(revokedUse.status, 401);
  assert.equal((await body(revokedUse)).error, "INVALID_API_TOKEN");
});

test("webhook lifecycle events are signed, idempotent, retryable, and mock-only", async (t) => {
  const env = testEnv();
  t.after(() => env.CALLBOARD_DB.close());
  const organizer = await bootstrap(env);

  const subscriptionResponse = await worker.fetch(api("/api/webhooks/subscriptions", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({
      name: "Judge consumer",
      targetUrl: "https://consumer.example.test/callboard",
      eventTypes: ["task.created"],
    }),
  }), env);
  assert.equal(subscriptionResponse.status, 201);
  const subscription = await body(subscriptionResponse);
  assert.match(subscription.signingSecret, /^whsec_[A-Za-z0-9_-]+$/);
  assert.equal(subscription.item.eventTypes[0], "task.created");

  const storedColumns = env.CALLBOARD_DB.database.prepare("PRAGMA table_info(webhook_subscriptions)").all().map((column) => column.name);
  assert.equal(storedColumns.some((column) => column.includes("secret") && column !== "secret_version"), false);
  const listedSubscriptions = await body(await worker.fetch(api("/api/webhooks/subscriptions", { headers: { cookie: organizer.cookie } }), env));
  assert.equal(listedSubscriptions.items.length, 1);
  assert.equal(Object.hasOwn(listedSubscriptions.items[0], "signingSecret"), false);

  const taskResponse = await worker.fetch(api("/api/tasks", {
    method: "POST",
    headers: { cookie: organizer.cookie },
    body: JSON.stringify({ title: "Trigger webhook proof", status: "open", kind: "contact" }),
  }), env);
  assert.equal(taskResponse.status, 201);
  const task = (await body(taskResponse)).item;

  const beforeStale = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS count FROM webhook_events").first();
  const staleTaskResponse = await worker.fetch(api(`/api/tasks/${task.id}`, {
    method: "PATCH",
    headers: { cookie: organizer.cookie, "if-match": '"999"' },
    body: JSON.stringify({ status: "done" }),
  }), env);
  assert.equal(staleTaskResponse.status, 409);
  const afterStale = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS count FROM webhook_events").first();
  assert.equal(Number(afterStale.count), Number(beforeStale.count));

  const eventListResponse = await worker.fetch(api("/api/webhooks/events?limit=1", { headers: { cookie: organizer.cookie } }), env);
  assert.equal(eventListResponse.status, 200);
  const eventList = await body(eventListResponse);
  assert.equal(eventList.items.length, 1);
  assert.equal(eventList.items[0].type, "task.created");
  assert.equal(eventList.items[0].subjectId, task.id);

  const realAttempt = await worker.fetch(api(`/api/webhooks/events/${eventList.items[0].id}/deliveries`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "forbidden-real-delivery" },
    body: JSON.stringify({ mode: "real", networkIntent: true }),
  }), env);
  assert.equal(realAttempt.status, 403);
  assert.equal((await body(realAttempt)).error, "WEBHOOK_MOCK_ONLY");

  const firstDeliveryResponse = await worker.fetch(api(`/api/webhooks/events/${eventList.items[0].id}/deliveries`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "judge-first-delivery" },
    body: JSON.stringify({ mode: "mock", networkIntent: false, simulateFailureSubscriptionIds: [subscription.item.id] }),
  }), env);
  assert.equal(firstDeliveryResponse.status, 201);
  const firstDeliveryEnvelope = await body(firstDeliveryResponse);
  assert.equal(firstDeliveryEnvelope.networkIntent, false);
  assert.equal(firstDeliveryEnvelope.replayed, false);
  assert.equal(firstDeliveryEnvelope.items.length, 1);
  const firstDelivery = firstDeliveryEnvelope.items[0];
  assert.equal(firstDelivery.status, "FAILED");
  assert.equal(firstDelivery.networkIntent, false);
  assert.equal(firstDelivery.retryOfDeliveryId, null);
  const expectedSignature = createHmac("sha256", subscription.signingSecret)
    .update(`${firstDelivery.signatureTimestamp}.${JSON.stringify(firstDelivery.body)}`)
    .digest("hex");
  assert.equal(firstDelivery.signature, `v1=${expectedSignature}`);

  const replayResponse = await worker.fetch(api(`/api/webhooks/events/${eventList.items[0].id}/deliveries`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "judge-first-delivery" },
    body: JSON.stringify({ mode: "mock", networkIntent: false }),
  }), env);
  assert.equal(replayResponse.status, 200);
  const replay = await body(replayResponse);
  assert.equal(replay.replayed, true);
  assert.equal(replay.items[0].id, firstDelivery.id);

  const retryResponse = await worker.fetch(api(`/api/webhooks/deliveries/${firstDelivery.id}/retry`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "judge-retry-delivery" },
    body: JSON.stringify({ mode: "mock", networkIntent: false }),
  }), env);
  assert.equal(retryResponse.status, 201);
  const retry = await body(retryResponse);
  assert.equal(retry.item.status, "SUCCEEDED");
  assert.equal(retry.item.attemptNumber, 2);
  assert.equal(retry.item.retryOfDeliveryId, firstDelivery.id);
  assert.match(retry.item.externalId, /^mock_webhook_/);

  const retryReplayResponse = await worker.fetch(api(`/api/webhooks/deliveries/${firstDelivery.id}/retry`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "judge-retry-delivery" },
    body: JSON.stringify({ mode: "mock", networkIntent: false }),
  }), env);
  assert.equal(retryReplayResponse.status, 200);
  const retryReplay = await body(retryReplayResponse);
  assert.equal(retryReplay.replayed, true);
  assert.equal(retryReplay.item.id, retry.item.id);

  const duplicateRetry = await worker.fetch(api(`/api/webhooks/deliveries/${firstDelivery.id}/retry`, {
    method: "POST",
    headers: { cookie: organizer.cookie, "idempotency-key": "judge-retry-delivery-again" },
    body: JSON.stringify({ mode: "mock", networkIntent: false }),
  }), env);
  assert.equal(duplicateRetry.status, 409);
  assert.equal((await body(duplicateRetry)).error, "DELIVERY_ALREADY_RETRIED");

  const safety = await env.CALLBOARD_DB.prepare("SELECT COUNT(*) AS count, SUM(network_intent) AS network_intent FROM webhook_deliveries").first();
  assert.equal(Number(safety.count), 2);
  assert.equal(Number(safety.network_intent), 0);

  const speakerGrant = await createGrant(env, organizer.cookie, "speaker", "webhook-speaker@example.test", "Webhook Speaker");
  const speaker = await redeemGrant(env, speakerGrant.grantToken);
  const speakerDenied = await worker.fetch(api("/api/webhooks/events", { headers: { cookie: speaker.cookie } }), env);
  assert.equal(speakerDenied.status, 403);
});

test("API routes fail closed without D1 and never fall through to static assets", async () => {
  let assetCalls = 0;
  const env = { ASSETS: { fetch: async () => { assetCalls += 1; return new Response("asset"); } } };
  const response = await worker.fetch(api("/api/forms"), env);
  assert.equal(response.status, 503);
  assert.equal((await body(response)).error, "D1_NOT_CONFIGURED");
  assert.equal(assetCalls, 0);
});

test("bootstrap and normalized mutations fail closed while writes are disabled", async (t) => {
  const env = testEnv({ CALLBOARD_WRITE_ENABLED: "false" });
  t.after(() => env.CALLBOARD_DB.close());
  const response = await worker.fetch(api("/api/bootstrap", {
    method: "POST",
    headers: { "x-callboard-bootstrap-key": env.CALLBOARD_BOOTSTRAP_SECRET },
    body: JSON.stringify({ event: { name: "Disabled" }, organizer: { name: "Owner", email: "owner@example.test" } }),
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await body(response)).error, "WRITES_DISABLED");
});
