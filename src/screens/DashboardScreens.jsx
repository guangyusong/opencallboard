import { useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleAlert,
  CircleX, ClipboardCheck, FileText, Gauge, Grid2X2, Mic2, Plus, Settings,
  Sparkles, Store, UsersRound, Wrench,
} from "lucide-react";
import { Button, Modal, Pill } from "../components/ui.jsx";
import { useAppStore } from "../store.jsx";
import { acceptedParticipants, participantsForAbstract, scheduleConflicts, tasksForParticipant } from "../lib/domain.js";

const dashboardStyles = `
  .db-page{padding:34px 32px 54px;min-height:calc(100vh - var(--topbar-height));background:linear-gradient(180deg,#f6f8fd 0,#fbfcfe 100%)}
  .db-date{font-size:11px;font-weight:700;letter-spacing:.09em;color:#758197;text-transform:uppercase}.db-title{margin:9px 0 25px;font-size:31px;line-height:1.15;letter-spacing:-.035em}
  .db-top-tabs{display:flex;align-items:flex-end;border-bottom:1px solid var(--border);gap:7px}.db-top-tab{height:46px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#718097;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:9px}.db-top-tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}.db-dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}.db-dot.orange{background:#f59e0b}.db-dot.purple{background:#8b46ec}.db-add{margin-left:auto;margin-bottom:7px}
  .db-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:20px 0}.db-kpi,.db-stat{min-height:98px;padding:20px;border:1px solid var(--border);border-radius:11px;background:#fff;box-shadow:var(--shadow-card);position:relative}.db-kpi span,.db-stat span{display:block;color:#708097;font-size:13px}.db-kpi strong,.db-stat strong{display:block;margin-top:12px;font-size:25px}.db-kpi svg,.db-stat svg{position:absolute;right:18px;top:20px;color:#708097}
  .db-section-label{margin:8px 0 10px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#607089;font-weight:700}.db-status-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.db-stat{min-height:77px;padding:14px}.db-stat strong{font-size:20px;margin-top:7px}.db-stat svg{top:14px;right:14px}
  .db-checks{margin:22px 0 18px;padding:12px 15px;border:1px solid var(--border);border-radius:9px;background:#fbfcfe;color:#687991;font-size:12px;display:flex;align-items:center;gap:15px;white-space:nowrap;overflow:hidden}.db-checks b{color:#283449;font-weight:500}.db-checks button{border:0;background:transparent;color:#526680;cursor:pointer;padding:0}.db-checks .more{margin-left:auto}
  .db-subtabs{display:flex;border-bottom:1px solid var(--border);gap:3px}.db-subtabs button{height:48px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f7f96;font-size:13px;cursor:pointer}.db-subtabs button.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}
  .db-panel{margin-top:22px;padding:20px;border:1px solid #dce3ee;border-radius:12px;background:rgba(255,255,255,.74);box-shadow:0 1px 2px rgb(15 23 41/.03)}.db-panel.green{border-color:#b9efd7}.db-panel.amber{border-color:#f5d46a}.db-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.db-panel h3{margin:0;font-size:14px}.db-panel p{margin:5px 0 0;color:#728198;font-size:12px;line-height:1.55}.db-link{border:0;background:transparent;color:#25334a;font-size:12px;cursor:pointer}
  .pacing-card{margin-top:16px;padding:18px;border:1px solid var(--border);border-radius:11px;background:#fff}.pacing-head{display:flex;justify-content:space-between}.pacing-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.mini-metric{padding:12px;border:1px solid var(--border);border-radius:9px;background:#fcfdff}.mini-metric span{display:block;color:#718097;font-size:10px}.mini-metric strong{display:block;margin-top:8px;font-size:18px}.db-chart{height:160px;border:1px solid var(--border);border-radius:10px;position:relative;overflow:hidden;background:repeating-linear-gradient(to bottom,#fff 0,#fff 39px,#e9edf4 40px)}.db-chart:after{content:"";position:absolute;left:6%;right:3%;bottom:17px;height:3px;background:#823cf1;clip-path:polygon(0 90%,18% 84%,35% 80%,52% 73%,68% 66%,81% 48%,93% 35%,100% 0,100% 100%,0 100%)}.chart-switch{position:absolute;right:12px;top:11px;z-index:1;display:flex;gap:6px}.chart-switch button{height:30px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:#fff;color:#66768d;font-size:10px}.chart-switch button.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .forms-heading,.recent-heading{display:flex;justify-content:space-between;align-items:center;margin:22px 0 12px}.forms-heading h3,.recent-heading h3{margin:0;font-size:13px}.forms-progress{padding:13px;border:1px solid var(--border);border-radius:9px;background:#fff}.progress-line{height:6px;background:#e9edf3;border-radius:99px;overflow:hidden;margin:10px 0}.progress-line span{display:block;height:100%;background:#42c58c;border-radius:inherit}.form-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:12px}.form-card{min-height:170px;padding:20px;border:1px solid var(--border);border-radius:11px;background:#fff;box-shadow:var(--shadow-card)}.form-card h4{margin:0 0 12px;font-size:15px}.form-card .form-top{display:flex;align-items:center;justify-content:space-between}.form-card p{min-height:18px}.form-actions{display:flex;gap:10px;margin-top:18px}.form-actions button{border:0;background:transparent;font-size:12px;display:flex;gap:7px;align-items:center;cursor:pointer}.form-actions button:first-child{border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:#66768c}
  .recent-table{border:1px solid var(--border);border-radius:11px;background:#fff;padding:12px 24px;overflow:auto}.recent-table table{width:100%;border-collapse:collapse;font-size:12px;min-width:830px}.recent-table th{text-align:left;color:#718097;font-weight:500;padding:12px 10px;border-bottom:1px solid var(--border)}.recent-table td{padding:13px 10px;border-bottom:1px solid var(--border);color:#334056}.recent-table tr:last-child td{border-bottom:0}
  .db-alert{display:flex;align-items:center;gap:9px;padding:12px;border:1px solid #9fd8ff;border-radius:8px;background:#f6fbff;color:#174d70;font-size:12px;margin-bottom:10px}.db-alert button{margin-left:auto;border:0;background:transparent;color:#17577d;cursor:pointer}.role-card,.review-card{margin-top:16px;padding:16px;border:1px solid var(--border);border-radius:10px;background:#fff}.role-total{text-align:center;margin:18px}.role-total strong{display:block;font-size:22px}.role-total small{color:#718097}.role-bar{height:12px;border-radius:99px;background:#0ca36c}.role-row{display:flex;gap:10px;align-items:center;padding:16px 0;border-bottom:1px solid var(--border)}.role-row .green-dot{width:10px;height:10px;border-radius:50%;background:#0ca36c}.role-row strong{margin-left:auto}.status-donut-wrap{display:grid;grid-template-columns:220px 1fr;align-items:center;gap:28px;padding-top:18px}.donut{width:142px;height:142px;border-radius:50%;margin:auto;background:conic-gradient(#7c3aed 0 40%,#9333ea 40% 60%,#f59e0b 60% 80%,#d97706 80% 100%);display:grid;place-items:center}.donut:before{content:"";width:76px;height:76px;border-radius:50%;background:#fff;position:absolute}.donut-center{position:relative;text-align:center}.donut-center strong{display:block;font-size:24px}.donut-center span{display:block;width:70px;color:#718097;font-size:10px}.legend-row{display:grid;grid-template-columns:12px 1fr auto auto 16px;gap:8px;align-items:center;padding:8px 0;font-size:12px}.legend-row i{width:9px;height:9px;border-radius:50%}
  .review-empty{height:112px;border:1px dashed var(--border);border-radius:9px;display:grid;place-items:center;color:#718097;font-size:12px;margin:16px 0}.review-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.review-metrics .mini-metric{min-height:72px}.review-footer{margin-top:14px;padding:13px;background:#fafbfc;border-radius:8px;color:#65758b;font-size:12px}
  .custom-head{display:flex;justify-content:space-between;align-items:flex-start;margin:18px 0}.custom-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#586980}.custom-label:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:8px}.custom-label.purple:before{background:#8b46ec}.custom-head p{margin:7px 0 0;color:#708097;font-size:12px}.custom-actions{display:flex;gap:8px}.widget-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) 2fr;grid-auto-rows:235px;gap:16px}.widget{border:1px solid var(--border);border-radius:11px;background:#fff;padding:18px;position:relative}.widget.big-number{display:grid;place-items:center;text-align:center}.widget.big-number strong{font-size:38px}.widget.big-number span{display:block;margin-top:10px;color:#67778f;font-size:11px;font-weight:700;text-transform:uppercase}.widget h4{margin:0;color:#5d6e87;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.widget.wide{grid-row:span 2}.widget.empty{display:flex;align-items:center;justify-content:center;color:#7b899e;font-size:12px}.bar-chart{height:calc(100% - 28px);display:flex;align-items:flex-end;justify-content:space-around;border-bottom:1px dashed #dbe3ed;margin-top:16px}.bar{width:48px;background:var(--accent);border-radius:3px 3px 0 0;position:relative}.bar:after{content:attr(data-label);position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);font-size:10px;color:#708097;white-space:nowrap}
  .dashboard-modal{width:min(1120px,calc(100vw - 54px));}.dashboard-modal > header{border-bottom:0}.dashboard-builder-tabs{margin:0 24px 18px;padding:4px;background:#f2f4f7;border-radius:9px;display:grid;grid-template-columns:repeat(3,1fr)}.dashboard-builder-tabs button{height:42px;border:0;border-radius:7px;background:transparent;color:#6d7c92;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}.dashboard-builder-tabs button.active{background:#fff;color:#1b2638;box-shadow:0 1px 3px rgb(15 23 41/.08)}.dashboard-gallery{padding:0 24px 28px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.preset{padding:0;border:1px solid var(--border);border-radius:12px;background:#fff;overflow:hidden;text-align:left;cursor:pointer}.preset-preview{height:160px;display:grid;place-items:center;background:#eaf2ff}.preset-preview.purple{background:#f2e8ff}.preset-preview.pink{background:#fff0f5}.preset-preview.orange{background:#fff3e2}.preset-preview.gray{background:#eef0f2}.preset-preview.indigo{background:#eceeff}.preview-window{width:75%;height:65%;padding:12px;border-radius:7px;background:#fff;box-shadow:0 6px 18px rgb(15 23 41/.08);display:flex;align-items:flex-end;justify-content:space-around;gap:7px}.preview-window i{width:13%;background:var(--accent);border-radius:2px 2px 0 0}.preset-body{padding:16px}.preset-body h3{margin:0 0 7px;font-size:14px}.preset-body p{height:38px;margin:0;color:#708097;font-size:11px;line-height:1.55;overflow:hidden}.preset-meta{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:10px;color:#66768c}.builder-blank{margin:0 24px 28px;padding:34px;border:1px dashed var(--border);border-radius:10px;text-align:center}.builder-blank textarea{width:100%;min-height:120px;margin:16px 0;border:1px solid var(--border);border-radius:9px;padding:12px;resize:vertical}
  @media(max-width:1100px){.db-kpis{grid-template-columns:repeat(2,1fr)}.db-status-grid{grid-template-columns:repeat(3,1fr)}.form-cards{grid-template-columns:1fr}.widget-grid{grid-template-columns:repeat(2,1fr)}.widget.wide{grid-column:span 2;grid-row:auto}.dashboard-gallery{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:680px){.db-page{padding:22px 16px}.db-title{font-size:26px}.db-top-tabs{overflow:auto}.db-kpis,.db-status-grid,.review-metrics,.widget-grid{grid-template-columns:1fr}.widget.wide{grid-column:auto}.pacing-metrics{grid-template-columns:repeat(2,1fr)}.status-donut-wrap{grid-template-columns:1fr}.dashboard-gallery{grid-template-columns:1fr}.db-checks{white-space:normal;flex-wrap:wrap}.db-add{margin-left:0}}
`;

