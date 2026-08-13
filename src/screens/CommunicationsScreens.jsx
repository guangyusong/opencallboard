import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  Link2,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useAppStore } from "../store.jsx";
import {
  Button,
  Drawer,
  Field,
  PageHeader,
  Pill,
  SearchBox,
  Tabs,
  Toggle,
} from "../components/ui.jsx";
import {
  DEFAULT_REMINDERS,
  MERGE_FIELDS,
  SEEDED_TEMPLATES,
  SEGMENTS,
  buildMergeContext,
  calendarLinks,
  createCalendarPayload,
  createIcsInvitation,
  downloadIcs,
  makeDryRunEntry,
  materializeReminderDryRuns,
  reminderDueAt,
  renderMergeFields,
  segmentRecipients,
} from "../lib/communications.js";
import {
  buildSyntheticCommunicationPayload,
  syntheticCalendarMetadata,
  TEST_RECIPIENT_IDENTITIES,
} from "../lib/communicationsRelease.js";
import {
  createSharedCommunicationOutbox,
  createSharedResource,
  evaluateSharedReminderPreviews,
  patchSharedResource,
  releaseSharedCommunicationOutbox,
} from "../lib/sharedApi.js";

const COMMUNICATIONS_STYLES = `
.comms-page{padding:28px 30px 54px}.comms-page .page-header{margin-bottom:8px}.comms-safe-note{display:flex;align-items:center;gap:9px;color:#57677d;font-size:11px;background:#edf4ff;border:1px solid #d8e6ff;border-radius:8px;padding:9px 12px}.comms-summary{height:76px;border-block:1px solid #dfe5ed;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);margin:8px -30px 0;padding:0 30px}.comms-summary div{display:flex;flex-direction:column;justify-content:center;border-right:1px solid #e6eaf0;padding:0 22px}.comms-summary div:first-child{padding-left:0}.comms-summary div:last-child{border:0}.comms-summary b{font-size:20px}.comms-summary span{margin-top:4px;color:#77859a;font-size:11px}.comms-nav{margin:0 -30px 24px;padding:0 30px;background:#fff;border-bottom:1px solid #dfe5ed}.comms-nav .tabs{border:0}.comms-nav .tabs button{min-height:54px;font-size:13px}.comms-layout{display:grid;grid-template-columns:285px minmax(460px,1fr) 390px;gap:18px;align-items:start}.comms-panel{border:1px solid #dfe5ed;border-radius:11px;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.04);overflow:hidden}.comms-panel-head{min-height:61px;border-bottom:1px solid #e3e8ee;padding:0 18px;display:flex;align-items:center;gap:10px}.comms-panel-head h2{margin:0;font-size:14px}.comms-panel-head button{margin-left:auto}.comms-template-search{padding:13px;border-bottom:1px solid #e8ebf0}.comms-template-search .search-box{width:100%;min-width:0}.comms-template-list{max-height:640px;overflow:auto}.comms-template{width:100%;min-height:88px;border:0;border-bottom:1px solid #edf0f4;background:#fff;padding:14px 16px;text-align:left;cursor:pointer}.comms-template:hover{background:#f7f9fb}.comms-template.active{background:#edf4ff;box-shadow:inset 3px 0 #255edb}.comms-template b,.comms-template span{display:block}.comms-template b{font-size:12px}.comms-template span{margin-top:6px;color:#758297;font-size:10px}.comms-template .pill{display:inline-flex;margin-top:9px}.comms-composer{padding:20px;display:grid;gap:18px}.comms-row{display:grid;grid-template-columns:1fr 1fr;gap:15px}.comms-field{display:grid;gap:7px;font-size:11px;font-weight:600}.comms-field input,.comms-field select,.comms-field textarea{width:100%;border:1px solid #dce3ec;border-radius:8px;background:#fff;padding:0 11px;outline:0;font-size:12px}.comms-field input,.comms-field select{height:42px}.comms-field textarea{min-height:210px;padding-block:12px;resize:vertical;line-height:1.6}.comms-field input:focus,.comms-field select:focus,.comms-field textarea:focus{border-color:#255edb;box-shadow:0 0 0 2px rgba(37,94,219,.12)}.comms-merge{border:1px solid #dfe5ed;border-radius:9px;background:#f8fafc;padding:13px}.comms-merge-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:11px}.comms-merge-fields{display:flex;flex-wrap:wrap;gap:6px}.comms-merge-fields button{height:27px;border:1px solid #dce3ec;border-radius:6px;background:#fff;padding:0 8px;color:#536176;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}.comms-merge-fields button:hover{border-color:#8aa9ee;color:#174dbd}.comms-calendar-toggle{border:1px solid #dfe5ed;border-radius:9px;padding:14px 15px;display:flex;align-items:center;gap:12px}.comms-calendar-toggle div{flex:1}.comms-calendar-toggle b,.comms-calendar-toggle span{display:block}.comms-calendar-toggle b{font-size:12px}.comms-calendar-toggle span{margin-top:4px;color:#77859a;font-size:10px}.comms-composer-actions{border-top:1px solid #e3e8ef;margin:0 -20px -20px;padding:15px 20px;display:flex;align-items:center;gap:8px}.comms-composer-actions .comms-spacer{flex:1}.comms-preview-controls{padding:13px 16px;border-bottom:1px solid #e5e9ef}.comms-preview-controls label{display:grid;gap:6px;color:#718096;font-size:10px}.comms-preview-controls select{height:38px;border:1px solid #dce3ec;border-radius:7px;background:#fff;padding:0 10px;font-size:11px}.comms-email-frame{margin:18px;border:1px solid #dfe5ed;border-radius:9px;background:#fff;box-shadow:0 5px 16px rgba(15,23,42,.07);overflow:hidden}.comms-email-meta{border-bottom:1px solid #e7ebf0;padding:15px}.comms-email-meta div{display:grid;grid-template-columns:48px 1fr;gap:7px;margin-bottom:7px;font-size:10px}.comms-email-meta div:last-child{margin:0}.comms-email-meta span{color:#8793a5}.comms-email-subject{padding:15px 18px;border-bottom:1px solid #e7ebf0;font-size:13px;font-weight:600}.comms-email-body{padding:22px 18px;min-height:290px;white-space:pre-wrap;font-size:12px;line-height:1.75;color:#354054}.comms-preview-footer{border-top:1px solid #e5e9ef;padding:14px 16px;display:grid;gap:8px}.comms-preview-footer .btn{width:100%}.comms-provider-links{display:grid;grid-template-columns:1fr 1fr;gap:8px}.comms-provider-links a{height:37px;border:1px solid #dce3ec;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;gap:7px;color:#334155;text-decoration:none;font-size:10px;font-weight:600}.comms-provider-links a:hover{border-color:#98afe4;background:#f8faff}.comms-empty{padding:60px 30px;text-align:center;color:#77859a}.comms-empty svg{color:#a1adbd}.comms-empty h3{margin:15px 0 7px;color:#1c2737}.comms-table-wrap{border:1px solid #dfe5ed;border-radius:11px;background:#fff;overflow:hidden}.comms-table-toolbar{min-height:64px;border-bottom:1px solid #e3e8ee;padding:0 17px;display:flex;align-items:center;gap:12px}.comms-table-toolbar h2{margin:0;font-size:14px}.comms-table-toolbar .search-box{margin-left:auto;width:290px}.comms-table{width:100%;border-collapse:collapse}.comms-table th,.comms-table td{height:62px;border-bottom:1px solid #e8ebf0;padding:0 16px;text-align:left;font-size:11px}.comms-table th{height:44px;background:#fafbfc;color:#738096;font-weight:600}.comms-table td:first-child{font-weight:600}.comms-table tr:last-child td{border-bottom:0}.comms-table small{display:block;margin-top:4px;color:#7e8b9e}.comms-reminders{display:grid;gap:14px}.comms-reminder{min-height:108px;border:1px solid #dfe5ed;border-radius:11px;background:#fff;padding:18px 20px;display:flex;align-items:center;gap:17px}.comms-reminder-icon{width:45px;height:45px;border-radius:9px;background:#edf3ff;color:#255edb;display:grid;place-items:center}.comms-reminder-copy{display:grid;gap:5px}.comms-reminder-copy b{font-size:13px}.comms-reminder-copy span{color:#718096;font-size:11px}.comms-reminder .toggle-row{margin-left:auto}.comms-reminder .comms-more{width:34px;height:34px;border:0;border-radius:7px;background:transparent;display:grid;place-items:center}.comms-reminder .comms-more:hover{background:#f1f4f7}.comms-reminder-head{display:flex;align-items:center;margin-bottom:17px}.comms-reminder-head h2{margin:0;font-size:16px}.comms-reminder-head .btn{margin-left:auto}.comms-drawer-stack{display:grid;gap:20px}.comms-timing{display:grid;grid-template-columns:90px 1fr;gap:10px}.comms-dryrun-banner{display:flex;gap:10px;border:1px solid #dbe4f0;border-radius:9px;background:#f8fbff;padding:14px}.comms-dryrun-banner b,.comms-dryrun-banner span{display:block}.comms-dryrun-banner b{font-size:12px}.comms-dryrun-banner span{margin-top:4px;color:#68778d;font-size:10px;line-height:1.5}.comms-toast{position:fixed;z-index:160;right:22px;bottom:22px;width:360px;border:1px solid #dce3eb;border-radius:10px;background:#fff;box-shadow:0 13px 35px rgba(15,23,42,.17);padding:16px 18px;display:flex;gap:12px}.comms-toast svg{color:#1aa36f}.comms-toast b,.comms-toast span{display:block}.comms-toast span{margin-top:4px;color:#748197;font-size:11px}.comms-preview-count{padding:0 16px 13px;color:#637188;font-size:10px}.comms-preview-count b{color:#172033}
@media(max-width:1250px){.comms-layout{grid-template-columns:240px minmax(420px,1fr)}.comms-layout>.comms-panel:last-child{grid-column:1/-1}.comms-email-frame{max-width:720px}.comms-preview-footer{grid-template-columns:220px 1fr;align-items:start}.comms-provider-links{max-width:420px}}
@media(max-width:820px){.comms-page{padding:20px 15px 40px}.comms-summary,.comms-nav{margin-inline:-15px;padding-inline:15px}.comms-summary{grid-template-columns:1fr 1fr;height:auto}.comms-summary div{min-height:68px}.comms-layout{grid-template-columns:1fr}.comms-layout>.comms-panel:last-child{grid-column:auto}.comms-template-list{max-height:260px}.comms-row{grid-template-columns:1fr}.comms-preview-footer{grid-template-columns:1fr}.comms-table-wrap{overflow:auto}.comms-table{min-width:760px}}
`;

