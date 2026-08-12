import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert,
  Columns3, Download, Eye, FileText, Filter, Globe2, GripVertical, Info, LayoutList,
  ListFilter, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, SortAsc,
  Upload, UsersRound, X,
} from "lucide-react";
import { Button, Drawer, EmptyState, Field, PageHeader, Pill, SearchBox } from "../components/ui.jsx";
import { useAppStore } from "../store.jsx";
import { scheduleConflicts } from "../lib/domain.js";
import { createSharedResource, decideSharedSubmission, patchSharedResource, setSharedScheduleRelease } from "../lib/sharedApi.js";

const programStyles = `
  .program-page{padding:28px 30px 44px;min-height:calc(100vh - var(--topbar-height));background:linear-gradient(180deg,#f6f8fd 0,#fbfcfe 100%)}
  .program-page .page-header{margin-bottom:10px}.module-tabs{display:flex;border-bottom:1px solid var(--border);overflow-x:auto}.module-tabs button{height:50px;flex:0 0 auto;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f7f96;font-size:12px;cursor:pointer}.module-tabs button.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}.module-tabs b{margin-left:9px;color:#182337;font-size:10px}
  .module-toolbar{display:flex;align-items:center;gap:8px;margin:16px 0;position:relative}.module-toolbar .search-box{width:min(440px,38vw);height:44px}.module-toolbar .toolbar-spacer{flex:1}.toolbar-btn{height:39px;padding:0 13px;border:1px solid var(--border);border-radius:9px;background:#fff;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap}.toolbar-btn:hover,.toolbar-btn.active{border-color:var(--accent);color:var(--accent)}.toolbar-btn.square{width:42px;justify-content:center;padding:0}.toolbar-divider{width:1px;height:27px;background:var(--border);margin:0 3px}.relative{position:relative}.floating-menu{position:absolute;z-index:60;right:0;top:calc(100% + 7px);min-width:210px;padding:7px;border:1px solid var(--border);border-radius:10px;background:#fff;box-shadow:0 12px 30px rgb(15 23 41/.14)}.floating-menu.left{left:0;right:auto}.floating-menu button{width:100%;height:38px;padding:0 10px;border:0;border-radius:7px;background:transparent;display:flex;align-items:center;gap:10px;text-align:left;font-size:12px;cursor:pointer}.floating-menu button:hover{background:#f3f5f8}
  .abstract-table-wrap{height:calc(100vh - 285px);min-height:430px;border:1px solid var(--border);border-radius:11px;background:#fff;overflow:auto;box-shadow:0 1px 2px rgb(15 23 41/.02)}.abstract-table{min-width:1530px;width:100%;border-collapse:collapse;font-size:12px}.abstract-table th{height:50px;padding:0 13px;background:#f5f7fa;border-bottom:1px solid var(--border);color:#566478;text-align:left;font-weight:600;white-space:nowrap}.abstract-table td{height:52px;padding:0 13px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}.abstract-table td.status-cell{position:relative;overflow:visible}.abstract-table tbody tr:hover{background:#fbfcff}.abstract-table input[type=checkbox]{width:17px;height:17px;accent-color:var(--accent)}.abstract-table .select-cell{width:44px}.abstract-table .edit-cell{width:38px;color:#8b9ab0}.table-info{display:inline-flex;margin-left:7px;color:#9aa8ba;vertical-align:middle}.table-empty{height:320px}.program-footer{height:58px;display:flex;align-items:center;gap:12px;color:#687991;font-size:12px}.program-footer .pager{margin-left:auto;display:flex;gap:6px}.program-footer .pager button{width:37px;height:37px;border:1px solid var(--border);border-radius:8px;background:#fff}.program-footer .pager button.active{background:var(--accent);color:#fff;border-color:var(--accent)}.program-footer select{margin-left:auto;height:37px;border:1px solid var(--border);border-radius:8px;background:#fff;padding:0 10px;color:#687991}
  .status-trigger{border:0;background:transparent;padding:0;cursor:pointer}.status-trigger.focused{outline:2px solid var(--accent);outline-offset:3px;border-radius:999px}.status-editor{position:fixed;z-index:400;width:310px;border:1px solid var(--border);border-radius:10px;background:#fff;box-shadow:0 14px 35px rgb(15 23 41/.16);overflow:hidden}.status-editor-head{height:45px;padding:0 13px;display:flex;align-items:center;border-bottom:1px solid var(--border)}.status-editor-head button{margin-left:auto;border:0;background:transparent;color:#718097;font-size:11px;display:flex;gap:5px;align-items:center}.status-choice{width:100%;height:45px;padding:0 13px;border:0;background:#fff;display:flex;align-items:center;cursor:pointer}.status-choice.selected{background:#dfe9fb}.status-choice svg{margin-left:auto}.selected-status{padding:12px;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.selected-status .pill button{border:0;background:transparent;padding:0;margin-left:6px;display:grid}.status-editor-foot{padding:9px;display:flex;justify-content:flex-end;gap:7px}
  .status-accepted{background:#4fd36d;color:#091b0e}.status-accept-queue{background:#83e79a;color:#09210f}.status-pending{background:#ffdb58;color:#1f1a04}.status-decline-queue{background:#ffbd12;color:#211700}.status-declined{background:#ff6969;color:#260606}.status-withdrawn{background:#e7eaf0;color:#475569}.status-drafts{background:#ece5ff;color:#6533a5}
  .prefs-tabs{display:grid;grid-template-columns:repeat(4,1fr);margin:-22px -24px 0;background:#f4f6f9;border-bottom:1px solid var(--border)}.prefs-tabs button{height:54px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6d7c92;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.prefs-tabs button.active{background:#fff;border-bottom-color:var(--accent);color:#25334a}.prefs-layout{display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - 156px);margin:0 -24px -22px}.prefs-available{border-right:1px solid var(--border);padding:14px 16px}.prefs-selected{padding:16px}.prefs-subtabs{display:flex;gap:18px;margin-bottom:14px}.prefs-subtabs button{height:32px;border:0;border-radius:8px;background:transparent;color:#6f7f96;font-size:11px}.prefs-subtabs button.active{background:var(--accent);color:#fff;padding:0 13px}.column-search{height:42px;width:100%;border:1px solid var(--border);border-radius:9px;padding:0 12px;display:flex;align-items:center;gap:8px;color:#8a98aa}.column-search input{border:0;outline:0;flex:1;min-width:0}.field-group-title{display:flex;align-items:center;gap:8px;margin:16px 4px 9px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase}.field-group-title span{color:#98a5b6}.field-group-title button{margin-left:auto;border:0;background:transparent;font-size:10px;color:#29364b}.column-list{display:grid;gap:7px;max-height:calc(100vh - 330px);overflow:auto;padding-right:3px}.column-row{min-height:54px;border:1px solid transparent;border-radius:9px;padding:8px 10px;display:flex;align-items:center;gap:10px}.column-row.selected{background:#dfe9fb;border-color:#99b9f4}.column-row input{width:17px;height:17px;accent-color:var(--accent)}.column-row-text b,.column-row-text small{display:block}.column-row-text b{font-size:12px}.column-row-text small{margin-top:3px;color:#718097;font-size:10px}.selected-head{display:flex;justify-content:space-between;font-size:12px}.selected-head button{border:0;background:transparent;font-size:10px}.selected-hint{margin:7px 0 12px;color:#718097;font-size:10px}.selected-list{display:grid;gap:7px;max-height:calc(100vh - 260px);overflow:auto}.selected-row{height:48px;border:1px solid #95b7f6;border-radius:9px;background:#dfe9fb;padding:0 10px;display:flex;align-items:center;gap:10px;font-size:12px}.selected-row button{margin-left:auto;border:0;background:transparent;color:#6b7c95;padding:2px}.preferences-placeholder{padding:32px 10px;text-align:center;color:#718097}.preferences-placeholder h3{color:#25334a}
  .drawer-segment{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:9px;background:#f3f5f8;margin-bottom:20px}.drawer-segment button{height:40px;border:0;border-radius:7px;background:transparent;color:#6f7f96;display:flex;align-items:center;justify-content:center;gap:8px}.drawer-segment button.active{background:#fff;color:#1c2739;box-shadow:0 1px 3px rgb(15 23 41/.08)}.drawer-form{display:grid;gap:18px}.drawer-form .field input,.drawer-form .field select{height:46px}.drawer-form .field textarea{min-height:86px}.input-with-count{position:relative}.input-with-count input{padding-right:60px}.input-with-count span{position:absolute;right:12px;top:15px;color:#94a0b1;font-size:10px}.participant-picker{display:grid;gap:9px}.participant-option{height:58px;border:1px solid var(--border);border-radius:9px;padding:0 12px;display:flex;align-items:center;gap:12px}.participant-option input{width:17px;height:17px;accent-color:var(--accent)}.participant-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e4e9f1;font-size:10px}.participant-option b,.participant-option small{display:block}.participant-option b{font-size:12px}.participant-option small{font-size:10px;color:#718097}.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .toast-inline{position:fixed;z-index:160;right:22px;bottom:22px;padding:13px 16px;border:1px solid var(--border);border-radius:10px;background:#fff;box-shadow:0 12px 35px rgb(15 23 41/.18);font-size:12px}.toast-inline b{display:block}.toast-inline span{display:block;margin-top:3px;color:#718097;font-size:10px}.session-timezone-note{margin:-4px 0 2px;padding:10px 12px;border-radius:8px;background:#f3f6fb;color:#536278;font-size:11px;line-height:1.5}.session-time-error{margin-top:-10px;color:#b42318;font-size:11px}.field-row.invalid .field input{border-color:#e77878;background:#fffafa}
  .agenda-view-tabs{display:flex;border-bottom:1px solid var(--border);gap:3px}.agenda-view-tabs button{height:48px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f7f96;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer}.agenda-view-tabs button.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}.agenda-stage{min-height:calc(100vh - 285px);border:1px solid var(--border);border-radius:11px;background:#fff;overflow:auto}.agenda-stage .empty-state{min-height:calc(100vh - 287px);border:0}.agenda-list{min-width:900px;width:100%;border-collapse:collapse;font-size:12px}.agenda-list th{height:48px;padding:0 14px;background:#f5f7fa;color:#5f6f85;text-align:left}.agenda-list td{height:58px;padding:0 14px;border-top:1px solid var(--border)}.agenda-list tr[draggable=true]{cursor:grab}.agenda-list tr[draggable=true]:active{cursor:grabbing}.agenda-title-cell button{border:0;background:transparent;padding:0;text-align:left;color:inherit;cursor:pointer}.agenda-title-cell button:hover b{color:var(--accent);text-decoration:underline}.agenda-title-cell b,.agenda-title-cell small{display:block}.agenda-title-cell small{margin-top:5px;color:#718097}.view-canvas{padding:22px;min-height:500px}.view-canvas h3{margin:0 0 14px;font-size:14px}.agenda-view-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.agenda-view-head h3{margin:0}.agenda-view-head small{color:#718097;font-size:10px}.agenda-day-picker{display:flex;gap:5px;flex-wrap:wrap}.agenda-day-picker button{height:30px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:#fff;color:#5e6e84;font-size:10px;cursor:pointer}.agenda-day-picker button.active{border-color:var(--accent);background:#eaf1ff;color:var(--accent);font-weight:700}.agenda-unscheduled{margin-bottom:12px;padding:10px 12px;border:1px dashed #b9c6d9;border-radius:9px;background:#f8fafc}.agenda-unscheduled header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.agenda-unscheduled b{font-size:11px}.agenda-unscheduled small{color:#718097;font-size:10px}.agenda-unscheduled-list{display:flex;gap:7px;flex-wrap:wrap}.agenda-unscheduled .session-chip{margin:0;max-width:360px}.calendar-board{display:grid;grid-template-columns:76px repeat(3,1fr);border:1px solid var(--border);border-radius:10px;overflow:hidden}.calendar-board > div{min-height:31px;padding:4px 8px;border-right:1px solid var(--border);border-bottom:1px solid #edf0f4}.calendar-board .time{background:#f7f9fb;color:#718097;font-size:9px}.calendar-board .time.quarter{color:transparent}.calendar-board .day-head{min-height:38px;padding:11px 8px;background:#f7f9fb;color:#536278;font-size:11px;font-weight:600;position:sticky;top:0;z-index:4}.calendar-slot{position:relative}.calendar-slot.hour{border-top-color:#d7dee8}.calendar-slot.unavailable{background:#fafafa;cursor:not-allowed}.calendar-slot.drop-target{background:#eaf1ff;box-shadow:inset 0 0 0 1px #7ba1ed}.drop-preview{min-height:24px;padding:5px 8px;border:1px dashed #3569d9;border-radius:5px;background:#f5f8ff;color:#2458c5;font-size:9px;font-weight:700}.session-chip{padding:7px 9px;border-left:3px solid var(--accent);border-radius:6px;background:#eaf1ff;font-size:10px;margin-bottom:4px;cursor:grab}.session-chip small{display:block;margin-top:2px;color:#5d6f89;font-size:9px}.session-chip:active{cursor:grabbing}.drop-zone{transition:120ms ease}.drop-zone:hover{background:#f3f7ff;box-shadow:inset 0 0 0 1px #9ab8f4}.room-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.room-card{min-height:170px;padding:16px;border:1px solid var(--border);border-radius:10px}.room-card h4{margin:0 0 13px}.conflict-list{display:grid;gap:10px}.conflict-card{padding:14px;border:1px solid #f2b6b6;border-radius:9px;background:#fff7f7;display:flex;gap:12px}.conflict-card b,.conflict-card span{display:block}.conflict-card span{margin-top:4px;color:#718097;font-size:11px}.conflict-card svg{color:#d84343;flex:none}
  .conflict-card>div{min-width:0;flex:1}.conflict-rule{margin-top:8px!important;color:#9a3412!important;font-weight:600}.conflict-types{display:flex!important;gap:6px;flex-wrap:wrap;margin-top:8px!important}.conflict-types em{padding:3px 7px;border-radius:999px;background:#ffe4e4;color:#9f2d2d;font-size:9px;font-style:normal;font-weight:700}.conflict-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px}.conflict-actions small{color:#718097;font-size:10px}.conflict-choice{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.conflict-actions button,.conflict-preview button{min-height:34px;padding:0 11px;border:1px solid #d9a5a5;border-radius:7px;background:#fff;color:#8f2d2d;font-size:10px;font-weight:600;cursor:pointer}.conflict-actions button:hover{border-color:#bd6060;background:#fffafa}.conflict-preview{margin-top:12px;padding:12px;border:1px solid #e9b4b4;border-radius:8px;background:#fff}.conflict-preview b{font-size:11px}.conflict-preview p{margin:7px 0;color:#5e6e84;font-size:10px;line-height:1.6}.conflict-preview-actions{display:flex;justify-content:flex-end;gap:7px}.conflict-preview button.primary{border-color:#b23a3a;background:#b23a3a;color:#fff}
  .agenda-release{margin:0 0 12px;padding:13px 16px;border:1px solid #f2d18b;border-radius:10px;background:#fff9e9;color:#6b4d0b;display:flex;align-items:center;gap:11px;font-size:12px}.agenda-release.published{border-color:#9ed8b0;background:#eefaf2;color:#176534}.agenda-release b{margin-right:4px}.agenda-release time{margin-left:auto;color:inherit;opacity:.75}
  .calendar-board.day{grid-template-columns:90px 1fr}.month-board{display:grid;grid-template-columns:repeat(7,minmax(105px,1fr));border:1px solid var(--border);border-radius:10px;overflow:hidden}.month-head{min-height:34px!important;background:#f7f9fb;color:#536278;font-size:10px;font-weight:700;text-transform:uppercase}.month-cell{min-height:112px;padding:8px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)}.month-cell>span{display:block;margin-bottom:7px;color:#718097;font-size:10px}.month-cell.outside{background:#fafbfc;color:#a2adbc}
  @media(max-width:1320px){.agenda-toolbar{gap:6px}.agenda-toolbar .search-box{width:150px;min-width:150px}.agenda-toolbar .toolbar-btn{padding:0 9px;gap:6px}.agenda-toolbar .toolbar-btn.square{width:36px;flex:0 0 36px}.agenda-toolbar .toolbar-divider{margin:0}.agenda-toolbar>.btn{padding-left:10px;padding-right:10px;gap:6px}}
  @media(max-width:1050px){.module-toolbar{flex-wrap:wrap}.module-toolbar .search-box{width:100%}.prefs-layout{grid-template-columns:1fr}.prefs-available{border-right:0;border-bottom:1px solid var(--border)}.selected-list,.column-list{max-height:340px}.room-grid{grid-template-columns:1fr 1fr}}
  @media(max-width:680px){.program-page{padding:20px 16px}.toolbar-btn span{display:none}.module-toolbar .search-box{min-width:100%}.abstract-table-wrap,.agenda-stage{height:auto;min-height:420px}.field-row,.room-grid{grid-template-columns:1fr}.prefs-tabs button span{display:none}}
`;

