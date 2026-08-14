import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Cloud,
  Code2,
  Database,
  FileUp,
  Github,
  Globe2,
  Menu,
  Play,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import "../landing.css";

const workflow = [
  {
    key: "collect",
    number: "01",
    label: "Collect",
    title: "Launch a call for speakers that feels considered.",
    body: "Publish branded, conditional submission forms with drafts, limits, confirmation states, and co-speaker support.",
    image: "/landing/public-cfp.webp",
    alt: "OpenCallboard public call for speakers review screen",
  },
  {
    key: "review",
    number: "02",
    label: "Review",
    title: "Give every reviewer exactly the right queue.",
    body: "Route proposals by track, run blind reviews, collect decisions, and turn an acceptance into a real session in one action.",
    image: "/landing/review-decisions.webp",
    alt: "OpenCallboard reviewer decision workspace",
  },
  {
    key: "onboard",
    number: "03",
    label: "Onboard",
    title: "Make the work after acceptance visible.",
    body: "Automatically create speaker records, travel forms, profile tasks, and private file requests—without chasing five spreadsheets.",
    image: "/landing/organizer-dashboard.webp",
    alt: "OpenCallboard organizer program dashboard",
  },
  {
    key: "schedule",
    number: "04",
    label: "Schedule",
    title: "Build the agenda without creating new conflicts.",
    body: "Place sessions on a day and room grid, detect speaker and room collisions, and keep each accepted session connected to its source.",
    image: "/landing/agenda-day.webp",
    alt: "OpenCallboard day agenda editor",
  },
  {
    key: "publish",
    number: "05",
    label: "Publish",
    title: "Release a program people can actually use.",
    body: "Share mobile-friendly schedules and speaker listings, embed them anywhere, and keep public output tied to the live program.",
    image: "/landing/public-schedule.webp",
    alt: "OpenCallboard public event schedule",
  },
];

const proof = [
  ["One source of truth", "Submissions, people, sessions, and tasks stay connected."],
  ["Role-aware by default", "Purpose-built views for organizers, reviewers, and speakers."],
  ["Cloudflare-native", "Fast global delivery with D1, R2, Queues, and Workers."],
];

const operations = [
  "Travel and hotel forms tied to the right speaker",
  "Private headshot, slide deck, and supporting-file requests",
  "Profile and session-detail completion tracking",
  "Deadline reminders and decision communications",
];

const extras = [
  [Send, "Real communications", "Gmail-backed decision and reminder delivery, plus RFC 5545 calendar invitations with room and session details."],
  [FileUp, "Object-backed speaker files", "Role-scoped R2 uploads, version history, downloads, and sanitized public headshot delivery."],
  [Database, "Optional speaker CRM", "A cross-event directory with segments, pipeline stages, notes, bulk communication, and relationship analytics."],
  [Cloud, "Airtable-ready operations", "A one-way sync plan with exact diffs, stable idempotency keys, and an explicit approval gate before external writes."],
  [Globe2, "Five public embeds", "Sessions, agenda, itinerary, speaker list, and speaker gallery views designed for anonymous, mobile-friendly use."],
  [Code2, "API and operational controls", "OpenAPI-documented endpoints, scoped tokens, D1 shared state, Queue-backed jobs, and observable delivery logs."],
];

function Brand() {
  return (
    <a className="landing-brand" href="/" aria-label="OpenCallboard home">
      <span className="landing-brand-mark"><Send size={18} strokeWidth={2.4} /></span>
      <span>OpenCallboard</span>
    </a>
  );
}

