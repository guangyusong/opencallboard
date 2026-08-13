function isJsonResponse(response) {
  return response.headers.get("content-type")?.includes("application/json");
}

async function readJson(response) {
  if (!isJsonResponse(response)) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function statusLabel(value, fallback = "Pending") {
  const text = String(value || fallback)
    .trim()
    .replaceAll("_", " ");
  return text
    ? text
        .split(/\s+/)
        .map((word) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`)
        .join(" ")
    : fallback;
}

function eventDateRange(startsAt, endsAt, timezone, fallback) {
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return fallback || "Dates not set";
  const zone = timezone || "UTC";
  const startParts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(start);
  const values = Object.fromEntries(startParts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  if (!end || Number.isNaN(end.getTime())) return `${values.month} ${values.day}, ${values.year}`;
  const endParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(end).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  if (values.year === endParts.year && values.month === endParts.month)
    return `${values.month} ${values.day}–${endParts.day}, ${values.year}`;
  if (values.year === endParts.year)
    return `${values.month} ${values.day}–${endParts.month} ${endParts.day}, ${values.year}`;
  return `${values.month} ${values.day}, ${values.year}–${endParts.month} ${endParts.day}, ${endParts.year}`;
}

export function createIdempotencyKey(prefix = "callboard") {
  const token =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${token}`;
}

export async function loadPublicForm(formId, fetchImpl = globalThis.fetch) {
  if (!fetchImpl || !formId) return { available: false };
  try {
    const response = await fetchImpl(
      `/api/public/forms/${encodeURIComponent(formId)}`,
      { headers: { accept: "application/json" } },
    );
    const payload = await readJson(response);
    if (!isJsonResponse(response))
      return { available: false, fallbackAllowed: true };
    if (!response.ok)
      return {
        available: false,
        status: response.status,
        error: payload?.error,
      };
    return { available: true, form: payload?.form || null };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

export async function loadPublicEmbed(embedId, fetchImpl = globalThis.fetch) {
  if (!fetchImpl || !embedId)
    return { available: false, fallbackAllowed: true };
  try {
    const response = await fetchImpl(
      `/api/public/embeds/${encodeURIComponent(embedId)}`,
      { headers: { accept: "application/json" } },
    );
    const payload = await readJson(response);
    if (!isJsonResponse(response))
      return { available: false, fallbackAllowed: true };
    if (!response.ok) {
      const fallbackAllowed = ["API_NOT_FOUND", "D1_NOT_CONFIGURED"].includes(
        payload?.error,
      );
      return {
        available: !fallbackAllowed,
        fallbackAllowed,
        item: null,
        status: response.status,
        error: payload?.error,
      };
    }
    return { available: true, item: payload };
  } catch (error) {
    return { available: false, fallbackAllowed: true, error: error.message };
  }
}

export async function submitPublicCfp(
  formId,
  submission,
  { idempotencyKey, fetchImpl = globalThis.fetch } = {},
) {
  if (!fetchImpl || !formId) return { available: false };
  try {
    const response = await fetchImpl(
      `/api/public/forms/${encodeURIComponent(formId)}/submissions`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "idempotency-key": idempotencyKey || createIdempotencyKey("cfp"),
        },
        body: JSON.stringify(submission),
      },
    );
    const payload = await readJson(response);
    if (!isJsonResponse(response))
      return { available: false, ok: false, fallbackAllowed: true };
    if (!response.ok) {
      const unavailable =
        [404, 503].includes(response.status) &&
        [
          "D1_NOT_CONFIGURED",
          "WRITES_DISABLED",
          "API_NOT_FOUND",
          undefined,
        ].includes(payload?.error);
      return {
        available: !unavailable,
        ok: false,
        fallbackAllowed: unavailable,
        status: response.status,
        error: payload?.error || "SUBMISSION_FAILED",
        details: payload?.details,
      };
    }
    return {
      available: true,
      ok: true,
      item: payload?.item,
      replayed: Boolean(payload?.replayed),
      portalAccess: payload?.portalAccess || null,
    };
  } catch (error) {
    return {
      available: false,
      ok: false,
      fallbackAllowed: false,
      error: error.message,
    };
  }
}

export async function loadPublicDraft(
  formId,
  resumeToken,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !formId || !resumeToken)
    return { ok: false, error: "DRAFT_TOKEN_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/public/forms/${encodeURIComponent(formId)}/drafts/${encodeURIComponent(resumeToken)}`,
      { headers: { accept: "application/json" } },
    );
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "DRAFT_LOAD_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function savePublicDraft(
  formId,
  draft,
  { resumeToken = "", version, fetchImpl = globalThis.fetch } = {},
) {
  if (!fetchImpl || !formId) return { ok: false, error: "FORM_REQUIRED" };
  try {
    const updating = Boolean(resumeToken);
    const response = await fetchImpl(
      `/api/public/forms/${encodeURIComponent(formId)}/drafts${updating ? `/${encodeURIComponent(resumeToken)}` : ""}`,
      {
        method: updating ? "PUT" : "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(updating ? { "if-match": `"${version}"` } : {}),
        },
        body: JSON.stringify(draft),
      },
    );
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          item: payload?.item,
          resumeToken: payload?.resumeToken || resumeToken,
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "DRAFT_SAVE_FAILED",
          details: payload?.details,
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function establishSession(path, init, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl(path, {
      method: "POST",
      headers: { accept: "application/json", ...init.headers },
      body: init.body,
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, session: payload }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SIGN_IN_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function loginOrganizer(secret, fetchImpl = globalThis.fetch) {
  return establishSession(
    "/api/session/organizer",
    { headers: { "x-callboard-bootstrap-key": secret } },
    fetchImpl,
  );
}

export function requestOrganizerLogin(
  { email, name, turnstileToken } = {},
  fetchImpl = globalThis.fetch,
) {
  return establishSession(
    "/api/auth/organizer/request",
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name, turnstileToken }),
    },
    fetchImpl,
  );
}

export async function loadPublicHealth(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/health", {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    return response.ok && payload
      ? { ok: true, item: payload }
      : { ok: false, error: payload?.error || "HEALTH_UNAVAILABLE" };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function redeemOrganizerLogin(token, fetchImpl = globalThis.fetch) {
  return establishSession(
    "/api/auth/organizer/redeem",
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    },
    fetchImpl,
  );
}

async function accountRequest(path, init = {}, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl(path, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, ...payload }
      : { ok: false, status: response.status, error: payload?.error || "ACCOUNT_REQUEST_FAILED", details: payload?.details };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function loadOrganizerAccount(fetchImpl = globalThis.fetch) {
  return accountRequest("/api/account", {}, fetchImpl);
}

export function createOrganizerEvent(event, fetchImpl = globalThis.fetch) {
  return accountRequest(
    "/api/account/events",
    { method: "POST", body: JSON.stringify(event) },
    fetchImpl,
  );
}

export function selectOrganizerEvent(eventId, fetchImpl = globalThis.fetch) {
  return accountRequest(
    `/api/account/events/${encodeURIComponent(eventId)}/select`,
    { method: "POST", body: JSON.stringify({}) },
    fetchImpl,
  );
}

export function redeemAccessGrant(grantToken, fetchImpl = globalThis.fetch) {
  return establishSession(
    "/api/session",
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grantToken }),
    },
    fetchImpl,
  );
}

