import { useMemo, useState } from "react";
import {
  Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList,
  Code2, ContactRound, FileInput, FileText, Folder, Gauge, Globe2, Grid2X2, Inbox,
  LayoutDashboard, LogOut, Megaphone, MessageSquareText, PanelLeftClose, Search, Settings,
  Sparkles, UsersRound, WandSparkles,
} from "lucide-react";
import { useAppStore } from "../store.jsx";
import { logoutSharedSession } from "../lib/sharedApi.js";

const programGroups = [
  { label: null, items: [{ label: "Overview", icon: Grid2X2, route: "/program" }] },
  { label: "Submissions", items: [{ label: "View All", icon: Grid2X2, route: "/submissions" }, { label: "Abstracts", icon: FileText, route: "/abstracts" }, { label: "Speakers", icon: UsersRound, route: "/participants" }, { label: "Sessions", icon: MessageSquareText, route: "/sessions" }, { label: "Files", icon: Folder, route: "/program-files" }] },
  { label: "Collect & Review", items: [{ label: "Forms", icon: MessageSquareText, route: "/submission-forms" }, { label: "Evaluation", icon: Folder, route: "/evaluation" }, { label: "Agenda", icon: CalendarDays, route: "/agenda" }, { label: "Invoices", icon: ClipboardList, route: "/invoices" }, { label: "Site", icon: Globe2, route: "/site" }] },
  { label: "Portals", items: [{ label: "Portals", icon: Settings, route: "/portals" }, { label: "Tasks", icon: WandSparkles, route: "/portal-tasks" }, { label: "Forms", icon: Globe2, route: "/portal-forms" }, { label: "File Requests", icon: FileInput, route: "/file-requests" }, { label: "Resources", icon: Globe2, route: "/resources" }, { label: "Files", icon: FileText, route: "/portal-files" }] },
  { label: "Configure", items: [{ label: "Settings", icon: Settings, route: "/settings" }] },
];

const lowerNav = [
  ["CRM", ContactRound, "/crm"], ["Marketing", Megaphone, "/marketing"], ["CMS", Globe2, "/embeds"],
  ["Reports", FileText, "/reports"], ["Studio", Sparkles, "/studio"], ["History", Inbox, "/history"],
  ["Event Team", UsersRound, "/event-team"], ["Preview", Code2, "/preview"], ["Settings", Settings, "/settings"],
];

function NavButton({ icon: Icon, label, route, active, nested = false, onNavigate, end }) {
  return <button className={`nav-row ${nested ? "nested" : ""} ${active ? "active" : ""}`} onClick={() => onNavigate(route)}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{end ? <ChevronRight className="nav-end" size={16} /> : null}</button>;
}

export function AppShell({ route, onNavigate, children }) {
  const { data } = useAppStore();
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const commands = useMemo(() => [
    ["Dashboard", "/dashboard"], ["Submissions", "/submissions"], ["Abstracts", "/abstracts"], ["Speakers", "/participants"], ["Speaker CRM", "/crm"], ["Evaluation", "/evaluation"], ["Agenda", "/agenda"], ["Submission forms", "/submission-forms"], ["Portal tasks", "/portal-tasks"], ["Portal forms", "/portal-forms"], ["File requests", "/file-requests"], ["Resources", "/resources"], ["Embeds", "/embeds"], ["Communications", "/marketing"], ["Integrations", "/integrations"], ["Airtable sync", "/integrations/airtable"], ["Event settings", "/settings"],
  ].filter(([label]) => label.toLowerCase().includes(query.toLowerCase())).slice(0, 8), [query]);
  const navigateCommand = (path) => { setQuery(""); setPanel(null); onNavigate(path); };
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await logoutSharedSession();
    window.location.hash = "/organizer-login";
    window.location.reload();
  };
  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand-mark"><Megaphone size={22} /></div>
        <button className="event-switcher" onClick={() => onNavigate("/workspace")}><span>{data.event.initials}</span><div><b>{data.event.shortName}</b><small>{data.event.dates}</small></div><ChevronDown size={18} /></button>
        <nav className="sidebar-nav">
          <NavButton icon={LayoutDashboard} label="Dashboard" route="/dashboard" active={route === "/dashboard"} onNavigate={onNavigate} />
          <div className="program-parent"><ClipboardList size={18} /><span>Program</span><ChevronDown size={17} /></div>
          <div className="program-tree">
            {programGroups.map((group, index) => <div className="nav-group" key={group.label ?? index}>{group.label ? <div className="nav-label">{group.label}</div> : null}{group.items.map((item) => <NavButton key={item.route} {...item} nested active={route === item.route || (item.route === "/submission-forms" && route.startsWith("/submission-form"))} onNavigate={onNavigate} />)}</div>)}
          </div>
          <div className="lower-nav">{lowerNav.map(([label, icon, path]) => <NavButton key={label} label={label} icon={icon} route={path} active={route === path} onNavigate={onNavigate} end={!["Reports", "Studio", "History", "Event Team", "Preview", "Settings"].includes(label)} />)}</div>
        </nav>
        <button className="sidebar-apps" aria-label="Open page finder" title="Open page finder" onClick={() => { setPanel("search"); document.querySelector(".command-search input")?.focus(); }}><Grid2X2 size={18} /></button>
        <button className="sidebar-collapse" aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"} title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"} aria-pressed={sidebarCollapsed} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button>
      </aside>
      <header className="topbar">
        <div className="command-search-wrap"><label className="command-search"><Search size={18} /><input placeholder="Find or ask" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setPanel("search")} onKeyDown={(event) => { if (event.key === "Enter" && commands[0]) navigateCommand(commands[0][1]); }} /><kbd>⌘K</kbd></label>{panel === "search" && query ? <div className="shell-popover command-results">{commands.length ? commands.map(([label, path]) => <button key={path} onClick={() => navigateCommand(path)}><Search size={15} /><span>{label}</span><small>{path}</small></button>) : <p>No matching Callboard page.</p>}</div> : null}</div>
        <div className="top-actions"><button className="view-portal" onClick={() => onNavigate("/embeds")}>View public program</button><button className="top-icon unread" aria-label="Announcements" onClick={() => setPanel(panel === "announcements" ? null : "announcements")}><Megaphone size={20} /></button><button className="top-icon" aria-label="Help" onClick={() => setPanel(panel === "help" ? null : "help")}><CircleHelp size={21} /></button><button className="avatar-button" aria-label="Account menu" onClick={() => setPanel(panel === "account" ? null : "account")}>{data.organizer.initials}</button>{panel && panel !== "search" ? <div className="shell-popover top-popover">{panel === "announcements" ? <><b>Announcements</b><p>Your Callboard competition workspace is ready for review.</p></> : panel === "help" ? <><b>Help &amp; shortcuts</b><button onClick={() => { setPanel("search"); document.querySelector(".command-search input")?.focus(); }}>Search pages <kbd>⌘K</kbd></button><button onClick={() => navigateCommand("/resources")}>Open resources</button></> : <><b>{data.organizer.name}</b><p>{data.organizer.email}</p><button onClick={() => navigateCommand("/workspace")}>Switch event</button><button onClick={() => navigateCommand("/settings")}>Event settings</button><button onClick={() => navigateCommand("/event-team")}>Manage portal access</button><button disabled={signingOut} onClick={signOut}><LogOut size={15} />{signingOut ? "Signing out…" : "Sign out"}</button></>}</div> : null}</div>
      </header>
      <main className="workspace">{children}</main>
    </div>
  );
}