const dashboardTabs = [
  ["Today", "blue"], ["Review Progress", "orange"], ["Speaker Tracking", "blue"], ["Submissions Pipeline", "purple"],
];

const presets = [
  { name: "Event Overview", tone: "", tag: "OVERVIEW", widgets: 5, description: "KPIs at a glance: total submissions, accepted speakers, scheduled sessions, and session status." },
  { name: "Submissions Pipeline", tone: "purple", tag: "SUBMISSIONS", widgets: 5, description: "Funnel of submissions from received → reviewed → accepted, with per-form and per-track context." },
  { name: "Speaker Tracking", tone: "pink", tag: "SPEAKERS", widgets: 5, description: "Confirmation status, outstanding tasks, and an overdue list for accepted speakers." },
  { name: "Review Progress", tone: "orange", tag: "EVALUATION", widgets: 5, description: "Reviewer workload, session scores, top-rated sessions, and pending submissions." },
  { name: "Evaluation Plans by Tracks", tone: "gray", tag: "EVALUATION", widgets: 4, description: "Compare Plan 2.0 session scores across tracks and evaluation plans." },
  { name: "Schedule Health", tone: "indigo", tag: "AGENDA", widgets: 5, description: "Scheduled vs unscheduled sessions, sessions per day, room, and track." },
];

