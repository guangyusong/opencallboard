const STEP_NAMES = new Set(["account", "submission", "participant", "review"]);

export function parsePublicFormRoute(route, forms = []) {
  const [path, query = ""] = String(route ?? "").split("?", 2);
  const parts = path.split("/").filter(Boolean);
  const submitIndex = parts.findIndex((part) => part === "submit" || part === "cfp");
  const tail = submitIndex >= 0 ? parts.slice(submitIndex + 1) : [];
  const first = tail[0] ?? "";
  const formId = first && !STEP_NAMES.has(first) ? first : forms[0]?.id;
  const stepName = STEP_NAMES.has(first) ? first : STEP_NAMES.has(tail[1]) ? tail[1] : "";
  const stepIndex = ["", "account", "submission", "participant", "review"].indexOf(stepName);
  const draftToken = new URLSearchParams(query).get("draft") || "";
  return { formId, stepName, stepIndex: Math.max(0, stepIndex), draftToken };
}

export function publicFormPath(formId, stepName = "", draftToken = "") {
  const path = `/submit/${formId ?? ""}${stepName ? `/${stepName}` : ""}`.replace(/\/$/, "");
  return draftToken ? `${path}?draft=${encodeURIComponent(draftToken)}` : path;
}

export function normalizePublicForm(form = {}) {
  return {
    id: form.id,
    name: form.name ?? "Session Submission Form",
    externalTitle: form.externalTitle ?? "Welcome to our event!",
    pageHeading: form.pageHeading ?? "Welcome!",
    welcomeEnabled: form.welcomeEnabled ?? true,
    welcomeMessage: form.welcomeMessage ?? "Tell us about the session you want to bring to our event.",
    kind: form.kind ?? "Abstracts",
    collectParticipants: form.collectParticipants ?? true,
    abstractSection: {
      title: "Tell us about your submission", heading: "Submission",
      description: "What do you want to present? Fill out the following information to tell us more.",
      ...(form.abstractSection ?? {}),
    },
    participantSection: {
      title: "Tell us about you", heading: "Participant",
      description: "Give us information about yourself and your credentials for presenting at our event.",
      ...(form.participantSection ?? {}),
    },
    participantRoles: form.participantRoles ?? [
      { id: "speaker", label: "Speaker", enabled: true, min: 1, max: 3 },
    ],
    abstractFields: form.abstractFields ?? [
      { id: "title", label: "Title", type: "Text", required: true, max: 255, locked: true },
      { id: "description", label: "Description", type: "Wysiwyg", required: true, max: 5000 },
      { id: "format", label: "Format", type: "Dropdown", required: true, options: ["Talk", "Panel", "Workshop"] },
      { id: "track", label: "Track", type: "Dropdown", required: true, options: ["Agents", "Infrastructure", "Applied AI"] },
    ],
    participantFields: form.participantFields ?? [
      { id: "firstName", label: "First Name", type: "Text", required: true, locked: true },
      { id: "lastName", label: "Last Name", type: "Text", required: true, locked: true },
      { id: "email", label: "Email", type: "Email", required: true, locked: true },
      { id: "professionalTitle", label: "Professional Title", type: "Text", required: false, max: 255 },
      { id: "company", label: "Company", type: "Text", required: false, max: 255 },
      { id: "biography", label: "Biography", type: "Wysiwyg", required: false, max: 5000 },
    ],
    closeDate: form.closeDate ?? form.closesAt ?? form.closes ?? "",
    setLimit: form.setLimit ?? false,
    submissionLimit: Number(form.submissionLimit ?? 3),
    allowMultipleDrafts: form.allowMultipleDrafts ?? false,
    autoRedirect: form.autoRedirect ?? true,
    successMessage: form.successMessage ?? "Your submission is now pending review. You can follow its status and complete speaker tasks in your portal.",
    crossFieldRules: form.crossFieldRules ?? [],
    routingRules: form.routingRules ?? [],
    adminNew: form.adminNew ?? ["eventops-organizer-test@opencallboard.invalid"],
    adminUpdated: form.adminUpdated ?? ["eventops-organizer-test@opencallboard.invalid"],
    adminNewEnabled: form.adminNewEnabled ?? true,
    adminNewSubject: form.adminNewSubject ?? "New submission: {{submission.title}}",
    adminNewBody: form.adminNewBody ?? "A new submission was received for {{event.name}} from {{participant.fullName}}.",
    adminUpdatedEnabled: form.adminUpdatedEnabled ?? true,
    adminUpdatedSubject: form.adminUpdatedSubject ?? "Submission updated: {{submission.title}}",
    adminUpdatedBody: form.adminUpdatedBody ?? "{{participant.fullName}} updated a submission for {{event.name}}.",
    submissionConfirmation: form.submissionConfirmation ?? true,
    confirmationSubject: form.confirmationSubject ?? "We received your submission: {{submission.title}}",
    confirmationBody: form.confirmationBody ?? "Hi {{participant.firstName}},\n\nThanks for submitting to {{event.name}}. We will be in touch after review.",
  };
}

