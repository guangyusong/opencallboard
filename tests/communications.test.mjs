import assert from "node:assert/strict";
import test from "node:test";

import {
  createCalendarPayload,
  createIcsInvitation,
} from "../src/lib/communications.js";
import { syntheticCalendarMetadata } from "../src/lib/communicationsRelease.js";

const data = {
  event: {
    name: "Callboard Summit",
    timezone: "America/Toronto",
    website: "https://example.test/event",
  },
  organizer: {
    name: "Event Operations",
    email: "eventops-organizer-test@opencallboard.invalid",
  },
  abstracts: [
    {
      id: "abstract-1",
      title: "Reliable event operations",
      status: "Accepted",
      participantIds: ["speaker-1"],
    },
  ],
  sessions: [
    {
      id: "session-1",
      sourceAbstractId: "abstract-1",
      title: "Reliable event operations",
      description:
        "A deliberately long description that verifies RFC 5545 content lines are folded without exceeding the seventy-five octet limit.",
      room: "Main stage",
      startsAt: "2026-09-30T09:00",
      endsAt: "2026-09-30T10:00",
      participants: ["speaker-1"],
    },
  ],
};

const person = {
  id: "speaker-1",
  name: "Test Speaker",
  email: "eventops-speaker-test@opencallboard.invalid",
};

test("calendar invitations preserve UID while updating and cancelling", () => {
  const initial = createCalendarPayload(data, person, {
    method: "REQUEST",
    sequence: 0,
  });
  const update = createCalendarPayload(data, person, {
    method: "REQUEST",
    sequence: 1,
  });
  const cancellation = createCalendarPayload(data, person, {
    method: "CANCEL",
    sequence: 2,
  });

  assert.equal(initial.uid, "session-1@callboard.local");
  assert.equal(update.uid, initial.uid);
  assert.equal(cancellation.uid, initial.uid);

  const initialIcs = createIcsInvitation(initial);
  const updateIcs = createIcsInvitation(update);
  const cancellationIcs = createIcsInvitation(cancellation);

  assert.match(initialIcs, /\r\nMETHOD:REQUEST\r\n/);
  assert.match(initialIcs, /\r\nSEQUENCE:0\r\nSTATUS:CONFIRMED\r\n/);
  assert.match(updateIcs, /\r\nMETHOD:REQUEST\r\n/);
  assert.match(updateIcs, /\r\nSEQUENCE:1\r\nSTATUS:CONFIRMED\r\n/);
  assert.match(cancellationIcs, /\r\nMETHOD:CANCEL\r\n/);
  assert.match(cancellationIcs, /\r\nSEQUENCE:2\r\nSTATUS:CANCELLED\r\n/);
  assert.match(cancellationIcs, /\r\nUID:session-1@callboard\.local\r\n/);

  for (const line of cancellationIcs.split("\r\n").filter(Boolean)) {
    assert.ok(
      new TextEncoder().encode(line).length <= 75,
      `ICS line exceeds 75 octets: ${line}`,
    );
  }
  assert.equal(cancellationIcs.endsWith("\r\n"), true);
  assert.equal(/(^|[^\r])\n/.test(cancellationIcs), false);
});

test("the guarded synthetic email calendar matches its inspected message", () => {
  assert.deepEqual(syntheticCalendarMetadata({ method: "REQUEST", sequence: 0 }), {
    uid: "session-synthetic@callboard.local",
    method: "REQUEST",
    sequence: 0,
    status: "CONFIRMED",
    start: "2026-10-12T16:00:00.000Z",
    end: "2026-10-12T17:00:00.000Z",
    location: "Test Room A",
  });
});