function KPI({ label, value, icon: Icon }) {
  return <article className="db-kpi"><span>{label}</span><strong>{value}</strong><Icon size={18} /></article>;
}

function Stat({ label, value, icon: Icon }) {
  return <article className="db-stat"><span>{label}</span><strong>{value}</strong><Icon size={16} /></article>;
}

function OverviewSummary({ data, accepted, pending, acceptedSpeakerCount }) {
  const declined = data.abstracts.filter((item) => item.status === "Declined").length;
  const drafts = data.abstracts.filter((item) => item.status === "Drafts" || item.status === "Draft").length;
  const withdrawn = data.abstracts.filter((item) => item.status === "Withdrawn").length;
  return <>
    <div className="db-kpis"><KPI label="Submissions" value={data.abstracts.length} icon={FileText} /><KPI label="Accepted Speakers" value={acceptedSpeakerCount} icon={Mic2} /><KPI label="Exhibitors" value={0} icon={Store} /><KPI label="Sponsors" value={0} icon={Gauge} /></div>
    <div className="db-section-label">Submission Status</div>
    <div className="db-status-grid"><Stat label="Accepted" value={accepted} icon={CheckCircle2} /><Stat label="Pending" value={pending} icon={CircleAlert} /><Stat label="Declined" value={declined} icon={CircleX} /><Stat label="Drafts" value={drafts} icon={FileText} /><Stat label="Withdrawn" value={withdrawn} icon={ArrowRight} /></div>
  </>;
}