function initialDraft(template) {
  return {
    ...template,
    subject: template.subject || "",
    body: template.body || "",
    segment: template.segment || "all-speakers",
    attachCalendar: Boolean(template.attachCalendar),
  };
}

const CALENDAR_ACTIONS = [
  {
    id: "initial",
    label: "Initial invitation",
    method: "REQUEST",
    sequence: 0,
  },
  { id: "update", label: "Schedule update", method: "REQUEST", sequence: 1 },
  { id: "cancel", label: "Cancellation", method: "CANCEL", sequence: 2 },
];

function calendarMetadata(payload) {
  if (!payload) return null;
  return {
    uid: payload.uid,
    method: payload.method,
    sequence: payload.sequence,
    status: payload.method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
    start: payload.start.toISOString(),
    end: payload.end.toISOString(),
    location: payload.location,
  };
}

function formatEventDateTime(value, timezone) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone || "UTC",
  }).format(value);
}

export function CommunicationsScreen() {
  const { data, update, persistenceStatus } = useAppStore();
  const customTemplates = data.communicationTemplates || [];
  const templates = [...SEEDED_TEMPLATES, ...customTemplates];
  const reminders = data.communicationReminders || DEFAULT_REMINDERS;
  const [tab, setTab] = useState("templates");
  const [selectedId, setSelectedId] = useState("acceptance");
  const [draft, setDraft] = useState(() => initialDraft(SEEDED_TEMPLATES[0]));
  const [templateSearch, setTemplateSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [previewPersonId, setPreviewPersonId] = useState(
    data.participants?.[0]?.id || "",
  );
  const [releaseIdentityId, setReleaseIdentityId] = useState(
    "eventops-speaker-test",
  );
  const [scheduleAt, setScheduleAt] = useState("2026-09-30T09:00");
  const [calendarActionId, setCalendarActionId] = useState("initial");
  const [reminderDrawer, setReminderDrawer] = useState(false);
  const [reminderDraft, setReminderDraft] = useState({
    name: "",
    templateId: "task-due",
    segment: "incomplete-tasks",
    amount: 3,
    unit: "days before task due",
    enabled: true,
  });
  const [toast, setToast] = useState(null);
  const [sending, setSending] = useState(false);
  const previewPerson =
    data.participants?.find((person) => person.id === previewPersonId) ||
    data.participants?.[0];
  const recipients = segmentRecipients(data, draft.segment);
  const mergeContext = buildMergeContext(data, previewPerson, {
    segment: draft.segment,
  });
  const renderedSubject = renderMergeFields(draft.subject, mergeContext);
  const renderedBody = renderMergeFields(draft.body, mergeContext);
  const calendarAction =
    CALENDAR_ACTIONS.find((item) => item.id === calendarActionId) ||
    CALENDAR_ACTIONS[0];
  const calendarPayload = createCalendarPayload(
    data,
    previewPerson,
    calendarAction,
  );
  const ics = createIcsInvitation(calendarPayload);
  const providerLinks = calendarLinks(calendarPayload);
  const releasePreview = useMemo(() => {
    try {
      const payload = buildSyntheticCommunicationPayload({
        template: draft,
        identityId: releaseIdentityId,
        action: "preview",
        scheduledFor: scheduleAt || null,
        attachCalendar: draft.attachCalendar,
      });
      return {
        payload: draft.attachCalendar
          ? { ...payload, calendar: syntheticCalendarMetadata(calendarAction) }
          : payload,
        error: null,
      };
    } catch (error) {
      return { payload: null, error: error.message };
    }
  }, [
    draft,
    releaseIdentityId,
    scheduleAt,
    calendarActionId,
    data,
    previewPerson,
  ]);
  const exactPayload = releasePreview.payload;
  const visibleTemplates = templates.filter((template) =>
    `${template.name} ${template.category}`
      .toLowerCase()
      .includes(templateSearch.toLowerCase()),
  );
  const log = (data.emailLog || []).filter((entry) =>
    `${entry.templateName || ""} ${entry.subject || ""} ${entry.status || ""}`
      .toLowerCase()
      .includes(logSearch.toLowerCase()),
  );
  const selectTemplate = (template) => {
    setSelectedId(template.id);
    setDraft(initialDraft(template));
    setCalendarActionId("initial");
  };
  const insertMergeField = (field) =>
    setDraft({
      ...draft,
      body: `${draft.body}${draft.body.endsWith(" ") || !draft.body ? "" : " "}{{${field}}}`,
    });
  const saveTemplate = async () => {
    const existing = customTemplates.find((item) => item.id === draft.id);
    const id = existing ? existing.id : `custom-${Date.now()}`;
    let savedTemplate = {
      ...draft,
      id,
      name: draft.name || "Untitled template",
      category: draft.category || "Custom",
    };
    if (persistenceStatus === "d1") {
      const payload = {
        name: savedTemplate.name,
        category: savedTemplate.category,
        segment: savedTemplate.segment,
        subject: savedTemplate.subject,
        body: savedTemplate.body,
        attachCalendar: savedTemplate.attachCalendar ? 1 : 0,
      };
      const result = existing
        ? await patchSharedResource(
            "communication-templates",
            existing.id,
            existing.version,
            payload,
          )
        : await createSharedResource("communication-templates", payload);
      if (!result.ok) {
        showToast(
          "Template not saved",
          result.error === "VERSION_CONFLICT"
            ? "This template changed elsewhere. Reload first."
            : "The shared preview rejected this template.",
        );
        return;
      }
      savedTemplate = {
        ...result.item,
        attachCalendar: Boolean(result.item.attachCalendar),
      };
    }
    update((state) => ({
      ...state,
      communicationTemplates: (state.communicationTemplates || []).some(
        (item) => item.id === id,
      )
        ? (state.communicationTemplates || []).map((item) =>
            item.id === id ? savedTemplate : item,
          )
        : [...(state.communicationTemplates || []), savedTemplate],
    }));
    setDraft(savedTemplate);
    setSelectedId(savedTemplate.id);
    showToast(
      "Template saved",
      persistenceStatus === "d1"
        ? "The reusable template is stored in the shared preview."
        : "The reusable local template is ready.",
    );
  };
  const runDry = async (action, release = false) => {
    if (!exactPayload) {
      showToast(
        "Payload blocked",
        releasePreview.error || "The template is not release-safe.",
      );
      return;
    }
    const baseReleasePayload = buildSyntheticCommunicationPayload({
      template: draft,
      identityId: releaseIdentityId,
      action,
      scheduledFor: action === "schedule" ? scheduleAt : null,
      attachCalendar: draft.attachCalendar,
    });
    const releasePayload = draft.attachCalendar
      ? { ...baseReleasePayload, calendar: syntheticCalendarMetadata(calendarAction) }
      : baseReleasePayload;
    let entry = makeDryRunEntry({
      action,
      template: draft,
      segment: draft.segment,
      recipients: releasePayload.to,
      subject: releasePayload.subject,
      body: releasePayload.text,
      scheduledFor: action === "schedule" ? scheduleAt : null,
      attachCalendar: draft.attachCalendar,
      exactPayload: releasePayload,
      matchedRecipientCount: recipients.length,
    });
    if (persistenceStatus === "d1") {
      const result = await createSharedCommunicationOutbox(entry);
      if (!result.ok) {
        showToast(
          "Dry run not recorded",
          `The shared preview rejected this record (${result.error}).`,
        );
        return;
      }
      entry = {
        ...result.item,
        status:
          result.item.status === "scheduled_preview"
            ? "Scheduled Preview"
            : "Prepared Preview",
        provider:
          result.item.provider === "none"
            ? "Not connected"
            : result.item.provider,
        attachCalendar: Boolean(result.item.attachCalendar),
      };
      if (release) {
        setSending(true);
        const released = await releaseSharedCommunicationOutbox(result.item.id);
        setSending(false);
        if (!released.ok) {
          showToast(
            "Delivery not queued",
            `The guarded delivery gate rejected this send (${released.error}).`,
          );
          return;
        }
        entry = {
          ...entry,
          status: "Queued for test delivery",
          provider: "Gmail",
        };
      }
    }
    update((state) => ({
      ...state,
      emailLog: [entry, ...(state.emailLog || [])],
    }));
    showToast(
      release
        ? "Test email queued"
        : action === "schedule"
          ? "Reminder preview recorded"
          : "Dry run added to outbox",
      release
        ? `The inspected message${draft.attachCalendar ? " and calendar invitation" : ""} was queued to ${releasePayload.to[0].email}.`
        : `Exact payload prepared for ${releasePayload.to[0].email}; no email was transmitted.`,
    );
  };
  const sendLive = async () => {
    if (!previewPerson?.id || !previewPerson?.email || !renderedSubject.trim() || !renderedBody.trim()) {
      showToast("Message not ready", "Choose an event member and complete the subject and message.");
      return;
    }
    const confirmed = globalThis.confirm(
      `Send this email${draft.attachCalendar ? " and calendar invitation" : ""} now to ${previewPerson.name} <${previewPerson.email}>?`,
    );
    if (!confirmed) return;
    const livePayload = {
      schemaVersion: 1,
      releaseMode: "event-members",
      deliveryMode: "live",
      networkIntent: true,
      action: "send",
      from: { name: data.event?.name || "OpenCallboard", email: data.emailSender || "hello@opencallboard.com" },
      replyTo: { name: data.event?.name || "OpenCallboard", email: data.emailSender || "hello@opencallboard.com" },
      to: [{
        id: previewPerson.id,
        role: previewPerson.role || "Speaker",
        name: previewPerson.name,
        email: previewPerson.email,
      }],
      subject: renderedSubject,
      text: renderedBody,
      scheduledFor: null,
      attachments: draft.attachCalendar
        ? [{ kind: "calendar", filename: "opencallboard-session.ics", contentDisposition: "attachment", previewOnly: false }]
        : [],
      safety: { recipientAllowlistEnforced: true, outboundEnabled: true },
      ...(draft.attachCalendar ? { calendar: calendarMetadata(calendarPayload) } : {}),
    };
    setSending(true);
    const prepared = await createSharedCommunicationOutbox({
      action: "send",
      templateId: draft.id,
      templateName: draft.name,
      segment: draft.segment,
      exactPayload: livePayload,
    });
    if (!prepared.ok) {
      setSending(false);
      showToast("Email not prepared", `The delivery safety gate rejected this message (${prepared.error}).`);
      return;
    }
    const released = await releaseSharedCommunicationOutbox(prepared.item.id, { live: true });
    setSending(false);
    if (!released.ok) {
      showToast("Email not queued", `The delivery gate rejected this send (${released.error}).`);
      return;
    }
    const entry = {
      ...prepared.item,
      status: "Queued for delivery",
      provider: "Amazon SES",
      attachCalendar: Boolean(prepared.item.attachCalendar),
    };
    update((state) => ({ ...state, emailLog: [entry, ...(state.emailLog || [])] }));
    showToast(
      "Email queued",
      `${previewPerson.name} will receive the message${draft.attachCalendar ? " with a calendar invitation" : ""}. Delivery status is recorded in the outbox.`,
    );
  };
  const addReminder = async () => {
    let item = {
      id: `reminder-${Date.now()}`,
      name: reminderDraft.name || "New reminder",
      templateId: reminderDraft.templateId,
      segment: reminderDraft.segment,
      amount: Number(reminderDraft.amount),
      unit: reminderDraft.unit,
      timing: `${reminderDraft.amount} ${reminderDraft.unit}`,
      enabled: reminderDraft.enabled,
    };
    if (persistenceStatus === "d1") {
      const result = await createSharedResource("communication-reminders", {
        ...item,
        enabled: item.enabled ? 1 : 0,
      });
      if (!result.ok) {
        showToast(
          "Reminder not saved",
          "The shared preview rejected this reminder definition.",
        );
        return;
      }
      item = { ...result.item, enabled: Boolean(result.item.enabled) };
    }
    update((state) => ({
      ...state,
      communicationReminders: [
        ...(state.communicationReminders || DEFAULT_REMINDERS),
        item,
      ],
    }));
    setReminderDrawer(false);
    showToast(
      "Reminder definition saved",
      persistenceStatus === "d1"
        ? "It is shared and preview-only; no message will send automatically."
        : "It is local only and will not send automatically.",
    );
  };
  const toggleReminder = async (id, enabled) => {
    const existing = reminders.find((item) => item.id === id);
    let updated = { ...existing, enabled };
    if (persistenceStatus === "d1") {
      const result = await patchSharedResource(
        "communication-reminders",
        id,
        existing?.version,
        { enabled: enabled ? 1 : 0 },
      );
      if (!result.ok) {
        showToast(
          "Reminder not updated",
          result.error === "VERSION_CONFLICT"
            ? "This reminder changed elsewhere. Reload first."
            : "The shared preview rejected this change.",
        );
        return;
      }
      updated = { ...result.item, enabled: Boolean(result.item.enabled) };
    }
    update((state) => ({
      ...state,
      communicationReminders: (
        state.communicationReminders || DEFAULT_REMINDERS
      ).map((item) => (item.id === id ? updated : item)),
    }));
  };
  const runReminderAutomation = async () => {
    if (persistenceStatus === "d1" && data.reminderAutomationAvailable) {
      const result = await evaluateSharedReminderPreviews();
      if (!result.ok) {
        showToast(
          "Reminder evaluation blocked",
          result.error === "REMINDER_AUTOMATION_DISABLED"
            ? "The server-side reminder gate is disabled."
            : `The shared preview rejected this evaluation (${result.error}).`,
        );
        return;
      }
      const runs = result.items.map((entry) => entry.item).filter(Boolean);
      update((state) => ({
        ...state,
        reminderRuns: [
          ...runs,
          ...(state.reminderRuns || []).filter(
            (existing) => !runs.some((run) => run.id === existing.id),
          ),
        ],
      }));
      const materialized = runs.filter(
        (run) => run.status === "materialized_preview",
      ).length;
      showToast(
        materialized
          ? "Due reminders materialized"
          : "Reminder evaluation complete",
        materialized
          ? `${materialized} idempotent preview record${materialized === 1 ? "" : "s"} added; no message was queued or sent.`
          : "No new due preview was created; durable skip/block evidence is available below.",
      );
      return;
    }
    let generated = materializeReminderDryRuns(
      data,
      reminders,
      templates,
      new Date(),
      { force: true },
    );
    if (persistenceStatus === "d1" && generated.length) {
      generated = generated.map((entry) =>
        entry.attachCalendar
          ? {
              ...entry,
              exactPayload: {
                ...entry.exactPayload,
                calendar: calendarMetadata(calendarPayload),
              },
            }
          : entry,
      );
      const results = await Promise.all(
        generated.map((entry) =>
          createSharedCommunicationOutbox(entry, entry.automationKey),
        ),
      );
      if (results.some((result) => !result.ok)) {
        showToast(
          "Simulation not recorded",
          "One or more preview records were rejected; no email was transmitted.",
        );
        return;
      }
      generated = results.map((result) => ({
        ...result.item,
        status: "Scheduled Preview",
        provider:
          result.item.provider === "none"
            ? "Not connected"
            : result.item.provider,
        attachCalendar: Boolean(result.item.attachCalendar),
        automationKey: result.item.idempotencyKey,
      }));
    }
    update((state) => ({
      ...state,
      emailLog: [...generated, ...(state.emailLog || [])],
    }));
    showToast(
      generated.length
        ? "Reminder automation simulated"
        : "Nothing new to materialize",
      generated.length
        ? `${generated.length} dry-run delivery batch${generated.length === 1 ? "" : "es"} added to the outbox; no email was transmitted.`
        : "Today's enabled reminder definitions have already been simulated or have no recipients.",
    );
  };
  const showToast = (title, message) => {
    setToast({ title, message });
    setTimeout(() => setToast(null), 2600);
  };
  const newTemplate = () => {
    const template = {
      id: `custom-${Date.now()}`,
      name: "Untitled message",
      category: "Custom",
      segment: "all-speakers",
      subject: "",
      body: "Hi {{first_name}},\n\n",
      attachCalendar: false,
    };
    setSelectedId(template.id);
    setDraft(template);
    setCalendarActionId("initial");
    setTab("templates");
  };
  return (
    <>
      <style>{COMMUNICATIONS_STYLES}</style>
      <div className="comms-page">
        <PageHeader
          icon={MessageSquareText}
          title="Communications"
          subtitle="Create speaker messages, reminders, and calendar invitations"
          actions={
            <>
              <div className="comms-safe-note">
                <Eye size={15} />
                {data.emailUiReleaseAvailable
                  ? "Guarded test delivery ready"
                  : "Preview-only · strict test allowlist"}
              </div>
              <Button variant="primary" icon={Plus} onClick={newTemplate}>
                New Message
              </Button>
            </>
          }
        />
        <section className="comms-summary">
          <div>
            <b>{templates.length}</b>
            <span>Reusable templates</span>
          </div>
          <div>
            <b>{reminders.filter((item) => item.enabled).length}</b>
            <span>Enabled reminder definitions</span>
          </div>
          <div>
            <b>
              {
                (data.emailLog || []).filter((item) =>
                  item.status?.includes("Scheduled"),
                ).length
              }
            </b>
            <span>Scheduled dry runs</span>
          </div>
          <div>
            <b>{(data.emailLog || []).length}</b>
            <span>Preview records</span>
          </div>
        </section>
        <nav className="comms-nav">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { label: "Templates & compose", value: "templates" },
              {
                label: "Scheduled reminders",
                value: "reminders",
                count: reminders.length,
              },
              {
                label: "Outbox & log",
                value: "log",
                count: (data.emailLog || []).length,
              },
            ]}
          />
        </nav>
        {tab === "templates" ? (
          <section
            className="comms-dryrun-banner"
            style={{ marginBottom: 18, alignItems: "flex-start" }}
          >
            <Eye size={18} />
            <div style={{ flex: 1 }}>
              <b>Guarded synthetic delivery</b>
              <span>
                Every preview is limited to one authorized synthetic mailbox.
                When the server gate is enabled, the Speaker test identity can
                be queued through Gmail from this screen.
              </span>
              <label className="comms-field" style={{ marginTop: 10 }}>
                Test identity
                <select
                  value={releaseIdentityId}
                  onChange={(event) => setReleaseIdentityId(event.target.value)}
                >
                  {TEST_RECIPIENT_IDENTITIES.map((identity) => (
                    <option value={identity.id} key={identity.id}>
                      {identity.label} · {identity.email}
                    </option>
                  ))}
                </select>
              </label>
              {releasePreview.error ? (
                <span style={{ color: "#b42318", marginTop: 9 }}>
                  {releasePreview.error}
                </span>
              ) : (
                <details style={{ marginTop: 10 }}>
                  <summary
                    style={{ cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                  >
                    Inspect exact guarded payload
                  </summary>
                  <pre
                    style={{
                      maxHeight: 220,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      font: "9px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
                    }}
                  >
                    {JSON.stringify(exactPayload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </section>
        ) : null}
        {tab === "templates" ? (
          <div className="comms-layout">
            <section className="comms-panel">
              <header className="comms-panel-head">
                <FileText size={18} />
                <h2>Templates</h2>
              </header>
              <div className="comms-template-search">
                <SearchBox
                  value={templateSearch}
                  onChange={setTemplateSearch}
                  placeholder="Search templates..."
                />
              </div>
              <div className="comms-template-list">
                {visibleTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`comms-template ${selectedId === template.id ? "active" : ""}`}
                    onClick={() => selectTemplate(template)}
                  >
                    <b>{template.name}</b>
                    <span>{template.subject}</span>
                    <Pill
                      tone={
                        template.category === "Decision"
                          ? "blue"
                          : template.category === "Task"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {template.category}
                    </Pill>
                  </button>
                ))}
              </div>
            </section>
            <section className="comms-panel">
              <header className="comms-panel-head">
                <Mail size={18} />
                <h2>Compose</h2>
                <Button icon={Save} onClick={saveTemplate}>
                  Save template
                </Button>
              </header>
              <div className="comms-composer">
                <div className="comms-row">
                  <label className="comms-field">
                    Template name
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                    />
                  </label>
                  <label className="comms-field">
                    Recipient segment
                    <select
                      value={draft.segment}
                      onChange={(event) =>
                        setDraft({ ...draft, segment: event.target.value })
                      }
                    >
                      {SEGMENTS.map((segment) => (
                        <option value={segment.id} key={segment.id}>
                          {segment.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="comms-field">
                  Subject
                  <input
                    value={draft.subject}
                    onChange={(event) =>
                      setDraft({ ...draft, subject: event.target.value })
                    }
                  />
                </label>
                <label className="comms-field">
                  Message
                  <textarea
                    value={draft.body}
                    onChange={(event) =>
                      setDraft({ ...draft, body: event.target.value })
                    }
                  />
                </label>
                <section className="comms-merge">
                  <header className="comms-merge-head">
                    <b>Merge fields</b>
                    <span>Insert at end of message</span>
                  </header>
                  <div className="comms-merge-fields">
                    {MERGE_FIELDS.map((field) => (
                      <button
                        key={field}
                        onClick={() => insertMergeField(field)}
                      >{`{{${field}}}`}</button>
                    ))}
                  </div>
                </section>
                <section className="comms-calendar-toggle">
                  <CalendarDays size={21} />
                  <div>
                    <b>Attach calendar invitation</b>
                    <span>
                      Generates a downloadable RFC 5545 .ics preview; no
                      calendar is modified.
                    </span>
                    {draft.attachCalendar ? (
                      <label className="comms-field" style={{ marginTop: 10 }}>
                        Calendar action
                        <select
                          value={calendarActionId}
                          onChange={(event) =>
                            setCalendarActionId(event.target.value)
                          }
                        >
                          {CALENDAR_ACTIONS.map((item) => (
                            <option value={item.id} key={item.id}>
                              {item.label} · sequence {item.sequence}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <Toggle
                    checked={draft.attachCalendar}
                    onChange={(attachCalendar) =>
                      setDraft({ ...draft, attachCalendar })
                    }
                  />
                </section>
                <div className="comms-row">
                  <label className="comms-field">
                    Schedule dry run for
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                    />
                  </label>
                  <div className="comms-dryrun-banner">
                    <Eye size={18} />
                    <div>
                      <b>Dry-run mode</b>
                      <span>
                        Send and Schedule write only to the preview outbox.
                      </span>
                    </div>
                  </div>
                </div>
                <footer className="comms-composer-actions">
                  <span className="comms-safe-note">
                    <Eye size={14} />
                    {data.emailUiReleaseAvailable
                      ? "Amazon SES delivery ready"
                      : "Preview outbox only"}
                  </span>
                  <span className="comms-spacer" />
                  <Button
                    icon={Clock3}
                    disabled={!scheduleAt || !draft.subject}
                    onClick={() => runDry("schedule")}
                  >
                    Preview schedule
                  </Button>
                  <Button
                    icon={Send}
                    disabled={!draft.subject || !recipients.length}
                    onClick={() => runDry("send")}
                  >
                    Prepare preview
                  </Button>
                  {data.emailUiReleaseAvailable ? (
                    <Button
                      variant="primary"
                      icon={Send}
                      disabled={
                        sending ||
                        !draft.subject ||
                        !previewPerson?.email
                      }
                      onClick={sendLive}
                    >
                      {sending ? "Queueing…" : "Send email now"}
                    </Button>
                  ) : null}
                </footer>
              </div>
            </section>
            <section className="comms-panel">
              <header className="comms-panel-head">
                <Eye size={18} />
                <h2>Preview as speaker</h2>
              </header>
              <div className="comms-preview-controls">
                <label>
                  Recipient
                  <select
                    value={previewPersonId}
                    onChange={(event) => setPreviewPersonId(event.target.value)}
                  >
                    {(data.participants || []).map((person) => (
                      <option value={person.id} key={person.id}>
                        {person.name} · {person.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="comms-preview-count">
                <b>{recipients.length}</b> recipients match{" "}
                {SEGMENTS.find(
                  (item) => item.id === draft.segment,
                )?.label.toLowerCase()}
                .
              </div>
              <article className="comms-email-frame">
                <div className="comms-email-meta">
                  <div>
                    <span>From</span>
                    <b>
                      {data.event.shortName} &lt;preview@callboard.local&gt;
                    </b>
                  </div>
                  <div>
                    <span>To</span>
                    <b>
                      {previewPerson?.name} &lt;{previewPerson?.email}&gt;
                    </b>
                  </div>
                </div>
                <div className="comms-email-subject">
                  {renderedSubject || "Message subject"}
                </div>
                <div className="comms-email-body">
                  {renderedBody || "Your message preview will appear here."}
                </div>
              </article>
              {draft.attachCalendar ? (
                <footer className="comms-preview-footer">
                  <Button
                    icon={Download}
                    onClick={() =>
                      downloadIcs(
                        `${data.event.slug}-session${calendarAction.method === "CANCEL" ? "-cancellation" : ""}`,
                        ics,
                      )
                    }
                  >
                    {calendarAction.method === "CANCEL"
                      ? "Download cancellation"
                      : "Download .ics invitation"}
                  </Button>
                  {calendarAction.method !== "CANCEL" ? (
                    <div className="comms-provider-links">
                      <a
                        href={providerLinks.google}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CalendarDays size={15} />
                        Add to Google
                      </a>
                      <a
                        href={providerLinks.outlook}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <CalendarClock size={15} />
                        Add to Outlook
                      </a>
                    </div>
                  ) : (
                    <span className="comms-safe-note">
                      Same event UID · sequence {calendarAction.sequence}
                    </span>
                  )}
                </footer>
              ) : null}
            </section>
          </div>
        ) : null}
        {tab === "reminders" ? (
          <section>
            <header className="comms-reminder-head">
              <h2>Scheduled reminder definitions</h2>
              <Button icon={Sparkles} onClick={runReminderAutomation}>
                {data.reminderAutomationAvailable
                  ? "Evaluate due reminders"
                  : "Simulate reminder run"}
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setReminderDrawer(true)}
              >
                Add Reminder
              </Button>
            </header>
            <div className="comms-reminders">
              {reminders.map((reminder) => {
                const due = reminderDueAt(data, reminder);
                const lastRun = (data.reminderRuns || []).find(
                  (run) => run.reminderId === reminder.id,
                );
                return (
                  <article className="comms-reminder" key={reminder.id}>
                    <span className="comms-reminder-icon">
                      <CalendarClock size={21} />
                    </span>
                    <div className="comms-reminder-copy">
                      <b>{reminder.name}</b>
                      <span>
                        {templates.find(
                          (item) => item.id === reminder.templateId,
                        )?.name || reminder.templateId}{" "}
                        ·{" "}
                        {
                          SEGMENTS.find((item) => item.id === reminder.segment)
                            ?.label
                        }
                      </span>
                      <span>
                        {reminder.timing} ·{" "}
                        {due
                          ? `Next due ${formatEventDateTime(due, data.event?.timezone)}`
                          : "Waiting for a task or scheduled session"}
                      </span>
                      {lastRun ? (
                        <span>
                          Last server run ·{" "}
                          {String(lastRun.status).replaceAll("_", " ")} ·{" "}
                          {lastRun.matchedRecipientCount} matched · no delivery
                        </span>
                      ) : null}
                    </div>
                    <Toggle
                      checked={reminder.enabled}
                      onChange={(enabled) =>
                        toggleReminder(reminder.id, enabled)
                      }
                    />
                    <button className="comms-more">
                      <MoreHorizontal size={19} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        {tab === "log" ? (
          <section className="comms-table-wrap">
            <header className="comms-table-toolbar">
              <h2>Preview outbox and delivery log</h2>
              <SearchBox
                value={logSearch}
                onChange={setLogSearch}
                placeholder="Search records..."
              />
            </header>
            {log.length ? (
              <table className="comms-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Scheduled / created</th>
                    <th>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {entry.templateName}
                        <small>{entry.subject}</small>
                      </td>
                      <td>
                        <Pill
                          tone={
                            entry.status?.includes("Scheduled")
                              ? "warning"
                              : "blue"
                          }
                        >
                          {entry.status}
                        </Pill>
                      </td>
                      <td>{entry.recipientCount}</td>
                      <td>
                        {entry.scheduledFor
                          ? new Date(entry.scheduledFor).toLocaleString()
                          : new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td>{entry.provider || "Local preview"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="comms-empty">
                <Mail size={34} />
                <h3>No preview records yet</h3>
                <span>
                  Use Dry-run Send or Schedule to add a shared record without
                  transmitting email.
                </span>
              </div>
            )}
          </section>
        ) : null}
      </div>
      <Drawer
        open={reminderDrawer}
        title="Add Reminder"
        subtitle="Create a reusable preview-only reminder definition"
        onClose={() => setReminderDrawer(false)}
        footer={
          <>
            <Button onClick={() => setReminderDrawer(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!reminderDraft.name}
              onClick={addReminder}
            >
              Save Reminder
            </Button>
          </>
        }
      >
        <div className="comms-drawer-stack">
          <div className="comms-dryrun-banner">
            <Eye size={18} />
            <div>
              <b>Preview automation</b>
              <span>
                The preview engine can materialize a dry-run outbox; production
                scheduling and delivery remain disabled.
              </span>
            </div>
          </div>
          <Field label="Name" required>
            <input
              value={reminderDraft.name}
              placeholder="e.g. Slides due reminder"
              onChange={(event) =>
                setReminderDraft({ ...reminderDraft, name: event.target.value })
              }
            />
          </Field>
          <Field label="Template">
            <select
              value={reminderDraft.templateId}
              onChange={(event) =>
                setReminderDraft({
                  ...reminderDraft,
                  templateId: event.target.value,
                })
              }
            >
              {templates.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recipient segment">
            <select
              value={reminderDraft.segment}
              onChange={(event) =>
                setReminderDraft({
                  ...reminderDraft,
                  segment: event.target.value,
                })
              }
            >
              {SEGMENTS.map((segment) => (
                <option value={segment.id} key={segment.id}>
                  {segment.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timing">
            <div className="comms-timing">
              <input
                type="number"
                min="1"
                value={reminderDraft.amount}
                onChange={(event) =>
                  setReminderDraft({
                    ...reminderDraft,
                    amount: event.target.value,
                  })
                }
              />
              <select
                value={reminderDraft.unit}
                onChange={(event) =>
                  setReminderDraft({
                    ...reminderDraft,
                    unit: event.target.value,
                  })
                }
              >
                <option>days before task due</option>
                <option>days before event</option>
                <option>hours before session</option>
              </select>
            </div>
          </Field>
          <Toggle
            checked={reminderDraft.enabled}
            onChange={(enabled) =>
              setReminderDraft({ ...reminderDraft, enabled })
            }
            label="Enabled"
          />
        </div>
      </Drawer>
      {toast ? (
        <div className="comms-toast">
          <Check size={20} />
          <div>
            <b>{toast.title}</b>
            <span>{toast.message}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
