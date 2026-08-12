import { useEffect, useState } from "react";
import {
  ArrowLeft, Blocks, Building2, ChevronDown, Database, FileText, FolderCog,
  Image, Info, Layers3, Mail, Megaphone, Palette, PanelsTopLeft, Settings,
  Store, Tags, Upload, UsersRound,
} from "lucide-react";
import { Button, Field } from "../components/ui.jsx";
import { useAppStore } from "../store.jsx";
import { localTimeInZoneToUtc } from "../lib/communications.js";
import { patchSharedEvent } from "../lib/sharedApi.js";

const settingsStyles = `
.settings-screen{min-height:calc(100vh - var(--topbar-height));background:#f9fafb}.settings-hero{height:126px;padding:25px 38px;display:flex;align-items:center;gap:18px;background:#f0f4fb;border-bottom:1px solid var(--border)}.settings-hero .back{width:38px;height:38px;border:0;border-radius:9px;background:transparent;display:grid;place-items:center;cursor:pointer}.settings-hero .back:hover{background:#e7edf7}.settings-hero .hero-icon{width:52px;height:52px;border-radius:12px;background:#f5f7fb;display:grid;place-items:center;color:#62738c}.settings-hero h1{margin:0;font-size:26px;letter-spacing:-.025em}.settings-hero p{margin:5px 0 0;color:var(--muted-text);font-size:14px}.settings-body{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:calc(100vh - var(--topbar-height) - 126px)}.settings-subnav{padding:14px 12px 28px;border-right:1px solid var(--border);background:#fbfcfd}.settings-subnav button{width:100%;height:40px;padding:0 12px;border:0;border-radius:9px;background:transparent;color:#667891;display:flex;align-items:center;gap:10px;text-align:left;font-size:13px;cursor:pointer}.settings-subnav button:hover{background:#f0f3f7}.settings-subnav button.active{background:#e4eaf8;color:#195adb;font-weight:600}.settings-subnav .section-open{justify-content:flex-start}.settings-subnav .section-open svg:last-child{margin-left:auto}.settings-subnav .nested{padding-left:35px}.settings-subnav .branch{margin-left:20px;border-left:1px solid #dce4ee;padding-left:0}.settings-content{padding:28px 30px 54px;overflow:hidden}.settings-content-inner{max-width:1120px}.settings-overview h2,.settings-form h2{margin:0 0 25px;font-size:18px}.settings-group{margin-bottom:45px}.settings-group h3{margin:0 0 24px;font-size:16px}.settings-link-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px 46px}.settings-link{border:0;background:transparent;padding:0;display:grid;grid-template-columns:48px 1fr;gap:14px;text-align:left;cursor:pointer}.settings-link .link-icon{width:48px;height:48px;border-radius:11px;background:#e9eefb;color:#195adb;display:grid;place-items:center}.settings-link b{display:block;margin:4px 0 6px;color:#195adb;font-size:14px}.settings-link span:last-child{display:block;color:var(--muted-text);font-size:12px;line-height:1.65}.settings-form>header{margin-bottom:25px}.settings-form>header h2{margin-bottom:7px;font-size:21px}.settings-form>header p{margin:0;color:var(--muted-text);font-size:13px}.event-fields{max-width:1050px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.event-fields .wide{grid-column:1/-1}.event-fields .field{font-size:13px}.event-fields input,.event-fields select{height:50px;background:#f9fafb;font-size:13px}.event-fields textarea{min-height:122px;background:#f9fafb;font-size:13px}.date-wrap{display:flex;gap:8px}.date-wrap input{flex:1}.counter{margin-top:-2px;text-align:right;color:var(--muted-text);font-size:11px}.settings-divider{height:1px;background:var(--border);margin:30px 0}.settings-save{display:flex;align-items:center;gap:12px}.saved-note{color:#15803d;font-size:12px}.group-question{margin:0 0 17px;font-size:15px}.choice-grid{display:grid;grid-template-columns:repeat(2,315px);gap:12px}.group-choice{position:relative;height:160px;border:2px solid #dce4ee;border-radius:12px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:14px;cursor:pointer}.group-choice.selected{border-color:#195adb;background:#edf1fa}.group-choice .check{position:absolute;right:13px;top:13px;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#22c55f;color:#fff;font-size:15px}.image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:58px}.image-uploader h4{margin:0 0 6px;font-size:13px}.image-uploader>p{margin:0 0 12px;color:var(--muted-text);font-size:12px}.upload-row{display:flex;align-items:flex-start;gap:16px}.upload-well{width:150px;height:150px;border:1px dashed #d9e2ec;border-radius:11px;background:#fff;display:grid;place-items:center;color:#95a2b4;overflow:hidden}.upload-well img{width:100%;height:100%;object-fit:cover}.upload-button{position:relative;overflow:hidden}.upload-button input{position:absolute;inset:0;opacity:0;cursor:pointer}.simple-settings{max-width:850px;border:1px solid var(--border);border-radius:12px;background:#fff;padding:28px}.simple-settings h2{margin:0 0 8px}.simple-settings p{margin:0;color:var(--muted-text);font-size:13px;line-height:1.7}.simple-settings .simple-icon{width:50px;height:50px;border-radius:11px;background:#e9eefb;color:#195adb;display:grid;place-items:center;margin-bottom:18px}
@media(max-width:1080px){.settings-body{grid-template-columns:200px minmax(0,1fr)}.settings-link-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.settings-hero{height:auto;padding:20px}.settings-body{display:block}.settings-subnav{display:flex;overflow-x:auto;border-right:0;border-bottom:1px solid var(--border);padding:8px}.settings-subnav button{width:auto;min-width:max-content}.settings-subnav .branch{display:flex;margin:0;border:0}.settings-content{padding:22px 16px}.settings-link-grid,.event-fields,.image-grid{grid-template-columns:1fr}.event-fields .wide{grid-column:auto}.choice-grid{grid-template-columns:1fr}.settings-link-grid{gap:22px}}
`;

