import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert,
  Cloud, Download, ExternalLink, FileDiff, History, KeyRound, LockKeyhole, Play, RefreshCw,
  Save, Settings2, ShieldCheck, Table2, Unplug, UsersRound, Workflow, XCircle,
} from "lucide-react";
import { Button, Field, PageHeader, Pill } from "../components/ui.jsx";
import { useAppStore } from "../store.jsx";
import { createSharedAcceleventsRun, saveSharedAcceleventsConfig } from "../lib/sharedApi.js";
import {
  buildAcceleventsSyncPlan, createMockAcceleventsAdapter, defaultAcceleventsConfig,
  snapshotFromSyncRun,
} from "../lib/accelevents.js";
import { buildAcceleventsCsvPack } from "../lib/acceleventsCsv.js";

const integrationStyles = `
  .integration-page{padding:28px 30px 52px;min-height:calc(100vh - var(--topbar-height));background:linear-gradient(180deg,#f6f8fd,#fbfcfe)}
  .integration-hero{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:20px}.connection-card,.safety-card{padding:20px;border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:var(--shadow-card)}.connection-title{display:flex;align-items:center;gap:12px}.integration-logo{width:46px;height:46px;border-radius:11px;background:#141d2e;color:#fff;display:grid;place-items:center}.connection-title h3{margin:0;font-size:16px}.connection-title p{margin:5px 0 0;color:#718097;font-size:11px}.connection-meta{display:flex;gap:8px;align-items:center;margin-top:18px;flex-wrap:wrap}.safety-card{background:#f8fbff;border-color:#cfe0fb}.safety-card h3{margin:0;display:flex;gap:9px;align-items:center;font-size:14px}.safety-card p{color:#66768d;font-size:11px;line-height:1.55}.safety-list{display:grid;gap:7px;margin-top:12px}.safety-list div{display:flex;align-items:center;gap:8px;font-size:11px;color:#344158}.safety-list svg{color:#27845d}
  .integration-tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:20px;overflow:auto}.integration-tabs button{height:48px;padding:0 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f7f96;font-size:12px;display:flex;align-items:center;gap:8px;white-space:nowrap;cursor:pointer}.integration-tabs button.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}.integration-tabs b{min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#edf1f6;display:grid;place-items:center;color:#4d5c71;font-size:9px}
  .integration-section{border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:var(--shadow-card)}.integration-section-head{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.integration-section-head h3{margin:0;font-size:14px}.integration-section-head p{margin:5px 0 0;color:#718097;font-size:11px}.integration-section-body{padding:20px}.config-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.config-grid .full{grid-column:1/-1}.config-note{padding:13px;border:1px solid #f0d98d;border-radius:9px;background:#fffbec;color:#6e5a17;font-size:11px;display:flex;align-items:flex-start;gap:9px}.secret-input{display:flex;gap:8px}.secret-input input{flex:1}.secret-input .btn{flex:none}.token-status{margin-top:7px;color:#718097;font-size:10px}.config-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
  .mapping-layout{display:grid;grid-template-columns:1fr 1fr;gap:18px}.mapping-card{border:1px solid var(--border);border-radius:10px;overflow:hidden}.mapping-card h4{margin:0;padding:14px 16px;border-bottom:1px solid var(--border);background:#f7f9fb;font-size:12px;display:flex;align-items:center;gap:8px}.mapping-row{display:grid;grid-template-columns:1fr 26px 1fr;gap:8px;align-items:center;padding:9px 12px;border-bottom:1px solid #edf0f4}.mapping-row:last-child{border-bottom:0}.mapping-row label{color:#687991;font-size:10px}.mapping-row select{height:34px;border:1px solid var(--border);border-radius:7px;background:#fff;font-size:10px;padding:0 8px}.mapping-row svg{color:#9aa6b6}
  .dry-toolbar{display:flex;align-items:center;gap:8px}.dry-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.diff-kpi{padding:14px;border:1px solid var(--border);border-radius:9px;background:#fbfcfe}.diff-kpi span{display:block;color:#718097;font-size:10px;text-transform:uppercase;font-weight:700;letter-spacing:.04em}.diff-kpi strong{display:block;margin-top:8px;font-size:21px}.diff-kpi.create{border-color:#b8ead2;background:#f6fffa}.diff-kpi.update{border-color:#c9daf9;background:#f7faff}.diff-kpi.skip{border-color:#e0e4eb}.diff-kpi.blocked,.diff-kpi.delete{border-color:#f0c0c0;background:#fff8f8}.diff-table-wrap{border:1px solid var(--border);border-radius:10px;overflow:auto}.diff-table{width:100%;min-width:930px;border-collapse:collapse;font-size:11px}.diff-table th{height:42px;padding:0 12px;background:#f5f7fa;color:#5f6e83;text-align:left}.diff-table td{height:55px;padding:0 12px;border-top:1px solid var(--border);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.action-create{background:#dcfce7;color:#15803d}.action-update{background:#dbeafe;color:#1d4ed8}.action-skip{background:#eef1f5;color:#5f6c7e}.action-blocked{background:#fee2e2;color:#b42318}.idempotency{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;color:#5c6d84}.payload-preview{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px;color:#687991}.dry-empty{padding:55px 20px;text-align:center;color:#718097}.dry-empty svg{color:#91a0b4}.dry-empty h3{color:#263348;font-size:15px}.dry-empty p{font-size:11px}.dry-footer{display:flex;align-items:center;justify-content:space-between;margin-top:15px}.dry-footer p{margin:0;color:#718097;font-size:10px}.real-disabled{opacity:.55}.retry-button{margin-left:auto}
  .history-list{display:grid;gap:12px}.history-card{border:1px solid var(--border);border-radius:10px;overflow:hidden}.history-head{min-height:58px;padding:12px 14px;display:grid;grid-template-columns:150px 1fr auto auto;gap:16px;align-items:center;background:#fbfcfe}.history-head time{color:#687991;font-size:10px}.history-head b{font-size:11px}.history-counts{color:#718097;font-size:10px}.history-errors{padding:12px 14px;border-top:1px solid #f1c4c4;background:#fff8f8}.history-error{display:flex;align-items:flex-start;gap:8px;color:#7f1d1d;font-size:10px;padding:5px 0}.history-empty{padding:55px 20px;text-align:center;color:#718097}.history-empty h3{color:#263348;font-size:14px}
  .integration-toast{position:fixed;z-index:150;right:22px;bottom:22px;min-width:300px;padding:14px 16px;border:1px solid var(--border);border-radius:10px;background:#fff;box-shadow:0 12px 35px rgb(15 23 41/.18)}.integration-toast b,.integration-toast span{display:block}.integration-toast b{font-size:12px}.integration-toast span{margin-top:4px;color:#718097;font-size:10px}
  .csv-pack{margin-bottom:16px}.csv-pack-banner{padding:14px 16px;border:1px solid #cfe0fb;border-radius:9px;background:#f8fbff;color:#42536c;font-size:11px;line-height:1.55}.csv-pack-banner b{display:block;margin-bottom:4px;color:#1f2f47}.csv-pack-warning{margin-top:10px;border-color:#f3c6c6;background:#fffafa;color:#7f1d1d}.csv-pack-summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.csv-pack-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.csv-pack-step{border:1px solid var(--border);border-radius:10px;background:#fbfcfe;padding:15px}.csv-pack-step strong,.csv-pack-step span{display:block}.csv-pack-step strong{font-size:12px}.csv-pack-step span{min-height:48px;margin:7px 0 12px;color:#5f6e83;font-size:11px;line-height:1.5}.csv-pack-step .btn{width:100%}.csv-pack-note{margin:14px 0 0;color:#5f6e83;font-size:11px;line-height:1.55}.csv-pack-note b{color:#435269}
  @media(max-width:950px){.integration-hero,.mapping-layout{grid-template-columns:1fr}.dry-summary{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.integration-page{padding:20px 16px}.config-grid{grid-template-columns:1fr}.config-grid .full{grid-column:auto}.dry-summary{grid-template-columns:1fr}.history-head{grid-template-columns:1fr 1fr}.integration-section-head{flex-direction:column}.csv-pack-steps{grid-template-columns:1fr}.csv-pack-step span{min-height:0}}
`;

