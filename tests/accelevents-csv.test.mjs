import test from "node:test";
import assert from "node:assert/strict";
import { buildAcceleventsCsvPack } from "../src/lib/acceleventsCsv.js";

const data = {
  event: { timezone: "America/Los_Angeles" },
  participants: [
    { id: "speaker-1", name: "Priya Raman", email: "priya@example.test", title: "Principal Engineer", company: "Latticework", bio: "Builds reliable systems." },
    { id: "speaker-2", name: "Marcus Okafor", email: "marcus@example.test", bio: "Agents, evaluation, and platforms." },
    { id: "organizer", name: "Avery Organizer", email: "avery@example.test", role: "Organizer" },
  ],
  abstracts: [
    { id: "abstract-1", format: "Featured Keynote", track: "AI Engineering", tags: ["Production AI"] },
  ],
  sessions: [
    {
      id: "session-1",
      sourceAbstractId: "abstract-1",
      title: "Shipping Reliable AI, Without the Demo Trap",
      description: "A practical session with \"real\" evidence.",
      status: "Accepted",
      startsAt: "2026-10-12T16:00:00Z",
      endsAt: "2026-10-12T16:30:00Z",
      room: "Main Stage",
      track: "AI Engineering",
      participants: ["speaker-1", "speaker-2"],
    },
    { id: "session-2", title: "Private draft", status: "Draft", participants: ["organizer"] },
  ],
};

test("Accelevents CSV pack follows the current browser import templates", () => {
  const pack = buildAcceleventsCsvPack(data);
  assert.deepEqual(pack.summary, {
    speakers: 2,
    locations: 1,
    sessions: 1,
    acceptedSessions: 1,
    invalidSpeakers: 0,
    duplicateSpeakerEmails: 0,
    omittedSpeakerAssignments: 0,
    missingScheduleSessions: 0,
    invalidScheduleSessions: 0,
    outsideEventSessions: 0,
    blockedSessions: 0,
    timezoneFallback: false,
  });
  assert.match(pack.files.speakers.content, /^Speaker Id,First Name,Last Name,Email,Pronouns,Title,Company,Bio,LinkedIn URL,Instagram Handle,Twitter Handle,Override Profile Details,Allow to Edit Sessions,Primary Sessions,Secondary Sessions\r\n/);
  assert.match(pack.files.speakers.content, /,Priya,Raman,priya@example\.test,,Principal Engineer,Latticework,Builds reliable systems\.,,,,N,N,,/);
  assert.equal(pack.files.locations.content, "Location,Source URL,Attendee Meetings\r\nMain Stage,,N\r\n");
  assert.match(pack.files.sessions.content, /^ID,Title,Format,Session Type,Start Date,Start Time,End Time,Full Detail,Capacity,Short Description,Tags,Tracks,Location Id,Primary speaker,Secondary speaker\r\n/);
  assert.match(pack.files.sessions.content, /,"Shipping Reliable AI, Without the Demo Trap",MAIN_STAGE_SESSION,IN_PERSON,12\/10\/2026,09:00,09:30,/);
  assert.match(pack.files.sessions.content, /"A practical session with ""real"" evidence\."/);
  assert.match(pack.files.sessions.content, /Production AI,AI Engineering,,priya@example\.test,marcus@example\.test/);
  assert.doesNotMatch(pack.files.sessions.content, /Private draft/);
  assert.doesNotMatch(pack.files.speakers.content, /Avery Organizer/);
  assert.equal(pack.files.speakers.rowCount, 2);
  assert.equal(pack.files.locations.rowCount, 1);
  assert.equal(pack.files.sessions.rowCount, 1);
});