export function LandingScreen() {
  const [activeKey, setActiveKey] = useState("review");
  const [videoOpen, setVideoOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const active = workflow.find((item) => item.key === activeKey) || workflow[0];
  const createEventUrl = "https://app.opencallboard.com/#/organizer-login";
  const judgeDemoUrl = "#/organizer-login";

  useEffect(() => {
    if (!videoOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [videoOpen]);

  const closeMobile = () => setMobileOpen(false);
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    closeMobile();
  };

  return (
    <main className="landing" id="top">
      <header className="landing-header">
        <Brand />
        <button className="landing-menu" type="button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label="Toggle navigation">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={mobileOpen ? "landing-nav is-open" : "landing-nav"} aria-label="Primary navigation">
          <button type="button" onClick={() => scrollToSection("product")}>Product</button>
          <button type="button" onClick={() => scrollToSection("workflow")}>Workflow</button>
          <button type="button" onClick={() => scrollToSection("open-source")}>Open source</button>
          <button type="button" className="landing-nav-video" onClick={() => { setVideoOpen(true); closeMobile(); }}>Watch demo</button>
          <a className="landing-nav-cta" href={judgeDemoUrl} onClick={closeMobile}>Organizer demo <ArrowRight size={15} /></a>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <div className="landing-eyebrow"><span /> Open source event program operations</div>
          <h1 id="landing-title">Run the program.<br />Not the paperwork.</h1>
          <p>OpenCallboard gives event teams one shared workflow for proposals, reviewer decisions, speaker onboarding, agenda production, and a published program—without enterprise bloat.</p>
          <div className="landing-actions">
            <a className="landing-button primary" href={judgeDemoUrl}>Open organizer demo <ArrowRight size={17} /></a>
            <button className="landing-button secondary" type="button" onClick={() => setVideoOpen(true)}><Play size={16} fill="currentColor" /> Watch walkthrough</button>
          </div>
          <div className="landing-hero-note"><Check size={15} /> No attendee registration. No per-event pricing. <a href={createEventUrl}>Create your own workspace.</a></div>
        </div>
        <div className="landing-hero-visual" aria-label="OpenCallboard product preview">
          <div className="landing-shot landing-shot-main">
            <div className="landing-shot-bar"><span /><span /><span /><b>Organizer workspace</b></div>
            <img src="/landing/organizer-dashboard.webp" alt="OpenCallboard organizer dashboard showing submission and program health" />
          </div>
          <div className="landing-shot landing-shot-float">
            <div className="landing-shot-label"><CalendarDays size={14} /> Conflict-aware agenda</div>
            <img src="/landing/agenda-day.webp" alt="OpenCallboard agenda showing a scheduled session" />
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Product principles">
        {proof.map(([title, body], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <div><h2>{title}</h2><p>{body}</p></div>
          </article>
        ))}
      </section>

      <section className="landing-section landing-workflow" id="workflow">
        <div className="landing-section-heading">
          <div>
            <div className="landing-kicker">The complete program loop</div>
            <h2>From open call to showtime.</h2>
          </div>
          <p>The valuable part is not any single screen. It is the handoff between them—with no re-entry and no missing context.</p>
        </div>

        <div className="landing-workflow-tabs" role="tablist" aria-label="OpenCallboard workflow">
          {workflow.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeKey === item.key}
              className={activeKey === item.key ? "is-active" : ""}
              onClick={() => setActiveKey(item.key)}
            >
              <span>{item.number}</span>{item.label}
            </button>
          ))}
        </div>

        <div className="landing-workflow-stage" id="product">
          <div className="landing-workflow-copy">
            <span>{active.number} / 05</span>
            <h3>{active.title}</h3>
            <p>{active.body}</p>
            <a href={active.key === "collect" ? "#/submit/form_callboard_judge_cfp" : active.key === "publish" ? "#/embed/embed_callboard_judge_itinerary" : "#/organizer-login"}>
              Try this workflow <ArrowRight size={16} />
            </a>
          </div>
          <div className="landing-workflow-image" key={active.key}>
            <img src={active.image} alt={active.alt} />
          </div>
        </div>
      </section>

      <section className="landing-operations">
        <div className="landing-operations-copy">
          <div className="landing-kicker light">After acceptance</div>
          <h2>The decision is only the midpoint.</h2>
          <p>OpenCallboard turns every accepted proposal into the practical work required to get a speaker on stage—without losing the relationship to their session.</p>
          <ul>
            {operations.map((item) => <li key={item}><Check size={16} /> {item}</li>)}
          </ul>
          <a href="#/organizer-login">See speaker operations <ArrowRight size={16} /></a>
        </div>
        <div className="landing-operations-system" aria-label="Accepted proposal workflow">
          <div className="landing-system-source"><Sparkles size={18} /><span>Accepted proposal</span></div>
          <div className="landing-system-line" />
          <div className="landing-system-output"><ClipboardCheck size={18} /><span>Onboarding tasks</span><small>Auto-created</small></div>
          <div className="landing-system-output"><FileUp size={18} /><span>Private files</span><small>R2-backed</small></div>
          <div className="landing-system-output"><CalendarDays size={18} /><span>Agenda session</span><small>Ready to place</small></div>
        </div>
      </section>

      <section className="landing-section landing-foundation" id="open-source">
        <div className="landing-foundation-intro">
          <div className="landing-kicker">Built to be kept</div>
          <h2>Open infrastructure, not another event-data silo.</h2>
          <p>OpenCallboard is a Cloudflare-native, self-hostable application with explicit operational boundaries. Your team can inspect it, extend it, and own the workflow.</p>
          <a className="landing-text-link" href="https://github.com/guangyusong/opencallboard" target="_blank" rel="noreferrer"><Github size={17} /> View source <ArrowRight size={15} /></a>
        </div>
        <div className="landing-foundation-grid">
          <article><Database size={20} /><h3>Shared state</h3><p>D1-backed event data keeps organizer, reviewer, and speaker actions in sync.</p></article>
          <article><Cloud size={20} /><h3>Private objects</h3><p>Speaker headshots and presentation files use private, role-scoped R2 access.</p></article>
          <article><Globe2 size={20} /><h3>Public output</h3><p>Fast agenda and speaker embeds publish only accepted, released program data.</p></article>
          <article><Code2 size={20} /><h3>Useful API</h3><p>OpenAPI-documented endpoints support practical integrations without recreating the app.</p></article>
        </div>
      </section>

      <section className="landing-extras" aria-labelledby="landing-extras-title">
        <div className="landing-extras-heading">
          <div className="landing-kicker">Production extras</div>
          <h2 id="landing-extras-title">Depth beyond the happy path.</h2>
          <p>The core workflow is the product. These additional capabilities make it practical to operate, integrate, and keep.</p>
        </div>
        <div className="landing-extras-list">
          {extras.map(([Icon, title, body]) => (
            <article key={title}>
              <Icon size={19} />
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-demo" id="demo">
        <div>
          <div className="landing-kicker light">Judge quick start</div>
          <h2>See the whole workflow,<br />not a stitched-together mock.</h2>
        </div>
        <ol>
          <li><span>1</span><div><strong>Submit a proposal</strong><p>Use the public CFP as a speaker.</p></div></li>
          <li><span>2</span><div><strong>Review and accept</strong><p>Open the role-scoped review workspace.</p></div></li>
          <li><span>3</span><div><strong>Complete onboarding</strong><p>Finish forms and upload a private file.</p></div></li>
          <li><span>4</span><div><strong>Schedule and publish</strong><p>Place the session and view the public output.</p></div></li>
        </ol>
        <div className="landing-demo-actions">
          <a className="landing-button inverse" href="#/submit/form_callboard_judge_cfp">Start with the CFP <ArrowRight size={17} /></a>
          <a className="landing-button ghost" href={judgeDemoUrl}>Open organizer demo</a>
        </div>
      </section>

      <footer className="landing-footer">
        <Brand />
        <p>Program operations for teams who would rather run the event.</p>
        <div><a href="#/submit/form_callboard_judge_cfp">Call for papers</a><a href="#/embed/embed_callboard_judge_sessions">Sessions</a><a href="#/embed/embed_callboard_judge_agenda">Agenda</a><a href="#/embed/embed_callboard_judge_itinerary">Itinerary</a><a href="#/embed/embed_callboard_judge_speaker_list">Speaker list</a><a href="#/embed/embed_callboard_judge_gallery">Speaker gallery</a><a href={createEventUrl}>Create event</a></div>
      </footer>

      {videoOpen && (
        <div className="landing-video-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setVideoOpen(false); }}>
          <section className="landing-video-modal" role="dialog" aria-modal="true" aria-label="OpenCallboard product walkthrough">
            <div className="landing-video-header">
              <div className="landing-video-heading"><span>OpenCallboard in 90 seconds</span><small>Real browser interaction with a concise narrated tour</small></div>
              <div className="landing-video-controls"><a href="/landing/callboard-walkthrough.mp4" target="_blank" rel="noreferrer">Full 4:15 walkthrough</a><button ref={closeButtonRef} type="button" onClick={() => setVideoOpen(false)} aria-label="Close video"><X size={20} /></button></div>
            </div>
            <video controls autoPlay playsInline poster="/landing/organizer-dashboard.webp"><source src="/landing/opencallboard-demo.mp4?v=20260812-natural" type="video/mp4" /></video>
          </section>
        </div>
      )}
    </main>
  );
}
