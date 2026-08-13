import { sendSyntheticGmail, syntheticGmailConfigured } from "./gmail.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SES_SERVICE = "ses";

function text(value) {
  return String(value || "").trim();
}

function bytes(value) {
  return new TextEncoder().encode(String(value));
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", bytes(value));
}

async function hmac(key, value) {
  const rawKey = typeof key === "string" ? bytes(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, bytes(value));
}

function sesConfigured(env = {}) {
  return Boolean(
    text(env.CALLBOARD_SES_ACCESS_KEY_ID) &&
      text(env.CALLBOARD_SES_SECRET_ACCESS_KEY) &&
      text(env.CALLBOARD_AUTH_SENDER_EMAIL),
  );
}

function compactIdempotencyTag(value) {
  return text(value)
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(0, 256);
}

async function sendWithSes({ env, exactPayload, idempotencyKey, providerFetch, sentAt }) {
  const region = text(env.CALLBOARD_SES_REGION) || "us-east-1";
  const endpoint = new URL(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`);
  const accessKeyId = text(env.CALLBOARD_SES_ACCESS_KEY_ID);
  const secretAccessKey = text(env.CALLBOARD_SES_SECRET_ACCESS_KEY);
  const sessionToken = text(env.CALLBOARD_SES_SESSION_TOKEN);
  const senderEmail = text(exactPayload?.from?.email).toLowerCase();
  const recipients = Array.isArray(exactPayload?.to)
    ? exactPayload.to.map((recipient) => text(recipient.email)).filter(Boolean)
    : [];
  if (!senderEmail || !recipients.length) {
    const error = new Error("Transactional email payload is incomplete.");
    error.code = "TRANSACTIONAL_EMAIL_PAYLOAD_INVALID";
    throw error;
  }

  const payload = {
    // Keep the envelope address bare so the least-privileged ses:FromAddress
    // condition evaluates the exact verified product address.
    FromEmailAddress: senderEmail,
    ...(text(env.CALLBOARD_SES_CONFIGURATION_SET)
      ? { ConfigurationSetName: text(env.CALLBOARD_SES_CONFIGURATION_SET) }
      : {}),
    Destination: { ToAddresses: recipients },
    ReplyToAddresses: [text(exactPayload?.replyTo?.email) || senderEmail],
    Content: {
      Simple: {
        Subject: { Data: text(exactPayload?.subject), Charset: "UTF-8" },
        Body: { Text: { Data: String(exactPayload?.text || ""), Charset: "UTF-8" } },
      },
    },
    ...(idempotencyKey
      ? {
          EmailTags: [
            {
              Name: "callboard_idempotency",
              Value: compactIdempotencyTag(idempotencyKey),
            },
          ],
        }
      : {}),
  };
  const body = JSON.stringify(payload);
  const date = new Date(sentAt);
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const contentHash = hex(await sha256(body));
  const canonicalHeaders = [
    "content-type:application/json",
    `host:${endpoint.host}`,
    `x-amz-content-sha256:${contentHash}`,
    `x-amz-date:${amzDate}`,
    ...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
  ];
  const signedHeaders = [
    "content-type",
    "host",
    "x-amz-content-sha256",
    "x-amz-date",
    ...(sessionToken ? ["x-amz-security-token"] : []),
  ].join(";");
  const canonicalRequest = [
    "POST",
    endpoint.pathname,
    "",
    `${canonicalHeaders.join("\n")}\n`,
    signedHeaders,
    contentHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${SES_SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hex(await sha256(canonicalRequest)),
  ].join("\n");
  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, SES_SERVICE);
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(await hmac(signingKey, stringToSign));
  const response = await providerFetch(endpoint.toString(), {
    method: "POST",
    headers: {
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": "application/json",
      "x-amz-content-sha256": contentHash,
      "x-amz-date": amzDate,
      ...(sessionToken ? { "x-amz-security-token": sessionToken } : {}),
    },
    body,
  });
  if (!response.ok) {
    const providerError = await response.json().catch(() => ({}));
    const providerMessage = text(providerError?.message || providerError?.Message).toLowerCase();
    const classifiedMessage = providerMessage.includes("not authorized")
      ? "ACCESS_DENIED"
      : providerMessage.includes("signature")
        ? "SIGNATURE_ERROR"
        : providerMessage.includes("security token") || providerMessage.includes("access key")
          ? "CREDENTIAL_ERROR"
          : providerMessage.includes("configuration set")
            ? "CONFIGURATION_SET_ERROR"
            : "";
    const providerCode = text(
      response.headers.get("x-amzn-errortype") ||
        providerError?.__type ||
        providerError?.name ||
        providerError?.code ||
        classifiedMessage,
    )
      .split("#")
      .at(-1)
      .replace(/[^A-Za-z0-9_-]/g, "_")
      .slice(0, 80);
    const error = new Error("Transactional email provider rejected the request.");
    error.code = `SES_SEND_FAILED_${response.status}${providerCode ? `_${providerCode}` : ""}`;
    throw error;
  }
  const result = await response.json();
  if (!result?.MessageId) {
    const error = new Error("Transactional email provider returned no message ID.");
    error.code = "SES_MESSAGE_ID_MISSING";
    throw error;
  }
  return { provider: "ses", messageId: String(result.MessageId), threadId: null };
}

export function transactionalEmailConfigured(env = {}) {
  const resendConfigured = Boolean(
    text(env.CALLBOARD_RESEND_API_KEY) && text(env.CALLBOARD_AUTH_SENDER_EMAIL),
  );
  return sesConfigured(env) || resendConfigured || syntheticGmailConfigured({
    credentialsJson: env.CALLBOARD_GMAIL_CREDENTIALS,
  });
}

export async function sendTransactionalEmail({
  env = {},
  exactPayload,
  idempotencyKey,
  providerFetch = fetch,
  sentAt = new Date(),
}) {
  if (sesConfigured(env)) {
    return sendWithSes({ env, exactPayload, idempotencyKey, providerFetch, sentAt });
  }
  const resendKey = text(env.CALLBOARD_RESEND_API_KEY);
  if (!resendKey)
    return sendSyntheticGmail({
      credentialsJson: env.CALLBOARD_GMAIL_CREDENTIALS,
      exactPayload,
      outboxId: idempotencyKey,
      providerFetch,
      sentAt,
    });

  const senderName = text(exactPayload?.from?.name) || "OpenCallboard";
  const senderEmail = text(exactPayload?.from?.email).toLowerCase();
  const recipients = Array.isArray(exactPayload?.to) ? exactPayload.to : [];
  if (!senderEmail || !recipients.length) {
    const error = new Error("Transactional email payload is incomplete.");
    error.code = "TRANSACTIONAL_EMAIL_PAYLOAD_INVALID";
    throw error;
  }
  const response = await providerFetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": text(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: recipients.map((recipient) => text(recipient.email)).filter(Boolean),
      reply_to: text(exactPayload?.replyTo?.email) || senderEmail,
      subject: text(exactPayload?.subject),
      text: String(exactPayload?.text || ""),
    }),
  });
  if (!response.ok) {
    const error = new Error("Transactional email provider rejected the request.");
    error.code = `RESEND_SEND_FAILED_${response.status}`;
    throw error;
  }
  const result = await response.json();
  if (!result?.id) {
    const error = new Error("Transactional email provider returned no message ID.");
    error.code = "RESEND_MESSAGE_ID_MISSING";
    throw error;
  }
  return { provider: "resend", messageId: String(result.id), threadId: null };
}
