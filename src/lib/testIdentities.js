const identities = [
  { id: "eventops-organizer-test", role: "organizer", label: "Organizer test identity", name: "Event Operations Test Organizer", email: "eventops-organizer-test@opencallboard.invalid" },
  { id: "eventops-reviewer-test", role: "reviewer", label: "Reviewer test identity", name: "Event Operations Test Reviewer", email: "eventops-reviewer-test@opencallboard.invalid" },
  { id: "eventops-speaker-test", role: "speaker", label: "Speaker test identity", name: "Event Operations Test Speaker", email: "eventops-speaker-test@opencallboard.invalid" },
  { id: "eventops-notifications-test", role: "notifications", label: "Notifications test identity", name: "Event Operations Test Notifications", email: "eventops-notifications-test@opencallboard.invalid" },
];

export const TEST_IDENTITIES = Object.freeze(identities.map((identity) => Object.freeze(identity)));
export const TEST_MAILBOX_ALLOWLIST = Object.freeze(TEST_IDENTITIES.map((identity) => identity.email));
export const TEST_RECIPIENT_IDENTITIES = Object.freeze(TEST_IDENTITIES.filter((identity) => identity.role !== "notifications"));
export const TEST_RECIPIENT_MAILBOX_ALLOWLIST = Object.freeze(TEST_RECIPIENT_IDENTITIES.map((identity) => identity.email));

// Deliberately not an email address. A personal canary must be supplied
// explicitly at release time; Callboard must never infer or guess one.
export const PERSONAL_CANARY_EMAIL_PLACEHOLDER = "PERSONAL_CANARY_EMAIL_REQUIRED";

const identityById = new Map(TEST_IDENTITIES.map((identity) => [identity.id, identity]));
const identityByMailbox = new Map(TEST_IDENTITIES.map((identity) => [identity.email, identity]));

export function normalizeMailbox(value = "") {
  return String(value).trim().toLowerCase();
}

export function getTestIdentity(idOrMailbox) {
  const value = String(idOrMailbox || "");
  return identityById.get(value) || identityByMailbox.get(normalizeMailbox(value)) || null;
}

export function isAuthorizedTestMailbox(mailbox) {
  return identityByMailbox.has(normalizeMailbox(mailbox));
}

export function assertAuthorizedTestMailbox(mailbox) {
  const normalized = normalizeMailbox(mailbox);
  const identity = identityByMailbox.get(normalized);
  if (!identity) {
    const error = new Error(`Recipient ${normalized || "(missing)"} is outside the authorized Callboard test allowlist.`);
    error.name = "TestIdentityError";
    error.code = "RECIPIENT_NOT_ALLOWLISTED";
    throw error;
  }
  return identity;
}

export function assertAuthorizedTestRecipient(mailbox) {
  const identity = assertAuthorizedTestMailbox(mailbox);
  if (identity.role === "notifications") {
    const error = new Error("The notifications mailbox is sender-only and cannot be selected as a test recipient.");
    error.name = "TestIdentityError";
    error.code = "SENDER_MAILBOX_NOT_A_RECIPIENT";
    throw error;
  }
  return identity;
}

export function syntheticMergeContext(identityId = "eventops-speaker-test") {
  const identity = getTestIdentity(identityId);
  if (!identity) throw new Error(`Unknown Callboard test identity: ${identityId}`);
  return {
    first_name: identity.name.split(" ").at(-1),
    full_name: identity.name,
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
  };
}
