import assert from "node:assert/strict";
import test from "node:test";

import { scheduleConflicts } from "../src/lib/domain.js";

test("schedule conflicts identify duplicate speaker records by normalized name", () => {
  const participants = [
    { id: "speaker-a", name: "Priya Raman", email: "priya@example.test" },
    { id: "speaker-b", name: "  Priya   Raman ", email: "priya+duplicate@example.test" },
  ];
  const sessions = [
    {
      id: "session-a",
      title: "Session A",
      startsAt: "2027-05-12T14:00:00.000Z",
      endsAt: "2027-05-12T14:30:00.000Z",
      participants: ["speaker-a"],
    },
    {
      id: "session-b",
      title: "Session B",
      startsAt: "2027-05-12T14:00:00.000Z",
      endsAt: "2027-05-12T14:30:00.000Z",
      participantIds: ["speaker-b"],
    },
  ];

  const conflict = scheduleConflicts(sessions, participants).find(
    (item) => item.type === "Speaker conflict",
  );
  assert.ok(conflict);
  assert.deepEqual(conflict.participantIds.sort(), ["speaker-a", "speaker-b"]);
});

test("schedule conflicts do not flag different speakers", () => {
  const participants = [
    { id: "speaker-a", name: "Priya Raman", email: "priya@example.test" },
    { id: "speaker-b", name: "Nora Chen", email: "nora@example.test" },
  ];
  const sessions = [
    { id: "a", title: "A", startsAt: "2027-05-12T14:00:00Z", endsAt: "2027-05-12T14:30:00Z", participants: ["speaker-a"] },
    { id: "b", title: "B", startsAt: "2027-05-12T14:00:00Z", endsAt: "2027-05-12T14:30:00Z", participants: ["speaker-b"] },
  ];

  assert.equal(
    scheduleConflicts(sessions, participants).some((item) => item.type === "Speaker conflict"),
    false,
  );
});