function SubmissionFormsPanel({ data, onNavigate }) {
  const [pacingExpanded, setPacingExpanded] = useState(true);
  const [pacingMode, setPacingMode] = useState("days");
  const recent = useMemo(() => data.abstracts.map((item) => ({ ...item, speakers: participantsForAbstract(data, item).map((person) => person.name).join(", ") || "—" })), [data]);
  const submissionsByForm = useMemo(() => data.abstracts.reduce((counts, item) => counts.set(item.formId, (counts.get(item.formId) || 0) + 1), new Map()), [data.abstracts]);
  const submitted = data.abstracts.length;
  return <section className="db-panel">
    <div className="pacing-card">
      <div className="pacing-head"><div><h3>Submission Pacing</h3><p>Cumulative submissions in the run-up to event start.</p></div><button className="db-link" aria-label={pacingExpanded ? "Collapse submission pacing" : "Expand submission pacing"} aria-expanded={pacingExpanded} onClick={() => setPacingExpanded((value) => !value)}><ChevronDown size={18} style={{ transform: pacingExpanded ? "none" : "rotate(-90deg)" }} /></button></div>
      {pacingExpanded ? <><div className="pacing-metrics"><div className="mini-metric"><span>Submissions</span><strong>{data.abstracts.length}</strong></div><div className="mini-metric"><span>vs prior (T-65d)</span><strong>— —</strong></div><div className="mini-metric"><span>Days to event</span><strong>65</strong></div><div className="mini-metric"><span>This week vs prior</span><strong>+{data.abstracts.length}</strong></div></div>
      <div className="db-chart"><div className="chart-switch"><button className={pacingMode === "days" ? "active" : ""} onClick={() => setPacingMode("days")}>Days before event</button><button className={pacingMode === "date" ? "active" : ""} onClick={() => setPacingMode("date")}>Calendar date</button></div></div>
      <p>{pacingMode === "days" ? "Pick a prior event to compare submission pacing edition-over-edition." : "Calendar dates use the event timezone for this pacing view."}</p></> : null}
    </div>
    <div className="forms-heading"><h3>Your forms</h3><button className="db-link" onClick={() => onNavigate?.("/submission-forms")}>View 1 more</button></div>
    <div className="forms-progress"><div className="db-section-label">Submission progress</div><div className="progress-line"><span style={{ width: submitted ? "100%" : "0%" }} /></div><b>{submitted}</b> <span style={{ color: "#718097", fontSize: 12 }}>submitted</span></div>
    <div className="form-cards">{data.forms.slice(0, 3).map((form) => { const formSubmissions = submissionsByForm.get(form.id) || 0; return <article className="form-card" key={form.id}><div className="form-top"><h4>{form.name}</h4><Pill tone="success">Open</Pill></div><p>{formSubmissions ? `${formSubmissions} submitted` : form.closes ? `Closes ${form.closes}` : "No submissions yet"}</p>{formSubmissions ? <div className="progress-line"><span style={{ width: "100%" }} /></div> : null}<div className="form-actions"><button onClick={() => onNavigate?.(`/public/cfp/${form.id}`)}><ArrowRight size={15} />View</button><button onClick={() => onNavigate?.(`/submission-form/${form.id}`)}><Settings size={15} />Manage</button></div></article>; })}</div>
    <div className="recent-heading"><h3>Recent Submissions</h3><button className="db-link" onClick={() => onNavigate?.("/abstracts")}>View all</button></div>
    <div className="recent-table"><table><thead><tr><th>Source</th><th>Title</th><th>Status</th><th>Speakers</th><th>Tags</th><th>Submitted</th></tr></thead><tbody>{recent.map((row) => <tr key={row.id}><td>{row.source}</td><td>{row.title}</td><td><Pill tone={row.status === "Accepted" ? "success" : "neutral"}>{row.status}</Pill></td><td>{row.speakers}</td><td>{row.tags?.length ? <Pill>{row.tags[0]}</Pill> : "—"}</td><td>{row.submitted}</td></tr>)}</tbody></table></div>
  </section>;
}

