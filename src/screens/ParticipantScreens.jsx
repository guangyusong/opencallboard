import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileText, Search, UserRound, UsersRound } from "lucide-react";
import { Button, EmptyState, Field, PageHeader, Pill, SearchBox } from "../components/ui.jsx";
import { patchSharedResource } from "../lib/sharedApi.js";
import { useAppStore } from "../store.jsx";

const styles = `
.people-page{padding:28px 30px 48px;min-height:calc(100vh - var(--topbar-height));background:linear-gradient(180deg,#f6f8fd 0,#fbfcfe 100%)}.people-toolbar{display:flex;gap:12px;margin:18px 0}.people-toolbar .search-box{width:min(460px,100%)}.people-layout{display:grid;grid-template-columns:minmax(340px,.8fr) minmax(520px,1.2fr);gap:18px}.people-list,.people-detail{border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:var(--shadow-card);overflow:hidden}.people-list header,.people-detail>header{min-height:66px;padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}.people-list h2,.people-detail h2{margin:0;font-size:16px}.person-row{width:100%;min-height:72px;padding:12px 16px;border:0;border-bottom:1px solid var(--border);background:#fff;display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;text-align:left;cursor:pointer}.person-row:last-child{border-bottom:0}.person-row:hover,.person-row.active{background:#f3f6fd}.person-avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#e4eaf4;color:#40506a;font-size:12px;font-weight:700;overflow:hidden}.person-avatar img{width:100%;height:100%;object-fit:cover}.person-copy b,.person-copy small{display:block}.person-copy small{margin-top:5px;color:var(--muted-text);font-size:10px}.people-detail-body{padding:22px}.profile-hero{display:flex;align-items:center;gap:16px;margin-bottom:22px}.profile-hero .person-avatar{width:68px;height:68px;font-size:17px}.profile-hero h3{margin:0;font-size:20px}.profile-hero p{margin:6px 0 0;color:var(--muted-text);font-size:12px}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.profile-grid .field textarea{min-height:112px}.profile-grid .wide{grid-column:1/-1}.profile-actions{display:flex;justify-content:flex-end;margin-top:16px}.profile-message{margin:14px 0;padding:11px 13px;border-radius:8px;background:#eef7f1;color:#176534;font-size:11px}.profile-message.error{background:#fff1f1;color:#a12f2f}.operations-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}.operations-card{border:1px solid var(--border);border-radius:10px;overflow:hidden}.operations-card header{padding:13px 15px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}.operations-card h4{margin:0;font-size:13px}.operations-row{min-height:48px;padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px;font-size:11px}.operations-row:last-child{border-bottom:0}.operations-row span:first-of-type{min-width:0;flex:1}.operations-row a{color:var(--accent);display:grid}.people-empty{padding:30px}@media(max-width:980px){.people-layout{grid-template-columns:1fr}.people-page{padding:20px 14px}}@media(max-width:620px){.profile-grid,.operations-grid{grid-template-columns:1fr}.profile-grid .wide{grid-column:auto}}
`;

function isComplete(task) {
  return Boolean(task.complete) || ["complete", "completed", "done"].includes(String(task.status || "").toLowerCase());
}

