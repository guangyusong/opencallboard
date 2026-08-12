import { useEffect, useRef, useState } from "react";
import { CalendarClock, CalendarDays, Check, CheckCircle2, ClipboardCopy, FileText, GalleryHorizontalEnd, KeyRound, LayoutList, Link2, ListTree, LoaderCircle, Mail, ShieldCheck, UserRoundPlus, UsersRound } from "lucide-react";
import { Button, Field, Modal, PageHeader, Pill } from "../components/ui.jsx";
import { useAppStore } from "../store.jsx";
import { createAccessGrant, loginOrganizer, redeemAccessGrant } from "../lib/sharedApi.js";

const styles = `
.auth-root{min-height:100vh;display:grid;place-items:center;background:#f7f8fb;padding:24px;font-family:Montserrat,"Proxima Nova",Arial,sans-serif;color:#292d37}.auth-card{width:min(620px,100%);background:#fff;border:1px solid #e1e5ec;border-radius:12px;box-shadow:0 14px 34px rgba(23,33,53,.12);padding:34px}.auth-icon{width:48px;height:48px;border-radius:12px;background:#eef2ff;color:#4962e2;display:grid;place-items:center;margin-bottom:20px}.auth-card h1{font-size:25px;margin:0 0 9px}.auth-card p{color:#697386;line-height:1.55;font-size:14px;margin:0 0 22px}.auth-field{display:grid;gap:8px;font-size:13px;font-weight:600}.auth-field input{height:46px;border:1px solid #d7dce5;border-radius:8px;padding:0 13px;font:inherit;outline:0}.auth-field input:focus{border-color:#4b62e2;box-shadow:0 0 0 3px rgba(73,98,226,.12)}.auth-button{width:100%;height:46px;border:0;border-radius:9px;background:#4962e2;color:#fff;font-weight:600;margin-top:18px;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}.auth-button:disabled{opacity:.55;cursor:not-allowed}.auth-error{margin-top:15px;border:1px solid #efb1b1;background:#fff2f2;color:#9e2c2c;border-radius:8px;padding:12px;font-size:13px}.auth-status{display:flex;align-items:center;gap:11px;color:#4c5668}.auth-status svg{flex:none}.auth-note{margin-top:18px!important;font-size:12px!important;color:#8a94a5!important}.auth-public{margin-top:22px;padding-top:18px;border-top:1px solid #e7eaf0}.auth-public h2{margin:0 0 5px;font-size:14px}.auth-public>p{margin:0 0 12px;font-size:12px}.auth-public-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.auth-public-links a{min-height:62px;padding:9px 7px;border:1px solid #dfe4ed;border-radius:8px;color:#3e4c62;text-decoration:none;display:grid;place-items:center;gap:5px;text-align:center;font-size:10px;font-weight:600;transition:border-color .15s ease,background .15s ease,color .15s ease,transform .15s ease}.auth-public-links a:hover{border-color:#9fb0e7;background:#f5f7ff;color:#354fc0;transform:translateY(-1px)}.auth-public-links svg{color:#4962e2}.auth-spin{animation:auth-spin 1s linear infinite}@keyframes auth-spin{to{transform:rotate(360deg)}}@media(max-width:640px){.auth-root{padding:14px}.auth-card{padding:26px 20px}.auth-public-links{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

const teamStyles = `
.team-page .modal{width:min(640px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:hidden;display:flex;flex-direction:column}.team-page .modal>header{flex:none}.team-page .modal .team-modal-grid{gap:14px;padding:20px 24px 10px;overflow-y:auto}.team-page .modal .team-link-card{margin:10px 24px 18px;overflow:hidden}.team-page .modal .team-message{margin:10px 24px 0}.team-page .modal .team-link-output{display:grid;grid-template-columns:minmax(0,1fr) auto}.team-page .modal .team-link-output input{width:100%;min-width:0}
.team-page .modal .modal-actions{flex:none;margin:0;padding:14px 24px;border-top:1px solid var(--border);background:#fff;display:flex;justify-content:flex-end;gap:8px}.team-access-modal{width:min(640px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:hidden;display:flex;flex-direction:column}.team-access-modal>header{flex:none}.team-access-modal .team-modal-grid{gap:14px;padding:20px 24px 10px;overflow-y:auto}.team-access-modal .team-modal-grid .field input,.team-access-modal .team-modal-grid .field select{height:42px}.team-access-modal .team-link-card{margin:10px 24px 18px;overflow:hidden}.team-access-modal .team-message{margin:10px 24px 0}.team-page .team-access-modal .modal-actions{flex:none;margin:0;padding:14px 24px;border-top:1px solid var(--border);background:#fff;display:flex;justify-content:flex-end;gap:8px}.team-access-modal .team-link-output{display:grid;grid-template-columns:minmax(0,1fr) auto}.team-access-modal .team-link-output input{width:100%;min-width:0}@media(max-width:760px){.team-access-modal{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.team-access-modal .team-link-output{grid-template-columns:1fr}}
.team-page{min-height:calc(100vh - var(--topbar-height));padding:28px 30px 48px;background:linear-gradient(180deg,#f6f8fd 0,#fbfcfe 100%)}.team-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.team-stat{padding:18px;border:1px solid var(--border);border-radius:11px;background:#fff}.team-stat span,.team-stat b{display:block}.team-stat span{font-size:10px;color:var(--muted-text);text-transform:uppercase;letter-spacing:.06em}.team-stat b{margin-top:8px;font-size:23px}.team-card{border:1px solid var(--border);border-radius:11px;background:#fff;overflow:hidden;box-shadow:var(--shadow-card)}.team-card>header{min-height:66px;padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:16px}.team-card h2{margin:0;font-size:16px}.team-card header p{margin:5px 0 0;color:var(--muted-text);font-size:11px}.team-table{width:100%;border-collapse:collapse}.team-table th,.team-table td{padding:13px 18px;border-bottom:1px solid var(--border);font-size:12px;text-align:left}.team-table th{background:#f7f8fa;color:#718097;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.team-table tr:last-child td{border-bottom:0}.team-person{display:flex;align-items:center;gap:10px}.team-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e6ebf2;color:#53637a;font-size:10px;font-weight:700}.team-person b,.team-person small{display:block}.team-person small{margin-top:3px;color:var(--muted-text)}.team-link-card{margin-top:18px;padding:18px;border:1px solid #b9c9ee;border-radius:10px;background:#f2f6ff}.team-link-card header{display:flex;align-items:center;gap:9px}.team-link-card h3{margin:0;font-size:14px}.team-link-card p{margin:9px 0;color:#5b6c84;font-size:11px;line-height:1.6}.team-link-output{display:flex;gap:8px}.team-link-output input{height:42px;min-width:0;flex:1;border:1px solid #cfd8ea;border-radius:8px;background:#fff;padding:0 11px;font-size:11px}.team-warning{margin-top:14px;padding:12px;border:1px solid #f1d398;border-radius:8px;background:#fff9e9;color:#75550f;font-size:11px;line-height:1.55}.team-modal-grid{display:grid;gap:16px;padding:4px 0 10px}.team-modal-grid .field input,.team-modal-grid .field select{height:44px}.team-message{margin:14px 0 0;padding:12px;border-radius:8px;background:#eef7f1;color:#176534;font-size:11px}.team-message.error{background:#fff1f1;color:#a12f2f}.team-page .modal-actions{margin:18px -24px -22px;padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}@media(max-width:760px){.team-page{padding:20px 14px}.team-summary{grid-template-columns:1fr}.team-table{display:block;overflow-x:auto}.team-card>header{align-items:flex-start;flex-direction:column}.team-link-output{flex-direction:column}}
`;

export function OrganizerLoginScreen() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await loginOrganizer(secret);
    if (!result.ok) {
      setError(result.error === "INVALID_ORGANIZER_KEY" ? "That organizer or judge key is not valid." : result.error === "JUDGE_ACCESS_EXPIRED" ? "This temporary judge key has expired. Ask the Callboard team for a new one." : "Organizer sign-in is unavailable. Check the shared preview configuration.");
      setLoading(false);
      return;
    }
    window.location.hash = "/dashboard";
    window.location.reload();
  };
  return <main className="auth-root"><style>{styles}</style><form className="auth-card" onSubmit={submit}><div className="auth-icon"><ShieldCheck size={25} /></div><h1>Organizer access</h1><p>Use the organizer key or the temporary judge key supplied with this competition preview. The key is sent only to this Callboard deployment and is never saved in browser storage.</p><label className="auth-field">Organizer or judge key<input type="password" autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} autoFocus /></label><button className="auth-button" disabled={loading || secret.length < 12}>{loading ? <LoaderCircle className="auth-spin" size={18} /> : <KeyRound size={18} />}{loading ? "Signing in…" : "Sign in"}</button>{error ? <div className="auth-error" role="alert">{error}</div> : null}<p className="auth-note">Judge access is time-limited and restricted to the synthetic competition event. Production should replace key-based access with managed staff identity.</p><section className="auth-public" aria-labelledby="public-program-heading"><h2 id="public-program-heading">Explore the public program</h2><p>Call for papers and five live program views—no organizer account required.</p><div className="auth-public-links"><a href="#/submit/form_callboard_judge_cfp"><FileText size={18}/>Call for papers</a><a href="#/embed/embed_callboard_judge_sessions"><LayoutList size={18}/>Session list</a><a href="#/embed/embed_callboard_judge_agenda"><CalendarDays size={18}/>Agenda</a><a href="#/embed/embed_callboard_judge_itinerary"><CalendarClock size={18}/>Itinerary</a><a href="#/embed/embed_callboard_judge_speaker_list"><ListTree size={18}/>Speaker list</a><a href="#/embed/embed_callboard_judge_gallery"><GalleryHorizontalEnd size={18}/>Speaker gallery</a></div></section></form></main>;
}

export function AccessGrantScreen({ token }) {
  const started = useRef(false);
  const [state, setState] = useState({ status: "loading", message: "Verifying your private access link…" });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ status: "error", message: "This access link is incomplete." });
      return;
    }
    redeemAccessGrant(token).then((result) => {
      if (!result.ok) {
        setState({ status: "error", message: result.error === "INVALID_OR_EXPIRED_GRANT" ? "This access link has expired or was already used." : "Callboard could not verify this access link." });
        return;
      }
      const destination = result.session?.role === "reviewer" ? "/evaluation" : "/speaker-portal";
      setState({ status: "success", message: "Access verified. Opening your workspace…" });
      window.setTimeout(() => {
        window.location.hash = destination;
        window.location.reload();
      }, 250);
    });
  }, [token]);
  return <main className="auth-root"><style>{styles}</style><section className="auth-card"><div className="auth-icon">{state.status === "success" ? <CheckCircle2 size={25} /> : state.status === "loading" ? <LoaderCircle className="auth-spin" size={25} /> : <KeyRound size={25} />}</div><h1>{state.status === "error" ? "Access link unavailable" : "Secure event access"}</h1><div className="auth-status" role={state.status === "error" ? "alert" : "status"}><span>{state.message}</span></div>{state.status === "error" ? <p className="auth-note">Ask the event organizer for a new one-time link.</p> : null}</section></main>;
}

export function AccessRequiredScreen({ denied = false }) {
  return <main className="auth-root"><style>{styles}</style><section className="auth-card"><div className="auth-icon"><ShieldCheck size={25} /></div><h1>{denied ? "This workspace is not assigned to you" : "Private event workspace"}</h1><p>{denied ? "Your current event role cannot open this organizer surface." : "Open the one-time link sent by the event organizer to access your speaker or reviewer workspace."}</p><p className="auth-note">No event data is shown until the server verifies an active role-scoped session.</p></section></main>;
}

export function EventTeamScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const people = data.participants ?? [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ personId: "", role: "speaker", name: "", email: "" });
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const counts = {
    speakers: people.filter((person) => String(person.role).toLowerCase().includes("speaker")).length,
    reviewers: people.filter((person) => String(person.role).toLowerCase().includes("reviewer")).length,
    organizers: people.filter((person) => String(person.role).toLowerCase().includes("organizer")).length,
  };
  const choosePerson = (personId) => {
    const person = people.find((candidate) => candidate.id === personId);
    setDraft(person ? { personId: person.id, role: String(person.role).toLowerCase().includes("reviewer") ? "reviewer" : "speaker", name: person.name, email: person.email } : { personId: "", role: "speaker", name: "", email: "" });
    setMessage("");
  };
  const startGrant = (person = null) => {
    setResult(null); setCopied(false); setMessage("");
    if (person) setDraft({ personId: person.id, role: String(person.role).toLowerCase().includes("reviewer") ? "reviewer" : "speaker", name: person.name, email: person.email });
    else choosePerson(people.find((candidate) => String(candidate.role).toLowerCase().includes("speaker"))?.id || people[0]?.id || "");
    setOpen(true);
  };
  const generate = async () => {
    if (!draft.name.trim() || !/^\S+@\S+\.\S+$/.test(draft.email)) { setMessage("Choose an existing person or enter a valid name and email."); return; }
    const existingByEmail = people.find((person) => person.email.toLowerCase() === draft.email.trim().toLowerCase());
    if (!draft.personId && existingByEmail) {
      setMessage(`${existingByEmail.email} already belongs to ${existingByEmail.name}. Select that existing person instead of creating a conflicting identity.`);
      return;
    }
    setBusy(true); setMessage("");
    const response = await createAccessGrant({ role: draft.role, email: draft.email.trim().toLowerCase(), name: draft.name.trim(), personId: draft.personId || undefined });
    setBusy(false);
    if (!response.ok) { setMessage(response.error === "PERSON_EMAIL_MISMATCH" ? "The selected person and email do not match." : "The private access link could not be created."); return; }
    if (response.item.person) {
      const person = response.item.person;
      update((state) => ({
        ...state,
        participants: [
          ...(state.participants || []).filter((item) => item.id !== person.id),
          {
            id: person.id,
            name: person.name,
            email: person.email,
            role: person.role,
            bio: person.bio || "",
            initials: String(person.name || person.email || "TM").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
            version: person.version,
          },
        ],
        reviewers: draft.role === "reviewer"
          ? [
              ...(state.reviewers || []).filter((item) => item.id !== response.item.userId),
              { id: response.item.userId, personId: person.id, name: person.name, email: person.email },
            ]
          : (state.reviewers || []),
      }));
    }
    const accessUrl = `${window.location.origin}${window.location.pathname}#/access/${response.item.grantToken}`;
    setResult({ ...response.item, accessUrl });
  };
  const copy = async () => {
    if (!result?.accessUrl) return;
    try { await navigator.clipboard.writeText(result.accessUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setMessage("Copy is unavailable in this browser. Select the link manually."); }
  };
  return <div className="team-page"><style>{teamStyles}</style><PageHeader icon={UsersRound} title="Event Team" subtitle="Manage event-scoped people and issue private role access" actions={<Button variant="primary" icon={UserRoundPlus} onClick={() => startGrant()}>Create access link</Button>} />
    <div className="team-summary"><div className="team-stat"><span>Organizers</span><b>{counts.organizers}</b></div><div className="team-stat"><span>Reviewers</span><b>{counts.reviewers}</b></div><div className="team-stat"><span>Speakers</span><b>{counts.speakers}</b></div></div>
    <section className="team-card"><header><div><h2>People with event records</h2><p>Access links are single-use, expire after 24 hours, and are never sent automatically.</p></div><Pill tone={persistenceStatus === "d1" ? "success" : "warning"}>{persistenceStatus === "d1" ? "Shared workspace" : "Local preview"}</Pill></header><table className="team-table"><thead><tr><th>Person</th><th>Role</th><th>Access</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><td><div className="team-person"><span className="team-avatar">{person.initials}</span><span><b>{person.name}</b><small>{person.email}</small></span></div></td><td><Pill>{person.role || "Speaker"}</Pill></td><td>{String(person.role).toLowerCase().includes("organizer") ? <span>Organizer key</span> : <Button icon={Link2} onClick={() => startGrant(person)}>Create private link</Button>}</td></tr>)}</tbody></table></section>
    <Modal open={open} title="Create private access link" subtitle="Generate one role-scoped link. Callboard will not send an email." onClose={() => setOpen(false)}><div className="team-modal-grid"><Field label="Existing person"><select value={draft.personId} onChange={(event) => choosePerson(event.target.value)}><option value="">New identity</option>{people.filter((person) => !String(person.role).toLowerCase().includes("organizer")).map((person) => <option value={person.id} key={person.id}>{person.name} · {person.email}</option>)}</select></Field><Field label="Role" required><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}><option value="speaker">Speaker</option><option value="reviewer">Reviewer</option></select></Field><Field label="Name" required><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Email" required><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field></div>{message ? <div className={`team-message ${result ? "" : "error"}`}>{message}</div> : null}{result ? <div className="team-link-card"><header><ShieldCheck size={18} /><h3>Single-use link ready</h3></header><p>Expires {new Date(result.expiresAt).toLocaleString()}. Copy it only to the intended synthetic participant. Opening it consumes the grant.</p><div className="team-link-output"><input readOnly value={result.accessUrl} aria-label="Private access link" /><Button icon={copied ? Check : ClipboardCopy} onClick={copy}>{copied ? "Copied" : "Copy link"}</Button></div><div className="team-warning"><Mail size={14} style={{ verticalAlign: "middle", marginRight: 7 }} />No email was created or sent. This link exists only in this organizer session and cannot be retrieved after closing.</div></div> : null}<div className="modal-actions"><Button onClick={() => setOpen(false)}>Close</Button>{!result ? <Button variant="primary" icon={busy ? LoaderCircle : KeyRound} disabled={busy} onClick={generate}>{busy ? "Creating…" : "Generate link"}</Button> : null}</div></Modal>
  </div>;
}