function ParticipantsPanel({ data, onNavigate }) {
  const accepted = data.abstracts.filter((item) => item.status === "Accepted").length;
  const pending = data.abstracts.filter((item) => item.status === "Pending").length;
  const uniqueParticipants = new Set(data.abstracts.flatMap((item) => item.participantIds || [])).size;
  const acceptedSpeakers = acceptedParticipants(data);
  const missingProfiles = acceptedSpeakers.filter((person) => !person.bio || !person.headshotUrl).length;
  const total = Math.max(1, accepted + pending + data.sessions.length);
  const pct = (count) => `${Math.round((count / total) * 100)}%`;
  const legend = [["#7c3aed", "Accepted abstracts", accepted, pct(accepted)], ["#9333ea", "Accepted sessions", data.sessions.length, pct(data.sessions.length)], ["#f59e0b", "Pending abstracts", pending, pct(pending)]];
  return <section className="db-panel green">
    <div className="db-alert"><CircleAlert size={16} />{pending} session submissions are awaiting a decision.<button onClick={() => onNavigate?.("/abstracts")}>Review submissions</button></div>
    <div className="db-alert"><CircleAlert size={16} />{missingProfiles} accepted speakers are missing a bio or headshot.<button onClick={() => onNavigate?.("/sessions")}>View speakers</button></div>
    <div className="db-panel-head"><h3>Program snapshot</h3><button className="db-link" onClick={() => onNavigate?.("/sessions")}>View participants</button></div>
    <article className="role-card"><div className="db-section-label">Participants by role</div><p>Role names come from this event’s participant role settings. Each row is unique people in that role on a submission. The center total deduplicates people in multiple roles.</p><div className="role-total"><strong>{uniqueParticipants}</strong><small>unique participants</small></div><div className="role-bar" /><div className="role-row"><i className="green-dot" />Speakers<strong>{uniqueParticipants}</strong><span style={{ color: "#718097" }}>100%</span><ChevronRight size={16} /></div><div className="db-section-label" style={{ marginTop: 22 }}>Submission status</div><p>Counts session submissions (not people), at top level only.</p><div className="status-donut-wrap"><div className="donut"><div className="donut-center"><strong>{pending}</strong><span>awaiting decision</span></div></div><div>{legend.map(([color, name, count, percentage]) => <div className="legend-row" key={name}><i style={{ background: color }} /><span>{name}</span><strong>{count}</strong><span style={{ color: "#718097" }}>{percentage}</span><ChevronRight size={15} /></div>)}</div></div></article>
  </section>;
}