export async function createAccessGrant(grant, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/access-grants", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(grant),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "ACCESS_GRANT_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function saveSharedAcceleventsConfig(
  version,
  config,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !Number.isInteger(Number(version)) || Number(version) < 0)
    return { ok: false, error: "SHARED_RESOURCE_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl("/api/integrations/accelevents", {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "if-match": `"${Number(version)}"`,
      },
      body: JSON.stringify(config),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "INTEGRATION_SAVE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function createSharedAcceleventsRun(
  run,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/integrations/accelevents/runs", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(run),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item, integration: payload?.integration }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "INTEGRATION_RUN_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function loadSharedAirtableConfig(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/integrations/airtable", { headers: { accept: "application/json" } });
    const payload = await readJson(response);
    return response.ok ? { ok: true, item: payload?.item } : { ok: false, status: response.status, error: payload?.error || "AIRTABLE_LOAD_FAILED" };
  } catch (error) { return { ok: false, error: error.message }; }
}

export async function saveSharedAirtableConfig(version, config, fetchImpl = globalThis.fetch) {
  if (!fetchImpl || !Number.isInteger(Number(version)) || Number(version) < 0) return { ok: false, error: "SHARED_RESOURCE_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl("/api/integrations/airtable", { method: "PUT", headers: { accept: "application/json", "content-type": "application/json", "if-match": `"${Number(version)}"` }, body: JSON.stringify(config) });
    const payload = await readJson(response);
    return response.ok ? { ok: true, item: payload?.item } : { ok: false, status: response.status, error: payload?.error || "AIRTABLE_SAVE_FAILED" };
  } catch (error) { return { ok: false, error: error.message }; }
}

export async function previewSharedAirtableSync(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/integrations/airtable/preview", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: "{}" });
    const payload = await readJson(response);
    return response.ok ? { ok: true, item: payload?.item } : { ok: false, status: response.status, error: payload?.error || "AIRTABLE_PREVIEW_FAILED" };
  } catch (error) { return { ok: false, error: error.message }; }
}

