import { eventDateTime } from "./formEngine.js";

const SPEAKER_HEADERS = [
  "Speaker Id",
  "First Name",
  "Last Name",
  "Email",
  "Pronouns",
  "Title",
  "Company",
  "Bio",
  "LinkedIn URL",
  "Instagram Handle",
  "Twitter Handle",
  "Override Profile Details",
  "Allow to Edit Sessions",
  "Primary Sessions",
  "Secondary Sessions",
];

const LOCATION_HEADERS = ["Location", "Source URL", "Attendee Meetings"];

const SESSION_HEADERS = [
  "ID",
  "Title",
  "Format",
  "Session Type",
  "Start Date",
  "Start Time",
  "End Time",
  "Full Detail",
  "Capacity",
  "Short Description",
  "Tags",
  "Tracks",
  "Location Id",
  "Primary speaker",
  "Secondary speaker",
];

function csvCell(value) {
  let text = String(value ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  // CFP content is organizer-reviewed but still user supplied. Keep spreadsheet apps from
  // interpreting a title, biography, or description as a formula if the CSV is opened first.
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers, rows) {
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function splitName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function acceptedSessions(data) {
  return (data.sessions || []).filter(
    (session) => String(session.status || "").toLowerCase() === "accepted",
  );
}

function sessionParticipantIds(session) {
  if (Array.isArray(session.participantIds)) return session.participantIds;
  if (!Array.isArray(session.participants)) return [];
  return session.participants
    .map((participant) => typeof participant === "string" ? participant : participant?.id)
    .filter(Boolean);
}

function normalizedEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : "";
}

function supportedTimezone(value) {
  const timezone = String(value || "UTC").trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return { timezone, fallback: false };
  } catch {
    return { timezone: "UTC", fallback: true };
  }
}

function sessionFormat(session, data) {
  const source = (data.abstracts || []).find(
    (item) => item.id === session.sourceAbstractId,
  );
  const value = String(session.format || source?.format || "").toLowerCase();
  if (value.includes("keynote") || value.includes("main stage")) return "MAIN_STAGE_SESSION";
  if (value.includes("workshop")) return "WORKSHOP";
  if (value.includes("meet")) return "MEET_UP";
  if (value.includes("break")) return "BREAK";
  if (value.includes("expo")) return "EXPO";
  if (value.includes("lightning") || value.includes("other")) return "OTHER";
  return "REGULAR_SESSION";
}

function sessionType(session, data) {
  const value = String(
    session.sessionType || session.type || data.event?.sessionType || data.event?.eventType || data.event?.type || "",
  ).toLowerCase();
  if (value.includes("hybrid")) return "HYBRID";
  if (value.includes("virtual") || value.includes("online")) return "VIRTUAL";
  return "IN_PERSON";
}

