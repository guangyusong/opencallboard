function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function participantForEmail(data, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return (data.participants ?? []).find((person) => normalizeEmail(person.email) === normalized) ?? null;
}

export function participantIdsForAbstract(data, abstract) {
  const knownIds = new Set((data.participants ?? []).map((person) => person.id));
  const explicit = abstract?.participantIds ?? abstract?.participants ?? [];
  const valid = explicit.filter((id) => knownIds.has(id));
  if (valid.length) return [...new Set(valid)];
  const submitter = participantForEmail(data, abstract?.submitterEmail);
  return submitter ? [submitter.id] : [];
}

export function participantsForAbstract(data, abstract) {
  const ids = new Set(participantIdsForAbstract(data, abstract));
  return (data.participants ?? []).filter((person) => ids.has(person.id));
}

export function abstractsForParticipant(data, personId) {
  return (data.abstracts ?? []).filter((abstract) => participantIdsForAbstract(data, abstract).includes(personId));
}

export function acceptedParticipants(data) {
  const ids = new Set(
    (data.abstracts ?? [])
      .filter((abstract) => abstract.status === "Accepted")
      .flatMap((abstract) => participantIdsForAbstract(data, abstract)),
  );
  return (data.participants ?? []).filter((person) => ids.has(person.id));
}

export function tasksForParticipant(data, personId) {
  const abstractIds = new Set(abstractsForParticipant(data, personId).map((abstract) => abstract.id));
  return (data.tasks ?? []).filter((task) => {
    if (task.personId) return task.personId === personId;
    if (task.abstractId) return abstractIds.has(task.abstractId);
    return true;
  });
}

export function acceptedSessions(data) {
  return (data.sessions ?? []).filter((session) => !["Declined", "Withdrawn"].includes(session.status));
}

export function scheduleConflicts(sessions = []) {
  const conflicts = [];
  for (let left = 0; left < sessions.length; left += 1) for (let right = left + 1; right < sessions.length; right += 1) {
    const first = sessions[left];
    const second = sessions[right];
    const firstStart = Date.parse(first.startsAt || first.start || "");
    const firstEnd = Date.parse(first.endsAt || first.end || "");
    const secondStart = Date.parse(second.startsAt || second.start || "");
    const secondEnd = Date.parse(second.endsAt || second.end || "");
    if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite) || firstStart >= secondEnd || secondStart >= firstEnd) continue;
    const duration = Math.max(secondEnd - secondStart, 60 * 60 * 1000);
    const resolvedStart = Math.ceil(firstEnd / (60 * 60 * 1000)) * 60 * 60 * 1000;
    const resolution = { label: `Move ${second.title} after ${first.title}`, sessionId: second.id, startsAt: new Date(resolvedStart).toISOString(), endsAt: new Date(resolvedStart + duration).toISOString() };
    if (first.room && first.room === second.room) conflicts.push({ id: `room-${first.id}-${second.id}`, type: "Room overlap", detail: `${first.title} and ${second.title} overlap in ${first.room}.`, sessions: [first.id, second.id], recommendation: "Move one session or assign a different room.", resolution });
    const shared = (first.participants || []).filter((id) => (second.participants || []).includes(id));
    if (shared.length) conflicts.push({ id: `speaker-${first.id}-${second.id}`, type: "Speaker conflict", detail: `${first.title} and ${second.title} share a participant at the same time.`, sessions: [first.id, second.id], participantIds: shared, recommendation: "Move one session so the shared speaker can attend both.", resolution });
    if (first.track && first.track === second.track) conflicts.push({ id: `track-${first.id}-${second.id}`, type: "Track overlap", detail: `${first.title} and ${second.title} overlap in ${first.track}.`, sessions: [first.id, second.id], rule: "One session per track at a time", recommendation: "Move one session or assign a different track.", resolution });
  }
  return conflicts;
}
