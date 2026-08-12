import { abstractsForParticipant, acceptedParticipants, participantsForAbstract, tasksForParticipant } from "./domain.js";
import { buildSyntheticCommunicationPayload } from "./communicationsRelease.js";

export const MERGE_FIELDS = [
  "first_name", "full_name", "event_name", "event_dates", "event_location",
  "portal_url", "submission_title", "submission_status", "session_title",
  "session_start", "session_location", "task_title", "task_due_date",
];

export const SEEDED_TEMPLATES = [
  {
    id: "acceptance",
    name: "Submission accepted",
    category: "Decision",
    segment: "accepted-speakers",
    subject: "You're speaking at {{event_name}}",
    body: "Hi {{first_name}},\n\nWe're delighted to accept “{{submission_title}}” for {{event_name}}. Your speaker portal has the next steps and deadlines.\n\nOpen your portal: {{portal_url}}\n\n— The {{event_name}} team",
  },
  {
    id: "decline",
    name: "Submission not selected",
    category: "Decision",
    segment: "declined-submitters",
    subject: "An update on your {{event_name}} submission",
    body: "Hi {{first_name}},\n\nThank you for submitting “{{submission_title}}” to {{event_name}}. We weren't able to include it in this year's program. We appreciate the time and care you put into your proposal.\n\n— The {{event_name}} team",
  },
  {
    id: "general-reminder",
    name: "Speaker reminder",
    category: "Reminder",
    segment: "all-speakers",
    subject: "Reminder: your {{event_name}} speaker details",
    body: "Hi {{first_name}},\n\nA quick reminder to review your details and outstanding items for {{event_name}}.\n\nOpen your portal: {{portal_url}}\n\nThank you!",
  },
  {
    id: "task-due",
    name: "Task due reminder",
    category: "Task",
    segment: "incomplete-tasks",
    subject: "Due soon: {{task_title}}",
    body: "Hi {{first_name}},\n\nYour speaker task “{{task_title}}” is due {{task_due_date}}. Please complete it in your portal before the deadline.\n\n{{portal_url}}",
  },
  {
    id: "session-scheduled",
    name: "Session scheduled",
    category: "Schedule",
    segment: "accepted-speakers",
    subject: "Your {{event_name}} session is scheduled",
    body: "Hi {{first_name}},\n\n“{{session_title}}” is scheduled for {{session_start}} at {{session_location}}. A calendar invitation is attached.\n\nReview your session: {{portal_url}}",
    attachCalendar: true,
  },
];

export const DEFAULT_REMINDERS = [
  { id: "reminder-profile", name: "Incomplete speaker profile", templateId: "general-reminder", segment: "all-speakers", amount: 7, unit: "days before event", timing: "7 days before event", enabled: true },
  { id: "reminder-task", name: "Outstanding task deadline", templateId: "task-due", segment: "incomplete-tasks", amount: 3, unit: "days before task due", timing: "3 days before task due", enabled: true },
  { id: "reminder-session", name: "Upcoming session", templateId: "session-scheduled", segment: "accepted-speakers", amount: 24, unit: "hours before session", timing: "24 hours before session", enabled: false },
];

export const SEGMENTS = [
  { id: "all-speakers", label: "All speakers" },
  { id: "accepted-speakers", label: "Accepted speakers" },
  { id: "pending-submitters", label: "Pending submitters" },
  { id: "declined-submitters", label: "Declined submitters" },
  { id: "incomplete-tasks", label: "Speakers with incomplete tasks" },
];

export function segmentRecipients(data, segmentId) {
  const people = data.participants || [];
  if (segmentId === "accepted-speakers") return acceptedParticipants(data);
  if (segmentId === "pending-submitters" || segmentId === "declined-submitters") {
    const status = segmentId === "pending-submitters" ? "Pending" : "Declined";
    const ids = new Set((data.abstracts || []).filter((abstract) => abstract.status === status).flatMap((abstract) => participantsForAbstract(data, abstract).map((person) => person.id)));
    return people.filter((person) => ids.has(person.id));
  }
  if (segmentId === "incomplete-tasks") return people.filter((person) => tasksForParticipant(data, person.id).some((task) => !task.complete));
  return people.filter((person) => person.role === "Speaker" || !person.role);
}