const speakerSourceOptions = ["firstName", "lastName", "email", "title", "company", "bio", "pronouns", "headshotUrl"];
const sessionSourceOptions = ["title", "description", "startsAt", "endsAt", "format", "status", "track", "room"];

function mergeConfig(saved) {
  return {
    ...defaultAcceleventsConfig,
    ...(saved || {}),
    speakerMapping: { ...defaultAcceleventsConfig.speakerMapping, ...(saved?.speakerMapping || {}) },
    sessionMapping: { ...defaultAcceleventsConfig.sessionMapping, ...(saved?.sessionMapping || {}) },
    externalSnapshot: saved?.externalSnapshot || {},
    syncHistory: saved?.syncHistory || [],
  };
}

function downloadCsv(file) {
  const url = URL.createObjectURL(new Blob([file.content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function AcceleventsImportPanel({ data }) {
  const pack = useMemo(() => buildAcceleventsCsvPack(data), [data]);
  const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
  const steps = [
    ["1 · Speakers", "speakers", `${countLabel(pack.summary.speakers, "unique accepted-session speaker")} with valid email, title, company, and bio.`, pack.files.speakers],
    ["2 · Locations", "locations", `${countLabel(pack.summary.locations, "distinct room")} in Accelevents' current location template.`, pack.files.locations],
    ["3 · Sessions", "sessions", `${countLabel(pack.summary.sessions, "scheduled accepted session")} with track, description, and speaker assignments.`, pack.files.sessions],
  ];
  const warnings = [
    pack.summary.blockedSessions ? `${pack.summary.blockedSessions} accepted session${pack.summary.blockedSessions === 1 ? " needs" : "s need"} valid same-day times inside the Callboard event dates.` : "",
    pack.summary.invalidSpeakers ? `${pack.summary.invalidSpeakers} referenced speaker${pack.summary.invalidSpeakers === 1 ? " has" : "s have"} an invalid email and will be omitted.` : "",
    pack.summary.omittedSpeakerAssignments ? `${pack.summary.omittedSpeakerAssignments} session speaker assignment${pack.summary.omittedSpeakerAssignments === 1 ? "" : "s"} will be omitted until its email is fixed.` : "",
    pack.summary.timezoneFallback ? "The event timezone is invalid, so times are being exported in UTC." : "",
  ].filter(Boolean);
  return <section className="integration-section csv-pack"><div className="integration-section-head"><div><h3>Accelevents browser import pack</h3><p>Real bulk-import files for accounts where Accelevents API access is unavailable.</p></div><Pill tone="blue">No API key needed</Pill></div><div className="integration-section-body"><div className="csv-pack-banner"><b>Supported browser workflow</b>Download the current Callboard program in Accelevents' Speakers, Locations, and Sessions CSV formats.</div>{warnings.length ? <div className="csv-pack-banner csv-pack-warning" role="alert"><b>Fix before importing the full pack</b>{warnings.join(" ")}</div> : null}<div className="csv-pack-summary" aria-live="polite"><Pill>{countLabel(pack.summary.speakers, "speaker")} ready</Pill><Pill>{countLabel(pack.summary.locations, "location")} ready</Pill><Pill>{countLabel(pack.summary.sessions, "session")} ready</Pill>{pack.summary.duplicateSpeakerEmails ? <Pill>{pack.summary.duplicateSpeakerEmails} duplicate emails merged</Pill> : null}{pack.summary.blockedSessions ? <Pill tone="danger">{countLabel(pack.summary.blockedSessions, "session")} blocked</Pill> : null}</div><div className="csv-pack-steps">{steps.map(([title, itemName, detail, file]) => <article className="csv-pack-step" key={title}><strong>{title}</strong><span>{detail}</span><Button icon={Download} disabled={!file.rowCount} aria-label={`Download Accelevents ${itemName} CSV`} onClick={() => downloadCsv(file)}>{file.rowCount ? `Download ${itemName} CSV` : `No ${itemName} to download`}</Button></article>)}</div><p className="csv-pack-note"><b>Create-only snapshot:</b> import once in the numbered order. Re-uploading rows with blank Accelevents IDs can create duplicates. Only accepted sessions with valid same-day times inside the event are included.</p></div></section>;
}

function ConfigurationPanel({ config, setConfig, token, setToken, onSave, persistenceStatus }) {
  return <section className="integration-section"><div className="integration-section-head"><div><h3>Accelevents connection</h3><p>Configure the destination event. Credentials remain only in memory and are never written to Callboard state.</p></div><Pill tone={config.enabled ? "success" : "neutral"}>{config.enabled ? "Configured" : "Not configured"}</Pill></div><div className="integration-section-body"><div className="config-grid"><Field label="Accelevents event URL" hint="The event slug from its public URL"><input value={config.eventUrl} placeholder="ai-engineer-sandbox-event" onChange={(event) => setConfig((current) => ({ ...current, eventUrl: event.target.value }))} /></Field><Field label="Accelevents event ID" hint="Optional numeric host event ID"><input value={config.eventId} placeholder="123456" onChange={(event) => setConfig((current) => ({ ...current, eventId: event.target.value }))} /></Field><Field className="full" label="API token" hint="Session-only; never persisted"><div className="secret-input"><input type="password" value={token} autoComplete="off" placeholder="Paste only when real connection validation is approved" onChange={(event) => setToken(event.target.value)} /><Button icon={KeyRound} disabled={!token}>Validate</Button></div><div className="token-status">{token ? "Token present in this browser session. No request has been sent." : "No token supplied. Dry-run and mock sync remain available."}</div></Field><div className="config-note full"><AlertTriangle size={17} /><span>Real Accelevents calls are not wired into this screen. The production adapter requires a token, an injected reviewed transport, write approval, and an explicit action.</span></div><Field label="Run mode"><select value={config.mode} onChange={(event) => setConfig((current) => ({ ...current, mode: event.target.value }))}><option value="mock">Mock adapter — local only</option><option value="real" disabled>Real adapter — approval required</option></select></Field><Field label="State persistence"><input disabled value={persistenceStatus === "d1" ? "Cloudflare D1" : "Local browser storage"} /></Field></div><div className="config-actions"><Button icon={Save} variant="primary" onClick={onSave}>Save configuration</Button></div></div></section>;
}

function MappingCard({ title, icon: Icon, mapping, setMapping, options }) {
  return <article className="mapping-card"><h4><Icon size={17} />{title}</h4>{Object.entries(mapping).map(([target, source]) => <div className="mapping-row" key={target}><label>{target}</label><ArrowRight size={14} /><select value={source} onChange={(event) => setMapping((current) => ({ ...current, [target]: event.target.value }))}>{options.map((option) => <option key={option}>{option}</option>)}</select></div>)}</article>;
}

function MappingPanel({ config, setConfig, onSave }) {
  return <section className="integration-section"><div className="integration-section-head"><div><h3>One-way field mapping</h3><p>Only the fields shown below leave Callboard. No Accelevents field is read back into local records.</p></div><Button icon={Save} onClick={onSave}>Save mappings</Button></div><div className="integration-section-body"><div className="mapping-layout"><MappingCard title="Speakers" icon={UsersRound} mapping={config.speakerMapping} options={speakerSourceOptions} setMapping={(recipe) => setConfig((current) => ({ ...current, speakerMapping: typeof recipe === "function" ? recipe(current.speakerMapping) : recipe }))} /><MappingCard title="Sessions" icon={Workflow} mapping={config.sessionMapping} options={sessionSourceOptions} setMapping={(recipe) => setConfig((current) => ({ ...current, sessionMapping: typeof recipe === "function" ? recipe(current.sessionMapping) : recipe }))} /></div></div></section>;
}

function DryRunPanel({ plan, onBuild, onMockSync, onMockFailure, syncing }) {
  const canSimulateFailure = plan?.operations.some((operation) => ["CREATE", "UPDATE"].includes(operation.action));
  return <section className="integration-section"><div className="integration-section-head"><div><h3>Dry-run diff</h3><p>Compare the mapped Callboard payload with the last successful mock snapshot before any sync action.</p></div><div className="dry-toolbar"><Button icon={RefreshCw} onClick={onBuild}>{plan ? "Refresh diff" : "Generate dry run"}</Button></div></div><div className="integration-section-body">{plan ? <><div className="dry-summary"><div className="diff-kpi create"><span>Create</span><strong>{plan.summary.create}</strong></div><div className="diff-kpi update"><span>Update</span><strong>{plan.summary.update}</strong></div><div className="diff-kpi skip"><span>Unchanged</span><strong>{plan.summary.skip}</strong></div><div className="diff-kpi blocked"><span>Blocked</span><strong>{plan.summary.blocked}</strong></div><div className="diff-kpi delete"><span>Deletes</span><strong>0</strong></div></div><div className="diff-table-wrap"><table className="diff-table"><thead><tr><th>Action</th><th>Entity</th><th>Local ID</th><th>Reason</th><th>Idempotency key</th><th>Mapped payload</th></tr></thead><tbody>{plan.operations.map((operation) => <tr key={operation.id}><td><span className={`pill action-${operation.action.toLowerCase()}`}>{operation.action}</span></td><td>{operation.entityType}</td><td>{operation.localId}</td><td>{operation.reason}</td><td className="idempotency">{operation.idempotencyKey}</td><td className="payload-preview">{JSON.stringify(operation.payload)}</td></tr>)}</tbody></table></div><div className="dry-footer"><p>Direction: Callboard → Accelevents · No delete operations · Plan {plan.id}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}><Button className="real-disabled" icon={LockKeyhole} disabled>Sync to Accelevents</Button>{canSimulateFailure ? <Button icon={CircleAlert} disabled={syncing} onClick={onMockFailure}>Simulate one transient failure</Button> : null}<Button variant="primary" icon={Play} disabled={syncing} onClick={onMockSync}>{syncing ? "Running..." : "Run mock sync"}</Button></div></div></> : <div className="dry-empty"><FileDiff size={38} /><h3>No dry run generated</h3><p>Generate a diff to see every proposed create, update, unchanged, and blocked record with its idempotency key.</p><Button variant="primary" icon={FileDiff} onClick={onBuild}>Generate dry run</Button></div>}</div></section>;
}

function HistoryPanel({ history, onRetry, retrying, shared }) {
  const resolvedFailures = new Set(history.filter((run) => run.retryOfRunId).flatMap((run) => (run.results || []).filter((result) => ["SUCCEEDED", "SKIPPED"].includes(result.status)).map((result) => `${run.retryOfRunId}:${result.entityType}:${result.localId}:${result.idempotencyKey}`)));
  return <section className="integration-section"><div className="integration-section-head"><div><h3>Sync history</h3><p>{shared ? "Shared D1 mock runs retain every operation, result, and retry without storing a token." : "Local mock runs are retained with per-item results and errors."}</p></div></div><div className="integration-section-body">{history.length ? <div className="history-list">{history.map((run) => { const success = run.results?.filter((result) => result.status === "SUCCEEDED").length || 0; const skipped = run.results?.filter((result) => result.status === "SKIPPED").length || 0; const failed = run.results?.filter((result) => result.status === "FAILED") || []; const blocked = run.results?.filter((result) => result.status === "BLOCKED").length || 0; return <article className="history-card" key={run.id}><div className="history-head"><time>{new Date(run.completedAt).toLocaleString()}</time><b>{run.retryOfRunId ? "Targeted mock retry" : "Mock Accelevents sync"}</b><span className="history-counts">{success} changed · {skipped} unchanged · {blocked} blocked</span><Pill tone={run.status === "SUCCEEDED" ? "success" : "danger"}>{run.status}</Pill></div>{run.errors?.length ? <div className="history-errors">{run.errors.map((error) => <div className="history-error" key={`${run.id}-${error.localId}`}><XCircle size={15} /><span><b>{error.localId}</b> — {error.message}</span>{shared && failed.some((item) => item.localId === error.localId && !resolvedFailures.has(`${run.id}:${item.entityType}:${item.localId}:${item.idempotencyKey}`)) ? <Button className="retry-button" icon={RefreshCw} disabled={retrying} onClick={() => onRetry(run, [error.localId])}>{retrying ? "Retrying…" : "Retry failed"}</Button> : null}</div>)}</div> : null}</article>; })}</div> : <div className="history-empty"><History size={36} /><h3>No sync runs yet</h3><p>Run the mock adapter from Dry Run to create an inspectable history entry.</p></div>}</div></section>;
}

export function IntegrationScreen({ onNavigate }) {
  const { data, update, persistenceStatus = "localStorage" } = useAppStore();
  const saved = useMemo(() => mergeConfig(data.integrations?.accelevents), [data.integrations?.accelevents]);
  const [config, setConfig] = useState(saved);
  const [tab, setTab] = useState("Configuration");
  const [token, setToken] = useState("");
  const [plan, setPlan] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    setConfig(saved);
    setPlan(null);
  }, [saved]);
  const showToast = (title, detail) => { setToast({ title, detail }); window.setTimeout(() => setToast(null), 2500); };
  const persistConfig = async () => {
    const safeConfig = { ...config, enabled: Boolean(config.eventUrl || config.eventId), mode: "mock" };
    if (persistenceStatus === "d1") {
      const result = await saveSharedAcceleventsConfig(Number(config.version || 0), { eventUrl: safeConfig.eventUrl, eventId: safeConfig.eventId, speakerMapping: safeConfig.speakerMapping, sessionMapping: safeConfig.sessionMapping });
      if (!result.ok) { showToast("Configuration not saved", result.error === "VERSION_CONFLICT" ? "This integration changed elsewhere. Reload before saving." : "The shared integration configuration was rejected."); return; }
      update((current) => ({ ...current, integrations: { ...(current.integrations || {}), accelevents: result.item } }));
      setConfig(mergeConfig(result.item));
      setPlan(null);
      showToast("Configuration saved", "Mappings and destination metadata are shared in D1. No credential or provider request was included.");
      return;
    }
    update((current) => ({ ...current, integrations: { ...(current.integrations || {}), accelevents: safeConfig } }));
    setConfig(safeConfig);
    showToast("Configuration saved", "No credentials or external requests were included.");
  };
  const buildPlan = () => {
    const next = buildAcceleventsSyncPlan({ data, config });
    setPlan(next);
    showToast("Dry run ready", `${next.summary.create} create, ${next.summary.update} update, ${next.summary.skip} unchanged.`);
  };
  const runMock = async ({ simulateFailure = false } = {}) => {
    const nextPlan = plan || buildAcceleventsSyncPlan({ data, config });
    setPlan(nextPlan);
    setSyncing(true);
    try {
      if (persistenceStatus === "d1") {
        const failureTarget = simulateFailure ? nextPlan.operations.find((operation) => ["CREATE", "UPDATE"].includes(operation.action))?.localId : null;
        const result = await createSharedAcceleventsRun({ mode: "mock", networkIntent: false, configVersion: Number(config.version), plan: nextPlan, simulateFailureLocalIds: failureTarget ? [failureTarget] : [] });
        if (!result.ok) { showToast("Mock sync failed", result.error === "VERSION_CONFLICT" ? "This integration changed elsewhere. Reload before running." : "The shared mock boundary rejected the run."); return; }
        const nextConfig = mergeConfig(result.integration);
        setConfig(nextConfig);
        update((current) => ({ ...current, integrations: { ...(current.integrations || {}), accelevents: nextConfig } }));
        setPlan(buildAcceleventsSyncPlan({ data, config: nextConfig }));
        showToast(result.item.status === "SUCCEEDED" ? "Shared mock sync complete" : "Shared mock sync needs attention", `${result.item.results.filter((item) => item.status === "SUCCEEDED").length} changed · ${result.item.errors.length} blocked or failed.`);
        return;
      }
      const run = await createMockAcceleventsAdapter().apply(nextPlan);
      const externalSnapshot = snapshotFromSyncRun(config.externalSnapshot, run);
      const safeRun = { ...run, results: run.results.map(({ payload, ...result }) => result) };
      const nextConfig = { ...config, enabled: true, mode: "mock", externalSnapshot, syncHistory: [safeRun, ...(config.syncHistory || [])].slice(0, 25) };
      setConfig(nextConfig);
      update((current) => ({ ...current, integrations: { ...(current.integrations || {}), accelevents: nextConfig } }));
      setPlan(buildAcceleventsSyncPlan({ data, config: nextConfig }));
      showToast("Mock sync complete", `${run.results.filter((result) => result.status === "SUCCEEDED").length} records changed locally.`);
    } catch (error) {
      showToast("Mock sync failed", error.message);
    } finally {
      setSyncing(false);
    }
  };
  const retryMock = async (run, localIds) => {
    setSyncing(true);
    try {
      const result = await createSharedAcceleventsRun({ mode: "mock", networkIntent: false, configVersion: Number(config.version), retryOfRunId: run.id, retryLocalIds: localIds });
      if (!result.ok) { showToast("Retry failed", result.error === "VERSION_CONFLICT" ? "Reload before retrying this run." : "No retryable failed operation was found."); return; }
      const nextConfig = mergeConfig(result.integration);
      setConfig(nextConfig);
      update((current) => ({ ...current, integrations: { ...(current.integrations || {}), accelevents: nextConfig } }));
      setPlan(buildAcceleventsSyncPlan({ data, config: nextConfig }));
      setTab("Sync History");
      showToast("Targeted retry complete", `${result.item.results.length} failed operation retried with its original idempotency key.`);
    } finally { setSyncing(false); }
  };
  const errorCount = config.syncHistory.reduce((total, run) => total + (run.errors?.length || 0), 0);
  const tabs = [["Configuration", Settings2], ["Field Mapping", Workflow], ["Dry Run", FileDiff], ["Sync History", History]];
  return <div className="integration-page"><style>{integrationStyles}</style>
    <PageHeader icon={Cloud} title="Integrations" subtitle="Move approved program data into the event team's operating systems" actions={<Button icon={Table2} onClick={() => onNavigate?.("/integrations/airtable")}>Airtable sync</Button>} />
    <div className="integration-hero"><article className="connection-card"><div className="connection-title"><div className="integration-logo"><ExternalLink size={22} /></div><div><h3>Callboard → Accelevents</h3><p>Speakers, sessions, and speaker-session assignments</p></div></div><div className="connection-meta"><Pill tone="blue">One way</Pill><Pill tone="success">Mock ready</Pill><Pill>{config.eventUrl || "No event selected"}</Pill></div></article><article className="safety-card"><h3><ShieldCheck size={18} />Safe integration boundary</h3><p>This prototype can generate exact outbound diffs and run an idempotent local mock. It cannot make a real network write.</p><div className="safety-list"><div><CheckCircle2 size={14} />Dry-run before sync</div><div><CheckCircle2 size={14} />No delete propagation</div><div><CheckCircle2 size={14} />Tokens never persisted</div></div></article></div>
    <div className="integration-tabs">{tabs.map(([label, Icon]) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={17} />{label}{label === "Sync History" && config.syncHistory.length ? <b>{config.syncHistory.length}</b> : null}{label === "Sync History" && errorCount ? <CircleAlert size={14} color="#d33" /> : null}</button>)}</div>
    {tab === "Configuration" ? <><AcceleventsImportPanel data={data} /><ConfigurationPanel config={config} setConfig={setConfig} token={token} setToken={setToken} onSave={persistConfig} persistenceStatus={persistenceStatus} /></> : tab === "Field Mapping" ? <MappingPanel config={config} setConfig={setConfig} onSave={persistConfig} /> : tab === "Dry Run" ? <DryRunPanel plan={plan} onBuild={buildPlan} onMockSync={() => runMock()} onMockFailure={() => runMock({ simulateFailure: true })} syncing={syncing} /> : <HistoryPanel history={config.syncHistory} onRetry={retryMock} retrying={syncing} shared={persistenceStatus === "d1"} />}
    {toast ? <div className="integration-toast"><b>{toast.title}</b><span>{toast.detail}</span></div> : null}
  </div>;
}