function EvaluationsPanel({ data, onNavigate }) {
  const rounds = data.evaluationRounds || [];
  const finalReviews = (data.reviews || []).filter((review) => review.final);
  const drafts = (data.reviews || []).filter((review) => !review.final);
  const evaluated = new Set(finalReviews.map((review) => review.abstractId)).size;
  const active = [...rounds].sort((left, right) => (right.assignments?.length || 0) - (left.assignments?.length || 0))[0];
  const assigned = rounds.reduce((total, round) => total + (round.assignments?.length || 0), 0);
  return <section className="db-panel amber"><div className="db-panel-head"><h3>Review progress</h3><button className="db-link" onClick={() => onNavigate?.("/evaluation")}>Open evaluation</button></div><article className="review-card"><div className="review-empty">{finalReviews.length ? `${finalReviews.length} reviews complete across ${evaluated} submissions.` : `${assigned} reviewer assignments are ready to begin.`}</div><div className="review-metrics"><div className="mini-metric"><span>Evaluation rounds</span><strong>{rounds.length}</strong></div><div className="mini-metric"><span>Evaluated submissions</span><strong>{evaluated}</strong></div><div className="mini-metric"><span>Reviews in progress</span><strong>{drafts.length}</strong></div></div><div className="review-footer">Most active plan: <b>{active?.name || "No plan yet"}</b></div></article></section>;
}

function AgendaPanel({ data, onNavigate }) {
  const scheduled = data.sessions.filter((session) => session.startsAt || session.start).length;
  const conflicts = scheduleConflicts(data.sessions).length;
  return <section className="db-panel"><div className="db-panel-head"><div><h3>Schedule health</h3><p>Accepted sessions that are scheduled, unscheduled, or in conflict.</p></div><button className="db-link" onClick={() => onNavigate?.("/agenda")}>Open agenda</button></div><div className="review-metrics" style={{ marginTop: 18 }}><div className="mini-metric"><span>Scheduled</span><strong>{scheduled}</strong></div><div className="mini-metric"><span>Unscheduled</span><strong>{Math.max(0, data.sessions.length - scheduled)}</strong></div><div className="mini-metric"><span>Conflicts</span><strong>{conflicts}</strong></div></div></section>;
}