function dateTimeParts(value, timezone) {
  if (!value) return { date: "", time: "" };
  const parsed = value instanceof Date ? value : eventDateTime(value, timezone);
  if (!parsed || !Number.isFinite(parsed.getTime())) return { date: "", time: "" };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(parsed)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function referencedSpeakers(data, sessions) {
  const ids = new Set(sessions.flatMap(sessionParticipantIds));
  return (data.participants || []).filter((person) => ids.has(person.id));
}

function scheduleIssue(session, timezone, event) {
  if (!session.startsAt || !session.endsAt) return "missing";
  const startsAt = eventDateTime(session.startsAt, timezone);
  const endsAt = eventDateTime(session.endsAt, timezone);
  if (!startsAt || !endsAt) return "invalid";
  if (endsAt <= startsAt) return "invalid";
  if (dateTimeParts(startsAt, timezone).date !== dateTimeParts(endsAt, timezone).date)
    return "cross-day";
  const eventStart = eventDateTime(event?.startsAt || event?.start, timezone);
  const eventEnd = eventDateTime(event?.endsAt || event?.end, timezone);
  if (
    eventStart && eventEnd &&
    (startsAt < eventStart || endsAt > eventEnd)
  ) return "outside-event";
  return "";
}

export function buildAcceleventsCsvPack(data) {
  const accepted = acceptedSessions(data);
  const { timezone, fallback: timezoneFallback } = supportedTimezone(data.event?.timezone);
  const scheduleIssues = accepted.map((session) => ({
    session,
    issue: scheduleIssue(session, timezone, data.event),
  }));
  const sessions = scheduleIssues.filter(({ issue }) => !issue).map(({ session }) => session);
  const referenced = referencedSpeakers(data, accepted);
  const invalidSpeakers = referenced.filter((person) => !normalizedEmail(person.email));
  const speakerByEmail = new Map();
  const speakerEmailById = new Map();
  for (const person of referenced) {
    const email = normalizedEmail(person.email);
    if (!email) continue;
    speakerEmailById.set(person.id, email);
    if (!speakerByEmail.has(email)) speakerByEmail.set(email, { ...person, email });
  }
  const speakers = [...speakerByEmail.values()];
  const duplicateSpeakerEmails = referenced.length - invalidSpeakers.length - speakers.length;
  const peopleById = new Map((data.participants || []).map((person) => [person.id, person]));
  const locations = [...new Set(sessions.map((session) => String(session.room || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const omittedSpeakerAssignments = sessions.reduce(
    (count, session) => count + sessionParticipantIds(session).filter(
      (id) => !peopleById.has(id) || !speakerEmailById.get(id),
    ).length,
    0,
  );

  const speakerRows = speakers.map((person) => {
    const { firstName, lastName } = splitName(person.name);
    return [
      "",
      firstName,
      lastName,
      person.email,
      person.pronouns,
      person.title,
      person.company,
      person.bio,
      person.linkedin || person.linkedinUrl,
      person.instagram || person.instagramHandle,
      person.twitter || person.twitterHandle,
      "N",
      "N",
      "",
      "",
    ];
  });

  const locationRows = locations.map((location) => [location, "", "N"]);

  const sessionRows = sessions.map((session) => {
    const start = dateTimeParts(session.startsAt, timezone);
    const end = dateTimeParts(session.endsAt, timezone);
    const sessionSpeakers = [...new Set(
      sessionParticipantIds(session).map((id) => speakerEmailById.get(id)).filter(Boolean),
    )];
    const source = (data.abstracts || []).find(
      (item) => item.id === session.sourceAbstractId,
    );
    const tags = [...new Set([...(session.tags || []), ...(source?.tags || [])].filter(Boolean))].join(", ");
    const track = session.track || source?.track || "";
    const roomPrefix = session.room ? `Room: ${session.room}` : "";
    const shortDescription = [roomPrefix, String(session.description || "").slice(0, 120)]
      .filter(Boolean)
      .join(" · ");
    return [
      "",
      session.title,
      sessionFormat(session, data),
      sessionType(session, data),
      start.date,
      start.time,
      end.time,
      session.description,
      "",
      shortDescription,
      tags,
      track,
      "",
      sessionSpeakers[0] || "",
      sessionSpeakers.slice(1).join(","),
    ];
  });

  const missingScheduleSessions = scheduleIssues.filter(({ issue }) => issue === "missing").length;
  const invalidScheduleSessions = scheduleIssues.filter(
    ({ issue }) => ["invalid", "cross-day"].includes(issue),
  ).length;
  const outsideEventSessions = scheduleIssues.filter(({ issue }) => issue === "outside-event").length;

  return {
    summary: {
      speakers: speakers.length,
      locations: locations.length,
      sessions: sessions.length,
      acceptedSessions: accepted.length,
      invalidSpeakers: invalidSpeakers.length,
      duplicateSpeakerEmails,
      omittedSpeakerAssignments,
      missingScheduleSessions,
      invalidScheduleSessions,
      outsideEventSessions,
      blockedSessions: accepted.length - sessions.length,
      timezoneFallback,
    },
    files: {
      speakers: {
        filename: "callboard-accelevents-speakers.csv",
        content: csv(SPEAKER_HEADERS, speakerRows),
        rowCount: speakerRows.length,
      },
      locations: {
        filename: "callboard-accelevents-locations.csv",
        content: csv(LOCATION_HEADERS, locationRows),
        rowCount: locationRows.length,
      },
      sessions: {
        filename: "callboard-accelevents-sessions.csv",
        content: csv(SESSION_HEADERS, sessionRows),
        rowCount: sessionRows.length,
      },
    },
  };
}