export async function runSharedAirtableSync(version, fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/integrations/airtable/runs", { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ confirmation: "SYNC_TO_AIRTABLE", configVersion: Number(version) }) });
    const payload = await readJson(response);
    return response.ok ? { ok: true, item: payload?.item, integration: payload?.integration } : { ok: false, status: response.status, error: payload?.error || "AIRTABLE_SYNC_FAILED" };
  } catch (error) { return { ok: false, error: error.message }; }
}

export async function loadSharedWorkspaceVersion(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/workspace-version", {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          version: payload?.version || "empty:0:0",
          pollAfterMs: Number(payload?.pollAfterMs || 5000),
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "WORKSPACE_VERSION_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function patchSharedResource(
  resource,
  itemId,
  version,
  patch,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !resource || !itemId || !version)
    return { ok: false, error: "SHARED_RESOURCE_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/${encodeURIComponent(resource)}/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "if-match": `"${version}"`,
        },
        body: JSON.stringify(patch),
      },
    );
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SHARED_UPDATE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function deleteSharedResource(
  resource,
  itemId,
  version,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !resource || !itemId || !version)
    return { ok: false, error: "SHARED_RESOURCE_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/${encodeURIComponent(resource)}/${encodeURIComponent(itemId)}`,
      {
        method: "DELETE",
        headers: { accept: "application/json", "if-match": `"${version}"` },
      },
    );
    const payload = response.status === 204 ? null : await readJson(response);
    return response.ok
      ? { ok: true }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SHARED_DELETE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function createSharedResource(
  resource,
  item,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !resource)
    return { ok: false, error: "SHARED_RESOURCE_REQUIRED" };
  try {
    const response = await fetchImpl(`/api/${encodeURIComponent(resource)}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(item),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SHARED_CREATE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function createSharedCommunicationOutbox(
  item,
  idempotencyKey = createIdempotencyKey("communication"),
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !item?.exactPayload)
    return { ok: false, error: "EXACT_COMMUNICATION_PAYLOAD_REQUIRED" };
  try {
    const response = await fetchImpl("/api/communication-outbox", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey,
        action: item.action,
        templateId: item.templateId || null,
        templateName: item.templateName,
        segment: item.segment,
        exactPayload: item.exactPayload,
      }),
    });
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          item: payload?.item,
          attempt: payload?.attempt || null,
          calendar: payload?.calendar || null,
          replayed: Boolean(payload?.replayed),
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "COMMUNICATION_OUTBOX_CREATE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function releaseSharedCommunicationOutbox(
  outboxId,
  { live = false } = {},
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !outboxId)
    return { ok: false, error: "COMMUNICATION_OUTBOX_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/communication-outbox/${encodeURIComponent(outboxId)}/release-approval`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          confirm: live
            ? "release-one-event-member-email-from-ui"
            : "release-one-synthetic-email-from-ui",
        }),
      },
    );
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item, queued: Boolean(payload?.queued) }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "COMMUNICATION_RELEASE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function loadSharedCommunicationOutbox(
  outboxId,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !outboxId)
    return { ok: false, error: "COMMUNICATION_OUTBOX_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/communication-outbox/${encodeURIComponent(outboxId)}`,
      { headers: { accept: "application/json" } },
    );
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "COMMUNICATION_OUTBOX_LOAD_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function submitPortalFormResponse(
  formId,
  answers,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !formId)
    return { ok: false, error: "PORTAL_FORM_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/portal-forms/${encodeURIComponent(formId)}/responses`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ answers }),
      },
    );
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          item: payload?.item,
          response: payload?.response,
          completedTaskIds: payload?.completedTaskIds || [],
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "PORTAL_FORM_RESPONSE_FAILED",
          details: payload?.details,
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function evaluateSharedReminderPreviews(
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl) return { ok: false, error: "BROWSER_FETCH_UNAVAILABLE" };
  try {
    const response = await fetchImpl("/api/communication-reminders/evaluate", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirm: "materialize-due-reminder-previews" }),
    });
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          evaluatedAt: payload?.evaluatedAt,
          items: payload?.items || [],
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "REMINDER_EVALUATION_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function decideSharedSubmission(
  submissionId,
  version,
  decision,
  context = {},
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !submissionId || !version)
    return { ok: false, error: "SHARED_SUBMISSION_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl(
      `/api/submissions/${encodeURIComponent(submissionId)}/decision`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "if-match": `"${version}"`,
        },
        body: JSON.stringify({
          ...context,
          decision: String(decision || "")
            .trim()
            .toLowerCase()
            .replaceAll(" ", "_"),
        }),
      },
    );
    const payload = await readJson(response);
    return response.ok
      ? {
          ok: true,
          item: payload?.item,
          session: payload?.session,
          decision: payload?.decision,
          onboarding: payload?.onboarding,
        }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SHARED_DECISION_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function setSharedScheduleRelease(
  status,
  version,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !Number.isInteger(version) || version < 0)
    return { ok: false, error: "SCHEDULE_RELEASE_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl("/api/schedule-release", {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "if-match": `"${version}"`,
      },
      body: JSON.stringify({ status }),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SCHEDULE_RELEASE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function patchSharedEvent(
  version,
  patch,
  fetchImpl = globalThis.fetch,
) {
  if (!fetchImpl || !version)
    return { ok: false, error: "SHARED_EVENT_VERSION_REQUIRED" };
  try {
    const response = await fetchImpl("/api/event", {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "if-match": `"${version}"`,
      },
      body: JSON.stringify(patch),
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "SHARED_EVENT_UPDATE_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function uploadSharedFile(
  file,
  {
    kind,
    submissionId,
    ownerPersonId,
    fileRequestId,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  if (!fetchImpl || !file) return { ok: false, error: "FILE_REQUIRED" };
  try {
    const headers = {
      accept: "application/json",
      "content-type": file.type || "application/octet-stream",
      "x-callboard-file-name": encodeURIComponent(file.name),
      "x-callboard-file-kind": kind || "Supporting document",
      "x-callboard-file-size": String(file.size),
    };
    if (submissionId) headers["x-callboard-submission-id"] = submissionId;
    if (ownerPersonId) headers["x-callboard-owner-person-id"] = ownerPersonId;
    if (fileRequestId) headers["x-callboard-file-request-id"] = fileRequestId;
    const response = await fetchImpl("/api/files/upload", {
      method: "POST",
      headers,
      body: file,
    });
    const payload = await readJson(response);
    return response.ok
      ? { ok: true, item: payload?.item, person: payload?.person || null }
      : {
          ok: false,
          status: response.status,
          error: payload?.error || "FILE_UPLOAD_FAILED",
        };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function logoutSharedSession(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { ok: false };
  try {
    const response = await fetchImpl("/api/session", {
      method: "DELETE",
      headers: { accept: "application/json" },
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}

export async function loadSharedWorkspace(fetchImpl = globalThis.fetch) {
  if (!fetchImpl) return { state: null, persistence: "localStorage" };
  try {
    const sessionResponse = await fetchImpl("/api/session", {
      headers: { accept: "application/json" },
    });
    const sessionPayload = await readJson(sessionResponse);
    if (!sessionResponse.ok || !sessionPayload?.authenticated) {
      const sharedAvailable =
        isJsonResponse(sessionResponse) &&
        ["UNAUTHENTICATED", "INVALID_SESSION"].includes(sessionPayload?.error);
      return {
        state: null,
        persistence: "localStorage",
        session: null,
        sharedAvailable,
      };
    }

    if (sessionPayload.sessionType === "account" || sessionPayload.role === "account") {
      return {
        state: null,
        persistence: "d1",
        session: sessionPayload,
        accountEvents: sessionPayload.events || [],
        sharedAvailable: true,
      };
    }

    const [healthResponse, eventResponse] = await Promise.all([
      fetchImpl("/api/health", { headers: { accept: "application/json" } }),
      fetchImpl("/api/event", { headers: { accept: "application/json" } }),
    ]);
    const health =
      healthResponse.ok && isJsonResponse(healthResponse)
        ? await healthResponse.json()
        : {};
    const eventItem =
      eventResponse.ok && isJsonResponse(eventResponse)
        ? (await eventResponse.json()).item
        : null;
    const session = sessionPayload;
    const firstName = String(session.name || session.email || "Organizer")
      .trim()
      .split(/\s+/)[0];
    const sharedBase = {
      schemaVersion: 11,
      objectStorageAvailable: Boolean(health.objectStorageConfigured),
      emailDeliveryAvailable: Boolean(health.emailDeliveryConfigured),
      emailUiReleaseAvailable: Boolean(health.emailUiReleaseConfigured),
      emailSender: String(health.emailSender || "").trim() || null,
      reminderAutomationAvailable: Boolean(health.reminderAutomationConfigured),
      portalPersonId: session.personId || null,
      ...(eventItem
        ? {
            event: {
              id: eventItem.id,
              name: eventItem.name,
              shortName: eventItem.shortName || eventItem.name,
              initials: String(eventItem.shortName || eventItem.name || "EV")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              slug: eventItem.slug,
              timezone: eventItem.timezone,
              start: eventItem.startsAt || "",
              end: eventItem.endsAt || "",
              location: eventItem.location || "",
              website: eventItem.website || "",
              type: eventItem.type || "Conference",
              theme: eventItem.theme || "",
              groupTypes: eventItem.settings?.groupTypes || [
                "Exhibitors",
                "Sponsors",
              ],
              dates: eventDateRange(
                eventItem.startsAt,
                eventItem.endsAt,
                eventItem.timezone,
                eventItem.settings?.dates,
              ),
              version: eventItem.version,
              updatedAt: eventItem.updatedAt,
            },
          }
        : {}),
      organizer: {
        name: session.name || session.email || "Organizer",
        firstName,
        email: session.email || "",
        initials: String(session.name || session.email || "OR")
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      },
    };
    const baseRequests = [
      fetchImpl("/api/forms", { headers: { accept: "application/json" } }),
      fetchImpl("/api/submissions", {
        headers: { accept: "application/json" },
      }),
      fetchImpl("/api/people", { headers: { accept: "application/json" } }),
    ];
    if (session.role === "organizer")
      baseRequests.push(
        fetchImpl("/api/sessions", { headers: { accept: "application/json" } }),
        fetchImpl("/api/tasks", { headers: { accept: "application/json" } }),
        fetchImpl("/api/resources", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/reviews", { headers: { accept: "application/json" } }),
        fetchImpl("/api/embeds", { headers: { accept: "application/json" } }),
        fetchImpl("/api/file-requests", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/portal-forms", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/files", { headers: { accept: "application/json" } }),
        fetchImpl("/api/schedule-release", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/communication-templates", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/communication-reminders", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/communication-reminder-runs", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/communication-previews", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/communication-outbox", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/evaluation-rounds", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/evaluation-decisions", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/reviewers", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/integrations/accelevents", {
          headers: { accept: "application/json" },
        }),
      );
    const baseResponses = await Promise.all(baseRequests);
    const [formsResponse, submissionsResponse, peopleResponse] = baseResponses;
    const requiredBaseResponses = session.role === "reviewer"
      ? [submissionsResponse]
      : [formsResponse, submissionsResponse, peopleResponse];
    if (!requiredBaseResponses.every((response) => response.ok && isJsonResponse(response)))
      return { state: null, persistence: "localStorage", session };
    const optionalCollection = async (response) =>
      response?.ok && isJsonResponse(response) ? response.json() : { items: [] };
    const [formsPayload, submissionsPayload, peoplePayload] = await Promise.all([
      optionalCollection(formsResponse),
      submissionsResponse.json(),
      optionalCollection(peopleResponse),
    ]);
    const participants = (peoplePayload.items || []).map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role || "Speaker",
      title: person.title || "",
      company: person.company || "",
      bio: person.bio || "",
      headshotUrl: person.headshotUrl || "",
      initials: String(person.name || person.email || "SP")
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      version: person.version,
    }));
    const forms = (formsPayload.items || []).map((form) => {
      const closesAt = form.closesAt || form.schema?.closeDate || form.schema?.closes || "";
      const expired = closesAt && new Date(closesAt).getTime() <= Date.now();
      return {
        ...(form.schema || {}),
        id: form.id,
        name: form.name,
        status:
          !expired && ["open", "published"].includes(String(form.status).toLowerCase())
            ? "Open"
            : statusLabel(expired ? "closed" : form.status, "Closed"),
        version: form.version,
        closeDate: closesAt,
        closes: closesAt,
      };
    });
    const abstracts = (submissionsPayload.items || []).map((submission) => {
      const answerValue = (...keys) => {
        for (const key of keys) {
          if (submission.answers?.[key] !== undefined && submission.answers[key] !== "")
            return submission.answers[key];
          const match = Object.entries(submission.answers || {}).find(([answerKey]) =>
            String(answerKey).toLowerCase() === String(key).toLowerCase(),
          );
          if (match?.[1] !== undefined && match[1] !== "") return match[1];
        }
        return "";
      };
      return ({
      id: submission.id,
      formId: submission.formId,
      source:
        forms.find((form) => form.id === submission.formId)?.name ||
        "Public form",
      title: submission.title,
      description: submission.abstract || "",
      status: statusLabel(submission.status),
      track: submission.category || submission.answers?.Track || "Unassigned",
      format: answerValue("format", "Format"),
      level: answerValue("audienceLevel", "audience-level", "Audience level", "Level"),
      tags: [answerValue("format", "Format")].filter(Boolean),
      submitted: submission.createdAt,
      submitterEmail:
        participants.find(
          (person) => person.id === submission.submitterPersonId,
        )?.email || "",
      participantIds:
        submission.participantIds ||
        submission.participants?.map((person) => person.id) ||
        [],
      speakers: submission.participants?.map((person) => person.name) || [],
      answers: submission.answers || {},
      reviewRoute: submission.reviewRoute || "Round 1 · Technical review",
      routingRuleId: submission.routingRuleId || null,
      reviewRound: submission.round || 1,
      version: submission.version,
    });
    });
    if (session.role === "organizer") {
      const optionalPayload = async (response) =>
        response?.ok && isJsonResponse(response)
          ? response.json()
          : { items: [] };
      const [
        sessionsPayload,
        tasksPayload,
        resourcesPayload,
        reviewsPayload,
        embedsPayload,
        fileRequestsPayload,
        portalFormsPayload,
        filesPayload,
        scheduleReleasePayload,
        communicationTemplatesPayload,
        communicationRemindersPayload,
        communicationReminderRunsPayload,
        communicationPreviewsPayload,
        communicationOutboxPayload,
        evaluationRoundsPayload,
        evaluationDecisionsPayload,
        reviewersPayload,
        acceleventsPayload,
      ] = await Promise.all(baseResponses.slice(3).map(optionalPayload));
      const sessions = (sessionsPayload.items || []).map((item) => ({
        id: item.id,
        sourceAbstractId: item.submissionId,
        title: item.title,
        description: item.description || "",
        status: statusLabel(item.status, "Accepted"),
        startsAt: item.startsAt || "",
        endsAt: item.endsAt || "",
        room: item.room || "",
        track:
          item.track ||
          abstracts.find((abstract) => abstract.id === item.submissionId)
            ?.track ||
          "",
        format:
          item.format ||
          abstracts.find((abstract) => abstract.id === item.submissionId)
            ?.format ||
          "",
        participants: item.participantIds || [],
        version: item.version,
      }));
      const tasks = (tasksPayload.items || []).map((task) => ({
        id: task.id,
        title: task.title,
        personId: task.assigneePersonId,
        scope:
          task.kind === "submission"
            ? "Submission"
            : task.kind === "form"
              ? "Form"
              : "Contact",
        kind: task.kind || "contact",
        mode: task.id.startsWith("task_accepted_") ? "Automatic" : "Manual",
        notes: task.instructions || "",
        due: task.dueAt || "",
        complete: ["complete", "completed", "done"].includes(
          String(task.status).toLowerCase(),
        ),
        version: task.version,
      }));
      const resources = (resourcesPayload.items || []).map((resource) => ({
        id: resource.id,
        title: resource.title,
        kind: resource.kind,
        description: resource.content || resource.url || "",
        content: resource.content || "",
        url: resource.url || "",
        audience: resource.audience,
        version: resource.version,
      }));
      const reviews = (reviewsPayload.items || []).map((review) => ({
        id: review.id,
        roundId: review.roundId || `round-${review.round || 1}`,
        abstractId: review.submissionId,
        reviewerId: review.reviewerUserId,
        scores: review.scores || {},
        comments: review.notes || "",
        recommendation: review.recommendation
          ? statusLabel(review.recommendation, "Advance")
          : "Advance",
        total: review.totalScore || 0,
        final: String(review.status).toLowerCase() === "submitted",
        status: review.status || "assigned",
        version: review.version,
        updated: review.updatedAt,
      }));
      const assignments = reviews.map((review) => ({
        id: `assignment-${review.id}`,
        abstractId: review.abstractId,
        reviewerId: review.reviewerId,
        status: review.final ? "Complete" : "Assigned",
        reviewId: review.id,
        version: review.version,
      }));
      const evaluationRounds = (evaluationRoundsPayload.items || [])
        .sort((a, b) => Number(a.number) - Number(b.number))
        .map((item) => ({
          id: item.id,
          name: item.name,
          number: Number(item.number),
          status: statusLabel(item.status, "Upcoming"),
          blind: Boolean(item.blind),
          criteria: item.criteria || [],
          version: item.version,
          assignments: assignments.filter(
            (assignment) =>
              reviews.find((review) => review.id === assignment.reviewId)
                ?.roundId === item.id,
          ),
        }));
      const embeds = (embedsPayload.items || []).map((embed) => ({
        ...(embed.config || {}),
        id: embed.id,
        name: embed.name,
        format: embed.format,
        enabled: Boolean(embed.enabled),
        version: embed.version,
      }));
      const fileRequests = (fileRequestsPayload.items || []).map((request) => ({
        id: request.id,
        title: request.title,
        type: request.type,
        instructions: request.instructions || "",
        assigneePersonId: request.assigneePersonId || "",
        submissionId: request.submissionId || "",
        dueAt: request.dueAt || "",
        status: request.status || "open",
        files: [],
        version: request.version,
      }));
      const portalForms = (portalFormsPayload.items || []).map((form) => ({
        ...(form.schema || {}),
        id: form.id,
        name: form.name,
        title: form.title,
        type: form.type,
        version: form.version,
      }));
      const portalFiles = (filesPayload.items || []).map((file) => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        size: file.sizeBytes,
        kind: file.kind,
        personId: file.ownerPersonId,
        fileRequestId: file.fileRequestId,
        status: file.status,
        version: file.version,
        uploaded: file.createdAt,
        downloadUrl: file.storageKey
          ? `/api/files/${encodeURIComponent(file.id)}/content`
          : "",
      }));
      const linkedFileRequests = fileRequests.map((request) => ({
        ...request,
        files: portalFiles
          .filter((file) => file.fileRequestId === request.id)
          .map((file) => file.id),
      }));
      const scheduleRelease = scheduleReleasePayload.item || {
        status: "draft",
        publishedAt: null,
        version: 0,
        updatedAt: null,
      };
      const communicationTemplates = (
        communicationTemplatesPayload.items || []
      ).map((item) => ({
        ...item,
        attachCalendar: Boolean(item.attachCalendar),
      }));
      const communicationReminders = (
        communicationRemindersPayload.items || []
      ).map((item) => ({ ...item, enabled: Boolean(item.enabled) }));
      const reminderRuns = communicationReminderRunsPayload.items || [];
      const durableOutbox = (communicationOutboxPayload.items || []).map(
        (item) => ({
          ...item,
          status: statusLabel(item.status, "Prepared preview"),
          provider: item.provider === "none" ? "Not connected" : item.provider,
          attachCalendar: Boolean(item.attachCalendar),
          automationKey:
            item.action === "automation" ? item.idempotencyKey : null,
        }),
      );
      const emailLog = [
        ...durableOutbox,
        ...(communicationPreviewsPayload.items || []),
      ];
      const evaluationDecisions = evaluationDecisionsPayload.items || [];
      const reviewerDirectory = reviewersPayload.items || [];
      const integrations = { accelevents: acceleventsPayload.item || null };
      return {
        state: {
          ...sharedBase,
          forms,
          abstracts,
          participants,
          sessions,
          tasks,
          resources,
          reviews,
          evaluationRounds,
          evaluationDecisions,
          reviewers: reviewerDirectory,
          embeds,
          fileRequests: linkedFileRequests,
          portalForms,
          portalFiles,
          scheduleRelease,
          communicationTemplates,
          communicationReminders,
          reminderRuns,
          emailLog,
          integrations,
        },
        persistence: "d1",
        session,
        sharedAvailable: true,
      };
    }

    if (session.role === "reviewer") {
      const [reviewsResponse, evaluationRoundsResponse] = await Promise.all([
        fetchImpl("/api/reviews", { headers: { accept: "application/json" } }),
        fetchImpl("/api/evaluation-rounds", {
          headers: { accept: "application/json" },
        }),
      ]);
      const reviewsPayload =
        reviewsResponse.ok && isJsonResponse(reviewsResponse)
          ? await reviewsResponse.json()
          : { items: [] };
      const evaluationRoundsPayload =
        evaluationRoundsResponse.ok && isJsonResponse(evaluationRoundsResponse)
          ? await evaluationRoundsResponse.json()
          : { items: [] };
      const reviews = (reviewsPayload.items || []).map((review) => ({
        id: review.id,
        roundId: review.roundId || `round-${review.round || 1}`,
        abstractId: review.submissionId,
        reviewerId: review.reviewerUserId,
        scores: review.scores || {},
        comments: review.notes || "",
        recommendation: review.recommendation
          ? statusLabel(review.recommendation, "Advance")
          : "Advance",
        total: review.totalScore || 0,
        final: String(review.status).toLowerCase() === "submitted",
        status: review.status || "assigned",
        version: review.version,
        updated: review.updatedAt,
      }));
      const assignments = reviews.map((review) => ({
        id: `assignment-${review.id}`,
        abstractId: review.abstractId,
        reviewerId: review.reviewerId,
        status: review.final ? "Complete" : "Assigned",
        reviewId: review.id,
        version: review.version,
      }));
      const evaluationRounds = (evaluationRoundsPayload.items || [])
        .sort((a, b) => Number(a.number) - Number(b.number))
        .map((item) => ({
          id: item.id,
          name: item.name,
          number: Number(item.number),
          status: statusLabel(item.status, "Upcoming"),
          blind: Boolean(item.blind),
          criteria: item.criteria || [],
          version: item.version,
          assignments: assignments.filter(
            (assignment) =>
              reviews.find((review) => review.id === assignment.reviewId)
                ?.roundId === item.id,
          ),
        }));
      return {
        state: {
          ...sharedBase,
          forms,
          abstracts,
          participants,
          reviews,
          evaluationRounds,
        },
        persistence: "d1",
        session,
        sharedAvailable: true,
      };
    }

    if (session.role === "speaker") {
      const [
        tasksResponse,
        resourcesResponse,
        filesResponse,
        sessionsResponse,
        fileRequestsResponse,
        portalFormsResponse,
      ] = await Promise.all([
        fetchImpl("/api/tasks", { headers: { accept: "application/json" } }),
        fetchImpl("/api/resources", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/files", { headers: { accept: "application/json" } }),
        fetchImpl("/api/sessions", { headers: { accept: "application/json" } }),
        fetchImpl("/api/file-requests", {
          headers: { accept: "application/json" },
        }),
        fetchImpl("/api/portal-forms", {
          headers: { accept: "application/json" },
        }),
      ]);
      const optionalPayload = async (response) =>
        response.ok && isJsonResponse(response)
          ? response.json()
          : { items: [] };
      const [
        tasksPayload,
        resourcesPayload,
        filesPayload,
        sessionsPayload,
        fileRequestsPayload,
        portalFormsPayload,
      ] = await Promise.all(
        [
          tasksResponse,
          resourcesResponse,
          filesResponse,
          sessionsResponse,
          fileRequestsResponse,
          portalFormsResponse,
        ].map(optionalPayload),
      );
      const tasks = (tasksPayload.items || []).map((task) => ({
        id: task.id,
        title: task.title,
        personId: task.assigneePersonId,
        scope:
          task.kind === "submission"
            ? "Submission"
            : task.kind === "form"
              ? "Form"
              : "Contact",
        kind: task.kind || "contact",
        notes: task.instructions || "",
        due: task.dueAt || "",
        complete: ["complete", "completed", "done"].includes(
          String(task.status).toLowerCase(),
        ),
        version: task.version,
      }));
      const resources = (resourcesPayload.items || []).map((resource) => ({
        id: resource.id,
        title: resource.title,
        kind: resource.kind,
        description: resource.content || resource.url || "",
        content: resource.content || "",
        url: resource.url || "",
        audience: resource.audience,
        version: resource.version,
      }));
      const speakerFiles = (filesPayload.items || []).map((file) => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        size: file.sizeBytes,
        kind: file.kind,
        personId: file.ownerPersonId,
        fileRequestId: file.fileRequestId,
        submissionId: file.submissionId,
        status: file.status,
        version: file.version,
        uploaded: file.createdAt,
        downloadUrl: file.storageKey
          ? `/api/files/${encodeURIComponent(file.id)}/content`
          : "",
      }));
      const sessions = (sessionsPayload.items || []).map((item) => ({
        id: item.id,
        sourceAbstractId: item.submissionId,
        title: item.title,
        description: item.description || "",
        status: statusLabel(item.status, "Accepted"),
        startsAt: item.startsAt || "",
        endsAt: item.endsAt || "",
        room: item.room || "",
        track:
          item.track ||
          abstracts.find((abstract) => abstract.id === item.submissionId)
            ?.track ||
          "",
        format:
          item.format ||
          abstracts.find((abstract) => abstract.id === item.submissionId)
            ?.format ||
          "",
        participants: [session.personId].filter(Boolean),
        version: item.version,
      }));
      const fileRequests = (fileRequestsPayload.items || []).map((request) => ({
        id: request.id,
        title: request.title,
        type: request.type,
        instructions: request.instructions || "",
        assigneePersonId: request.assigneePersonId || "",
        submissionId: request.submissionId || "",
        dueAt: request.dueAt || "",
        status: request.status || "open",
        files: speakerFiles
          .filter((file) => file.fileRequestId === request.id)
          .map((file) => file.id),
        version: request.version,
      }));
      const portalForms = (portalFormsPayload.items || []).map((form) => ({
        ...(form.schema || {}),
        id: form.id,
        name: form.name,
        title: form.title,
        type: form.type,
        version: form.version,
      }));
      return {
        state: {
          ...sharedBase,
          forms,
          abstracts,
          participants,
          tasks,
          resources,
          speakerFiles,
          portalFiles: speakerFiles,
          sessions,
          fileRequests,
          portalForms,
        },
        persistence: "d1",
        session,
        sharedAvailable: true,
      };
    }

    return {
      state: { ...sharedBase, forms, abstracts, participants },
      persistence: "d1",
      session,
      sharedAvailable: true,
    };
  } catch (error) {
    return {
      state: null,
      persistence: "localStorage",
      error: error.message,
      session: null,
    };
  }
}