const overviewGroups = [
  { title: "Event setup", items: [
    ["Event Details", FileText, "Name, dates, timezone, and the basics.", "details"],
    ["Record Settings", Database, "Record layouts and field configuration.", "record"],
    ["Portals", PanelsTopLeft, "Speaker and exhibitor portal appearance.", "portals"],
    ["Submission Forms", Megaphone, "Submission form appearance and content.", "forms"],
  ] },
  { title: "Library", items: [
    ["Fields", Layers3, "Custom fields for contacts, sessions, and submissions.", "fields"],
    ["Tags", Tags, "Reusable labels across records.", "tags"],
    ["Personas", UsersRound, "Audience segments and attendee types.", "personas"],
  ] },
  { title: "Communications", items: [
    ["Email Templates", Mail, "Transactional email content.", "email"],
    ["Email Themes", Palette, "Branding applied to your emails.", "themes"],
  ] },
  { title: "Configuration", items: [
    ["Integrations", Blocks, "Connect Accelevents and the rest of your event stack.", "integrations"],
  ] },
];

const subnav = [
  ["Overview", PanelsTopLeft, "overview"], ["Event Details", FileText, "details"],
  ["Fields", Layers3, "fields", true], ["Tags", Tags, "tags", true], ["Personas", UsersRound, "personas", true],
  ["Record Settings", Database, "record"], ["Portals", PanelsTopLeft, "portals"],
  ["Submission Forms", Megaphone, "forms"], ["Email Templates", Mail, "email"],
  ["Email Themes", Palette, "themes"], ["Integrations", Blocks, "integrations"],
];

function readFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}