const statusChoices = ["Accepted", "Accept Queue", "Pending", "Decline Queue", "Declined", "Withdrawn", "Drafts"];
const statusClass = (status) => `status-${status.toLowerCase().replaceAll(" ", "-")}`;

const columnDefinitions = [
  ["status", "Status", "Status"], ["source", "Source", "Text"], ["title", "Title", "Text"], ["clientId", "Client Session ID", "Text"],
  ["description", "Description", "Rich Text"], ["notified", "Notified", "Date"], ["rating", "Ratings: My Evaluation Plan", "Number"], ["format", "Format", "Select"],
  ["language", "Language", "Select"], ["level", "Level", "Select"], ["submitter", "Session Submitter", "Text"], ["speaker", "Speaker", "Text"],
  ["track", "Track", "Select"], ["tags", "Tags", "Select"], ["files", "Files", "Text"], ["location", "Location", "Select"],
  ["capacity", "Capacity", "Number"], ["ceuCredits", "CEU Credits", "Number"], ["chairperson", "Chairperson", "Text"], ["createdAt", "Created At", "Date"],
  ["startsAt", "Starts At", "Date"], ["endsAt", "Ends At", "Date"], ["exhibitors", "Exhibitors", "Text"], ["room", "Room", "Select"], ["updatedAt", "Updated At", "Date"],
].map(([key, label, type]) => ({ key, label, type }));

