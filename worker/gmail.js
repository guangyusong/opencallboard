const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URI = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const OAUTH_REFRESH_MODE = "oauth-refresh-token";

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function utf8Base64(value) {
  return bytesToBase64(new TextEncoder().encode(String(value)));
}

function base64urlValue(value) {
  return utf8Base64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64urlBytes(bytes) {
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function mimeBase64(value) {
  return utf8Base64(value).match(/.{1,76}/g)?.join("\r\n") || "";
}

function headerValue(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function mailboxHeader(identity) {
  const name = headerValue(identity?.name);
  const email = headerValue(identity?.email).toLowerCase();
  return name ? `=?UTF-8?B?${utf8Base64(name)}?= <${email}>` : email;
}

function subjectHeader(value) {
  return `=?UTF-8?B?${utf8Base64(headerValue(value))}?=`;
}

function icsEscape(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replace(/\r?\n/g, "\\n");
}

function icsTime(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCalendarAttachment(exactPayload, sentAt = new Date()) {
  const calendar = exactPayload.calendar;
  if (!calendar) return null;
  const method = String(calendar.method || "REQUEST").toUpperCase() === "CANCEL" ? "CANCEL" : "REQUEST";
  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//Callboard//Synthetic Test Delivery//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${icsEscape(calendar.uid)}`,
    `DTSTAMP:${icsTime(sentAt)}`,
    `DTSTART:${icsTime(calendar.start)}`,
    `DTEND:${icsTime(calendar.end)}`,
    `SEQUENCE:${Math.max(0, Number(calendar.sequence || 0))}`,
    `STATUS:${status}`,
    `ORGANIZER:mailto:${headerValue(exactPayload.from.email).toLowerCase()}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${headerValue(exactPayload.to[0].email).toLowerCase()}`,
    `SUMMARY:${icsEscape(exactPayload.subject)}`,
    `DESCRIPTION:${icsEscape(exactPayload.text)}`,
    `LOCATION:${icsEscape(calendar.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function buildSyntheticMimeMessage(exactPayload, outboxId, sentAt = new Date()) {
  const safeId = String(outboxId || "message").replace(/[^a-zA-Z0-9_-]/g, "-");
  const boundary = `callboard-${safeId}`;
  const calendar = buildCalendarAttachment(exactPayload, sentAt);
  const lines = [
    `From: ${mailboxHeader(exactPayload.from)}`,
    `Reply-To: ${mailboxHeader(exactPayload.replyTo)}`,
    `To: ${mailboxHeader(exactPayload.to[0])}`,
    `Subject: ${subjectHeader(exactPayload.subject)}`,
    `Date: ${sentAt.toUTCString()}`,
    `Message-ID: <${safeId}@opencallboard.invalid>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(exactPayload.text),
  ];
  if (calendar) lines.push(
    `--${boundary}`,
    `Content-Type: text/calendar; charset=UTF-8; method=${exactPayload.calendar.method}`,
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="callboard-test-session.ics"',
    "",
    mimeBase64(calendar),
  );
  lines.push(`--${boundary}--`, "");
  return lines.join("\r\n");
}

function parseServiceAccount(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!parsed.client_email || !parsed.private_key) return null;
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key, tokenUri: parsed.token_uri || DEFAULT_TOKEN_URI };
  } catch {
    return null;
  }
}

function parseGmailCredentials(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (parsed?.mode === OAUTH_REFRESH_MODE) {
      const allowedFields = new Set(["mode", "clientId", "clientSecret", "refreshToken", "senderEmail", "tokenUri"]);
      if (
        !String(parsed.clientId || "").trim() ||
        !String(parsed.clientSecret || "").trim() ||
        !String(parsed.refreshToken || "").trim() ||
        !String(parsed.senderEmail || "").trim().toLowerCase().endsWith("@opencallboard.invalid") ||
        Object.keys(parsed).some((field) => !allowedFields.has(field))
      ) return null;
      return {
        mode: OAUTH_REFRESH_MODE,
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        refreshToken: parsed.refreshToken,
        senderEmail: parsed.senderEmail.trim().toLowerCase(),
        tokenUri: parsed.tokenUri || DEFAULT_TOKEN_URI,
      };
    }
    const serviceAccount = parseServiceAccount(value);
    return serviceAccount ? { mode: "private-key", serviceAccount } : null;
  } catch {
    return null;
  }
}

