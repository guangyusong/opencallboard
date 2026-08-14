import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Download,
  Filter,
  Grid2X2,
  List,
  Monitor,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Speaker,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { useAppStore } from "../store.jsx";
import { acceptedParticipants, acceptedSessions } from "../lib/domain.js";
import {
  Button,
  PageHeader,
  Pill,
  SearchBox,
  SplitButton,
  Tabs,
  Toggle,
} from "../components/ui.jsx";
import {
  createSharedResource,
  loadPublicEmbed,
  patchSharedResource,
} from "../lib/sharedApi.js";

const EMBED_STYLES = `
.embed-page{padding:34px 32px 60px}.embed-page .page-header{margin-bottom:22px}.embed-page .page-icon{background:#f3f5f8}.embed-toolbar{display:flex;align-items:center;gap:20px;margin-bottom:32px}.embed-toolbar .search-box{width:570px;height:52px}.embed-segments{border:1px solid #dfe4eb;border-radius:9px;background:#fff;padding:4px}.embed-segments .tabs{border:0}.embed-segments .tabs button{height:38px;min-height:38px;border:0;border-radius:7px;padding:0 16px}.embed-segments .tabs button.active{background:#f3f5f8;color:#182235}.embed-toolbar .split-wrap{margin-left:auto}.embed-group-head{height:58px;border-radius:10px;background:#f5f6f8;padding:0 20px;display:flex;align-items:center;gap:13px}.embed-group-head b{font-size:15px}.embed-group-head span{font-size:12px}.embed-group-head svg:last-child{margin-left:auto}.embed-grid{display:grid;grid-template-columns:repeat(3,minmax(280px,1fr));gap:20px;padding-top:20px}.embed-card{min-height:145px;border:1px solid #dfe5ed;border-radius:12px;background:#fff;padding:22px 24px;box-shadow:0 1px 3px rgba(15,23,42,.06);text-align:left;cursor:pointer}.embed-card:hover{border-color:#b7c4d5}.embed-card-head{display:flex;align-items:center}.embed-card-head h3{margin:0;font-size:16px;font-weight:500}.embed-card-head .embed-card-actions{margin-left:auto;display:flex;align-items:center;gap:7px}.embed-icon-button{width:34px;height:34px;border:0;border-radius:7px;background:transparent;display:grid;place-items:center;cursor:pointer}.embed-icon-button:hover{background:#f1f4f7}.embed-card .pill{margin-top:24px}.embed-editor{min-height:calc(100vh - 60px);margin:0;background:#f6f8fb}.embed-editor-bar{height:80px;border-bottom:1px solid #dfe4ec;background:#fff;display:grid;grid-template-columns:470px 1fr;align-items:center}.embed-editor-name{height:100%;border-right:1px solid #dfe4ec;padding:0 28px;display:flex;align-items:center;gap:20px}.embed-editor-name h1{margin:0;font-size:18px}.embed-editor-name button{border:0;background:transparent;display:grid;place-items:center;cursor:pointer}.embed-editor-tools{display:flex;align-items:center;gap:4px;padding:0 20px}.embed-editor-tools button{height:42px;border:0;border-radius:9px;background:transparent;padding:0 16px;display:flex;align-items:center;gap:8px;color:#6e7a8d;cursor:pointer}.embed-editor-tools button.active{background:#fff;color:#1c2737;box-shadow:0 1px 4px rgba(15,23,42,.11)}.embed-format-label{margin-left:auto;color:#758297;font-size:12px}.embed-editor-body{display:grid;grid-template-columns:470px minmax(0,1fr);min-height:calc(100vh - 140px)}.embed-config{border-right:1px solid #dfe4ec;background:#fff;overflow:auto}.embed-config-section{border-bottom:1px solid #dfe4ec}.embed-config-heading{height:68px;padding:0 25px;display:flex;align-items:center;font-size:15px;font-weight:600}.embed-config-heading svg{margin-left:auto}.embed-config-body{padding:18px 25px 25px}.embed-name-row{display:grid;grid-template-columns:1fr auto;align-items:end;gap:18px}.embed-field{display:grid;gap:8px;font-size:12px;font-weight:500}.embed-field input,.embed-field select{width:100%;height:45px;border:1px solid #dce3ec;border-radius:8px;background:#fff;padding:0 12px;outline:0}.embed-field input:focus,.embed-field select:focus{border-color:#285edb;box-shadow:0 0 0 2px rgba(40,94,219,.12)}.embed-format-card{margin-top:25px;min-height:180px;border:1px solid #dce3ec;border-radius:11px;background:#fbfcfd;padding:20px}.embed-format-card h3{margin:0 0 12px;display:flex;justify-content:space-between;font-size:14px}.embed-format-card p{margin:0;color:#718096;font-size:12px;line-height:1.65}.embed-lock{display:flex;align-items:center;gap:5px;color:#7d899a;font-size:11px}.embed-options{display:grid;gap:15px}.embed-option-row{display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:12px}.embed-color{width:44px;height:32px;border:1px solid #d7dee8;border-radius:7px;padding:3px}.embed-checks{display:grid;gap:10px}.embed-check{display:flex;align-items:center;gap:9px;font-size:12px}.embed-check input{accent-color:#275dda}.embed-config-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #dfe4ec;padding:14px 25px;display:flex;justify-content:flex-end}.embed-preview-wrap{padding:20px 24px 30px;background:#f5f7fa;min-width:0}.embed-browser{height:calc(100vh - 185px);min-height:620px;border:1px solid #dce3ec;border-radius:12px;background:#fff;box-shadow:0 2px 7px rgba(15,23,42,.08);overflow:hidden;display:flex;flex-direction:column}.embed-browser-toolbar{min-height:76px;border-bottom:1px solid #dfe4ec;padding:10px 17px;display:grid;grid-template-columns:auto 250px auto 1fr auto;gap:12px;align-items:center}.embed-lights{display:flex;gap:7px}.embed-lights i{width:13px;height:13px;border-radius:50%;display:block}.embed-lights i:nth-child(1){background:#ff6666}.embed-lights i:nth-child(2){background:#f8bd36}.embed-lights i:nth-child(3){background:#32c85c}.embed-device-toggle{display:flex;border:1px solid #dce3ec;border-radius:8px;overflow:hidden}.embed-device-toggle button{width:38px;height:38px;border:0;background:#fff;display:grid;place-items:center;cursor:pointer}.embed-device-toggle button.active{background:#edf2f8}.embed-preview-actions{margin-left:auto;display:flex;align-items:center;gap:4px}.embed-copy-code{height:39px;border:1px solid #dce3ec;border-radius:8px;background:#fff;padding:0 13px;display:flex;align-items:center;gap:8px;color:#6b788c;cursor:pointer}.embed-urlbar{grid-column:1/-1;height:38px;border:1px solid #dce3ec;border-radius:19px;background:#fafbfc;display:flex;align-items:center;padding-left:14px;overflow:hidden}.embed-urlbar input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#718096;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.embed-urlbar button{height:30px;border:0;border-left:1px solid #dce3ec;background:#fff;padding:0 18px;color:#40506a;cursor:pointer}.embed-canvas{flex:1;position:relative;background:#111a2a;overflow:auto;transition:width .2s}.embed-canvas.mobile{width:390px;align-self:center;box-shadow:0 0 0 1px #253044}.embed-event-title{min-height:84px;background:#2877c7;color:#0b1727;padding:25px 28px;font-size:24px;font-weight:700}.embed-subbar{height:78px;border-bottom:1px solid #3b4656;padding:0 28px;display:flex;align-items:center;color:#fff}.embed-content{padding:26px;background:#111a2a;color:#dce5f1;min-height:calc(100% - 196px)}.embed-agenda{display:grid;gap:13px}.embed-agenda-row{border:1px solid #344154;border-radius:8px;background:#172236;padding:16px;display:grid;grid-template-columns:100px 1fr;gap:16px}.embed-agenda-row time{color:#85a7d2;font-size:12px}.embed-agenda-row h4{margin:0 0 7px}.embed-agenda-row p{margin:0;color:#91a0b4;font-size:12px}.embed-empty-preview{height:300px;display:grid;place-items:center;color:#8290a4;text-align:center}.embed-speaker-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.embed-speaker-card{border:1px solid #344154;border-radius:8px;background:#172236;padding:16px;display:flex;align-items:center;gap:12px}.embed-speaker-avatar{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#2b3950}.embed-powered{height:40px;background:#222d3e;color:#a5b0bf;padding:10px 18px;font-size:12px;font-weight:600}.embed-code-panel{flex:1;background:#101827;padding:26px;color:#c9d5e6;overflow:auto}.embed-code-panel h3{margin:0 0 13px;color:#fff}.embed-code-panel p{color:#8fa0b7;font-size:12px}.embed-code-panel pre{margin:25px 0 0;border:1px solid #334157;border-radius:9px;background:#0c1320;padding:20px;white-space:pre-wrap;color:#9fcbff;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}.embed-code-panel button{margin-top:18px;height:40px;border:0;border-radius:8px;background:#275dda;color:#fff;padding:0 16px;display:flex;align-items:center;gap:8px;cursor:pointer}.embed-saved{position:fixed;right:24px;bottom:24px;border:1px solid #dce3eb;border-radius:9px;background:#fff;box-shadow:0 10px 27px rgba(15,23,42,.15);padding:14px 18px;font-size:12px}
.embed-subbar{display:none}.embed-content{min-height:calc(100% - 124px)}.embed-agenda{gap:28px}.embed-day-group{display:grid;gap:10px}.embed-day-heading{margin:0;padding:0 2px 9px;border-bottom:1px solid #344154;color:#f5f8fd;font-size:15px;font-weight:650}.embed-day-heading span{margin-left:8px;color:#8294ac;font-size:11px;font-weight:500}.embed-day-sessions{display:grid;gap:10px}.embed-agenda-row{grid-template-columns:100px minmax(0,1fr)}.embed-agenda-row time{font-weight:600}.embed-agenda-row p+p{margin-top:4px}.embed-tba{padding-top:4px}.embed-tba .embed-day-heading{color:#aab7c9}.embed-speaker-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.embed-speaker-card{min-width:0;padding:18px;align-items:flex-start;gap:14px}.embed-speaker-avatar{width:54px;height:54px;flex:0 0 54px;color:#dce5f1;font-size:13px;font-weight:700;overflow:hidden}.embed-speaker-avatar img{width:100%;height:100%;display:block;object-fit:cover}.embed-speaker-copy{min-width:0}.embed-speaker-copy h3{margin:1px 0 6px;color:inherit;font-size:15px}.embed-speaker-copy>p{margin:0 0 10px;color:#91a0b4;font-size:12px;line-height:1.45}.embed-speaker-sessions{margin:0;padding:0;list-style:none;display:grid;gap:7px}.embed-speaker-sessions li{display:grid;gap:2px;font-size:11px}.embed-speaker-sessions b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dce5f1}.embed-speaker-sessions span{color:#8294ac}
.embed-speaker-sessions b{color:inherit}.embed-canvas.light .embed-speaker-copy>p{color:#657286}.embed-canvas.light .embed-speaker-sessions span{color:#718096}
.embed-public-tools{display:flex;align-items:center;gap:9px;margin-bottom:16px;flex-wrap:wrap}.embed-public-tools label{height:38px;min-width:190px;border:1px solid #344154;border-radius:7px;background:#172236;display:flex;align-items:center;gap:8px;padding:0 11px}.embed-public-tools input,.embed-public-tools select{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit;font:inherit}.embed-public-tools select option{color:#172033}.embed-public-tools button{height:38px;border:1px solid #344154;border-radius:7px;background:#172236;color:inherit;padding:0 12px;display:flex;align-items:center;gap:7px;cursor:pointer}.embed-public-tools button.active{border-color:#6f91ff;background:#26375a}.embed-result-count{margin-left:auto;color:#91a0b4;font-size:11px}.embed-session-list{display:grid;gap:12px}.embed-session-card{border:1px solid #344154;border-radius:9px;background:#172236;padding:17px}.embed-session-card header{display:flex;align-items:flex-start;gap:12px}.embed-session-card h3{margin:0 0 5px;font-size:16px}.embed-session-card header button{margin-left:auto;border:0;background:transparent;color:#88aaff;cursor:pointer}.embed-session-meta,.embed-tags,.embed-person-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#91a0b4;font-size:11px}.embed-tags{margin-top:10px}.embed-tags span{padding:4px 7px;border-radius:999px;background:#26354d;color:#b9c8dc}.embed-session-description{margin:11px 0;color:#b5c0cf;font-size:12px;line-height:1.55}.embed-session-card>button{border:0;background:transparent;color:#88aaff;padding:0;cursor:pointer}.embed-session-action{margin-top:12px!important;display:flex;align-items:center;gap:6px}.embed-session-action.selected{color:#ffd36b}.embed-day-tabs{display:flex;gap:7px;margin-bottom:15px;overflow:auto}.embed-day-tabs button{border:1px solid #344154;border-radius:7px;background:#172236;color:#b9c5d6;padding:8px 11px;white-space:nowrap;cursor:pointer}.embed-day-tabs button.active{border-color:#6f91ff;background:#26375a;color:#fff}.embed-clickable{cursor:pointer}.embed-clickable:hover{border-color:#6782ae}.embed-detail-back{margin-bottom:15px;border:0;background:transparent;color:#88aaff;display:flex;align-items:center;gap:7px;cursor:pointer}.embed-detail{border:1px solid #344154;border-radius:10px;background:#172236;padding:22px}.embed-detail header{display:flex;align-items:flex-start;gap:14px}.embed-detail h2{margin:0 0 7px;font-size:22px}.embed-detail p{color:#aab6c7;line-height:1.6}.embed-detail .embed-speaker-avatar{width:72px;height:72px;flex-basis:72px}.embed-empty-filter{padding:42px;border:1px dashed #344154;border-radius:9px;text-align:center;color:#91a0b4}.embed-canvas.light .embed-public-tools label,.embed-canvas.light .embed-public-tools button,.embed-canvas.light .embed-day-tabs button,.embed-canvas.light .embed-session-card,.embed-canvas.light .embed-detail{background:#fff;border-color:#dce3ec}.embed-canvas.light .embed-tags span{background:#eef2f7;color:#526077}.embed-canvas.light .embed-session-description,.embed-canvas.light .embed-detail p{color:#526077}.embed-speaker-card button{border:0;background:transparent;color:inherit;text-align:left;padding:0;cursor:pointer}.embed-speaker-card .embed-card-open{margin-left:auto;color:#88aaff}.embed-gallery-tools{margin-bottom:16px}.embed-agenda-row button{all:unset;cursor:pointer;display:block}.embed-agenda-row button:focus-visible,.embed-speaker-card button:focus-visible{outline:2px solid #6f91ff;outline-offset:3px}
.embed-agenda-grid{border:1px solid #344154;border-radius:10px;overflow:hidden}.embed-agenda-grid-head,.embed-agenda-slot{display:grid;grid-template-columns:88px repeat(var(--agenda-columns),minmax(0,1fr))}.embed-agenda-grid-head{background:#202c40;color:#aebbd0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.embed-agenda-grid-head>*{padding:11px 12px;border-right:1px solid #344154}.embed-agenda-slot{border-top:1px solid #344154;min-height:104px}.embed-agenda-slot>time{padding:14px 12px;color:#85a7d2;font-size:12px;font-weight:700;border-right:1px solid #344154}.embed-agenda-cell{padding:8px;border-right:1px solid #344154}.embed-agenda-cell:last-child,.embed-agenda-grid-head>*:last-child{border-right:0}.embed-agenda-block{width:100%;height:100%;min-height:84px;border:1px solid #40516b;border-left:3px solid #6f91ff;border-radius:7px;background:#172236;color:inherit;padding:11px;text-align:left;cursor:pointer}.embed-agenda-block:hover{border-color:#7892bd}.embed-agenda-block h4{margin:0 0 8px;font-size:13px;line-height:1.35}.embed-agenda-block p{margin:0;color:#91a0b4;font-size:10px;line-height:1.45}.embed-agenda-block p+p{margin-top:3px}.embed-canvas.light .embed-agenda-grid,.embed-canvas.light .embed-agenda-grid-head>* ,.embed-canvas.light .embed-agenda-slot,.embed-canvas.light .embed-agenda-slot>time,.embed-canvas.light .embed-agenda-cell{border-color:#dce3ec}.embed-canvas.light .embed-agenda-grid-head{background:#eef2f7;color:#526077}.embed-canvas.light .embed-agenda-block{background:#fff;border-color:#dce3ec;border-left-color:#4d6cf0}.embed-canvas.light .embed-agenda-block p{color:#657286}
.embed-speaker-grid.gallery{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.embed-speaker-card.gallery{position:relative;display:block;padding:0;overflow:hidden}.embed-speaker-card.gallery .embed-speaker-avatar{width:100%;height:210px;border-radius:0;display:grid;place-items:center;font-size:30px}.embed-speaker-card.gallery>button{display:block;width:100%;padding:17px 18px 19px}.embed-speaker-card.gallery .embed-card-open{position:absolute;right:14px;bottom:18px}.embed-speaker-card.gallery .embed-session-meta{padding-right:28px}.embed-bio-toggle{border:0;background:transparent;color:#88aaff;padding:0;cursor:pointer}.embed-canvas.light .embed-bio-toggle{color:#315ed8}
@media(max-width:1100px){.embed-editor-bar,.embed-editor-body{grid-template-columns:380px minmax(0,1fr)}.embed-grid{grid-template-columns:repeat(2,minmax(250px,1fr))}.embed-browser-toolbar{grid-template-columns:auto 1fr auto auto}.embed-browser-toolbar .embed-device-toggle{display:none}}
@media(max-width:760px){.embed-page{padding:22px 16px 40px}.embed-toolbar{align-items:stretch;flex-direction:column}.embed-toolbar .search-box{width:100%}.embed-toolbar .split-wrap{margin-left:0}.embed-grid{grid-template-columns:1fr}.embed-editor-bar{display:flex}.embed-editor-name{width:100%;border-right:0}.embed-editor-tools{position:absolute;top:80px;left:0;right:0;height:55px;background:#fff;border-bottom:1px solid #dfe4ec;z-index:2}.embed-editor-body{display:block;padding-top:55px}.embed-config{border-right:0}.embed-preview-wrap{padding:14px}.embed-browser{height:680px;min-height:0}.embed-browser-toolbar{grid-template-columns:auto 1fr auto}.embed-preview-actions .embed-icon-button{display:none}.embed-urlbar{grid-column:1/-1}.embed-grid{padding-top:14px}.embed-event-title{min-height:70px;padding:21px 18px;font-size:21px}.embed-content{padding:18px 14px;min-height:calc(100% - 110px)}.embed-agenda{gap:24px}.embed-agenda-row{grid-template-columns:72px minmax(0,1fr);gap:11px;padding:14px 12px}.embed-day-heading{font-size:14px}.embed-speaker-grid{grid-template-columns:1fr}.embed-speaker-card{padding:15px}.embed-speaker-sessions b{white-space:normal}.embed-powered{padding-inline:14px}.embed-public-tools label{min-width:100%;width:100%}.embed-result-count{margin-left:0;width:100%}.embed-session-card header{display:block}.embed-session-card header button{margin-top:8px}.embed-detail h2{font-size:18px}}
@media(max-width:760px){.embed-speaker-grid.gallery{grid-template-columns:1fr}.embed-speaker-card.gallery{padding:0}.embed-speaker-card.gallery .embed-speaker-avatar{height:190px}.embed-agenda-grid{border:0;overflow:visible}.embed-agenda-grid-head{display:none}.embed-agenda-slot{display:block;border:0;min-height:0;margin-bottom:18px}.embed-agenda-slot>time{display:block;padding:0 0 8px;border:0}.embed-agenda-cell{padding:0 0 8px;border:0}.embed-agenda-cell:empty{display:none}.embed-agenda-block{min-height:0}}
`;

