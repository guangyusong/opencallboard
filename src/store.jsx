import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadSharedWorkspace, loadSharedWorkspaceVersion } from "./lib/sharedApi.js";

const STORAGE_KEY = "callboard-demo-v1";
const DATA_SCHEMA_VERSION = 9;
const SHARED_REFRESH_INTERVAL_MS = 5000;

const initialData = {
  schemaVersion: DATA_SCHEMA_VERSION,
  event: {
    name: "AI.Engineer Sandbox Event — NYC",
    shortName: "AI.Engineer Sandbox",
    initials: "AS",
    dates: "Oct 12–14, 2026",
    start: "2026-10-12T09:00",
    end: "2026-10-14T17:00",
    timezone: "America/Los_Angeles",
    location: "New York, NY",
    website: "https://ai.engineer",
    slug: "ai-engineer-sandbox-event",
    theme: "A practical gathering for engineers building the next generation of AI systems.",
  },
  organizer: { name: "Sw yx", firstName: "Sw", email: "swyx@ai.engineer", initials: "SY" },
  portalPersonId: "person-1",
  forms: [
    { id: "form-2", name: "Session Submission Form #2", externalTitle: "Session Submission Form", status: "Open", submissions: 1, drafts: 0, version: 1, closes: "Sep 15, 2026 at 11:59 PM PDT" },
    { id: "form-3", name: "Session Submission Form #3", externalTitle: "Submit a Session", status: "Open", submissions: 1, drafts: 0, version: 1, closes: "Sep 15, 2026 at 11:59 PM PDT" },
    { id: "form-4", name: "Session Submission Form #4", externalTitle: "Call for Speakers", status: "Open", submissions: 0, drafts: 0, version: 1, closes: "Sep 15, 2026 at 11:59 PM PDT" },
  ],
  abstracts: [
    { id: "abs-1", formId: "form-3", source: "Session Submission Form #3", title: "sd", description: "wdw", status: "Accepted", track: "Track 1", tags: ["Tag A"], submitted: "Fri August 7, 2026, 11:51:05 PM PDT", submitterEmail: "swyx@ai.engineer", participantIds: ["person-1", "person-2"], reviewRoute: "Round 2 · Program committee", reviewRound: 2 },
    { id: "abs-2", formId: "form-2", source: "Session Submission Form #2", title: ";lkj", description: "lkjasd", status: "Pending", track: "Track 2", tags: ["Tag A"], submitted: "Fri August 7, 2026, 11:32:55 PM PDT", submitterEmail: "swyx@ai.engineer", participantIds: ["person-1"], reviewRoute: "Round 1 · Technical review", reviewRound: 1 },
    { id: "abs-3", source: "Manual", title: "AIE Presenting Expo 1", description: "Expo session awaiting program review.", status: "Pending", track: "Track 1", tags: [], submitted: "Fri August 7, 2026, 02:52:23 PM PDT", participantIds: [] },
    { id: "abs-4", source: "Manual", title: "AIE NYC 2026: Insights from Session T...", description: "Imported session awaiting program review.", status: "Pending", track: "Track 2", tags: ["Tag A"], submitted: "Thu August 6, 2026, 02:10:49 PM PDT", participantIds: [] },
  ],
  sessions: [
    { id: "session-abs-1", sourceAbstractId: "abs-1", title: "sd", description: "wdw", status: "Accepted", track: "Track 1", room: "", startsAt: "", endsAt: "", participants: ["person-1", "person-2"] },
  ],
  participants: [
    { id: "person-1", name: "Sw yx", email: "swyx@ai.engineer", initials: "SY", role: "Speaker", bio: "", linkedin: "", website: "" },
    { id: "person-2", name: "Maya Chen", email: "maya@example.com", initials: "MC", role: "Speaker", bio: "AI infrastructure engineer and open-source maintainer." },
  ],
  tasks: [
    { id: "task-1", title: "Add your headshot", scope: "Contact", mode: "Manual", personId: "person-1", due: "2026-10-05T17:00", complete: false },
    { id: "task-2", title: "Confirm session details", scope: "Submission", mode: "Manual", abstractId: "abs-1", due: "2026-09-30T17:00", complete: false },
    { id: "task-3", title: "Upload final slides", scope: "Submission", mode: "Manual", abstractId: "abs-1", due: "2026-10-01T17:00", complete: false },
  ],
  portalForms: [],
  fileRequests: [],
  resources: [
    { id: "resource-guide", title: "Speaker preparation guide", kind: "Article", description: "Dates, deliverables, accessibility guidance, and presentation tips.", audience: "Accepted speakers" },
    { id: "resource-av", title: "Stage and A/V specifications", kind: "Article", description: "Presentation format, slide dimensions, microphones, and rehearsal guidance.", audience: "Accepted speakers" },
    { id: "resource-html", title: "Embedded speaker handbook", kind: "HTML Embed", description: "<main style='font:14px system-ui;padding:18px'><h2>Speaker handbook</h2><p>Arrive 30 minutes before your session and check in at the speaker ready room.</p><ul><li>16:9 slides</li><li>Bring a backup copy</li><li>Use accessible contrast</li></ul></main>", audience: "Accepted speakers" },
  ],
  portalFiles: [],
  speakerFiles: [],
  embeds: [
    { id: "embed-1", name: "Schedule Itinerary", format: "Styled HTML", enabled: true, view: "Schedule Itinerary", theme: "light", accent: "#2877c7", filter: "All tracks", fields: { description: true, speakers: true, location: true } },
    { id: "embed-2", name: "Speaker Gallery", format: "Styled HTML", enabled: true, view: "Speaker Gallery", theme: "light", accent: "#2877c7", filter: "All tracks", fields: { description: true, speakers: true, location: true } },
  ],
  emailLog: [],
  reminderRuns: [],
  reminderAutomationAvailable: false,
  reviews: [],
  evaluationRounds: [
    { id: "round-1", name: "Round 1 · Technical review", number: 1, status: "Open", blind: true, criteria: [{ id: "relevance", label: "Program relevance", weight: 30 }, { id: "originality", label: "Originality", weight: 20 }, { id: "technical", label: "Technical depth", weight: 30 }, { id: "practical", label: "Practical value", weight: 20 }], assignments: [{ id: "assignment-round-1-abs-2", abstractId: "abs-2", reviewerId: "reviewer-sarah", status: "Assigned" }, { id: "assignment-round-1-abs-3", abstractId: "abs-3", reviewerId: "reviewer-marcus", status: "Assigned" }, { id: "assignment-round-1-abs-4", abstractId: "abs-4", reviewerId: "reviewer-monica", status: "Assigned" }] },
    { id: "round-2", name: "Round 2 · Program committee", number: 2, status: "Upcoming", blind: false, criteria: [{ id: "committee-relevance", label: "Program relevance", weight: 30 }, { id: "committee-originality", label: "Originality", weight: 20 }, { id: "committee-technical", label: "Technical depth", weight: 30 }, { id: "committee-practical", label: "Practical value", weight: 20 }], assignments: [{ id: "assignment-round-2-abs-1", abstractId: "abs-1", reviewerId: "reviewer-marcus", status: "Assigned" }] },
  ],
  integrations: {
    accelevents: {
      enabled: false,
      eventUrl: "ai-engineer-sandbox-event",
      eventId: "",
      mode: "mock",
      externalSnapshot: {},
      syncHistory: [],
    },
  },
};