const initialColumns = columnDefinitions.slice(0, 18).map((column) => column.key);

function StatusPill({ status, removable = false, onRemove }) {
  return <span className={`pill ${statusClass(status)}`}>{status}{removable ? <button onClick={onRemove}><X size={11} /></button> : null}</span>;
}

function submissionAnswer(row, ...keys) {
  const answers = row?.answers || {};
  for (const key of keys) {
    if (answers[key] !== undefined && answers[key] !== "") return answers[key];
    const match = Object.entries(answers).find(([answerKey]) =>
      String(answerKey).toLowerCase() === String(key).toLowerCase(),
    );
    if (match?.[1] !== undefined && match[1] !== "") return match[1];
  }
  return "";
}

function fieldOptions(forms, matcher) {
  const values = forms.flatMap((form) =>
    (form.abstractFields || [])
      .filter((field) => matcher.test(`${field.id || ""} ${field.label || ""}`))
      .flatMap((field) => field.options || []),
  );
  return [...new Set(values.map((value) =>
    String(typeof value === "object" ? value.value ?? value.label ?? "" : value).trim(),
  ).filter(Boolean))];
}

function withSubmissionAnswer(answers, field, value) {
  const next = { ...(answers || {}) };
  if (!field) return next;
  if (field.id) next[field.id] = value;
  if (field.label) next[field.label] = value;
  return next;
}

function getCellValue(row, key) {
  if (key === "status") return <StatusPill status={row.status} />;
  if (key === "source") return <Pill>{row.source}</Pill>;
  if (key === "title") return <b>{row.title}</b>;
  if (key === "description") return row.description || "-";
  if (key === "track") return row.track ? <Pill tone="blue">{row.track}</Pill> : "-";
  if (key === "tags") return row.tags?.map((tag) => <Pill key={tag}>{tag}</Pill>) || "-";
  if (key === "capacity" || key === "ceuCredits" || key === "clientId") return row[key] || "-";
  if (key === "speaker") return row.speakers?.length ? row.speakers.join(", ") : "-";
  if (key === "submitter") return row.submitter || row.submitterEmail || "-";
  if (key === "format") return row.format || row.tags?.[0] || submissionAnswer(row, "format", "Format") || "-";
  if (key === "level") return row.level || submissionAnswer(row, "audienceLevel", "audience-level", "Audience level", "Level") || "-";
  if (key === "notified" || key === "rating" || key === "files" || key === "location" || key === "language" || key === "room") return row[key] || "-";
  return row[key] || "-";
}

function syncAcceptedSession(current, abstractId, status) {
  const abstract = current.abstracts.find((item) => item.id === abstractId);
  if (!abstract) return current.sessions;
  const existing = current.sessions.find((session) => session.sourceAbstractId === abstractId);
  if (status !== "Accepted") return existing ? current.sessions.filter((session) => session.id !== existing.id) : current.sessions;
  const synchronized = {
    id: existing?.id ?? `session-${abstractId}`,
    sourceAbstractId: abstractId,
    title: abstract.title,
    description: abstract.description,
    status: "Accepted",
    track: abstract.track || "Track 1",
    format: abstract.format || abstract.tags?.[0] || existing?.format || "Talk",
    room: existing?.room ?? "",
    startsAt: existing?.startsAt ?? "",
    endsAt: existing?.endsAt ?? "",
    participants: abstract.participantIds ?? existing?.participants ?? [],
  };
  return existing
    ? current.sessions.map((session) => session.id === existing.id ? synchronized : session)
    : [...current.sessions, synchronized];
}

function PreferencesDrawer({ open, onClose, selected, setSelected, initialTab = "Columns" }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [draftSelected, setDraftSelected] = useState(selected);
  const [dragKey, setDragKey] = useState(null);
  const filtered = columnDefinitions.filter((column) => column.label.toLowerCase().includes(query.toLowerCase()));
  const toggle = (key) => setDraftSelected((columns) => columns.includes(key) ? columns.filter((item) => item !== key) : [...columns, key]);
  const drop = (target) => {
    if (!dragKey || dragKey === target) return;
    setDraftSelected((columns) => {
      const next = columns.filter((key) => key !== dragKey);
      next.splice(next.indexOf(target), 0, dragKey);
      return next;
    });
    setDragKey(null);
  };
  return <Drawer open={open} onClose={onClose} title="Preferences" wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Check} onClick={() => { setSelected(draftSelected); onClose(); }}>Apply Changes</Button></>}>
    <div className="prefs-tabs">{[["Columns", Columns3], ["Sort", SortAsc], ["Filter", Filter], ["Drafts", FileText]].map(([label, Icon]) => <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}><Icon size={17} /><span>{label}{label === "Columns" ? ` ${draftSelected.length}/25` : ""}</span></button>)}</div>
    {tab === "Columns" ? <div className="prefs-layout"><section className="prefs-available"><div className="prefs-subtabs"><button className="active">Fields</button><button>Reporting Fields</button></div><label className="column-search"><Search size={17} /><input placeholder="Search columns..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="field-group-title"><ChevronDown size={15} />Session details <span>({draftSelected.length}/25)</span><button onClick={() => setDraftSelected(columnDefinitions.map((column) => column.key))}>Show All</button><button onClick={() => setDraftSelected([])}>Hide All</button></div><div className="column-list">{filtered.map((column) => <label className={`column-row ${draftSelected.includes(column.key) ? "selected" : ""}`} key={column.key}><input type="checkbox" checked={draftSelected.includes(column.key)} onChange={() => toggle(column.key)} /><FileText size={17} /><span className="column-row-text"><b>{column.label}</b><small>{column.type}</small></span></label>)}</div></section><section className="prefs-selected"><div className="selected-head"><b>Selected ({draftSelected.length})</b><button onClick={() => setDraftSelected(initialColumns)}>Reset to Default</button></div><div className="selected-hint">Drag to reorder columns</div><div className="selected-list">{draftSelected.map((key) => { const column = columnDefinitions.find((item) => item.key === key); return <div className="selected-row" key={key} draggable onDragStart={() => setDragKey(key)} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(key)}><GripVertical size={16} /><FileText size={16} /><span>{column?.label}</span><button onClick={() => toggle(key)}><X size={15} /></button></div>; })}</div></section></div> : <div className="preferences-placeholder"><SlidersHorizontal size={30} /><h3>{tab} preferences</h3><p>{tab === "Sort" ? "Choose the order used for this view." : tab === "Filter" ? "Build field-based filters for this view." : "Save this configuration as a reusable draft."}</p></div>}
  </Drawer>;
}

function isEligibleSpeaker(person) {
  const role = String(person?.role || "").toLowerCase();
  return ["speaker", "participant", "contact"].some((label) => role.includes(label));
}

function visibleParticipantOptions(participants, selectedIds = []) {
  return participants.filter(
    (person) => isEligibleSpeaker(person) || selectedIds.includes(person.id),
  );
}

