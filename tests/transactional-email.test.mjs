import assert from "node:assert/strict";
import test from "node:test";
import { sendTransactionalEmail, transactionalEmailConfigured } from "../worker/transactionalEmail.js";

test("SES transactional delivery signs the exact recipient and sender payload", async () => {
  const calls = [];
  const env = {
    CALLBOARD_SES_ACCESS_KEY_ID: "AKIATESTACCESSKEY",
    CALLBOARD_SES_SECRET_ACCESS_KEY: "test-secret-access-key",
    CALLBOARD_SES_REGION: "us-east-1",
    CALLBOARD_SES_CONFIGURATION_SET: "shared-transactional",
    CALLBOARD_AUTH_SENDER_EMAIL: "hello@opencallboard.com",
  };
  assert.equal(transactionalEmailConfigured(env), true);
  const result = await sendTransactionalEmail({
    env,
    sentAt: new Date("2026-08-13T12:34:56.000Z"),
    idempotencyKey: "organizer_login_test_1",
    exactPayload: {
      from: { name: "OpenCallboard", email: "hello@opencallboard.com" },
      replyTo: { name: "OpenCallboard", email: "hello@opencallboard.com" },
      to: [{ name: "Test Organizer", email: "organizer@example.test" }],
      subject: "Sign in to OpenCallboard",
      text: "Use this private link to sign in.",
    },
    providerFetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ MessageId: "ses-message-1" });
    },
  });
  assert.deepEqual(result, { provider: "ses", messageId: "ses-message-1", threadId: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails");
  assert.match(calls[0].init.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIATESTACCESSKEY\//);
  assert.equal(calls[0].init.headers["x-amz-date"], "20260813T123456Z");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    FromEmailAddress: "hello@opencallboard.com",
    ConfigurationSetName: "shared-transactional",
    Destination: { ToAddresses: ["organizer@example.test"] },
    ReplyToAddresses: ["hello@opencallboard.com"],
    Content: {
      Simple: {
        Subject: { Data: "Sign in to OpenCallboard", Charset: "UTF-8" },
        Body: { Text: { Data: "Use this private link to sign in.", Charset: "UTF-8" } },
      },
    },
    EmailTags: [{ Name: "callboard_idempotency", Value: "organizer_login_test_1" }],
  });
});

test("Resend transactional delivery preserves the exact recipient and idempotency boundary", async () => {
  const calls = [];
  const env = {
    CALLBOARD_RESEND_API_KEY: "re_test_key",
    CALLBOARD_AUTH_SENDER_EMAIL: "hello@opencallboard.com",
  };
  assert.equal(transactionalEmailConfigured(env), true);
  const result = await sendTransactionalEmail({
    env,
    idempotencyKey: "organizer_login_test_1",
    exactPayload: {
      from: { name: "OpenCallboard", email: "hello@opencallboard.com" },
      replyTo: { name: "OpenCallboard", email: "hello@opencallboard.com" },
      to: [{ name: "Test Organizer", email: "organizer@example.test" }],
      subject: "Sign in to OpenCallboard",
      text: "Use this private link to sign in.",
    },
    providerFetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ id: "resend-message-1" });
    },
  });
  assert.deepEqual(result, { provider: "resend", messageId: "resend-message-1", threadId: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers["idempotency-key"], "organizer_login_test_1");
  assert.equal(calls[0].init.headers.authorization, "Bearer re_test_key");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    from: "OpenCallboard <hello@opencallboard.com>",
    to: ["organizer@example.test"],
    reply_to: "hello@opencallboard.com",
    subject: "Sign in to OpenCallboard",
    text: "Use this private link to sign in.",
  });
});

test("transactional delivery remains fail closed without a configured provider", async () => {
  assert.equal(transactionalEmailConfigured({}), false);
  await assert.rejects(
    sendTransactionalEmail({ env: {}, exactPayload: {}, idempotencyKey: "missing" }),
    (error) => error.code === "GMAIL_CREDENTIALS_NOT_CONFIGURED",
  );
});