export function ParticipantsScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const [query, setQuery] = useState("");
  const speakers = useMemo(() => (data.participants || []).filter((person) => {
    const linked = (data.abstracts || []).some((abstract) => (abstract.participantIds || []).includes(person.id));
    return String(person.role || "").toLowerCase().includes("speaker") || linked;
  }), [data.abstracts, data.participants]);
  const filtered = speakers.filter((person) => `${person.name} ${person.email} ${person.title || ""} ${person.company || ""} ${person.bio || ""}`.toLowerCase().includes(query.toLowerCase()));
  const [selectedId, setSelectedId] = useState(speakers[0]?.id || "");
  const selected = speakers.find((person) => person.id === selectedId) || filtered[0] || speakers[0];
  const [draft, setDraft] = useState({ name: "", title: "", company: "", bio: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (selected) setDraft({ name: selected.name || "", title: selected.title || "", company: selected.company || "", bio: selected.bio || "" });
    setMessage("");
  }, [selected?.id, selected?.name, selected?.title, selected?.company, selected?.bio]);
  const tasks = (data.tasks || []).filter((task) => task.personId === selected?.id || task.assigneePersonId === selected?.id);
  const files = useMemo(() => [
    ...new Map(
      [...(data.portalFiles || []), ...(data.speakerFiles || []), ...(data.files || [])]
        .filter((file) => file.ownerPersonId === selected?.id || file.personId === selected?.id)
        .map((file) => [file.id, file]),
    ).values(),
  ].sort((left, right) => Number(right.version || 1) - Number(left.version || 1)), [data.files, data.portalFiles, data.speakerFiles, selected?.id]);
  const submissions = (data.abstracts || []).filter((abstract) => (abstract.participantIds || []).includes(selected?.id));
  const completed = tasks.filter(isComplete).length;
  const save = async () => {
    if (!selected || !draft.name.trim()) return;
    setSaving(true); setMessage("");
    let version = selected.version;
    if (persistenceStatus === "d1") {
      const result = await patchSharedResource("people", selected.id, selected.version, { name: draft.name.trim(), title: draft.title.trim(), company: draft.company.trim(), bio: draft.bio });
      if (!result.ok) {
        setSaving(false);
        setMessage(result.error === "VERSION_CONFLICT" ? "This speaker changed elsewhere. Reload before saving." : "The speaker profile could not be saved.");
        return;
      }
      version = result.item.version;
    }
    update((state) => ({ ...state, participants: state.participants.map((person) => person.id === selected.id ? { ...person, name: draft.name.trim(), title: draft.title.trim(), company: draft.company.trim(), bio: draft.bio, initials: draft.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), version } : person) }));
    setSaving(false); setMessage("Speaker profile saved to the shared workspace.");
  };
  return <div className="people-page"><style>{styles}</style>
    <PageHeader icon={UsersRound} title="Speakers" subtitle="Track accepted speakers, profiles, sessions, tasks, and files in one organizer workspace" />
    <div className="people-toolbar"><SearchBox value={query} onChange={setQuery} placeholder="Search speakers by name, title, company, email, or bio…" /></div>
    <div className="people-layout"><section className="people-list"><header><h2>Speaker roster</h2><Pill tone="blue">{filtered.length} speakers</Pill></header>{filtered.length ? filtered.map((person) => <button className={`person-row ${selected?.id === person.id ? "active" : ""}`} key={person.id} onClick={() => setSelectedId(person.id)}><span className="person-avatar">{person.headshotUrl ? <img src={person.headshotUrl} alt="" /> : person.initials}</span><span className="person-copy"><b>{person.name}</b><small>{person.email}</small></span><Pill tone={(data.tasks || []).some((task) => (task.personId === person.id || task.assigneePersonId === person.id) && !isComplete(task)) ? "warning" : "success"}>{(data.tasks || []).some((task) => (task.personId === person.id || task.assigneePersonId === person.id) && !isComplete(task)) ? "Needs action" : "Ready"}</Pill></button>) : <div className="people-empty"><EmptyState icon={Search} title="No speakers found" description="Try another search." /></div>}</section>
      <section className="people-detail">{selected ? <><header><h2>Speaker record</h2><Pill tone={completed === tasks.length ? "success" : "warning"}>{completed}/{tasks.length} tasks complete</Pill></header><div className="people-detail-body"><div className="profile-hero"><span className="person-avatar">{selected.headshotUrl ? <img src={selected.headshotUrl} alt={`${selected.name} headshot`} /> : selected.initials}</span><div><h3>{selected.name}</h3><p>{[selected.title, selected.company].filter(Boolean).join(" · ") || selected.email} · {submissions.length} submission{submissions.length === 1 ? "" : "s"}</p></div></div>{message ? <div className={`profile-message ${message.includes("could not") || message.includes("Reload") ? "error" : ""}`}>{message}</div> : null}<div className="profile-grid"><Field label="Name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Email"><input readOnly value={selected.email || ""} /></Field><Field label="Professional title"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Principal Engineer" /></Field><Field label="Company"><input value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} placeholder="Company" /></Field><div className="wide"><Field label="Biography"><textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} placeholder="Speaker biography…" /></Field></div></div><div className="profile-actions"><Button variant="primary" disabled={saving || !draft.name.trim()} onClick={save}>{saving ? "Saving…" : "Save speaker"}</Button></div><div className="operations-grid"><section className="operations-card"><header><h4>Onboarding tasks</h4><Pill>{tasks.length}</Pill></header>{tasks.length ? tasks.map((task) => <div className="operations-row" key={task.id}>{isComplete(task) ? <CheckCircle2 size={16} color="#18864b" /> : <UserRound size={16} color="#b7791f" />}<span>{task.title}</span><Pill tone={isComplete(task) ? "success" : "warning"}>{isComplete(task) ? "Complete" : "Open"}</Pill></div>) : <div className="operations-row"><span>No assigned tasks.</span></div>}</section><section className="operations-card"><header><h4>Speaker files</h4><Pill>{files.length}</Pill></header>{files.length ? files.map((file) => <div className="operations-row" key={file.id}><FileText size={16}/><span>{file.name}<br/><small>v{file.version || 1} · {file.size || file.sizeBytes ? `${file.size || file.sizeBytes} bytes` : "Uploaded"}{file.uploaded ? ` · ${new Date(file.uploaded).toLocaleString()}` : ""}</small></span>{file.downloadUrl ? <a href={file.downloadUrl} aria-label={`Download ${file.name}`}><Download size={16}/></a> : null}</div>) : <div className="operations-row"><span>No uploaded files.</span></div>}</section><section className="operations-card" style={{gridColumn:"1 / -1"}}><header><h4>Submissions and sessions</h4><Pill>{submissions.length}</Pill></header>{submissions.length ? submissions.map((submission) => <div className="operations-row" key={submission.id}><FileText size={16}/><span>{submission.title}</span><Pill tone={submission.status === "Accepted" ? "success" : "neutral"}>{submission.status}</Pill></div>) : <div className="operations-row"><span>No linked submissions.</span></div>}</section></div></div></> : <EmptyState icon={UsersRound} title="No speaker selected" description="Choose a speaker from the roster."/>}</section></div>
  </div>;
}