function CustomDashboard({ kind, data }) {
  const pipeline = kind === "Submissions Pipeline";
  const description = pipeline ? "Funnel of submissions from received → reviewed → accepted, with per-form and per-track context." : "Confirmation status, outstanding tasks, and an overdue list for accepted speakers.";
  const acceptedSpeakers = acceptedParticipants(data);
  const outstandingTasks = [...new Map(acceptedSpeakers.flatMap((person) => tasksForParticipant(data, person.id).filter((task) => !task.complete)).map((task) => [task.id, task])).values()];
  const contactOutstanding = outstandingTasks.filter((task) => task.scope === "Contact").length;
  const submissionOutstanding = outstandingTasks.filter((task) => task.scope !== "Contact").length;
  return <>
    <div className="custom-head"><div><div className={`custom-label ${pipeline ? "purple" : ""}`}>Custom Dashboard</div><p>{description}</p></div><div className="custom-actions"><Button icon={Plus}>Add Widget</Button><Button icon={Settings}>Settings</Button></div></div>
    {pipeline ? <div className="widget-grid"><article className="widget big-number"><div><strong>{data.abstracts.length}</strong><span>Total Submissions</span></div></article><article className="widget big-number"><div><strong>{data.abstracts.filter((item) => item.status === "Pending").length}</strong><span>Pending Review</span></div></article><article className="widget wide"><h4>Submissions by form</h4><div className="bar-chart"><i className="bar" data-label="(none)" style={{ height: "85%" }} /></div></article><article className="widget"><h4>Submissions by track</h4><div className="bar-chart"><i className="bar" data-label="Track 1" style={{ height: "78%" }} /><i className="bar" data-label="Track 2" style={{ height: "78%" }} /></div></article></div> : <div className="widget-grid"><article className="widget big-number"><div><strong>{acceptedSpeakers.length}</strong><span>Accepted Speakers</span></div></article><article className="widget big-number"><div><strong>{outstandingTasks.length}</strong><span>Outstanding Speaker Tasks</span></div></article><article className="widget wide"><h4>Speaker confirmation mix</h4><div className="bar-chart"><i className="bar" data-label="Profile" style={{ height: `${Math.max(14, contactOutstanding * 28)}%` }} /><i className="bar" data-label="Submission" style={{ height: `${Math.max(14, submissionOutstanding * 28)}%` }} /></div></article><article className="widget"><h4>Top speakers by outstanding tasks</h4><div style={{ marginTop: 18 }}>{acceptedSpeakers.map((speaker) => { const count = tasksForParticipant(data, speaker.id).filter((task) => !task.complete).length; return <div className="legend-row" key={speaker.id}><i style={{ background: "#285edb" }} /><span>{speaker.name}</span><strong>{count}</strong><span>open</span><ChevronRight size={15} /></div>; })}</div></article></div>}
  </>;
}