function dateTimeInput(value, timezone) {
  if (!value) return "";
  if (!/Z$|[+-]\d\d:?\d\d$/.test(String(value))) return String(value).slice(0, 16);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function SettingsScreen({ onNavigate }) {
  const { data, update, persistenceStatus } = useAppStore();
  const [section, setSection] = useState("overview");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draft, setDraft] = useState(data.event);
  useEffect(() => setDraft(data.event), [data.event]);

  const selectSection = (next) => {
    if (next === "forms") return onNavigate("/submission-forms");
    if (next === "portals") return onNavigate("/portals");
    if (next === "integrations") return onNavigate("/integrations");
    setSection(next);
  };
  const persistEvent = async (patch = draft) => {
    let next = patch;
    setSaveError("");
    if (persistenceStatus === "d1") {
      const result = await patchSharedEvent(data.event.version, {
        name: patch.name, shortName: patch.shortName || patch.name, slug: patch.slug, type: patch.type,
        website: patch.website, location: patch.location, timezone: patch.timezone,
        startsAt: patch.start ? localTimeInZoneToUtc(patch.start, patch.timezone).toISOString() : null,
        endsAt: patch.end ? localTimeInZoneToUtc(patch.end, patch.timezone).toISOString() : null,
        theme: patch.theme,
        settings: { groupTypes: patch.groupTypes || [], dates: patch.dates || data.event.dates },
      });
      if (!result.ok) { setSaveError(result.error === "VERSION_CONFLICT" ? "Event settings changed elsewhere. Reload before saving." : "The shared event settings could not be saved."); return; }
      next = { ...patch, id: result.item.id, name: result.item.name, shortName: result.item.shortName || result.item.name, slug: result.item.slug, type: result.item.type || "Conference", website: result.item.website || "", location: result.item.location || "", timezone: result.item.timezone, start: result.item.startsAt || "", end: result.item.endsAt || "", theme: result.item.theme || "", groupTypes: result.item.settings?.groupTypes || [], version: result.item.version, updatedAt: result.item.updatedAt };
      setDraft(next);
    }
    update((current) => ({ ...current, event: { ...current.event, ...next } }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };
  const setGroup = (group) => {
    const current = draft.groupTypes ?? ["Exhibitors", "Sponsors"];
    const groupTypes = current.includes(group) ? current.filter((item) => item !== group) : [...current, group];
    const next = { ...draft, groupTypes };
    setDraft(next);
    persistEvent(next);
  };

  return <div className="settings-screen">
    <style>{settingsStyles}</style>
    <header className="settings-hero">
      <button className="back" aria-label="Back" onClick={() => onNavigate("/dashboard")}><ArrowLeft size={20} /></button>
      <span className="hero-icon"><Settings size={25} /></span>
      <div><h1>Event Settings</h1><p>Configure event details and preferences</p></div>
    </header>
    <div className="settings-body">
      <nav className="settings-subnav" aria-label="Event settings">
        {subnav.map(([label, Icon, value, nested], index) => {
          if (index === 2) return <div key="library"><button className="section-open" onClick={() => setLibraryOpen((open) => !open)}><FolderCog size={18} /><span>Library</span><ChevronDown size={16} /></button>{libraryOpen ? <div className="branch">{subnav.slice(2, 5).map(([child, ChildIcon, childValue]) => <button key={childValue} className={`nested ${section === childValue ? "active" : ""}`} onClick={() => selectSection(childValue)}><ChildIcon size={17} />{child}</button>)}</div> : null}</div>;
          if (index > 2 && index < 5) return null;
          return <button key={value} className={section === value ? "active" : ""} onClick={() => selectSection(value)}><Icon size={18} />{label}</button>;
        })}
      </nav>
      <section className="settings-content"><div className="settings-content-inner">
        {section === "overview" ? <div className="settings-overview">{overviewGroups.map((group) => <section className="settings-group" key={group.title}><h3>{group.title}</h3><div className="settings-link-grid">{group.items.map(([label, Icon, copy, target]) => <button className="settings-link" key={label} onClick={() => selectSection(target)}><span className="link-icon"><Icon size={23} /></span><span><b>{label}</b><span>{copy}</span></span></button>)}</div></section>)}</div> : null}
        {section === "details" ? <div className="settings-form">
          <header><h2>Event Details</h2><p>Configure basic event information</p></header>
          <div className="event-fields">
            <Field label="Event Name" required><input value={draft.name ?? ""} onChange={(event) => setDraft({ ...draft, name: event.target.value, shortName: event.target.value })} /></Field>
            <Field label="Event Slug" required><input value={draft.slug ?? ""} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></Field>
            <Field label="Event Type"><select value={draft.type ?? "Conference"} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>Conference</option><option>Summit</option><option>Meetup</option><option>Webinar</option></select></Field>
            <Field label="Event Website URL"><input value={draft.website ?? ""} onChange={(event) => setDraft({ ...draft, website: event.target.value })} /></Field>
            <Field label="Event Location"><input value={draft.location ?? ""} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></Field>
            <Field label="Timezone"><select value={draft.timezone ?? "America/Los_Angeles"} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}><option value="America/Los_Angeles">(GMT-8:00) America/Los_Angeles</option><option value="America/Toronto">(GMT-5:00) America/Toronto</option><option value="America/New_York">(GMT-5:00) America/New_York</option><option value="Europe/London">(GMT+0:00) Europe/London</option></select></Field>
            <Field label="Starts At" required><input type="datetime-local" value={dateTimeInput(draft.start, draft.timezone)} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></Field>
            <Field label="Ends At" required><input type="datetime-local" value={dateTimeInput(draft.end, draft.timezone)} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></Field>
            <Field className="wide" label="Theme" hint="This helps improve search, recommendations, and how content is organized."><textarea maxLength={1000} value={draft.theme ?? ""} onChange={(event) => setDraft({ ...draft, theme: event.target.value })} /><span className="counter">{draft.theme?.length ?? 0} / 1000</span></Field>
          </div>
          <div className="settings-divider" />
          <h2>Exhibitors &amp; Sponsors</h2><p className="group-question">Which group types do you want to manage for this event?</p>
          <div className="choice-grid">{[["Exhibitors", Store], ["Sponsors", UsersRound]].map(([label, Icon]) => { const selected = (draft.groupTypes ?? ["Exhibitors", "Sponsors"]).includes(label); return <button className={`group-choice ${selected ? "selected" : ""}`} key={label} onClick={() => setGroup(label)}>{selected ? <span className="check">✓</span> : null}<Icon size={38} /><span>{label}</span></button>; })}</div>
          <div className="settings-divider" />
          <h2>Image Settings</h2><div className="image-grid">
            {[["Logo Image", "Recommended: 300 w x 300 h", "logoPreview"], ["Background Image", "Recommended: 1500 w x 500 h", "backgroundPreview"]].map(([label, copy, key]) => <div className="image-uploader" key={key}><h4>{label}</h4><p>{copy}</p><div className="upload-row"><div className="upload-well">{draft[key] ? <img alt={`${label} preview`} src={draft[key]} /> : <Upload size={30} />}</div><label className="btn btn-primary upload-button" aria-disabled={persistenceStatus === "d1"}><Upload size={17} />{persistenceStatus === "d1" ? "Storage required" : "Upload new"}<input type="file" accept="image/*" disabled={persistenceStatus === "d1"} onChange={(event) => readFile(event.target.files?.[0], (value) => { const next = { ...draft, [key]: value }; setDraft(next); persistEvent(next); })} /></label></div>{persistenceStatus === "d1" ? <p style={{ marginTop: 10 }}>Shared image storage is not connected; text settings remain fully saveable.</p> : null}</div>)}
          </div>
          <div className="settings-divider" /><div className="settings-save"><Button variant="primary" onClick={() => persistEvent()}>Save</Button>{saved ? <span className="saved-note">Changes saved</span> : null}{saveError ? <span style={{ color: "#b42318", fontSize: 12 }}>{saveError}</span> : null}</div>
        </div> : null}
        {!['overview','details'].includes(section) ? <div className="simple-settings"><span className="simple-icon">{section === "integrations" ? <Blocks /> : section === "email" ? <Mail /> : section === "themes" ? <Palette /> : section === "tags" ? <Tags /> : section === "personas" ? <UsersRound /> : section === "record" ? <Database /> : <Layers3 />}</span><h2>{subnav.find((item) => item[2] === section)?.[0] ?? "Settings"}</h2><p>This configuration area uses the same event record and is ready for the associated workflow. The primary competition path is available through Event Details and Submission Forms.</p></div> : null}
      </div></section>
    </div>
  </div>;
}