function migrateData(raw = {}) {
  const merged = { ...initialData, ...raw };
  const previousVersion = Number(raw.schemaVersion || 0);
  const needsRelationshipSeed = previousVersion < 2;
  const participantIds = new Set((merged.participants ?? []).map((person) => person.id));
  const participantByEmail = new Map((merged.participants ?? []).map((person) => [String(person.email ?? "").toLowerCase(), person.id]));
  const seededLinks = { "abs-1": ["person-1", "person-2"], "abs-2": ["person-1"] };
  const mergedAbstracts = needsRelationshipSeed
    ? [...(merged.abstracts ?? []), ...initialData.abstracts.filter((seeded) => !(merged.abstracts ?? []).some((abstract) => abstract.id === seeded.id))]
    : (merged.abstracts ?? []);
  const abstracts = mergedAbstracts.map((abstract) => {
    const explicit = abstract.participantIds ?? abstract.participants ?? [];
    const linked = explicit.filter((id) => participantIds.has(id));
    const byEmail = participantByEmail.get(String(abstract.submitterEmail ?? "").toLowerCase());
    const fallback = seededLinks[abstract.id]?.filter((id) => participantIds.has(id)) ?? [];
    const legacyDecision = needsRelationshipSeed && abstract.id === "abs-1" && abstract.status === "Pending"
      ? { status: "Accepted", reviewRoute: "Round 2 · Program committee", reviewRound: 2 }
      : {};
    return { ...abstract, ...legacyDecision, participantIds: linked.length ? linked : byEmail ? [byEmail] : fallback };
  });
  const abstractById = new Map(abstracts.map((abstract) => [abstract.id, abstract]));
  const migratedSessions = (merged.sessions ?? []).map((session) => {
    if ((session.participants ?? []).length || !session.sourceAbstractId) return session;
    return { ...session, participants: abstractById.get(session.sourceAbstractId)?.participantIds ?? [] };
  });
  const sessions = [...migratedSessions, ...abstracts.filter((abstract) => abstract.status === "Accepted" && !migratedSessions.some((session) => session.sourceAbstractId === abstract.id)).map((abstract) => ({ id: `session-${abstract.id}`, sourceAbstractId: abstract.id, title: abstract.title, description: abstract.description, status: "Accepted", track: abstract.track || "Track 1", room: "", startsAt: "", endsAt: "", participants: abstract.participantIds ?? [] }))];
  const taskDefaults = {
    "task-1": { personId: "person-1", due: "2026-10-05T17:00" },
    "task-2": { abstractId: "abs-1", due: "2026-09-30T17:00" },
    "task-3": { abstractId: "abs-1", due: "2026-10-01T17:00" },
  };
  const tasks = (merged.tasks ?? []).map((task) => ({ ...(taskDefaults[task.id] ?? {}), ...task }));
  const embeds = [...(merged.embeds ?? []), ...initialData.embeds.filter((seeded) => !(merged.embeds ?? []).some((embed) => embed.id === seeded.id))];
  const evaluationRounds = Object.prototype.hasOwnProperty.call(raw, "evaluationRounds")
    ? (raw.evaluationRounds ?? [])
    : initialData.evaluationRounds;
  return { ...merged, schemaVersion: DATA_SCHEMA_VERSION, abstracts, sessions, tasks, embeds, evaluationRounds };
}