export function buildMergeContext(data, person, overrides = {}) {
  const event = data.event || {};
  const relatedAbstracts = person?.id ? abstractsForParticipant(data, person.id) : [];
  const segmentStatus = {
    "accepted-speakers": "accepted",
    "pending-submitters": "pending",
    "declined-submitters": "declined",
  }[overrides.segment];
  const segmentSubmission = segmentStatus
    ? relatedAbstracts.find(
        (item) => String(item.status || "").toLowerCase() === segmentStatus,
      )
    : null;
  const submission = overrides.submission || segmentSubmission || relatedAbstracts.find((item) => item.status === "Accepted") || relatedAbstracts[0] || data.abstracts?.[0] || {};
  const session = overrides.session || data.sessions?.find((item) => item.sourceAbstractId === submission.id || item.participants?.includes(person?.id)) || submission;
  const relatedTasks = person?.id ? tasksForParticipant(data, person.id) : [];
  const task = overrides.task || relatedTasks.find((item) => !item.complete) || relatedTasks[0] || {};
  const start = session.startsAt || session.start || session.startTime || event.start;
  return {
    first_name: person?.name?.split(" ")[0] || data.organizer?.firstName || "Speaker",
    full_name: person?.name || "Speaker",
    event_name: event.name || "the event",
    event_dates: event.dates || "",
    event_location: event.location || "",
    portal_url: `${window.location.origin}${window.location.pathname}#/speaker-portal`,
    submission_title: submission.title || "Your submission",
    submission_status: submission.status || "Pending",
    session_title: session.title || submission.title || "Your session",
    session_start: start ? formatDateTime(start, event.timezone) : "To be announced",
    session_location: session.room || session.location || event.location || "To be announced",
    task_title: task.title || "Speaker task",
    task_due_date: task.due || "September 30, 2026",
    ...overrides,
  };
}

export function renderMergeFields(value = "", context = {}) {
  return value.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => context[key] ?? `{{${key}}}`);
}

export function makeDryRunEntry({ action, template, segment, recipients, subject, body, scheduledFor, attachCalendar, exactPayload = null, matchedRecipientCount = null }) {
  return {
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    status: action === "schedule" ? "Scheduled · dry run" : "Queued · dry run",
    provider: "Local preview",
    templateId: template.id,
    templateName: template.name,
    segment,
    recipientCount: recipients.length,
    recipients: recipients.map((person) => ({ id: person.id, name: person.name, email: person.email })),
    subject,
    body,
    scheduledFor: scheduledFor || null,
    attachCalendar: Boolean(attachCalendar),
    exactPayload,
    matchedRecipientCount: matchedRecipientCount ?? recipients.length,
    createdAt: new Date().toISOString(),
  };
}

function reminderTiming(reminder) {
  if (reminder.amount && reminder.unit) return { amount: Number(reminder.amount), unit: reminder.unit };
  const match = String(reminder.timing || "").match(/(\d+)\s+(.+)/);
  return { amount: Number(match?.[1] || 0), unit: match?.[2] || "days before event" };
}

export function reminderDueAt(data, reminder) {
  const { amount, unit } = reminderTiming(reminder);
  const timezone = data.event?.timezone || "UTC";
  let base;
  if (unit.includes("task due")) {
    const dueTasks = (data.tasks || []).filter((task) => !task.complete && task.due).map((task) => localTimeInZoneToUtc(task.due, timezone)).filter((date) => !Number.isNaN(date.getTime()));
    base = dueTasks.sort((left, right) => left - right)[0];
  } else if (unit.includes("session")) {
    const starts = (data.sessions || []).filter((session) => session.startsAt || session.start).map((session) => localTimeInZoneToUtc(session.startsAt || session.start, timezone)).filter((date) => !Number.isNaN(date.getTime()));
    base = starts.sort((left, right) => left - right)[0];
  } else if (data.event?.start) base = localTimeInZoneToUtc(data.event.start, timezone);
  if (!base) return null;
  const milliseconds = amount * (unit.startsWith("hour") || unit.includes("hours") ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000);
  return new Date(base.getTime() - milliseconds);
}

export function materializeReminderDryRuns(data, reminders = DEFAULT_REMINDERS, templates = SEEDED_TEMPLATES, at = new Date(), { force = false } = {}) {
  const dayKey = at.toISOString().slice(0, 10);
  const existing = new Set((data.emailLog || []).map((entry) => entry.automationKey).filter(Boolean));
  return reminders.filter((reminder) => reminder.enabled).flatMap((reminder) => {
    const dueAt = reminderDueAt(data, reminder);
    if (!force && (!dueAt || at < dueAt)) return [];
    const automationKey = force ? `${reminder.id}:simulation:${dayKey}` : `${reminder.id}:${dueAt.toISOString()}`;
    if (existing.has(automationKey)) return [];
    const template = templates.find((item) => item.id === reminder.templateId);
    if (!template) return [];
    const recipients = segmentRecipients(data, reminder.segment);
    if (!recipients.length) return [];
    const exactPayload = buildSyntheticCommunicationPayload({
      template,
      identityId: "eventops-speaker-test",
      action: "automation",
      scheduledFor: (dueAt || at).toISOString(),
      attachCalendar: template.attachCalendar,
    });
    return [{
      ...makeDryRunEntry({ action: "automation", template, segment: reminder.segment, recipients: exactPayload.to, subject: exactPayload.subject, body: exactPayload.text, scheduledFor: (dueAt || at).toISOString(), attachCalendar: template.attachCalendar, exactPayload, matchedRecipientCount: recipients.length }),
      automationKey,
      reminderId: reminder.id,
      dueAt: dueAt?.toISOString() || null,
      evaluatedAt: at.toISOString(),
      timing: reminder.timing,
      status: force ? "Simulated · automated dry run" : "Due · automated dry run",
      provider: "Local reminder engine",
    }];
  });
}

