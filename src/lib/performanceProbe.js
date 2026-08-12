const ATTRIBUTE = "data-callboard-vitals";
const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("vitals") === "1";
const supportedEntryTypes = typeof PerformanceObserver === "undefined" ? [] : PerformanceObserver.supportedEntryTypes;

const state = enabled ? {
  version: 1,
  mode: "dom-only-no-network",
  url: window.location.href,
  route: window.location.hash.replace(/^#/, "") || "/dashboard",
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  },
  capturedAtMs: 0,
  routeReadyMs: null,
  navigation: null,
  fcpMs: null,
  lcpMs: null,
  cls: 0,
  inpMs: null,
  interactionCount: 0,
  longTaskCount: 0,
  totalBlockingTimeMs: 0,
  supportedEntryTypes: [],
} : null;

const interactions = new Map();

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function refreshNavigation() {
  const navigation = performance.getEntriesByType("navigation")[0];
  if (!navigation) return;
  state.navigation = {
    type: navigation.type,
    responseStartMs: round(navigation.responseStart),
    domContentLoadedMs: round(navigation.domContentLoadedEventEnd),
    loadEventEndMs: round(navigation.loadEventEnd),
    durationMs: round(navigation.duration),
    transferSizeBytes: navigation.transferSize,
    encodedBodySizeBytes: navigation.encodedBodySize,
    decodedBodySizeBytes: navigation.decodedBodySize,
  };
}

function publish() {
  if (!enabled) return;
  refreshNavigation();
  state.capturedAtMs = round(performance.now());
  state.url = window.location.href;
  document.documentElement.setAttribute(ATTRIBUTE, JSON.stringify(state));
}

function observe(type, callback, options = {}) {
  if (!supportedEntryTypes.includes(type)) return;
  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
      publish();
    });
    observer.observe({ type, buffered: true, ...options });
  } catch {
    // Older browsers can expose an entry type without accepting every option.
  }
}

function updateInp(entries) {
  for (const entry of entries) {
    if (!entry.interactionId) continue;
    const previous = interactions.get(entry.interactionId) || 0;
    interactions.set(entry.interactionId, Math.max(previous, entry.duration));
  }
  const durations = [...interactions.values()].sort((left, right) => right - left);
  const percentileIndex = Math.min(Math.floor(durations.length / 50), Math.max(durations.length - 1, 0));
  state.interactionCount = durations.length;
  state.inpMs = durations.length ? round(durations[percentileIndex]) : null;
}

export function installPerformanceProbe() {
  if (!enabled) return;
  state.supportedEntryTypes = [...supportedEntryTypes];
  refreshNavigation();

  const initialFcp = performance.getEntriesByName("first-contentful-paint")[0];
  if (initialFcp) state.fcpMs = round(initialFcp.startTime);

  observe("paint", (entries) => {
    const fcp = entries.find((entry) => entry.name === "first-contentful-paint");
    if (fcp) state.fcpMs = round(fcp.startTime);
  });
  observe("largest-contentful-paint", (entries) => {
    const candidate = entries.at(-1);
    if (candidate) state.lcpMs = round(candidate.startTime);
  });
  observe("layout-shift", (entries) => {
    state.cls = round(state.cls + entries.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0), 4);
  });
  observe("event", updateInp, { durationThreshold: 16 });
  observe("longtask", (entries) => {
    state.longTaskCount += entries.length;
    state.totalBlockingTimeMs = round(state.totalBlockingTimeMs + entries.reduce((sum, entry) => sum + Math.max(entry.duration - 50, 0), 0));
  });

  window.addEventListener("hashchange", () => {
    state.route = window.location.hash.replace(/^#/, "") || "/dashboard";
    publish();
  });
  window.addEventListener("resize", () => {
    state.viewport = { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio };
    publish();
  });
  window.addEventListener("load", publish, { once: true });
  window.addEventListener("pagehide", publish);
  publish();
}

export function markCallboardRouteReady(route) {
  if (!enabled) return;
  state.route = route;
  state.routeReadyMs = round(performance.now());
  publish();
}