function AbstractDrawer({ open, onClose, editing, onSave, participants, formatOptions, trackOptions, answerFields }) {
  const [tab, setTab] = useState("Details");
  const [form, setForm] = useState(() => editing || { title: "", status: "Pending", description: "", format: "", track: "Track 1", participantIds: [] });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const togglePerson = (id) => change("participantIds", form.participantIds?.includes(id) ? form.participantIds.filter((item) => item !== id) : [...(form.participantIds || []), id]);
  const formats = [...new Set([...(formatOptions || []), form.format].filter(Boolean))];
  const tracks = [...new Set([...(trackOptions || []), form.track].filter(Boolean))];
  const supplementalAnswers = (answerFields || []).filter((field) =>
    !/^(title|description|format|track)$/i.test(`${field.id || ""} ${field.label || ""}`) &&
    submissionAnswer(form, field.id, field.label) !== "",
  );
  const eligibleParticipants = visibleParticipantOptions(participants, form.participantIds || []);
  return <Drawer open={open} onClose={onClose} title={editing?.id ? "Edit Abstract" : "Add Abstract"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!form.title.trim()} onClick={() => onSave(form)}>{editing?.id ? "Save Changes" : "Create Abstract"}</Button></>}>
    <div className="drawer-segment"><button className={tab === "Details" ? "active" : ""} onClick={() => setTab("Details")}><FileText size={17} />Details</button><button className={tab === "Participants" ? "active" : ""} onClick={() => setTab("Participants")}><UsersRound size={17} />Participants</button></div>
    {tab === "Details" ? <div className="drawer-form">
      <Field label="Title" required><div className="input-with-count"><input value={form.title} maxLength={255} placeholder="Enter abstract title..." onChange={(event) => change("title", event.target.value)} /><span>{form.title.length}/255</span></div></Field>
      <Field label="Status"><select value={form.status} onChange={(event) => change("status", event.target.value)}>{statusChoices.map((status) => <option key={status}>{status}</option>)}</select></Field>
      <Field label="Description"><textarea value={form.description} placeholder="Enter description..." onChange={(event) => change("description", event.target.value)} /></Field>
      <div className="field-row"><Field label="Format"><select value={form.format || ""} onChange={(event) => change("format", event.target.value)}><option value="">Select format...</option>{formats.map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Track"><select value={form.track || ""} onChange={(event) => change("track", event.target.value)}><option value="">Select track...</option>{tracks.map((value) => <option key={value}>{value}</option>)}</select></Field></div>
      {supplementalAnswers.map((field) => <Field key={field.id || field.label} label={field.label || field.id}><input readOnly value={Array.isArray(submissionAnswer(form, field.id, field.label)) ? submissionAnswer(form, field.id, field.label).join(", ") : submissionAnswer(form, field.id, field.label)} /></Field>)}
      <div className="session-timezone-note">Agenda time, room, and capacity are managed on the session after acceptance.</div>
    </div> : <div className="participant-picker">
      {eligibleParticipants.map((person) => <label className="participant-option" key={person.id}><input type="checkbox" checked={form.participantIds?.includes(person.id) || false} onChange={() => togglePerson(person.id)} /><span className="participant-avatar">{person.initials}</span><span><b>{person.name}</b><small>{person.email} · {person.role || "Speaker"}</small></span></label>)}
      {!eligibleParticipants.length ? <div className="session-timezone-note">No eligible speaker records are available yet.</div> : null}
    </div>}
  </Drawer>;
}