export function answerKey(field) {
  return field.id ?? field.label;
}

function comparable(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function conditionMatches(field, answers) {
  if (!field.conditionField) return true;
  const trigger = Object.entries(answers).find(([key]) => key === field.conditionField)?.[1]
    ?? answers[field.conditionField];
  if (Array.isArray(trigger)) return trigger.some((value) => comparable(value) === comparable(field.conditionValue));
  return comparable(trigger) === comparable(field.conditionValue);
}

export function visibleFields(fields = [], answers = {}) {
  return fields.filter((field) => conditionMatches(field, answers));
}

export function validateFields(fields = [], answers = {}) {
  const errors = {};
  for (const field of visibleFields(fields, answers)) {
    const key = answerKey(field);
    const value = answers[key];
    const empty = Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
    if (field.required && empty) errors[key] = `${field.label} is required.`;
    if (!empty && field.max && String(value).length > field.max) errors[key] = `${field.label} must be ${field.max.toLocaleString()} characters or fewer.`;
    if (!empty && field.type === "Email" && !/^\S+@\S+\.\S+$/.test(String(value))) errors[key] = "Enter a valid email address.";
    if (!empty && field.type === "Number" && Number.isNaN(Number(value))) errors[key] = "Enter a number.";
  }
  return errors;
}

export function crossFieldUsage(rule, fields, answers) {
  const requested = rule.fieldIds?.length ? rule.fieldIds : fields
    .filter((field) => ["Title", "Description"].includes(field.label))
    .map(answerKey);
  return requested.reduce((total, key) => total + String(answers[key] ?? "").length, 0);
}

export function validateCrossFieldRules(rules = [], fields = [], answers = {}) {
  return rules.flatMap((rule) => {
    const usage = crossFieldUsage(rule, fields, answers);
    return usage > Number(rule.max) ? [{ id: rule.id, message: `${rule.label ?? "Combined fields"} exceeds the ${Number(rule.max).toLocaleString()} character limit.`, usage, max: Number(rule.max) }] : [];
  });
}

export function eventDateTime(value, timezone = "UTC") {
  if (!value) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(String(value))) {
    const absolute = new Date(value);
    return Number.isNaN(absolute.getTime()) ? null : absolute;
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const observed = Object.fromEntries(formatter.formatToParts(new Date(target)).map((part) => [part.type, part.value]));
  const observedUtc = Date.UTC(Number(observed.year), Number(observed.month) - 1, Number(observed.day), Number(observed.hour), Number(observed.minute), Number(observed.second));
  const zoned = new Date(target - (observedUtc - target));
  return Number.isNaN(zoned.getTime()) ? null : zoned;
}

export function isFormClosed(form, at = Date.now(), timezone = "UTC") {
  if (form.status === "Closed") return true;
  if (!form.closeDate) return false;
  const close = eventDateTime(form.closeDate, timezone)?.getTime();
  return Number.isFinite(close) && close <= at;
}

export function submissionCountFor(data, formId, email) {
  return (data.abstracts ?? []).filter((item) => item.formId === formId && comparable(item.submitterEmail) === comparable(email)).length;
}

export function submissionLimitState(data, form, email) {
  const count = submissionCountFor(data, form.id, email);
  const limit = Number(form.submissionLimit ?? 3);
  return { count, limit, reached: Boolean(email && count >= limit) };
}

export function resolveRoutingRule(form, answers) {
  return (form.routingRules ?? []).find((rule) => {
    const value = answers[rule.fieldId] ?? answers[rule.fieldLabel];
    return comparable(value) === comparable(rule.equals);
  }) ?? null;
}

export function weightedScore(criteria = [], scores = {}) {
  const totalWeight = criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0) || 1;
  const weighted = criteria.reduce((sum, criterion) => sum + Number(scores[criterion.id] || 0) * Number(criterion.weight || 0), 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}

export function localAiSuggestion(submission, criteria = []) {
  const text = `${submission?.title ?? ""} ${submission?.description ?? ""}`.trim();
  const specificity = Math.min(5, Math.max(1, Math.round(text.length / 120)));
  const scores = Object.fromEntries(criteria.map((criterion, index) => [criterion.id, Math.max(1, Math.min(5, specificity + (index % 2 ? 0 : 1)))]));
  return {
    label: "Local AI-assist suggestion",
    disclaimer: "Deterministic demo guidance only. No external API was called; a human reviewer must decide.",
    scores,
    summary: text.length > 240 ? "Detailed proposal with enough context for a structured review." : "Concise proposal; consider requesting more implementation detail before accepting.",
  };
}