test("Accelevents CSV pack blocks accepted sessions that still need schedule times", () => {
  const pack = buildAcceleventsCsvPack({
    ...data,
    sessions: [
      ...data.sessions,
      { id: "session-3", title: "Accepted but unscheduled", status: "Accepted", participants: ["speaker-1"] },
    ],
  });
  assert.equal(pack.summary.acceptedSessions, 2);
  assert.equal(pack.summary.sessions, 1);
  assert.equal(pack.summary.missingScheduleSessions, 1);
  assert.equal(pack.summary.blockedSessions, 1);
  assert.doesNotMatch(pack.files.sessions.content, /Accepted but unscheduled/);
});

test("Accelevents CSV pack blocks invalid, reverse, cross-day, and outside-event schedules", () => {
  const pack = buildAcceleventsCsvPack({
    ...data,
    event: { ...data.event, startsAt: "2026-10-12T07:00:00Z", endsAt: "2026-10-14T23:00:00Z" },
    sessions: [
      { id: "invalid", title: "Invalid", status: "Accepted", startsAt: "bad", endsAt: "also-bad" },
      { id: "reverse", title: "Reverse", status: "Accepted", startsAt: "2026-10-12T18:00:00Z", endsAt: "2026-10-12T17:00:00Z" },
      { id: "cross-day", title: "Cross day", status: "Accepted", startsAt: "2026-10-13T06:30:00Z", endsAt: "2026-10-13T07:30:00Z" },
      { id: "outside", title: "Outside", status: "Accepted", startsAt: "2026-10-15T16:00:00Z", endsAt: "2026-10-15T17:00:00Z" },
    ],
  });
  assert.equal(pack.summary.sessions, 0);
  assert.equal(pack.summary.invalidScheduleSessions, 3);
  assert.equal(pack.summary.outsideEventSessions, 1);
  assert.equal(pack.summary.blockedSessions, 4);
  assert.equal(pack.files.sessions.rowCount, 0);
});

test("Accelevents CSV pack merges duplicate emails and omits invalid assignments", () => {
  const pack = buildAcceleventsCsvPack({
    ...data,
    participants: [
      data.participants[0],
      { ...data.participants[1], email: " PRIYA@example.test " },
      { id: "speaker-3", name: "No Email", email: "invalid" },
    ],
    sessions: [{ ...data.sessions[0], participants: ["speaker-1", "speaker-2", "speaker-3"] }],
  });
  assert.equal(pack.summary.speakers, 1);
  assert.equal(pack.summary.duplicateSpeakerEmails, 1);
  assert.equal(pack.summary.invalidSpeakers, 1);
  assert.equal(pack.summary.omittedSpeakerAssignments, 1);
  assert.equal(pack.files.speakers.rowCount, 1);
  assert.doesNotMatch(pack.files.sessions.content, /invalid/);
});

test("Accelevents CSV pack neutralizes spreadsheet formula prefixes", () => {
  const pack = buildAcceleventsCsvPack({
    ...data,
    sessions: [{ ...data.sessions[0], title: "=HYPERLINK(\"https://example.test\")" }],
  });
  assert.match(pack.files.sessions.content, /"'=HYPERLINK\(""https:\/\/example\.test""\)"/);
});

test("Accelevents CSV pack safely falls back when an event timezone is invalid", () => {
  const pack = buildAcceleventsCsvPack({ ...data, event: { timezone: "Mars/Olympus" } });
  assert.equal(pack.summary.timezoneFallback, true);
  assert.match(pack.files.sessions.content, /12\/10\/2026,16:00,16:30/);
});

test("Accelevents CSV pack interprets timezone-less event and session values in the event timezone", () => {
  const pack = buildAcceleventsCsvPack({
    ...data,
    event: {
      timezone: "America/Los_Angeles",
      startsAt: "2026-10-12T09:00",
      endsAt: "2026-10-12T17:00",
    },
    sessions: [{
      ...data.sessions[0],
      startsAt: "2026-10-12T09:00",
      endsAt: "2026-10-12T09:30",
    }],
  });
  assert.equal(pack.summary.blockedSessions, 0);
  assert.match(pack.files.sessions.content, /12\/10\/2026,09:00,09:30/);
});