function DashboardCreator({ open, onClose, onChoose }) {
  const [mode, setMode] = useState("Gallery");
  return <Modal open={open} onClose={onClose} title="New Dashboard" subtitle="Start from a pre-built dashboard, describe what you want, or build one manually." className="dashboard-modal">
    <div className="dashboard-builder-tabs">{[["Gallery", Grid2X2], ["AI prompt", Sparkles], ["Build manually", Wrench]].map(([label, Icon]) => <button key={label} className={mode === label ? "active" : ""} onClick={() => setMode(label)}><Icon size={17} />{label}</button>)}</div>
    {mode === "Gallery" ? <div className="dashboard-gallery">{presets.map((preset) => <button className="preset" key={preset.name} onClick={() => onChoose(preset.name)}><div className={`preset-preview ${preset.tone}`}><div className="preview-window">{[42, 68, 82, 61, 49].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><div className="preset-body"><h3>{preset.name}</h3><p>{preset.description}</p><div className="preset-meta"><Pill tone={preset.tone === "purple" ? "purple" : preset.tone === "pink" ? "danger" : "blue"}>{preset.tag}</Pill><span>{preset.widgets} widgets</span></div></div></button>)}</div> : <div className="builder-blank"><Sparkles size={30} /><h3>{mode === "AI prompt" ? "Describe your dashboard" : "Start with an empty dashboard"}</h3>{mode === "AI prompt" ? <textarea placeholder="For example: show outstanding speaker tasks and session confirmation status..." /> : <p>Choose a title and add widgets after creating your dashboard.</p>}<Button variant="primary" onClick={() => onChoose(mode === "AI prompt" ? "AI Dashboard" : "Untitled Dashboard")}>Create Dashboard</Button></div>}
  </Modal>;
}

export function DashboardScreen({ onNavigate = () => {} }) {
  const { data } = useAppStore();
  const [activeDashboard, setActiveDashboard] = useState("Today");
  const [subtab, setSubtab] = useState("Submission Forms");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const accepted = data.abstracts.filter((item) => item.status === "Accepted").length;
  const pending = data.abstracts.filter((item) => item.status === "Pending").length;
  const acceptedSpeakers = acceptedParticipants(data);
  const unscheduled = data.sessions.filter((session) => !session.startsAt && !session.start).length;
  const chooseDashboard = (name) => {
    setCreatorOpen(false);
    if (["Speaker Tracking", "Submissions Pipeline", "Review Progress"].includes(name)) setActiveDashboard(name);
    else setActiveDashboard("Today");
  };
  return <div className="db-page"><style>{dashboardStyles}</style>
    <div className="db-date">Saturday, August 8&nbsp;&nbsp; • &nbsp;&nbsp;65 days to event</div>
    <h1 className="db-title">Good morning, {data.organizer.firstName}</h1>
    <div className="db-top-tabs">{dashboardTabs.map(([label, tone]) => <button key={label} className={`db-top-tab ${activeDashboard === label ? "active" : ""}`} onClick={() => setActiveDashboard(label)}><i className={`db-dot ${tone}`} />{label}</button>)}<Button className="db-add" icon={Plus} onClick={() => setCreatorOpen(true)}>Add Dashboard</Button></div>
    {activeDashboard === "Today" || activeDashboard === "Review Progress" ? <>
      <OverviewSummary data={data} accepted={accepted} pending={pending} acceptedSpeakerCount={acceptedSpeakers.length} />
      <div className="db-checks"><span>Also check</span><button onClick={() => onNavigate("/agenda")}><b>{unscheduled} accepted sessions still need a time slot on the agenda.</b> (Agenda) <ChevronRight size={14} /></button><span>·</span><button onClick={() => onNavigate("/abstracts")}><b>{pending} session submissions are awaiting a decision.</b> (Participants) <ChevronRight size={14} /></button><button className="more">+1 more</button></div>
      <div className="db-subtabs">{["Submission Forms", "Participants", "Evaluations", "Agenda"].map((label) => <button key={label} className={subtab === label ? "active" : ""} onClick={() => setSubtab(label)}>{label}</button>)}</div>
      {subtab === "Submission Forms" ? <SubmissionFormsPanel data={data} onNavigate={onNavigate} /> : subtab === "Participants" ? <ParticipantsPanel data={data} onNavigate={onNavigate} /> : subtab === "Evaluations" ? <EvaluationsPanel data={data} onNavigate={onNavigate} /> : <AgendaPanel data={data} onNavigate={onNavigate} />}
    </> : <CustomDashboard kind={activeDashboard} data={data} />}
    <DashboardCreator open={creatorOpen} onClose={() => setCreatorOpen(false)} onChoose={chooseDashboard} />
  </div>;
}