export function AbstractsScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const [activeTab, setActiveTab] = useState("All Abstracts");
  const [search, setSearch] = useState("");
  const [statusEditor, setStatusEditor] = useState(null);
  const [statusAnchor, setStatusAnchor] = useState(null);
  const [statusDraft, setStatusDraft] = useState("Pending");
  const [preferences, setPreferences] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState(initialColumns);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [toast, setToast] = useState(null);
  const formatOptions = useMemo(() => fieldOptions(data.forms || [], /format/i), [data.forms]);
  const trackOptions = useMemo(() => fieldOptions(data.forms || [], /track|category/i), [data.forms]);
  const counts = useMemo(() => Object.fromEntries(["Accepted", "Accept Queue", "Pending", "Decline Queue", "Declined", "Withdrawn", "Drafts"].map((status) => [status, data.abstracts.filter((item) => item.status === status).length])), [data.abstracts]);
  const filtered = data.abstracts.filter((item) => (activeTab === "All Abstracts" || item.status === activeTab) && `${item.title} ${item.description} ${item.source} ${(item.speakers || []).join(" ")} ${(item.participantIds || []).map((id) => data.participants.find((person) => person.id === id)?.name || "").join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const announce = (title, detail) => { setToast({ title, detail }); window.setTimeout(() => setToast(null), 2200); };
  const saveInlineStatus = async () => {
    const id = statusEditor;
    const target = data.abstracts.find((item) => item.id === id);
    if (persistenceStatus === "d1") {
      const result = await decideSharedSubmission(id, target?.version, statusDraft);
      if (!result.ok) {
        announce("Status not saved", result.error === "VERSION_CONFLICT" ? "This abstract changed elsewhere. Reload before deciding." : "The shared workspace rejected this decision.");
        return;
      }
      const onboardingTaskIds = new Set(result.onboarding?.taskIds || []);
      const onboardingTasks = (result.onboarding?.tasks || []).map((task) => ({ id: task.id, title: task.title, personId: task.assigneePersonId, scope: task.kind === "submission" ? "Submission" : "Contact", mode: "Automatic", notes: task.instructions || "", due: task.dueAt || "", complete: ["complete", "completed", "done"].includes(String(task.status).toLowerCase()), version: task.version }));
      const onboardingResource = result.onboarding?.resource ? { id: result.onboarding.resource.id, title: result.onboarding.resource.title, kind: result.onboarding.resource.kind, description: result.onboarding.resource.content || result.onboarding.resource.url || "", content: result.onboarding.resource.content || "", url: result.onboarding.resource.url || "", audience: result.onboarding.resource.audience, version: result.onboarding.resource.version } : null;
      update((current) => ({
        ...current,
        abstracts: current.abstracts.map((item) => item.id === id ? { ...item, status: statusDraft, version: result.item.version } : item),
        sessions: result.session
          ? [...current.sessions.filter((session) => session.sourceAbstractId !== id), { id: result.session.id, sourceAbstractId: id, title: result.session.title, description: result.session.description || "", status: "Accepted", startsAt: result.session.startsAt || "", endsAt: result.session.endsAt || "", room: result.session.room || "", track: result.session.track || "", participants: result.session.participantIds || [], version: result.session.version }]
          : current.sessions.filter((session) => session.sourceAbstractId !== id),
        tasks: [...(current.tasks || []).filter((task) => !onboardingTaskIds.has(task.id)), ...onboardingTasks],
        resources: onboardingResource ? [...(current.resources || []).filter((resource) => resource.id !== onboardingResource.id), onboardingResource] : (current.resources || []),
      }));
    } else {
    update((current) => ({ ...current, abstracts: current.abstracts.map((item) => item.id === id ? { ...item, status: statusDraft } : item), sessions: syncAcceptedSession(current, id, statusDraft) }));
    }
    setStatusEditor(null);
    setStatusAnchor(null);
    announce("Status updated", `Abstract moved to ${statusDraft}.`);
  };
  const openEdit = (item) => setDrawer({ ...item, participantIds: item.participantIds || [] });
  const saveAbstract = async (form) => {
    if (drawer?.id) {
      const original = data.abstracts.find((item) => item.id === drawer.id);
      let saved = { ...original, ...form };
      if (persistenceStatus === "d1") {
        const sourceForm = data.forms.find((item) => item.id === original.formId);
        const formatField = sourceForm?.abstractFields?.find((field) => /format/i.test(`${field.id || ""} ${field.label || ""}`));
        const trackField = sourceForm?.abstractFields?.find((field) => /track|category/i.test(`${field.id || ""} ${field.label || ""}`));
        let answers = withSubmissionAnswer(original.answers, formatField, form.format || "");
        answers = withSubmissionAnswer(answers, trackField, form.track || "");
        const detailResult = await patchSharedResource("submissions", drawer.id, original.version, {
          title: form.title,
          abstract: form.description,
          category: form.track,
          answers,
        });
        if (!detailResult.ok) {
          announce("Abstract not saved", detailResult.error === "VERSION_CONFLICT" ? "This abstract changed elsewhere. Reload before editing." : "The shared workspace rejected this edit.");
          return;
        }
        saved = { ...saved, answers, version: detailResult.item.version, tags: [form.format].filter(Boolean) };
        if (form.status !== original.status) {
          const decisionResult = await decideSharedSubmission(drawer.id, detailResult.item.version, form.status);
          if (!decisionResult.ok) {
            announce("Details saved; status unchanged", "Reload before changing this abstract's status.");
            saved.status = original.status;
          } else {
            saved.version = decisionResult.item.version;
          }
        }
      }
      update((current) => {
        const abstracts = current.abstracts.map((item) => item.id === drawer.id ? saved : item);
        const next = { ...current, abstracts };
        return { ...next, sessions: syncAcceptedSession(next, drawer.id, saved.status) };
      });
    } else {
      let created = { id: `abs-${Date.now()}`, source: "Manual", title: form.title, description: form.description, status: form.status, track: form.track, tags: [form.format].filter(Boolean), submitted: "Just now", ...form };
      let acceptedSession = null;
      if (persistenceStatus === "d1") {
        const participantIds = form.participantIds || [];
        const result = await createSharedResource("submissions", {
          formId: data.forms[0]?.id || null,
          submitterPersonId: participantIds[0] || null,
          title: form.title,
          abstract: form.description,
          status: form.status === "Accepted" ? "pending" : String(form.status || "Pending").toLowerCase(),
          category: form.track || null,
          answers: { format: form.format || "", track: form.track || "" },
          participantIds,
          round: 1,
        });
        if (!result.ok) {
          announce("Abstract not created", "The shared workspace rejected this abstract.");
          return;
        }
        created = {
          ...created,
          id: result.item.id,
          formId: result.item.formId,
          version: result.item.version,
          participantIds,
          speakers: participantIds.map((id) => data.participants.find((person) => person.id === id)?.name).filter(Boolean),
        };
        if (form.status === "Accepted") {
          const decision = await decideSharedSubmission(result.item.id, result.item.version, "Accepted");
          if (!decision.ok) {
            announce("Abstract created; acceptance pending", "The record is saved, but its accepted session could not be created.");
            created.status = "Pending";
          } else {
            created.version = decision.item.version;
            acceptedSession = decision.session;
          }
        }
      }
      update((current) => {
        const next = { ...current, abstracts: [...current.abstracts, created] };
        if (acceptedSession) {
          return {
            ...next,
            sessions: [
              ...next.sessions.filter((session) => session.sourceAbstractId !== created.id),
              {
                id: acceptedSession.id,
                sourceAbstractId: created.id,
                title: acceptedSession.title,
                description: acceptedSession.description || "",
                status: "Accepted",
                startsAt: acceptedSession.startsAt || "",
                endsAt: acceptedSession.endsAt || "",
                room: acceptedSession.room || "",
                track: acceptedSession.track || created.track || "",
                participants: acceptedSession.participantIds || created.participantIds || [],
                version: acceptedSession.version,
              },
            ],
          };
        }
        return persistenceStatus === "d1" ? next : { ...next, sessions: syncAcceptedSession(next, created.id, form.status) };
      });
    }
    setDrawer(null);
    announce(drawer?.id ? "Abstract updated" : "Abstract created", form.title);
  };
  const tabs = [["All Abstracts", data.abstracts.length], ...["Accepted", "Accept Queue", "Pending", "Decline Queue", "Declined", "Withdrawn", "Drafts"].map((label) => [label, counts[label]])];
  return <div className="program-page"><style>{programStyles}</style>
    <PageHeader icon={FileText} title="Abstracts" subtitle="Review and manage your abstract submissions" actions={<><div className="relative"><Button icon={MoreHorizontal} onClick={() => setOptionsOpen((value) => !value)}>Options</Button>{optionsOpen ? <div className="floating-menu">{[["Import Sessions", Upload], ["Export .CSV", Download], ["Export .XLSX", Download], ["Download files bundle...", Download]].map(([label, Icon]) => <button key={label} onClick={() => { setOptionsOpen(false); announce(label, "Demo action prepared locally."); }}><Icon size={17} />{label}</button>)}</div> : null}</div><Button variant="primary" icon={Plus} onClick={() => setDrawer({ title: "", status: "Pending", description: "", startsAt: "", endsAt: "", capacity: "", ceuCredits: "", clientId: "", format: "", track: "Track 1", participantIds: [] })}>Add Abstract</Button></>} />
    <div className="module-tabs">{tabs.map(([label, count]) => <button key={label} className={activeTab === label ? "active" : ""} onClick={() => setActiveTab(label)}>{label}<b>{count}</b></button>)}</div>
    <div className="module-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search abstracts..." /><div className="toolbar-spacer" /><button className="toolbar-btn square" aria-label="Table preferences" onClick={() => setPreferences("Columns")}><ListFilter size={17} /></button><div className="toolbar-divider" /><div className="relative"><button className="toolbar-btn" onClick={() => setSavedOpen((value) => !value)}><Eye size={17} /><span>Saved Views</span><ChevronDown size={15} /></button>{savedOpen ? <div className="floating-menu left"><button onClick={() => setSavedOpen(false)}><Check size={16} />Default view</button><button onClick={() => { setSavedOpen(false); announce("View saved", "Your current table preferences were saved."); }}><Plus size={16} />Save current view</button></div> : null}</div><button className="toolbar-btn active" onClick={() => setPreferences("Columns")}><Columns3 size={17} /><span>Columns</span></button><button className="toolbar-btn" onClick={() => setPreferences("Sort")}><SortAsc size={17} /><span>Sort</span></button><button className="toolbar-btn" onClick={() => setPreferences("Filter")}><Filter size={17} /><span>Filter</span></button></div>
    <div className="abstract-table-wrap"><table className="abstract-table"><thead><tr><th className="select-cell"><input type="checkbox" /></th><th className="edit-cell" />{selectedColumns.map((key) => { const column = columnDefinitions.find((item) => item.key === key); return <th key={key}>{column?.label}<Info className="table-info" size={13} /></th>; })}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><input type="checkbox" /></td><td><button className="status-trigger" onClick={() => openEdit(row)}><Pencil size={16} /></button></td>{selectedColumns.map((key) => <td className={key === "status" ? "status-cell" : undefined} key={key}>{key === "status" ? <button className={`status-trigger ${statusEditor === row.id ? "focused" : ""}`} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const editorHeight = 361;
      const openUp = rect.bottom + editorHeight + 8 > window.innerHeight;
      setStatusEditor(row.id);
      setStatusDraft(row.status);
      setStatusAnchor({
        left: Math.max(12, Math.min(rect.left - 3, window.innerWidth - 322)),
        top: openUp ? Math.max(12, rect.top - editorHeight - 8) : rect.bottom + 8,
      });
    }}><StatusPill status={row.status} /></button> : getCellValue(row, key)}</td>)}</tr>)}{!filtered.length ? <tr><td colSpan={selectedColumns.length + 2}><div className="table-empty"><EmptyState icon={FileText} title="No abstracts found" description="Try a different search or status view." /></div></td></tr> : null}</tbody></table></div>
    {statusEditor && statusAnchor ? createPortal(<div className="status-editor" style={{ left: statusAnchor.left, top: statusAnchor.top }}><div className="status-editor-head"><b>Status</b><button onClick={() => setStatusDraft("")}><X size={13} />Clear</button></div>{statusChoices.slice(0, 5).map((status) => <button className={`status-choice ${statusDraft === status ? "selected" : ""}`} key={status} onClick={() => setStatusDraft(status)}><StatusPill status={status} />{statusDraft === status ? <Check size={16} /> : null}</button>)}<div className="selected-status">{statusDraft ? <StatusPill status={statusDraft} removable onRemove={() => setStatusDraft("")} /> : "No status selected"}</div><div className="status-editor-foot"><Button onClick={() => { setStatusEditor(null); setStatusAnchor(null); }}>Cancel</Button><Button variant="primary" disabled={!statusDraft} onClick={saveInlineStatus}>Save</Button></div></div>, document.body) : null}
    <div className="program-footer"><span>1 — {filtered.length} of {filtered.length} rows</span><div className="pager"><button><ChevronLeft size={16} /></button><button className="active">1</button><button><ChevronRight size={16} /></button></div><select defaultValue="25"><option>Show: 25</option><option>Show: 50</option></select></div>
    <PreferencesDrawer key={`preferences-${preferences || "closed"}`} open={Boolean(preferences)} initialTab={preferences || "Columns"} onClose={() => setPreferences(null)} selected={selectedColumns} setSelected={setSelectedColumns} />
    <AbstractDrawer key={`abstract-${drawer?.id || (drawer ? "new" : "closed")}`} open={Boolean(drawer)} editing={drawer} onClose={() => setDrawer(null)} onSave={saveAbstract} participants={data.participants} formatOptions={formatOptions} trackOptions={trackOptions} answerFields={data.forms.find((form) => form.id === drawer?.formId)?.abstractFields || []} />
    {toast ? <div className="toast-inline"><b>{toast.title}</b><span>{toast.detail}</span></div> : null}
  </div>;
}

function SessionDrawer({ open, onClose, onSave, participants, editing, rooms, tracks, event, timezone }) {
  const [form, setForm] = useState(() => sessionDrawerForm(editing, event, timezone));
  participants = visibleParticipantOptions(participants, form.participants || []);
  const startInstant = eventDate(form.startsAt, timezone);
  const endInstant = eventDate(form.endsAt, timezone);
  const eventStart = eventDate(event?.start, timezone);
  const eventEnd = eventDate(event?.end, timezone);
  const invalidOrder = startInstant && endInstant && endInstant <= startInstant;
  const outsideEvent = startInstant && endInstant && eventStart && eventEnd && (startInstant < eventStart || endInstant > eventEnd);
  const timeError = invalidOrder ? "End time must be after start time." : outsideEvent ? `Choose a time within ${formatEventDateTime(event?.start, timezone)}–${formatEventDateTime(event?.end, timezone)}.` : "";
  const change = (key, value) => setForm((current) => {
    if (key !== "startsAt") return { ...current, [key]: value };
    const previousStart = eventDate(current.startsAt, timezone);
    const previousEnd = eventDate(current.endsAt, timezone);
    const duration = previousStart && previousEnd && previousEnd > previousStart ? previousEnd - previousStart : 30 * 60 * 1000;
    const nextStart = eventDate(value, timezone);
    return { ...current, startsAt: value, endsAt: nextStart ? toDatetimeLocal(new Date(nextStart.getTime() + duration), timezone) : current.endsAt };
  });
  const togglePerson = (id) => change("participants", form.participants.includes(id) ? form.participants.filter((item) => item !== id) : [...form.participants, id]);
  const save = () => onSave({ ...form, startsAt: startInstant?.toISOString() || "", endsAt: endInstant?.toISOString() || "" });
  return <Drawer open={open} onClose={onClose} title={editing?.id ? "Edit Session" : "Add Session"} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!form.title.trim() || !form.startsAt || !form.endsAt || Boolean(timeError)} onClick={save}>{editing?.id ? "Save Changes" : "Create Session"}</Button></>}><div className="drawer-form"><Field label="Title" required><input value={form.title} placeholder="Enter session title..." onChange={(event) => change("title", event.target.value)} /></Field><Field label="Description"><textarea value={form.description} placeholder="Enter description..." onChange={(event) => change("description", event.target.value)} /></Field><div className="session-timezone-note"><b>{timezone || "UTC"}</b> event time · New sessions default to the event start and a 30-minute duration. Changing the start preserves the duration.</div><div className={`field-row ${timeError ? "invalid" : ""}`}><Field label="Starts At"><input type="datetime-local" step="900" value={form.startsAt} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => change("startsAt", event.target.value)} /></Field><Field label="Ends At"><input type="datetime-local" step="900" value={form.endsAt} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => change("endsAt", event.target.value)} /></Field></div>{timeError ? <div className="session-time-error" role="alert">{timeError}</div> : null}<div className="field-row"><Field label="Room"><select value={form.room} onChange={(event) => change("room", event.target.value)}><option value="">Select room...</option>{rooms.map((room) => <option key={room}>{room}</option>)}</select></Field><Field label="Track"><select value={form.track} onChange={(event) => change("track", event.target.value)}><option value="">Select track...</option>{tracks.map((track) => <option key={track}>{track}</option>)}</select></Field></div><Field label="Status"><select value={form.status} onChange={(event) => change("status", event.target.value)}><option>Accepted</option><option>Pending</option><option>Draft</option></select></Field><Field label="Participants"><div className="participant-picker">{participants.map((person) => <label className="participant-option" key={person.id}><input type="checkbox" checked={form.participants.includes(person.id)} onChange={() => togglePerson(person.id)} /><span className="participant-avatar">{person.initials}</span><span><b>{person.name}</b><small>{person.email}</small></span></label>)}</div></Field></div></Drawer>;
}

function eventDate(value, timezone = "UTC") {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/Z$|[+-]\d\d:?\d\d$/.test(String(value))) return new Date(value);
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return new Date(value);
  const desired = { year: +match[1], month: +match[2], day: +match[3], hour: +(match[4] || 0), minute: +(match[5] || 0), second: +(match[6] || 0) };
  const guess = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
  const observed = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, +part.value]));
  return new Date(guess - (Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second) - guess));
}

function eventDateParts(value, timezone) {
  const date = eventDate(value, timezone);
  if (!date || Number.isNaN(date.getTime())) return {};
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function formatEventDateTime(value, timezone) {
  const date = eventDate(value, timezone);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timezone || "UTC" }).format(date);
}

function agendaCalendarDates(event, timezone) {
  const start = eventDateParts(event?.start, timezone);
  const end = eventDateParts(event?.end, timezone);
  if (!start.year || !start.month || !start.day) return [];
  const first = Date.UTC(start.year, start.month - 1, start.day);
  const last = end.year ? Date.UTC(end.year, end.month - 1, end.day) : first;
  const dates = [];
  for (let cursor = first; cursor <= last && dates.length < 14; cursor += 86400000) {
    const date = new Date(cursor);
    dates.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
  }
  return dates;
}

function dateLabel(date, includeYear = false) {
  if (!date) return "Date not set";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(includeYear ? { year: "numeric" } : {}) }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

function toDatetimeLocal(value, timezone) {
  const parts = eventDateParts(value, timezone);
  if (!parts.year) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function sessionDuration(session, fallback = 30 * 60 * 1000) {
  const start = Date.parse(session?.startsAt || session?.start || "");
  const end = Date.parse(session?.endsAt || session?.end || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : fallback;
}

function sessionDrawerForm(editing, event, timezone) {
  const source = editing || { title: "", status: "Accepted", description: "", room: "", track: "Track 1", participants: [] };
  const defaultStart = eventDate(event?.start, timezone);
  const start = eventDate(source.startsAt || source.start, timezone) || defaultStart;
  const end = eventDate(source.endsAt || source.end, timezone) || (start ? new Date(start.getTime() + 30 * 60 * 1000) : null);
  return {
    ...source,
    startsAt: toDatetimeLocal(start, timezone),
    endsAt: toDatetimeLocal(end, timezone),
    participants: source.participants || [],
  };
}

function timeLabel(value, timezone) {
  const date = eventDate(value, timezone);
  if (!date) return "Unscheduled";
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC", hour: "numeric", minute: "2-digit" }).format(date);
}

function slotStart(day, minutes, timezone) {
  const localDate = `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return eventDate(`${localDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, timezone);
}

function AgendaContent({ view, sessions, conflicts, participants, onMove, onEdit, timezone, event, rooms, tracks }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [dragPreview, setDragPreview] = useState(null);
  const [conflictPlan, setConflictPlan] = useState(null);
  const availableDates = agendaCalendarDates(event, timezone);
  const eventStart = eventDate(event?.start, timezone);
  const eventEnd = eventDate(event?.end, timezone);
  const dragStart = (dragEvent, session) => {
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/session-id", session.id);
    setDragPreview({ sessionId: session.id });
  };
  const dragEnd = () => setDragPreview(null);
  const sessionChip = (session) => <div className="session-chip" draggable onDragStart={(dragEvent) => dragStart(dragEvent, session)} onDragEnd={dragEnd} key={session.id}>{session.title}{session.startsAt ? <small>{timeLabel(session.startsAt, timezone)}–{timeLabel(session.endsAt, timezone)}</small> : null}</div>;

  if (view === "Conflicts") {
    const grouped = [...conflicts.reduce((groups, conflict) => {
      const ids = [...(conflict.sessions || [])].sort();
      const key = ids.join(":") || conflict.id;
      const current = groups.get(key) || { key, sessionIds: ids, types: [], details: [] };
      current.types.push(conflict.type);
      current.details.push(conflict.detail);
      groups.set(key, current);
      return groups;
    }, new Map()).values()];
    const planMove = (group, moving, after) => {
      const afterEnd = Date.parse(after.endsAt || after.end || "");
      if (!Number.isFinite(afterEnd)) return;
      const startsAt = new Date(afterEnd);
      const endsAt = new Date(afterEnd + sessionDuration(moving));
      setConflictPlan({ groupKey: group.key, sessionId: moving.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), label: `Move ${moving.title} after ${after.title}`, outsideEvent: Boolean(eventEnd && endsAt > eventEnd) });
    };
    return <div className="view-canvas"><div className="agenda-view-head"><h3>Conflicts</h3><small>{timezone || "UTC"} · Preview every change before applying</small></div>{grouped.length ? <div className="conflict-list">{grouped.map((group) => { const [first, second] = group.sessionIds.map((id) => sessions.find((session) => session.id === id)); const plan = conflictPlan?.groupKey === group.key ? conflictPlan : null; return <article className="conflict-card" key={group.key}><CircleAlert size={19} /><div><b>{group.types.length} scheduling conflict{group.types.length === 1 ? "" : "s"}</b><span>{first?.title} overlaps {second?.title}.</span><span className="conflict-types">{[...new Set(group.types)].map((type) => <em key={type}>{type}</em>)}</span><div className="conflict-actions"><small>Choose which session to move. Its current duration will be preserved.</small><div className="conflict-choice">{first && second ? <><button onClick={() => planMove(group, first, second)}>Preview moving {first.title}</button><button onClick={() => planMove(group, second, first)}>Preview moving {second.title}</button></> : null}</div></div>{plan ? <div className="conflict-preview"><b>{plan.label}</b><p>{formatEventDateTime(plan.startsAt, timezone)}–{timeLabel(plan.endsAt, timezone)} · {timezone || "UTC"}. {plan.outsideEvent ? "This would fall outside the configured event dates; edit the session manually instead." : "Conflicts will be recalculated after the move."}</p><div className="conflict-preview-actions"><button onClick={() => setConflictPlan(null)}>Cancel</button>{plan.outsideEvent ? <button onClick={() => onEdit(sessions.find((session) => session.id === plan.sessionId))}>Edit session</button> : <button className="primary" onClick={async () => { await onMove(plan.sessionId, { startsAt: plan.startsAt, endsAt: plan.endsAt }); setConflictPlan(null); }}>Apply move</button>}</div></div> : null}</div></article>; })}</div> : <EmptyState icon={Check} title="No conflicts found" description="Room, participant, and track overlaps will appear here." />}</div>;
  }
  if (view === "Rooms") return <div className="view-canvas"><h3>Rooms</h3><div className="room-grid">{rooms.map((room) => <article className="room-card drop-zone" key={room} onDragOver={(dragEvent) => dragEvent.preventDefault()} onDrop={(dragEvent) => { onMove(dragEvent.dataTransfer.getData("text/session-id"), { room }); dragEnd(); }}><h4>{room}</h4>{sessions.filter((session) => session.room === room).map(sessionChip)}{!sessions.some((session) => session.room === room) ? <span style={{ color: "#718097", fontSize: 11 }}>Drop a session here</span> : null}</article>)}</div></div>;
  if (view === "Tracks") return <div className="view-canvas"><h3>Tracks</h3><div className="room-grid">{tracks.map((track) => <article className="room-card drop-zone" key={track} onDragOver={(dragEvent) => dragEvent.preventDefault()} onDrop={(dragEvent) => { onMove(dragEvent.dataTransfer.getData("text/session-id"), { track }); dragEnd(); }}><h4>{track}</h4>{sessions.filter((session) => session.track === track).map(sessionChip)}</article>)}</div></div>;
  if (view === "Day" || view === "Week") {
    if (!availableDates.length) return <EmptyState icon={CalendarDays} title="Set event dates first" description="Day and week scheduling follow the dates in Event Details." />;
    const selectedDay = availableDates[Math.min(selectedDayIndex, availableDates.length - 1)];
    const days = view === "Day" ? [selectedDay] : availableDates.slice(0, 3);
    const slots = Array.from({ length: ((18 - 8) * 4) + 1 }, (_, index) => (8 * 60) + (index * 15));
    const displayedDayKeys = new Set(days.map((day) => `${day.year}-${day.month}-${day.day}`));
    const outsideView = sessions.filter((session) => { const parts = eventDateParts(session.startsAt || session.start, timezone); return !displayedDayKeys.has(`${parts.year}-${parts.month}-${parts.day}`); });
    const range = view === "Day" ? dateLabel(selectedDay, true) : `${dateLabel(days[0])}–${dateLabel(days.at(-1), true)}`;
    const dropOnSlot = (dragEvent, day, minutes) => {
      const id = dragEvent.dataTransfer.getData("text/session-id");
      const moving = sessions.find((session) => session.id === id);
      const start = slotStart(day, minutes, timezone);
      if (!moving || !start) return;
      const end = new Date(start.getTime() + sessionDuration(moving));
      if ((eventStart && start < eventStart) || (eventEnd && end > eventEnd)) { setDragPreview(null); return; }
      onMove(id, { startsAt: start.toISOString(), endsAt: end.toISOString() });
      setDragPreview(null);
    };
    return <div className="view-canvas"><div className="agenda-view-head"><div><h3>{view} view · {range}</h3><small>{timezone || "UTC"} · 15-minute placement, 30-minute labels</small></div>{view === "Day" ? <div className="agenda-day-picker">{availableDates.map((day, index) => <button className={index === selectedDayIndex ? "active" : ""} key={`${day.year}-${day.month}-${day.day}`} onClick={() => setSelectedDayIndex(index)}>{dateLabel(day)}</button>)}</div> : null}</div>{outsideView.length ? <div className="agenda-unscheduled"><header><b>{view === "Day" ? "Other days / unscheduled" : "Outside this view"}</b><small>Drag any session into a precise time slot</small></header><div className="agenda-unscheduled-list">{outsideView.map(sessionChip)}</div></div> : null}<div className={`calendar-board ${view === "Day" ? "day" : ""}`} style={view === "Week" ? { gridTemplateColumns: `76px repeat(${days.length},1fr)` } : undefined}><div className="day-head" />{days.map((day) => <div className="day-head" key={`${day.year}-${day.month}-${day.day}`}>{dateLabel(day)}</div>)}{slots.flatMap((minutes) => { const minute = minutes % 60; const labelDate = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minute)); const label = minute % 30 === 0 ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(labelDate) : ""; return [<div className={`time ${label ? "" : "quarter"}`} key={`${minutes}-label`}>{label}</div>, ...days.map((day) => { const key = `${day.year}-${day.month}-${day.day}-${minutes}`; const matches = sessions.filter((session) => { const parts = eventDateParts(session.startsAt || session.start, timezone); return parts.year === day.year && parts.month === day.month && parts.day === day.day && (parts.hour * 60) + parts.minute === minutes; }); const moving = sessions.find((session) => session.id === dragPreview?.sessionId); const targetStart = slotStart(day, minutes, timezone); const targetEnd = targetStart ? new Date(targetStart.getTime() + sessionDuration(moving)) : null; const available = Boolean(targetStart && (!eventStart || targetStart >= eventStart) && (!eventEnd || targetEnd <= eventEnd)); const preview = available && dragPreview?.key === key; return <div className={`calendar-slot ${minute === 0 ? "hour" : ""} ${available ? "" : "unavailable"} ${preview ? "drop-target" : ""}`} key={key} onDragOver={(dragEvent) => { if (!available) return; dragEvent.preventDefault(); dragEvent.dataTransfer.dropEffect = "move"; }} onDragEnter={() => available && setDragPreview((current) => ({ ...(current || {}), key }))} onDrop={(dragEvent) => available && dropOnSlot(dragEvent, day, minutes)}>{preview ? <div className="drop-preview">Move to {label || timeLabel(targetStart, timezone)}</div> : matches.map(sessionChip)}</div>; })]; })}</div></div>;
  }
  if (view === "Month") {
    const [focus] = availableDates;
    if (!focus) return <EmptyState icon={CalendarDays} title="Set event dates first" description="Month scheduling follows the event start date." />;
    const leading = new Date(Date.UTC(focus.year, focus.month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(focus.year, focus.month, 0)).getUTCDate();
    const cells = Array.from({ length: Math.ceil((leading + daysInMonth) / 7) * 7 }, (_, index) => index - leading + 1);
    const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(focus.year, focus.month - 1, 1)));
    return <div className="view-canvas"><div className="agenda-view-head"><h3>{monthLabel}</h3><small>{timezone || "UTC"}</small></div><div className="month-board">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div className="month-head" key={day}>{day}</div>)}{cells.map((day, index) => { const inMonth = day >= 1 && day <= daysInMonth; return <div className={`month-cell ${inMonth ? "drop-zone" : "outside"}`} key={index} onDragOver={(dragEvent) => inMonth && dragEvent.preventDefault()} onDrop={(dragEvent) => { if (!inMonth) return; const id = dragEvent.dataTransfer.getData("text/session-id"); const moving = sessions.find((session) => session.id === id); const start = eventDate(`${focus.year}-${String(focus.month).padStart(2,"0")}-${String(day).padStart(2,"0")}T09:00`, timezone); const end = moving && start ? new Date(start.getTime() + sessionDuration(moving)) : null; if (moving && start && end && (!eventStart || start >= eventStart) && (!eventEnd || end <= eventEnd)) onMove(id, { startsAt: start.toISOString(), endsAt: end.toISOString() }); dragEnd(); }}><span>{inMonth ? day : ""}</span>{inMonth ? sessions.filter((session) => { const parts = eventDateParts(session.startsAt || session.start, timezone); return parts.year === focus.year && parts.month === focus.month && parts.day === day; }).map(sessionChip) : null}</div>; })}</div></div>;
  }
  if (!sessions.length) return <EmptyState icon={CalendarDays} title="Nothing here yet" description="Sessions will appear here in list view" />;
  return <table className="agenda-list"><thead><tr><th>Session</th><th>Status</th><th>Starts At</th><th>Ends At</th><th>Room</th><th>Track</th><th>Speakers</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id} draggable onDragStart={(dragEvent) => dragStart(dragEvent, session)} onDragEnd={dragEnd}><td className="agenda-title-cell"><button aria-label={`Edit ${session.title}`} onClick={() => onEdit(session)}><b>{session.title}</b><small>{session.description || "No description"}</small></button></td><td><Pill tone={session.status === "Accepted" ? "success" : "neutral"}>{session.status || "Accepted"}</Pill></td><td>{formatEventDateTime(session.startsAt, timezone)}</td><td>{formatEventDateTime(session.endsAt, timezone)}</td><td>{session.room || "—"}</td><td>{session.track || "—"}</td><td>{(session.participants || []).map((id) => participants.find((person) => person.id === id)?.name).filter(Boolean).join(", ") || "—"}</td></tr>)}</tbody></table>;
}

export function AgendaScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const [view, setView] = useState("List");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [draftsOnly, setDraftsOnly] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const scheduleRelease=data.scheduleRelease||{status:"draft",publishedAt:null,version:0};
  const schedulePublished=scheduleRelease.status==="published";
  const roomOptions = useMemo(() => [...new Set(["Main Stage", "Hall A", "Hall B", ...data.sessions.map((session) => session.room).filter(Boolean)])], [data.sessions]);
  const trackOptions = useMemo(() => [...new Set(["Track 1", ...fieldOptions(data.forms || [], /track|category/i), ...data.abstracts.map((abstract) => abstract.track).filter(Boolean), ...data.sessions.map((session) => session.track).filter(Boolean)])], [data.abstracts, data.forms, data.sessions]);
  const filtered = data.sessions.filter((session) => `${session.title} ${session.description || ""}`.toLowerCase().includes(search.toLowerCase()) && (!draftsOnly || session.status === "Draft"));
  const conflicts = useMemo(() => scheduleConflicts(data.sessions), [data.sessions]);
  const saveSession = async (form) => {
    if (form.id) {
      const { id, version, ...patch } = form;
      let nextPatch = patch;
      if (persistenceStatus === "d1") {
        const result = await patchSharedResource("sessions", id, version, { ...patch, status: String(patch.status || "Accepted").toLowerCase(), startsAt: patch.startsAt || null, endsAt: patch.endsAt || null, room: patch.room || null, track: patch.track || null, participantIds: patch.participants || [] });
        if (!result.ok) { setToast({ title: "Session not updated", detail: result.error === "VERSION_CONFLICT" ? "This session changed elsewhere. Reload first." : "The shared workspace rejected this update." }); return; }
        nextPatch = { ...patch, version: result.item.version };
      }
      update((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, ...nextPatch } : session) }));
      setDrawer(null);
      setToast({ title: "Session updated", detail: form.title });
      window.setTimeout(() => setToast(null), 2200);
      return;
    }
    let created = { id: `session-${Date.now()}`, ...form };
    if (persistenceStatus === "d1") {
      const result = await createSharedResource("sessions", { title: form.title, description: form.description, status: form.status.toLowerCase(), startsAt: form.startsAt || null, endsAt: form.endsAt || null, room: form.room || null, track: form.track || null, participantIds: form.participants || [] });
      if (!result.ok) { setToast({ title: "Session not created", detail: "The shared workspace rejected this session." }); return; }
      created = { id: result.item.id, title: result.item.title, description: result.item.description || "", status: form.status, startsAt: result.item.startsAt || "", endsAt: result.item.endsAt || "", room: result.item.room || "", track: result.item.track || "", participants: result.item.participantIds || [], version: result.item.version };
    }
    update((current) => ({ ...current, sessions: [...current.sessions, created] }));
    setDrawer(null);
    setToast({ title: "Session created", detail: form.title });
    window.setTimeout(() => setToast(null), 2200);
  };
  const moveSession = async (id, patch) => {
    if (!id) return;
    const existing = data.sessions.find((session) => session.id === id);
    let nextPatch = patch;
    if (persistenceStatus === "d1") {
      const result = await patchSharedResource("sessions", id, existing?.version, patch);
      if (!result.ok) { setToast({ title: "Agenda not updated", detail: result.error === "VERSION_CONFLICT" ? "This session changed elsewhere. Reload first." : "The shared workspace rejected this move." }); return; }
      nextPatch = { ...patch, version: result.item.version };
    }
    update((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === id ? { ...session, ...nextPatch } : session) }));
    setToast({ title: "Agenda updated", detail: "The session was moved and conflicts were recalculated." });
    window.setTimeout(() => setToast(null), 2200);
  };
  const toggleScheduleRelease=async()=>{const nextStatus=schedulePublished?"draft":"published";if(nextStatus==="published"&&!data.sessions.some((session)=>session.startsAt||session.start)){setToast({title:"Schedule not published",detail:"Add at least one scheduled session first."});return;}let next={status:nextStatus,publishedAt:nextStatus==="published"?new Date().toISOString():null,version:Number(scheduleRelease.version||0)+1};if(persistenceStatus==="d1"){const result=await setSharedScheduleRelease(nextStatus,Number(scheduleRelease.version||0));if(!result.ok){setToast({title:"Schedule release not updated",detail:result.error==="VERSION_CONFLICT"?"The release changed elsewhere. Reload first.":"The shared workspace rejected this release change."});return;}next=result.item;}update((current)=>({...current,scheduleRelease:next}));setToast({title:nextStatus==="published"?"Schedule published":"Schedule returned to draft",detail:nextStatus==="published"?"Enabled public embeds now use this released schedule.":"Public schedule embeds are no longer available."});window.setTimeout(()=>setToast(null),2600);};
  const views = [["List", LayoutList], ["Day", CalendarDays], ["Week", CalendarDays], ["Month", CalendarDays], ["Tracks", Columns3], ["Rooms", Columns3], ["Conflicts", CircleAlert]];
  return <div className="program-page"><style>{programStyles}</style>
    <PageHeader icon={CalendarDays} title="Agenda" subtitle="Manage your event agenda and schedule" actions={<Button variant={schedulePublished?"secondary":"primary"} icon={Globe2} onClick={toggleScheduleRelease}>{schedulePublished?"Unpublish schedule":"Publish schedule"}</Button>} />
    <div className={`agenda-release ${schedulePublished?"published":""}`}><Globe2 size={18}/><span><b>{schedulePublished?"Public schedule released.":"Schedule is private."}</b>{schedulePublished?" Enabled embeds can read this event's accepted sessions.":" Organizer changes remain hidden from public embeds until you publish."} <small>Times shown in {data.event?.timezone || "UTC"}.</small></span>{schedulePublished&&scheduleRelease.publishedAt?<time>{formatEventDateTime(scheduleRelease.publishedAt, data.event?.timezone)}</time>:null}</div>
    <div className="agenda-view-tabs">{views.map(([label, Icon]) => <button key={label} className={view === label ? "active" : ""} onClick={() => setView(label)}><Icon size={17} />{label}{label === "Conflicts" && conflicts.length ? <b>{conflicts.length}</b> : null}</button>)}</div>
    <div className="module-toolbar agenda-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search sessions..." /><button className="toolbar-btn square" aria-label="Table preferences" onClick={() => setToast({ title: "Preferences", detail: "Agenda preferences are ready for this view." })}><ListFilter size={17} /></button><div className="toolbar-divider" /><button className="toolbar-btn"><Eye size={17} /><span>Saved Views</span><ChevronDown size={15} /></button><button className="toolbar-btn active"><Columns3 size={17} /><span>Columns</span></button><button className="toolbar-btn"><SortAsc size={17} /><span>Sort</span></button><button className="toolbar-btn"><Filter size={17} /><span>Filter</span></button><button className={`toolbar-btn ${draftsOnly ? "active" : ""}`} onClick={() => setDraftsOnly((value) => !value)}><FileText size={17} /><span>Drafts</span></button><div className="relative"><button className="toolbar-btn" onClick={() => setOptionsOpen((value) => !value)}><MoreHorizontal size={17} /><span>Options</span></button>{optionsOpen ? <div className="floating-menu"><button onClick={() => setOptionsOpen(false)}><Upload size={17} />Import sessions</button><button onClick={() => setOptionsOpen(false)}><Download size={17} />Export agenda</button></div> : null}</div><Button variant="primary" icon={Plus} onClick={() => setDrawer({ title: "", status: "Accepted", description: "", startsAt: "", endsAt: "", room: "", track: "Track 1", participants: [] })}>Add Session</Button></div>
    <div className="agenda-stage"><AgendaContent view={view} sessions={filtered} conflicts={conflicts} participants={data.participants} onMove={moveSession} onEdit={setDrawer} timezone={data.event?.timezone} event={data.event} rooms={roomOptions} tracks={trackOptions} /></div>
    <SessionDrawer key={drawer?.id || (drawer ? "new" : "closed")} open={Boolean(drawer)} editing={drawer} onClose={() => setDrawer(null)} onSave={saveSession} participants={data.participants} rooms={roomOptions} tracks={trackOptions} event={data.event} timezone={data.event?.timezone || "UTC"} />
    {toast ? <div className="toast-inline"><b>{toast.title}</b><span>{toast.detail}</span></div> : null}
  </div>;
}