export function createCalendarPayload(data, person, overrides = {}) {
  const event = data.event || {};
  const relatedAbstracts = person?.id ? abstractsForParticipant(data, person.id) : [];
  const submission = overrides.submission || relatedAbstracts.find((item) => item.status === "Accepted") || relatedAbstracts[0] || data.abstracts?.[0] || {};
  const session = overrides.session || data.sessions?.find((item) => item.sourceAbstractId === submission.id || item.participants?.includes(person?.id)) || submission;
  const start = session.startsAt || session.start || session.startTime || event.start;
  const end = session.endsAt || session.end || session.endTime || event.end;
  const startDate = localTimeInZoneToUtc(start, event.timezone);
  const endDate = localTimeInZoneToUtc(end, event.timezone);
  return {
    uid: `${session.id || "event-session"}@callboard.local`,
    title: session.title || submission.title || event.name || "Event session",
    description: session.description || event.theme || "",
    location: session.room || session.location || event.location || "",
    url: event.website || `${window.location.origin}${window.location.pathname}#/speaker-portal`,
    organizerName: data.organizer?.name || "Event organizer",
    organizerEmail: data.organizer?.email || "organizer@example.com",
    attendeeName: person?.name || "Speaker",
    attendeeEmail: person?.email || "speaker@example.com",
    start: startDate,
    end: endDate > startDate ? endDate : new Date(startDate.getTime() + 60 * 60 * 1000),
    method: String(overrides.method || "REQUEST").toUpperCase() === "CANCEL" ? "CANCEL" : "REQUEST",
    sequence: Math.max(0, Number(overrides.sequence ?? 0)),
  };
}

export function createIcsInvitation(payload) {
  const method = String(payload.method || "REQUEST").toUpperCase() === "CANCEL" ? "CANCEL" : "REQUEST";
  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Callboard//Event Program//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${escapeIcs(payload.uid)}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(payload.start)}`,
    `DTEND:${formatIcsUtc(payload.end)}`,
    `SEQUENCE:${Math.max(0, Number(payload.sequence ?? 0))}`,
    `STATUS:${status}`,
    `ORGANIZER;CN=${escapeIcsParameter(payload.organizerName)}:mailto:${payload.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsParameter(payload.attendeeName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${payload.attendeeEmail}`,
    `SUMMARY:${escapeIcs(payload.title)}`,
    `DESCRIPTION:${escapeIcs(payload.description)}`,
    `LOCATION:${escapeIcs(payload.location)}`,
    `URL:${escapeIcs(payload.url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

export function calendarLinks(payload) {
  const start = formatIcsUtc(payload.start);
  const end = formatIcsUtc(payload.end);
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: payload.title, dates: `${start}/${end}`, details: payload.description, location: payload.location }).toString();
  const outlook = new URL("https://outlook.office.com/calendar/0/deeplink/compose");
  outlook.search = new URLSearchParams({ path: "/calendar/action/compose", rru: "addevent", subject: payload.title, startdt: payload.start.toISOString(), enddt: payload.end.toISOString(), body: payload.description, location: payload.location }).toString();
  return { google: google.toString(), outlook: outlook.toString() };
}

export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function formatDateTime(value, timezone) {
  const date = localTimeInZoneToUtc(value, timezone);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "UTC" }).format(date);
}

export function localTimeInZoneToUtc(value, timezone = "UTC") {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (/Z$|[+-]\d\d:?\d\d$/.test(value)) return new Date(value);
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return new Date(value);
  const desired = { year:+match[1], month:+match[2], day:+match[3], hour:+(match[4] || 0), minute:+(match[5] || 0), second:+(match[6] || 0) };
  const guess = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" }).formatToParts(new Date(guess));
  const zoned = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, +part.value]));
  const observed = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return new Date(guess - (observed - guess));
}

function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function escapeIcsParameter(value = "") {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const output = [];
  let current = "";
  let limit = 75;
  for (const char of line) {
    if (encoder.encode(current + char).length > limit) {
      output.push(current);
      current = ` ${char}`;
      limit = 75;
    } else current += char;
  }
  output.push(current);
  return output;
}
