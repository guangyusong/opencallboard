import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const spec = JSON.parse(readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"));

function resolvePointer(pointer) {
  assert.match(pointer, /^#\//, `Only local OpenAPI references are allowed: ${pointer}`);
  return pointer.slice(2).split("/").reduce((value, segment) => value?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], spec);
}

function visit(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.$ref === "string") assert.ok(resolvePointer(value.$ref), `Unresolved OpenAPI reference: ${value.$ref}`);
  for (const child of Object.values(value)) visit(child);
}

test("published OpenAPI contract covers the hosted product boundaries", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, "https://opencallboard.com");
  assert.ok(Object.keys(spec.paths).length >= 53);

  const requiredPaths = [
    "/api/event",
    "/api/reviewers",
    "/api/api-tokens",
    "/api/api-tokens/{id}",
    "/api/forms",
    "/api/public/forms/{formId}/submissions",
    "/api/submissions/{id}/decision",
    "/api/people",
    "/api/evaluation-rounds",
    "/api/reviews",
    "/api/sessions",
    "/api/agenda-conflicts",
    "/api/tasks",
    "/api/resources",
    "/api/files/upload",
    "/api/public/embeds/{id}",
    "/api/communication-outbox",
    "/api/communication-outbox/{id}/attempts",
    "/api/communication-outbox/{id}/release-approval",
    "/api/communication-reminders/evaluate",
    "/api/communication-reminder-runs",
    "/api/webhooks/subscriptions",
    "/api/webhooks/subscriptions/{id}",
    "/api/webhooks/events",
    "/api/webhooks/events/{id}/deliveries",
    "/api/webhooks/deliveries",
    "/api/webhooks/deliveries/{id}/retry",
    "/api/integrations/accelevents/runs",
  ];
  for (const path of requiredPaths) assert.ok(spec.paths[path], path);

  assert.deepEqual(spec.paths["/api/public/forms/{formId}/submissions"].post.security, []);
  assert.equal(spec.components.securitySchemes.apiToken.type, "http");
  assert.equal(spec.components.securitySchemes.apiToken.scheme, "bearer");
  assert.deepEqual(spec.security, [{ sessionCookie: [] }, { apiToken: [] }]);
  assert.deepEqual(spec.paths["/api/api-tokens"].post.security, [{ sessionCookie: [] }]);
  assert.deepEqual(spec.paths["/api/api-tokens/{id}"].delete.security, [{ sessionCookie: [] }]);
  assert.ok(spec.components.responses.ItemList.content["application/json"].schema.properties.nextCursor);
  for (const operation of Object.entries(spec.components["x-operations"]).filter(([name]) => name.startsWith("List") && name !== "ListCommunicationOutbox").map(([, value]) => value)) {
    assert.ok(operation.parameters.some((item) => item.$ref.endsWith("/Limit")));
    assert.ok(operation.parameters.some((item) => item.$ref.endsWith("/Cursor")));
  }
  assert.ok(spec.paths["/api/public/forms/{formId}/submissions"].post.parameters.some((item) => item.$ref.endsWith("/IdempotencyKey")));
  assert.ok(spec.paths["/api/event"].patch.parameters.some((item) => item.$ref.endsWith("/IfMatch")));
  assert.ok(spec.paths["/api/event"].put.parameters.some((item) => item.$ref.endsWith("/IfMatch")));
  assert.ok(spec.paths["/api/files/{id}/content"].head);
  assert.match(spec.paths["/api/files/upload"].post.description, /fails closed/i);
  assert.match(spec.paths["/api/integrations/accelevents/runs"].post.description, /networkIntent=false/);
  assert.match(spec.paths["/api/webhooks/events/{id}/deliveries"].post.description, /No fetch or provider transport occurs/);
  assert.match(spec.paths["/api/communication-outbox/{id}/release-approval"].post.description, /never calls Gmail directly/i);
  assert.match(spec.paths["/api/communication-reminders/evaluate"].post.description, /never enqueues or sends/i);
  assert.equal(spec.components.schemas.Health.properties.emailDeliveryConfigured.type, "boolean");
  assert.equal(spec.components.schemas.Health.properties.reminderAutomationConfigured.type, "boolean");
  assert.ok(spec.paths["/api/webhooks/events"].get.parameters.some((item) => item.$ref.endsWith("/Cursor")));
  assert.ok(spec.components.requestBodies.ApiTokenCreate.content["application/json"].schema.properties.scopes.items.pattern.includes("webhooks"));
  assert.deepEqual(spec["x-callboard-safety"], {
    externalEmailDelivery: false,
    emailReleaseRequiresOneTimeApproval: true,
    scheduledReminderDelivery: false,
    externalWebhookDelivery: false,
    calendarProviderWrites: false,
    realAcceleventsTransport: false,
    objectStorageBound: false,
    deletePropagationToAccelevents: false,
  });

  visit(spec);
});