async function importPrivateKey(pem) {
  const raw = String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const bytes = Uint8Array.from(atob(raw), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function serviceAccountAssertion(serviceAccount, { subject = null, scope, audience = serviceAccount.tokenUri || DEFAULT_TOKEN_URI, at = new Date() } = {}) {
  const issuedAt = Math.floor(at.getTime() / 1000);
  const header = base64urlValue(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = {
    iss: serviceAccount.clientEmail,
    scope,
    aud: audience,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  if (subject) payload.sub = subject;
  const claims = base64urlValue(JSON.stringify(payload));
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importPrivateKey(serviceAccount.privateKey), new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64urlBytes(new Uint8Array(signature))}`;
}

async function responseError(response, code) {
  let detail = "";
  try { detail = String(await response.text()).slice(0, 240).replace(/[\r\n]+/g, " "); } catch { /* ignore */ }
  const error = new Error(`${code} (${response.status})${detail ? `: ${detail}` : ""}`);
  error.code = code;
  error.status = response.status;
  throw error;
}

async function exchangeAssertion(tokenUri, assertion, providerFetch, errorCode) {
  const tokenResponse = await providerFetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokenResponse.ok) return responseError(tokenResponse, errorCode);
  const token = await tokenResponse.json();
  if (!token.access_token) {
    const error = new Error("Google token exchange returned no access token.");
    error.code = "GOOGLE_TOKEN_MISSING";
    throw error;
  }
  return token.access_token;
}

async function gmailAccessToken({ credentials, senderEmail, providerFetch, sentAt }) {
  if (credentials.mode === "private-key") {
    const assertion = await serviceAccountAssertion(credentials.serviceAccount, {
      subject: senderEmail,
      scope: GMAIL_COMPOSE_SCOPE,
      at: sentAt,
    });
    return exchangeAssertion(credentials.serviceAccount.tokenUri, assertion, providerFetch, "GMAIL_TOKEN_EXCHANGE_FAILED");
  }

  if (credentials.senderEmail !== senderEmail) {
    const error = new Error("The Gmail OAuth credential does not belong to the authorized sender.");
    error.code = "GMAIL_OAUTH_SENDER_MISMATCH";
    throw error;
  }
  const tokenResponse = await providerFetch(credentials.tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) return responseError(tokenResponse, "GMAIL_OAUTH_REFRESH_FAILED");
  const token = await tokenResponse.json();
  if (!token.access_token) {
    const error = new Error("Gmail OAuth refresh returned no access token.");
    error.code = "GMAIL_OAUTH_TOKEN_MISSING";
    throw error;
  }
  return token.access_token;
}

export function syntheticGmailConfigured({ credentialsJson } = {}) {
  return Boolean(parseGmailCredentials(credentialsJson));
}

export async function sendSyntheticGmail({ credentialsJson, exactPayload, outboxId, providerFetch = fetch, sentAt = new Date() }) {
  const credentials = parseGmailCredentials(credentialsJson);
  if (!credentials) {
    const error = new Error("Gmail delivery credentials are not configured.");
    error.code = "GMAIL_CREDENTIALS_NOT_CONFIGURED";
    throw error;
  }
  const senderEmail = headerValue(exactPayload.from?.email).toLowerCase();
  const accessToken = await gmailAccessToken({ credentials, senderEmail, providerFetch, sentAt });
  const mime = buildSyntheticMimeMessage(exactPayload, outboxId, sentAt);
  const sendResponse = await providerFetch(GMAIL_SEND_URI, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: base64urlValue(mime) }),
  });
  if (!sendResponse.ok) return responseError(sendResponse, "GMAIL_SEND_FAILED");
  const sent = await sendResponse.json();
  if (!sent.id) {
    const error = new Error("Gmail returned no provider message ID.");
    error.code = "GMAIL_MESSAGE_ID_MISSING";
    throw error;
  }
  return { provider: "gmail", messageId: String(sent.id), threadId: sent.threadId ? String(sent.threadId) : null };
}