const StoreContext = createContext(null);

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function createStatePersistence({ fetchImpl = globalThis.fetch, storage = browserStorage() } = {}) {
  return {
    loadLocal() {
      try {
        const stored = storage?.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },
    saveLocal(state) {
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    async loadRemote() {
      if (!fetchImpl) return { state: null, persistence: "localStorage" };
      try {
        const shared = await loadSharedWorkspace(fetchImpl);
        if (shared.persistence === "d1" || shared.sharedAvailable) return shared;
        const response = await fetchImpl("/api/state", { headers: { accept: "application/json" } });
        if (!response.ok) return { state: null, persistence: "localStorage" };
        const payload = await response.json();
        return { state: payload.state || null, version: payload.version || 0, persistence: payload.persistence || "localStorage" };
      } catch {
        return { state: null, persistence: "localStorage" };
      }
    },
    async saveRemote(state) {
      if (!fetchImpl) return { ok: false, persistence: "localStorage" };
      try {
        const response = await fetchImpl("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) return { ok: false, persistence: "localStorage", status: response.status };
        const payload = await response.json();
        return { ok: true, persistence: payload.persistence || "d1", version: payload.version || 0 };
      } catch (error) {
        return { ok: false, persistence: "localStorage", error: error.message };
      }
    },
  };
}

export function StoreProvider({ children }) {
  const persistence = useMemo(() => createStatePersistence(), []);
  const didMutate = useRef(false);
  const persistTimer = useRef(null);
  const refreshInFlight = useRef(false);
  const workspaceVersion = useRef(null);
  const lastLocalUpdateAt = useRef(0);
  const [data, setData] = useState(() => {
    const stored = persistence.loadLocal();
    return stored ? migrateData(stored) : initialData;
  });
  const [persistenceStatus, setPersistenceStatus] = useState("checking");
  const [lastPersistenceError, setLastPersistenceError] = useState(null);
  const [session, setSession] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [sharedAvailable, setSharedAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    persistence.loadRemote().then((remote) => {
      if (cancelled) return;
      setPersistenceStatus(remote.persistence === "d1" ? "d1" : "localStorage");
      setSession(remote.session || null);
      setSharedAvailable(Boolean(remote.sharedAvailable || remote.persistence === "d1"));
      if (remote.state && !didMutate.current) {
        const hydrated = migrateData(remote.state);
        if (remote.persistence !== "d1") persistence.saveLocal(hydrated);
        setData(hydrated);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [persistence]);

  useEffect(() => {
    if (!hydrated || persistenceStatus !== "d1") return undefined;
    let cancelled = false;

    const refreshIfChanged = async () => {
      if (cancelled || refreshInFlight.current || document.visibilityState === "hidden") return;
      refreshInFlight.current = true;
      const refreshStartedAt = Date.now();
      try {
        const version = await loadSharedWorkspaceVersion();
        if (cancelled || !version.ok) return;
        if (workspaceVersion.current === null) {
          workspaceVersion.current = version.version;
          return;
        }
        if (workspaceVersion.current === version.version) return;
        const remote = await persistence.loadRemote();
        if (cancelled || remote.persistence !== "d1" || !remote.state) return;
        workspaceVersion.current = version.version;
        if (refreshStartedAt < lastLocalUpdateAt.current) return;
        setSession(remote.session || null);
        setSharedAvailable(true);
        setLastPersistenceError(null);
        setData((current) => migrateData({ ...remote.state, integrations: remote.state.integrations ?? current.integrations }));
      } finally {
        refreshInFlight.current = false;
      }
    };

    const interval = window.setInterval(refreshIfChanged, SHARED_REFRESH_INTERVAL_MS);
    const refreshOnFocus = () => refreshIfChanged();
    const refreshOnVisibility = () => { if (document.visibilityState === "visible") refreshIfChanged(); };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    refreshIfChanged();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [hydrated, persistence, persistenceStatus]);

  const update = (recipe) => {
    didMutate.current = true;
    lastLocalUpdateAt.current = Date.now();
    setData((current) => {
      const next = typeof recipe === "function" ? recipe(current) : { ...current, ...recipe };
      if (persistenceStatus !== "d1") persistence.saveLocal(next);
      if (persistenceStatus !== "d1" && !sharedAvailable) {
        if (persistTimer.current) window.clearTimeout(persistTimer.current);
        persistTimer.current = window.setTimeout(async () => {
          const result = await persistence.saveRemote(next);
          setPersistenceStatus(result.ok && result.persistence === "d1" ? "d1" : "localStorage");
          setLastPersistenceError(result.error || null);
        }, 300);
      }
      return next;
    });
  };

  const value = useMemo(() => ({ data, update, reset: () => update(initialData), persistenceStatus, lastPersistenceError, session, hydrated, sharedAvailable }), [data, persistenceStatus, lastPersistenceError, session, hydrated, sharedAvailable]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useAppStore must be used inside StoreProvider");
  return value;
}