const blankEmbed = () => ({
  id: null,
  name: "New Embed",
  format: "Styled HTML",
  enabled: true,
  view: "Agenda",
  theme: "dark",
  accent: "#2877c7",
  filter: "All tracks",
  fields: { description: true, speakers: true, location: true },
});

function normalizeEmbed(item = {}) {
  const type = String(item.type || "").toLowerCase();
  const layout = String(item.layout || "").toLowerCase();
  const legacyView =
    type === "speaker"
      ? layout.includes("list")
        ? "Speaker List"
        : "Speaker Gallery"
      : type === "schedule"
        ? layout.includes("itinerary") || layout.includes("agenda")
          ? "Schedule Itinerary"
          : "Agenda"
        : null;
  const fields = Array.isArray(item.fields)
    ? {
        description: item.fields.includes("description"),
        speakers: item.fields.includes("speakers"),
        location:
          item.fields.includes("location") || item.fields.includes("room"),
      }
    : item.fields;
  return {
    ...blankEmbed(),
    ...item,
    ...(!item.view && legacyView ? { view: legacyView } : {}),
    ...(!item.accent && item.color ? { accent: item.color } : {}),
    ...(fields ? { fields } : {}),
  };
}

export function EmbedsScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const embeds = data.embeds || [];
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState(blankEmbed);
  const [mode, setMode] = useState("preview");
  const [device, setDevice] = useState("desktop");
  const [open, setOpen] = useState({
    type: true,
    style: false,
    filters: false,
    fields: false,
  });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saveError, setSaveError] = useState("");
  const embedTracks = [
    ...new Set(
      [
        ...(data.sessions || []).map((item) => item.track),
        ...(data.abstracts || []).map((item) => item.track),
      ].filter(Boolean),
    ),
  ].sort();
  const normalizedEmbeds = embeds.map(normalizeEmbed);
  const visible = normalizedEmbeds.filter(
    (item) =>
      (filter === "all" ||
        (filter === "enabled" ? item.enabled : !item.enabled)) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const counts = {
    all: embeds.length,
    enabled: embeds.filter((item) => item.enabled).length,
    disabled: embeds.filter((item) => !item.enabled).length,
  };
  const snippet = `<iframe\n  src="${window.location.origin}/#/embed/${draft.id || "new"}"\n  title="${draft.name}"\n  width="100%"\n  height="720"\n  frameborder="0"\n></iframe>`;
  const publicUrl = `${window.location.origin}${window.location.pathname}#/embed/${draft.id || "new"}`;
  const openPublicPreview = () => {
    if (draft.id) window.open(publicUrl, "_blank", "noopener,noreferrer");
  };
  const startNew = (nextView = "Agenda") => {
    setDraft({ ...blankEmbed(), view: nextView, name: `${nextView} embed` });
    setMode("preview");
    setView("editor");
    setMenu(false);
  };
  const edit = (item) => {
    setDraft({ ...blankEmbed(), ...item });
    setMode("preview");
    setView("editor");
  };
  const save = async () => {
    let item = { ...draft, id: draft.id || `embed-${Date.now()}` };
    setSaveError("");
    if (persistenceStatus === "d1") {
      const { id, name, format, enabled, version, ...config } = item;
      const result = draft.id
        ? await patchSharedResource("embeds", draft.id, draft.version, {
            name,
            format,
            enabled: enabled ? 1 : 0,
            config,
          })
        : await createSharedResource("embeds", {
            name,
            format,
            enabled: enabled ? 1 : 0,
            config,
          });
      if (!result.ok) {
        setSaveError(
          result.error === "VERSION_CONFLICT"
            ? "This embed changed elsewhere. Reload first."
            : "The shared embed could not be saved.",
        );
        return false;
      }
      item = { ...item, id: result.item.id, version: result.item.version };
    }
    update((state) => ({
      ...state,
      embeds: (state.embeds || []).some((embed) => embed.id === item.id)
        ? (state.embeds || []).map((embed) =>
            embed.id === item.id ? item : embed,
          )
        : [...(state.embeds || []), item],
    }));
    setDraft(item);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    return true;
  };
  const saveBack = async () => {
    if (await save()) setView("list");
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(snippet);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const duplicate = async (event, item) => {
    event.stopPropagation();
    let copy = {
      ...item,
      id: `embed-${Date.now()}`,
      name: `${item.name} copy`,
      version: undefined,
    };
    setSaveError("");
    if (persistenceStatus === "d1") {
      const { id, name, format, enabled, version, ...config } = copy;
      const result = await createSharedResource("embeds", {
        name,
        format,
        enabled: enabled ? 1 : 0,
        config,
      });
      if (!result.ok) {
        setSaveError("The shared embed copy could not be created.");
        return;
      }
      copy = { ...copy, id: result.item.id, version: result.item.version };
    }
    update((state) => ({ ...state, embeds: [...(state.embeds || []), copy] }));
  };
  if (view === "editor")
    return (
      <>
        <style>{EMBED_STYLES}</style>
        <div className="embed-editor">
          <header className="embed-editor-bar">
            <div className="embed-editor-name">
              <button aria-label="Save and return to embeds" onClick={saveBack}>
                <ArrowLeft size={21} />
              </button>
              <h1>{draft.name || "New Embed"}</h1>
            </div>
            <div className="embed-editor-tools">
              <button
                className={mode === "preview" ? "active" : ""}
                onClick={() => setMode("preview")}
              >
                <Monitor size={18} />
                Preview
              </button>
              <button
                className={mode === "code" ? "active" : ""}
                onClick={() => setMode("code")}
              >
                <Code2 size={18} />
                Get Code
              </button>
              <span className="embed-format-label">Styled HTML</span>
            </div>
          </header>
          <div className="embed-editor-body">
            <aside className="embed-config">
              <EmbedSection
                title="Type"
                open={open.type}
                onToggle={() => setOpen({ ...open, type: !open.type })}
              >
                {open.type ? (
                  <>
                    <div className="embed-name-row">
                      <label className="embed-field">
                        Name{" "}
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                        />
                      </label>
                      <label className="embed-field">
                        Enabled{" "}
                        <Toggle
                          checked={draft.enabled}
                          onChange={(enabled) =>
                            setDraft({ ...draft, enabled })
                          }
                        />
                      </label>
                    </div>
                    <section className="embed-format-card">
                      <h3>
                        Embed Styled HTML{" "}
                        <span className="embed-lock">Locked</span>
                      </h3>
                      <p>
                        Configure settings for styled HTML feeds including
                        Agenda, Session List, Schedule Itinerary, Speaker List,
                        and Speaker Gallery. Each embed can be placed directly
                        in your website and will auto-update with speaker and
                        session details.
                      </p>
                      <p style={{ marginTop: 12 }}>
                        Create a new embed to use a different format.
                      </p>
                    </section>
                  </>
                ) : null}
              </EmbedSection>
              <EmbedSection
                title="Style Options"
                open={open.style}
                onToggle={() => setOpen({ ...open, style: !open.style })}
              >
                {open.style ? (
                  <div className="embed-options">
                    <label className="embed-option-row">
                      <span>Theme</span>
                      <select
                        value={draft.theme}
                        onChange={(event) =>
                          setDraft({ ...draft, theme: event.target.value })
                        }
                      >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </select>
                    </label>
                    <label className="embed-option-row">
                      <span>Accent color</span>
                      <input
                        className="embed-color"
                        type="color"
                        value={draft.accent}
                        onChange={(event) =>
                          setDraft({ ...draft, accent: event.target.value })
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </EmbedSection>
              <EmbedSection
                title={`Filters  ${draft.filter !== "All tracks" ? "1" : ""}`}
                open={open.filters}
                onToggle={() => setOpen({ ...open, filters: !open.filters })}
              >
                {open.filters ? (
                  <label className="embed-field">
                    Track
                    <select
                      value={draft.filter}
                      onChange={(event) =>
                        setDraft({ ...draft, filter: event.target.value })
                      }
                    >
                      <option>All tracks</option>
                      {embedTracks.map((track) => (
                        <option key={track}>{track}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </EmbedSection>
              <EmbedSection
                title="Field Options"
                open={open.fields}
                onToggle={() => setOpen({ ...open, fields: !open.fields })}
              >
                {open.fields ? (
                  <div className="embed-checks">
                    {Object.entries(draft.fields).map(([key, value]) => (
                      <label className="embed-check" key={key}>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              fields: {
                                ...draft.fields,
                                [key]: event.target.checked,
                              },
                            })
                          }
                        />
                        <span>{key[0].toUpperCase() + key.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </EmbedSection>
              <footer className="embed-config-footer">
                <Button variant="primary" onClick={save}>
                  Save Embed
                </Button>
              </footer>
            </aside>
            <main className="embed-preview-wrap">
              <div className="embed-browser">
                {mode === "preview" ? (
                  <>
                    <div className="embed-browser-toolbar">
                      <div className="embed-lights">
                        <i />
                        <i />
                        <i />
                      </div>
                      <label className="embed-field">
                        <select
                          value={draft.view}
                          onChange={(event) =>
                            setDraft({ ...draft, view: event.target.value })
                          }
                        >
                          <option>Agenda</option>
                          <option>Session List</option>
                          <option>Schedule Itinerary</option>
                          <option>Speaker List</option>
                          <option>Speaker Gallery</option>
                        </select>
                      </label>
                      <div className="embed-device-toggle">
                        <button
                          className={device === "desktop" ? "active" : ""}
                          aria-label="Desktop preview"
                          aria-pressed={device === "desktop"}
                          onClick={() => setDevice("desktop")}
                        >
                          <Monitor size={17} />
                        </button>
                        <button
                          className={device === "mobile" ? "active" : ""}
                          aria-label="Mobile preview"
                          aria-pressed={device === "mobile"}
                          onClick={() => setDevice("mobile")}
                        >
                          <Smartphone size={17} />
                        </button>
                      </div>
                      <div className="embed-preview-actions">
                        <button className="embed-copy-code" onClick={copyCode}>
                          <Copy size={17} />
                          {copied ? "Copied" : "Copy code"}
                        </button>
                        <button
                          className="embed-icon-button"
                          aria-label="Refresh preview"
                          onClick={() => setRefresh(refresh + 1)}
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button
                          className="embed-icon-button"
                          aria-label="Open public preview"
                          disabled={!draft.id}
                          onClick={openPublicPreview}
                        >
                          <ExternalLink size={18} />
                        </button>
                      </div>
                      <div className="embed-urlbar">
                        <input
                          aria-label="Public embed URL"
                          value={`${publicUrl}?refresh=${refresh}`}
                          readOnly
                        />
                        <button
                          disabled={!draft.id}
                          onClick={openPublicPreview}
                        >
                          Go
                        </button>
                      </div>
                    </div>
                    <EmbedPreview draft={draft} device={device} data={data} />
                  </>
                ) : (
                  <div className="embed-code-panel">
                    <h3>Embed code</h3>
                    <p>
                      Paste this code into your website where the live Callboard
                      feed should appear.
                    </p>
                    <pre>{snippet}</pre>
                    <button onClick={copyCode}>
                      <Copy size={17} />
                      {copied ? "Copied to clipboard" : "Copy code"}
                    </button>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
        {saved ? (
          <div className="embed-saved">
            <Check size={16} /> Embed saved
          </div>
        ) : null}
      </>
    );
  return (
    <>
      <style>{EMBED_STYLES}</style>
      <div className="embed-page">
        <PageHeader
          icon={Code2}
          title="Embeds"
          subtitle="Export a feed of your agenda, sessions, or speakers to place in your app or website."
        />
        {saveError ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              border: "1px solid #f1b5b5",
              borderRadius: 9,
              background: "#fff7f7",
              color: "#9f2424",
              fontSize: 12,
            }}
          >
            {saveError}
          </div>
        ) : null}
        <div className="embed-toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by name, format, or ID..."
          />
          <div className="embed-segments">
            <Tabs
              compact
              value={filter}
              onChange={setFilter}
              items={[
                { label: "All", value: "all", count: counts.all },
                { label: "Enabled", value: "enabled", count: counts.enabled },
                {
                  label: "Disabled",
                  value: "disabled",
                  count: counts.disabled,
                },
              ]}
            />
          </div>
          <SplitButton
            children="Add Embed"
            menuOpen={menu}
            onMenu={() => setMenu(!menu)}
            onClick={() => startNew("Agenda")}
            items={[
              {
                label: "Agenda",
                icon: CalendarDays,
                onClick: () => startNew("Agenda"),
              },
              {
                label: "Session list",
                icon: List,
                onClick: () => startNew("Session List"),
              },
              {
                label: "Speaker gallery",
                icon: UsersRound,
                onClick: () => startNew("Speaker Gallery"),
              },
            ]}
          />
        </div>
        <section>
          <header className="embed-group-head">
            <Code2 size={18} />
            <b>Styled HTML</b>
            <span>{visible.length}</span>
            <ChevronDown size={17} />
          </header>
          <div className="embed-grid">
            {visible.map((item) => (
              <article
                className="embed-card"
                role="button"
                tabIndex={0}
                key={item.id}
                onClick={() => edit(item)}
                onKeyDown={(event) => event.key === "Enter" && edit(item)}
              >
                <div className="embed-card-head">
                  <h3>{item.name}</h3>
                  <div className="embed-card-actions">
                    <button
                      className="embed-icon-button"
                      aria-label={`Duplicate ${item.name}`}
                      onClick={(event) => duplicate(event, item)}
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="embed-icon-button"
                      aria-label={`Edit ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        edit(item);
                      }}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                </div>
                <Pill tone={item.enabled ? "success" : "neutral"}>
                  {item.enabled ? "Enabled" : "Disabled"}
                </Pill>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function EmbedSection({ title, open, onToggle, children }) {
  return (
    <section className="embed-config-section">
      <button
        className="embed-config-heading"
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          textAlign: "left",
        }}
        onClick={onToggle}
      >
        {title}
        {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
      </button>
      {open ? <div className="embed-config-body">{children}</div> : null}
    </section>
  );
}

function eventDate(value, timezone = "UTC") {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/Z$|[+-]\d\d:?\d\d$/.test(String(value))) return new Date(value);
  const match = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) return new Date(value);
  const desired = {
    year: +match[1],
    month: +match[2],
    day: +match[3],
    hour: +(match[4] || 0),
    minute: +(match[5] || 0),
    second: +(match[6] || 0),
  };
  const guess = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(guess));
  const observed = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, +part.value]),
  );
  return new Date(
    guess -
      (Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
        observed.second,
      ) -
        guess),
  );
}

function scheduledAt(session, timezone) {
  const value = session?.startsAt || session?.start;
  if (!value) return null;
  const date = eventDate(value, timezone);
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function scheduleDayKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function formatEventDay(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "UTC",
  }).format(date);
}

function formatEventTime(date, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone || "UTC",
  }).format(date);
}

function groupedSchedule(sessions, timezone) {
  const scheduled = [];
  const unscheduled = [];
  sessions.forEach((session) => {
    const startsAt = scheduledAt(session, timezone);
    if (startsAt) scheduled.push({ session, startsAt });
    else unscheduled.push(session);
  });
  scheduled.sort(
    (left, right) =>
      left.startsAt - right.startsAt ||
      String(left.session.title || "").localeCompare(
        String(right.session.title || ""),
      ),
  );
  unscheduled.sort((left, right) =>
    String(left.title || "").localeCompare(String(right.title || "")),
  );
  const groups = [];
  scheduled.forEach((item) => {
    const key = scheduleDayKey(item.startsAt, timezone);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = {
        key,
        label: formatEventDay(item.startsAt, timezone),
        sessions: [],
      };
      groups.push(group);
    }
    group.sessions.push(item);
  });
  return { groups, unscheduled };
}

function safePublicHeadshot(person) {
  const candidate = String(
    person?.publicHeadshotUrl ||
      person?.headshotPublicUrl ||
      person?.headshotUrl ||
      "",
  ).trim();
  if (!candidate) return "";
  if (/^blob:/i.test(candidate)) return candidate;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(candidate))
    return candidate;
  try {
    const base = globalThis.location?.origin || "https://callboard.invalid";
    const url = new URL(candidate, base);
    if (url.protocol !== "https:" && url.origin !== base) return "";
    if (url.origin === base && url.pathname.startsWith("/api/files/"))
      return "";
    if (
      url.origin === base &&
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/public/")
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}

function PublicSpeakerAvatar({ person }) {
  const source = safePublicHeadshot(person);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [source]);
  return (
    <span className="embed-speaker-avatar" aria-hidden="true">
      {source && !failed ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        person.initials
      )}
    </span>
  );
}

function formatEventRange(session, timezone) {
  const start = scheduledAt(session, timezone);
  const end = eventDate(session?.endsAt || session?.end, timezone);
  if (!start) return "Time to be announced";
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${day}, ${time.format(start)}${end && Number.isFinite(end.getTime()) ? `–${time.format(end)}` : ""}`;
}

function publicSessionFormat(session, timezone) {
  if (session?.format) return session.format;
  const start = scheduledAt(session, timezone);
  const end = eventDate(session?.endsAt || session?.end, timezone);
  if (!start || !end || !Number.isFinite(end.getTime())) return "Program session";
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes <= 15) return `Lightning talk (${minutes} min)`;
  if (minutes >= 60) return `Workshop (${minutes} min)`;
  return `Talk (${minutes} min)`;
}

function speakerSortKey(person) {
  const parts = String(person?.name || "")
    .trim()
    .split(/\s+/);
  return `${parts.at(-1) || ""} ${parts.slice(0, -1).join(" ")}`.toLowerCase();
}

function publicSpeakerDirectory(people) {
  const groups = new Map();
  for (const person of people) {
    const key = String(person?.name || person?.id || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const current = groups.get(key);
    const identityIds = [...new Set([
      ...(current?.identityIds || (current?.id ? [current.id] : [])),
      ...(person?.identityIds || (person?.id ? [person.id] : [])),
    ])];
    if (!current) {
      groups.set(key, { ...person, identityIds });
      continue;
    }
    const currentRichness = [current.publicHeadshotUrl, current.headshotUrl, current.bio, current.title, current.company].filter(Boolean).length;
    const nextRichness = [person.publicHeadshotUrl, person.headshotUrl, person.bio, person.title, person.company].filter(Boolean).length;
    groups.set(key, {
      ...(nextRichness > currentRichness ? person : current),
      identityIds,
    });
  }
  return [...groups.values()];
}

function downloadItineraryIcs(sessions, timezone, eventName) {
  const clean = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const stamp = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const events = sessions.flatMap((session) => {
    const start = scheduledAt(session, timezone);
    const end = eventDate(session.endsAt || session.end, timezone);
    if (!start || !end || !Number.isFinite(end.getTime())) return [];
    return [
      "BEGIN:VEVENT",
      `UID:${clean(session.id)}@callboard`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${clean(session.title)}`,
      `DESCRIPTION:${clean(session.description)}`,
      `LOCATION:${clean(session.room)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Callboard//Public itinerary//EN",
    `X-WR-CALNAME:${clean(eventName)} itinerary`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([calendar], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "callboard-itinerary.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EmbedPreview({ draft, device, data }) {
  const timezone = data.event.timezone || "UTC";
  const light = draft.theme === "light";
  const view = draft.view;
  const baseSessions = acceptedSessions(data).filter(
    (item) =>
      String(item.status || "").toLowerCase() === "accepted" &&
      (draft.filter === "All tracks" || item.track === draft.filter),
  );
  const baseSpeakers = publicSpeakerDirectory(acceptedParticipants(data))
    .filter(
      (person) => String(person.role || "Speaker").toLowerCase() === "speaker",
    )
    .sort((left, right) =>
      speakerSortKey(left).localeCompare(speakerSortKey(right)),
    );
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All tracks");
  const [format, setFormat] = useState("All formats");
  const [room, setRoom] = useState("All rooms");
  const [expanded, setExpanded] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [speakerBioExpanded, setSpeakerBioExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [showMine, setShowMine] = useState(false);
  const [exported, setExported] = useState(false);
  const storageKey = `callboard-itinerary:${draft.id || data.event.id || "public"}`;
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favorites));
    } catch {}
  }, [favorites, storageKey]);
  const personFor = (id) =>
    data.participants.find((person) => person.id === id);
  const peopleFor = (session) =>
    (session.participants || []).map(personFor).filter(Boolean);
  const speakerAppearsIn = (person, session) => {
    const identityIds = person.identityIds || [person.id];
    return (session.participants || []).some((id) => identityIds.includes(id));
  };
  const searchText = (session) =>
    [
      session.title,
      session.description,
      session.track,
      publicSessionFormat(session, timezone),
      session.room,
      ...peopleFor(session).map((person) => person.name),
    ]
      .join(" ")
      .toLowerCase();
  const sessions = baseSessions.filter(
    (session) =>
      (!query.trim() ||
        searchText(session).includes(query.trim().toLowerCase())) &&
      (track === "All tracks" || session.track === track) &&
      (format === "All formats" || publicSessionFormat(session, timezone) === format) &&
      (room === "All rooms" || session.room === room) &&
      (!showMine || favorites.includes(session.id)),
  );
  const schedule = groupedSchedule(sessions, timezone);
  const dayKey =
    selectedDay && schedule.groups.some((group) => group.key === selectedDay)
      ? selectedDay
      : schedule.groups[0]?.key || "";
  const activeGroup = schedule.groups.find((group) => group.key === dayKey);
  const tracks = [
    ...new Set(baseSessions.map((session) => session.track).filter(Boolean)),
  ].sort();
  const formats = [
    ...new Set(baseSessions.map((session) => publicSessionFormat(session, timezone))),
  ].sort();
  const rooms = [
    ...new Set(baseSessions.map((session) => session.room).filter(Boolean)),
  ].sort();
  const speakerMatches = baseSpeakers.filter((person) =>
    [person.name, person.title, person.company, person.bio]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const toggleFavorite = (id) =>
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const toggleExpanded = (id) =>
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const filters = (
    <div className="embed-public-tools">
      <label>
        <Search size={16} />
        <input
          aria-label={`Search ${view}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            view.includes("Speaker")
              ? "Search speakers"
              : "Search sessions or speakers"
          }
        />
      </label>
      {!view.includes("Speaker") ? (
        <>
          <label>
            <Filter size={15} />
            <select
              aria-label="Track filter"
              value={track}
              onChange={(event) => setTrack(event.target.value)}
            >
              <option>All tracks</option>
              {tracks.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {view === "Session List" ? (
            <label>
              <select
                aria-label="Format filter"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option>All formats</option>
                {formats.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ) : null}
          {view === "Session List" ? (
            <label>
              <select
                aria-label="Room filter"
                value={room}
                onChange={(event) => setRoom(event.target.value)}
              >
                <option>All rooms</option>
                {rooms.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : null}
      <span className="embed-result-count">
        {view.includes("Speaker") ? speakerMatches.length : sessions.length}{" "}
        result
        {(view.includes("Speaker")
          ? speakerMatches.length
          : sessions.length) === 1
          ? ""
          : "s"}
      </span>
    </div>
  );

  const sessionCard = (session, itinerary = false) => {
    const people = peopleFor(session);
    const isExpanded = expanded.includes(session.id);
    return (
      <article className="embed-session-card" key={session.id}>
        <header>
          <div>
            <h3>{session.title}</h3>
            <div className="embed-session-meta">
              <span>{formatEventRange(session, timezone)}</span>
              <span>{session.room || "Room TBA"}</span>
            </div>
          </div>
          <button onClick={() => setSelectedSession(session)}>
            View details
          </button>
        </header>
        {draft.fields.description && session.description ? (
          <>
            <p className="embed-session-description">
              {isExpanded
                ? session.description
                : `${session.description.slice(0, 160)}${session.description.length > 160 ? "…" : ""}`}
            </p>
            {session.description.length > 160 ? (
              <button onClick={() => toggleExpanded(session.id)}>
                {isExpanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </>
        ) : null}
        {draft.fields.speakers && people.length ? (
          <div className="embed-person-line">
            {people.map((person) => (
              <span key={person.id}>
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
                {person.company ? `, ${person.company}` : ""}
              </span>
            ))}
          </div>
        ) : null}
        <div className="embed-tags">
          <span>{publicSessionFormat(session, timezone)}</span>
          {session.track ? <span>{session.track}</span> : null}
        </div>
        {itinerary ? (
          <button
            className={`embed-session-action ${favorites.includes(session.id) ? "selected" : ""}`}
            onClick={() => toggleFavorite(session.id)}
          >
            <Star
              size={15}
              fill={favorites.includes(session.id) ? "currentColor" : "none"}
            />
            {favorites.includes(session.id)
              ? "Added to My Schedule"
              : "Add to My Schedule"}
          </button>
        ) : null}
      </article>
    );
  };

  const sessionDetail = selectedSession ? (
    <>
      <button
        className="embed-detail-back"
        onClick={() => setSelectedSession(null)}
      >
        <ArrowLeft size={16} />
        Back to {view}
      </button>
      <article className="embed-detail">
        <header>
          <div>
            <h2>{selectedSession.title}</h2>
            <div className="embed-session-meta">
              <span>{formatEventRange(selectedSession, timezone)}</span>
              <span>{selectedSession.room || "Room TBA"}</span>
            </div>
          </div>
        </header>
        <p>{selectedSession.description || "No description provided."}</p>
        <div className="embed-tags">
          <span>{publicSessionFormat(selectedSession, timezone)}</span>
          {selectedSession.track ? <span>{selectedSession.track}</span> : null}
        </div>
        {peopleFor(selectedSession).length ? (
          <div className="embed-person-line" style={{ marginTop: 15 }}>
            {peopleFor(selectedSession).map((person) => (
              <span key={person.id}>
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
                {person.company ? `, ${person.company}` : ""}
              </span>
            ))}
          </div>
        ) : null}
        {view === "Schedule Itinerary" ? (
          <button
            className={`embed-session-action ${favorites.includes(selectedSession.id) ? "selected" : ""}`}
            onClick={() => toggleFavorite(selectedSession.id)}
          >
            <Star size={15} fill={favorites.includes(selectedSession.id) ? "currentColor" : "none"} />
            {favorites.includes(selectedSession.id)
              ? "Added to My Schedule"
              : "Add to My Schedule"}
          </button>
        ) : null}
      </article>
    </>
  ) : null;

  const dayTabs = schedule.groups.length ? (
    <div className="embed-day-tabs">
      {schedule.groups.map((group) => (
        <button
          className={group.key === dayKey ? "active" : ""}
          key={group.key}
          onClick={() => setSelectedDay(group.key)}
        >
          {group.label.replace(/, \d{4}$/, "")}
        </button>
      ))}
    </div>
  ) : null;
  const agendaRooms = activeGroup
    ? [...new Set(activeGroup.sessions.map(({ session }) => session.room || "Room TBA"))].sort()
    : [];
  const agendaTimes = activeGroup
    ? [...new Map(activeGroup.sessions.map(({ startsAt }) => [startsAt.getTime(), startsAt])).values()]
    : [];
  const agenda = baseSessions.length ? (
    <>
      {filters}
      {dayTabs}
      {activeGroup ? (
        <section className="embed-day-group">
          <h2
            className="embed-day-heading"
            style={
              light ? { color: "#172033", borderColor: "#dce3ec" } : undefined
            }
          >
            {activeGroup.label}
            <span>{activeGroup.sessions.length} sessions</span>
          </h2>
          <div className="embed-agenda-grid" style={{ "--agenda-columns": agendaRooms.length }}>
            <div className="embed-agenda-grid-head" aria-hidden="true">
              <span>Time</span>
              {agendaRooms.map((agendaRoom) => <span key={agendaRoom}>{agendaRoom}</span>)}
            </div>
            {agendaTimes.map((startsAt) => (
              <div className="embed-agenda-slot" key={startsAt.getTime()}>
                <time dateTime={startsAt.toISOString()}>{formatEventTime(startsAt, timezone)}</time>
                {agendaRooms.map((agendaRoom) => (
                  <div className="embed-agenda-cell" key={agendaRoom}>
                    {activeGroup.sessions
                      .filter((item) => item.startsAt.getTime() === startsAt.getTime() && (item.session.room || "Room TBA") === agendaRoom)
                      .map(({ session }) => (
                        <button
                          className="embed-agenda-block"
                          key={session.id}
                          aria-label={`View ${session.title} in ${agendaRoom}`}
                          onClick={() => setSelectedSession(session)}
                        >
                          <h4>{session.title}</h4>
                          <p>{publicSessionFormat(session, timezone)}</p>
                          <p>{session.track || "General program"}</p>
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="embed-empty-filter">
          No sessions match these filters.
        </div>
      )}
      {schedule.unscheduled.length ? (
        <section className="embed-day-group embed-tba">
          <h2 className="embed-day-heading">
            To be scheduled
            <span>
              {schedule.unscheduled.length} session
              {schedule.unscheduled.length === 1 ? "" : "s"}
            </span>
          </h2>
          <div className="embed-session-list">
            {schedule.unscheduled.map((session) => sessionCard(session))}
          </div>
        </section>
      ) : null}
    </>
  ) : (
    <div className="embed-empty-preview">
      <div>
        <CalendarDays size={35} />
        <p>Published sessions will appear here.</p>
      </div>
    </div>
  );
  const sessionList = (
    <>
      {filters}
      <div className="embed-session-list">
        {sessions.length ? (
          sessions.map((session) => sessionCard(session))
        ) : (
          <div className="embed-empty-filter">
            No sessions match these filters.
          </div>
        )}
      </div>
    </>
  );
  const itinerary = (
    <>
      {filters}
      <div className="embed-public-tools">
        <button
          className={showMine ? "active" : ""}
          onClick={() => setShowMine(!showMine)}
        >
          <Star size={15} />
          My Schedule ({favorites.length})
        </button>
        <button
          disabled={!favorites.length}
          onClick={() =>
            (downloadItineraryIcs(
              baseSessions.filter((session) => favorites.includes(session.id)),
              timezone,
              data.event.name,
            ),
            setExported(true),
            setTimeout(() => setExported(false), 2400))
          }
        >
          <Download size={15} />
          {exported ? "Calendar downloaded" : "Export calendar"}
        </button>
      </div>
      {dayTabs}
      <div className="embed-session-list">
        {activeGroup?.sessions.length ? (
          activeGroup.sessions.map(({ session }) => sessionCard(session, true))
        ) : (
          <div className="embed-empty-filter">
            {showMine
              ? "Add sessions to build your personal schedule."
              : "No sessions match these filters."}
          </div>
        )}
      </div>
    </>
  );

  const speakerDetail = selectedSpeaker
    ? (() => {
        const appearances = baseSessions.filter((session) =>
          speakerAppearsIn(selectedSpeaker, session),
        );
        return (
          <>
            <button
              className="embed-detail-back"
              onClick={() => { setSelectedSpeaker(null); setSpeakerBioExpanded(false); }}
            >
              <ArrowLeft size={16} />
              Back to {view}
            </button>
            <article className="embed-detail">
              <header>
                <PublicSpeakerAvatar person={selectedSpeaker} />
                <div>
                  <h2>{selectedSpeaker.name}</h2>
                  <div className="embed-session-meta">
                    <span>{selectedSpeaker.title || "Speaker"}</span>
                    {selectedSpeaker.company ? (
                      <span>{selectedSpeaker.company}</span>
                    ) : null}
                  </div>
                </div>
              </header>
              <p>
                {selectedSpeaker.bio
                  ? speakerBioExpanded || selectedSpeaker.bio.length <= 120
                    ? selectedSpeaker.bio
                    : `${selectedSpeaker.bio.slice(0, 120)}…`
                  : "Biography coming soon."}
              </p>
              {selectedSpeaker.bio?.length > 120 ? (
                <button className="embed-bio-toggle" onClick={() => setSpeakerBioExpanded((value) => !value)}>
                  {speakerBioExpanded ? "Show less biography" : "Show full biography"}
                </button>
              ) : null}
              <h3>Sessions ({appearances.length})</h3>
              <div className="embed-session-list">
                {appearances.map((session) => (
                  <button
                    className="embed-session-card embed-clickable"
                    key={session.id}
                    onClick={() => {
                      setSelectedSpeaker(null);
                      setSelectedSession(session);
                    }}
                  >
                    <b>{session.title}</b>
                    <div className="embed-session-meta">
                      <span>{formatEventRange(session, timezone)}</span>
                      <span>{session.room || "Room TBA"}</span>
                    </div>
                  </button>
                ))}
              </div>
            </article>
          </>
        );
      })()
    : null;
  const speakerDirectory = (
    <>
      {filters}
      <div className={`embed-speaker-grid ${view === "Speaker Gallery" ? "gallery" : ""}`}>
        {speakerMatches.length ? (
          speakerMatches.map((person) => {
            const appearances = baseSessions.filter((session) =>
              speakerAppearsIn(person, session),
            );
            return (
              <article
                className={`embed-speaker-card embed-clickable ${view === "Speaker Gallery" ? "gallery" : ""}`}
                key={person.id}
                onClick={() => { setSelectedSpeaker(person); setSpeakerBioExpanded(false); }}
              >
                <PublicSpeakerAvatar person={person} />
                <button>
                  <div className="embed-speaker-copy">
                    <h3>{person.name}</h3>
                    <p>
                      {person.title || "Speaker"}
                      {person.company ? ` · ${person.company}` : ""}
                    </p>
                    {view === "Speaker Gallery" && person.bio ? (
                      <p>
                        {person.bio.slice(0, 130)}
                        {person.bio.length > 130 ? "…" : ""}
                      </p>
                    ) : null}
                    <div className="embed-session-meta">
                      {appearances.length} session
                      {appearances.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </button>
                <ChevronRight className="embed-card-open" size={18} />
              </article>
            );
          })
        ) : (
          <div className="embed-empty-filter">
            No speakers match this search.
          </div>
        )}
      </div>
    </>
  );

  let content =
    view === "Session List"
      ? sessionList
      : view === "Schedule Itinerary"
        ? itinerary
        : view.includes("Speaker")
          ? speakerDirectory
          : agenda;
  if (selectedSession) content = sessionDetail;
  if (selectedSpeaker) content = speakerDetail;
  return (
    <div
      className={`embed-canvas ${device === "mobile" ? "mobile" : ""} ${light ? "light" : ""}`}
      style={light ? { background: "#f5f7fa", color: "#172033" } : undefined}
    >
      <header
        className="embed-event-title"
        style={{ background: draft.accent }}
      >
        {data.event.name}
        <small
          style={{
            display: "block",
            marginTop: 5,
            fontSize: 11,
            fontWeight: 500,
            opacity: 0.75,
          }}
        >
          {view}
        </small>
      </header>
      <div
        className="embed-content"
        style={light ? { background: "#f5f7fa", color: "#172033" } : undefined}
      >
        {content}
      </div>
      <footer className="embed-powered">Powered by Callboard</footer>
    </div>
  );
}

export function PublicEmbedScreen({ route }) {
  const { data } = useAppStore();
  const id = route.split("/")[2];
  const aliases = {
    embed_callboard_judge_schedule: [
      "embed_callboard_judge_schedule",
      "Schedule Itinerary",
    ],
    embed_callboard_judge_speakers: [
      "embed_callboard_judge_speakers",
      "Speaker Gallery",
    ],
    embed_callboard_judge_sessions: [
      "embed_callboard_judge_schedule",
      "Session List",
    ],
    embed_callboard_judge_agenda: ["embed_callboard_judge_schedule", "Agenda"],
    embed_callboard_judge_itinerary: [
      "embed_callboard_judge_schedule",
      "Schedule Itinerary",
    ],
    embed_callboard_judge_speaker_list: [
      "embed_callboard_judge_speakers",
      "Speaker List",
    ],
    embed_callboard_judge_gallery: [
      "embed_callboard_judge_speakers",
      "Speaker Gallery",
    ],
  };
  const [canonicalId, forcedView] = aliases[id] || [id, null];
  const [remote, setRemote] = useState({
    loading: true,
    item: null,
    fallbackAllowed: false,
  });
  useEffect(() => {
    let cancelled = false;
    setRemote({ loading: true, item: null, fallbackAllowed: false });
    loadPublicEmbed(canonicalId).then((result) => {
      if (!cancelled)
        setRemote({
          loading: false,
          item: result.item || null,
          fallbackAllowed: Boolean(result.fallbackAllowed),
        });
    });
    return () => {
      cancelled = true;
    };
  }, [canonicalId]);
  if (remote.loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#111a2a",
          color: "#dce5f1",
        }}
      >
        <style>{EMBED_STYLES}</style>
        <div>Loading published schedule…</div>
      </div>
    );
  const publicData = remote.item
    ? {
        event: remote.item.event,
        sessions: remote.item.sessions || [],
        abstracts: remote.item.abstracts || [],
        participants: remote.item.participants || [],
      }
    : data;
  const embed =
    remote.item?.embed ||
    (remote.fallbackAllowed
      ? (data.embeds ?? []).find((item) => item.id === canonicalId)
      : null);
  if (!embed || !embed.enabled)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#111a2a",
          color: "#dce5f1",
        }}
      >
        <style>{EMBED_STYLES}</style>
        <div className="embed-empty-preview">
          <div>
            <CalendarDays size={35} />
            <p>This embed is not available.</p>
            <p>
              <a href="#/embed/embed_callboard_judge_itinerary">Open the public schedule</a>
              {" · "}
              <a href="#/embed/embed_callboard_judge_gallery">Open the speaker gallery</a>
            </p>
          </div>
        </div>
      </div>
    );
  const draft = {
    ...normalizeEmbed(embed),
    id,
    ...(forcedView
      ? {
          view: forcedView,
          // The five public aliases are complete attendee views rather than the
          // organizer's field-limited canonical embed configuration.
          fields: { description: true, speakers: true, location: true },
        }
      : {}),
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        background: draft.theme === "light" ? "#f5f7fa" : "#111a2a",
      }}
    >
      <style>{EMBED_STYLES}</style>
      <EmbedPreview
        key={`${id}:${forcedView || draft.view}`}
        draft={draft}
        device="desktop"
        data={publicData}
      />
    </div>
  );
}
