import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Bot, Check, ChevronRight, ClipboardCheck, EyeOff, Plus,
  LogOut, Settings, Sparkles, Trash2,
} from "lucide-react";
import { Button, Field, Modal, Pill, Tabs, Toggle } from "../components/ui.jsx";
import { localAiSuggestion, visibleFields, weightedScore } from "../lib/formEngine.js";
import { createSharedResource, decideSharedSubmission, deleteSharedResource, logoutSharedSession, patchSharedResource } from "../lib/sharedApi.js";
import { useAppStore } from "../store.jsx";

const EVALUATION_STYLES = `
.eval-screen{min-height:calc(100vh - var(--topbar-height));background:#f9fafb}.eval-header{min-height:116px;padding:25px 30px;border-bottom:1px solid var(--border);background:#f2f5fa;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.eval-heading{display:flex;gap:15px}.eval-heading .eval-icon{width:50px;height:50px;border-radius:11px;background:#e9eef8;color:#195adb;display:grid;place-items:center}.eval-heading h1{margin:0;font-size:25px;letter-spacing:-.025em}.eval-heading p{margin:6px 0 0;color:var(--muted-text);font-size:13px}.eval-layout{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:calc(100vh - var(--topbar-height) - 116px)}.eval-rail{padding:20px 14px;border-right:1px solid var(--border);background:#f4f6f9}.eval-rail-label{padding:0 10px 10px;color:#7a8aa0;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.round-button{width:100%;min-height:82px;margin-bottom:9px;padding:13px;border:1px solid transparent;border-radius:11px;background:transparent;display:grid;grid-template-columns:38px 1fr;gap:11px;text-align:left;cursor:pointer}.round-button:hover{background:#fff}.round-button.active{background:#0e172a;color:#fff}.round-number{width:38px;height:38px;border-radius:9px;background:#e6ebf2;color:#596a83;display:grid;place-items:center;font-size:12px;font-weight:700}.round-button.active .round-number{background:#3f4b60;color:#fff}.round-button b,.round-button small{display:block}.round-button b{font-size:13px}.round-button small{margin-top:6px;color:#7f8da1;font-size:10px}.round-button.active small{color:#c7d0df}.eval-main{padding:24px 30px 55px;min-width:0}.eval-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:20px}.eval-toolbar .tabs{flex:1}.eval-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}.eval-stat{padding:18px;border:1px solid var(--border);border-radius:11px;background:#fff}.eval-stat span,.eval-stat b{display:block}.eval-stat span{color:var(--muted-text);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.eval-stat b{margin-top:8px;font-size:22px}.eval-card{border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:var(--shadow-card);overflow:visible}.eval-card>header{min-height:72px;padding:15px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:14px}.eval-card h2,.eval-card h3{margin:0}.eval-card h2{font-size:17px}.eval-table{width:100%;border-collapse:collapse}.eval-table th,.eval-table td{padding:14px 17px;border-bottom:1px solid var(--border);text-align:left;font-size:12px;vertical-align:middle}.eval-table th{color:#73839a;background:#fafbfc;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.eval-table tr:last-child td{border-bottom:0}.eval-title-cell b,.eval-title-cell span{display:block}.eval-title-cell span{margin-top:5px;color:var(--muted-text);font-size:10px}.reviewer-select{height:36px;min-width:160px;border:1px solid var(--border);border-radius:8px;background:#fff;padding:0 9px;font-size:11px}.review-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);gap:20px}.submission-pane,.score-pane{border:1px solid var(--border);border-radius:12px;background:#fff;box-shadow:var(--shadow-card)}.submission-pane>header,.score-pane>header{padding:20px 22px;border-bottom:1px solid var(--border)}.submission-pane h2,.score-pane h2{margin:0;font-size:17px}.submission-body,.score-body{padding:22px}.submission-body h3{margin:0 0 11px;font-size:20px}.submission-body .meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:23px}.submission-body .abstract-copy{white-space:pre-wrap;color:#4c5b70;font-size:13px;line-height:1.8}.answer-grid{margin-top:24px;display:grid;grid-template-columns:140px 1fr;gap:10px;font-size:12px}.answer-grid dt{color:var(--muted-text)}.answer-grid dd{margin:0}.criterion-row{padding:15px 0;border-bottom:1px solid var(--border)}.criterion-row:first-child{padding-top:0}.criterion-row>header{display:flex;justify-content:space-between;gap:15px;margin-bottom:11px}.criterion-row b{font-size:13px}.criterion-row small{color:var(--muted-text)}.score-buttons{display:flex;gap:7px}.score-buttons button{width:40px;height:36px;border:1px solid var(--border);border-radius:8px;background:#fff;cursor:pointer}.score-buttons button.active{border-color:#195adb;background:#195adb;color:#fff}.review-total{display:flex;align-items:center;justify-content:space-between;margin:20px 0;padding:15px;border-radius:9px;background:#f1f4f9}.review-total b{font-size:20px}.review-comments{display:grid;gap:8px;font-size:12px}.review-comments textarea{min-height:100px;border:1px solid var(--border);border-radius:9px;padding:12px;resize:vertical}.recommendation{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.recommendation button{min-height:40px;border:1px solid var(--border);border-radius:8px;background:#fff;font-size:11px;cursor:pointer}.recommendation button.active{border-color:#195adb;background:#eaf0ff;color:#195adb;font-weight:700}.ai-box{margin:18px 0;padding:16px;border:1px solid #cfd7ff;border-radius:10px;background:#f4f6ff}.ai-box header{display:flex;align-items:center;gap:10px}.ai-box h4{margin:0;font-size:13px}.ai-label{margin-left:auto;padding:4px 8px;border-radius:999px;background:#e5e9ff;color:#4a58bd;font-size:9px;text-transform:uppercase}.ai-box p{margin:10px 0;color:#5c6683;font-size:11px;line-height:1.6}.ai-scores{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.review-actions{display:flex;justify-content:flex-end;gap:8px}.decision-list{display:grid;gap:12px;padding:18px}.decision-row{padding:17px;border:1px solid var(--border);border-radius:10px;background:#f9fafb;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center}.decision-row h3{font-size:14px}.decision-row p{margin:6px 0 0;color:var(--muted-text);font-size:11px}.decision-actions{display:flex;gap:6px;flex-wrap:wrap}.decision-actions button{height:34px;border:1px solid var(--border);border-radius:7px;background:#fff;padding:0 10px;font-size:10px;cursor:pointer}.decision-actions button.primary{border-color:#195adb;background:#195adb;color:#fff}.criteria-editor{padding:22px 24px}.criteria-row{display:grid;grid-template-columns:1fr 110px 42px;gap:10px;margin-bottom:10px;align-items:end}.criteria-row .field input{height:40px}.criteria-total{margin:10px 0;color:#64748b;font-size:12px}.criteria-total.invalid{color:#b42318}.round-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}
@media(max-width:1050px){.review-layout{grid-template-columns:1fr}.eval-summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.eval-header{padding:20px 16px}.eval-layout{display:block}.eval-rail{display:flex;overflow:auto;border-right:0;border-bottom:1px solid var(--border)}.eval-rail-label{display:none}.round-button{min-width:210px}.eval-main{padding:20px 14px}.eval-summary{grid-template-columns:1fr 1fr}.eval-table{display:block;overflow-x:auto}.decision-row{grid-template-columns:1fr}.round-settings-grid{grid-template-columns:1fr}}
`;

const EVALUATION_AUX_STYLES = `
.eval-screen .plain-icon-button{width:38px;height:38px;border:0;border-radius:8px;background:transparent;display:grid;place-items:center;cursor:pointer}.eval-screen .plain-icon-button:hover{background:#eef1f5}.eval-screen .modal-actions{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px}.review-section-label{display:block;margin:17px 0 8px;color:#526176;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.review-helper{margin:-2px 0 12px;color:var(--muted-text);font-size:10px;line-height:1.5}.decision-guidance{max-width:620px;color:var(--muted-text);font-size:11px;line-height:1.5}.decision-row.accepted{border-color:#9ed8b0;background:#f1fbf4}.decision-row.declined{opacity:.72}.decision-actions button:disabled{cursor:default;opacity:.55}.decision-actions button.accept{border-color:#1f8f4e;background:#1f8f4e;color:#fff}.decision-success{margin-bottom:18px;padding:14px 16px;border:1px solid #9ed8b0;border-radius:10px;background:#eefaf2;color:#176534;display:flex;align-items:flex-start;gap:10px}.decision-success b,.decision-success span{display:block}.decision-success span{margin-top:3px;font-size:11px;color:#3f7653}.decision-status{display:flex;align-items:center;gap:8px;justify-content:flex-end}.criterion-note{padding:13px 0;border-bottom:1px solid var(--border);color:#65748a;font-size:11px;line-height:1.5}
`;

const reviewers = [
  { id: "reviewer-sarah", name: "Sarah Kim" },
  { id: "reviewer-marcus", name: "Marcus George" },
  { id: "reviewer-monica", name: "Monica Rivera" },
];

const defaultCriteria = () => [
  { id: "relevance", label: "Program relevance", weight: 30 },
  { id: "originality", label: "Originality", weight: 20 },
  { id: "technical", label: "Technical depth", weight: 30 },
  { id: "practical", label: "Practical value", weight: 20 },
];

const reviewerFor = (abstract, index, offset) => abstract.reviewRoute?.includes("Agents") ? reviewers[0] : abstract.reviewRoute?.includes("Infrastructure") ? reviewers[1] : abstract.reviewRoute?.includes("Applied AI") ? reviewers[2] : reviewers[(index + offset) % reviewers.length];
const makeAssignments = (abstracts, offset = 0) => abstracts.map((abstract, index) => ({ id: `assignment-${offset}-${abstract.id}`, abstractId: abstract.id, reviewerId: reviewerFor(abstract, index, offset).id, status: "Assigned" }));

function defaultRounds(abstracts) {
  const roundTwo = abstracts.filter((abstract) => abstract.reviewRoute?.includes("Round 2") || Number(abstract.reviewRound || 1) > 1);
  const roundOne = abstracts.filter((abstract) => !roundTwo.some((candidate) => candidate.id === abstract.id));
  return [
    { id: "round-1", name: "Round 1 · Technical review", number: 1, status: "Open", blind: true, criteria: defaultCriteria(), assignments: makeAssignments(roundOne, 0) },
    { id: "round-2", name: "Round 2 · Program committee", number: 2, status: "Upcoming", blind: false, criteria: defaultCriteria().map((criterion) => ({ ...criterion, id: `committee-${criterion.id}` })), assignments: makeAssignments(roundTwo, 1) },
  ];
}

const participantAnswer = (key) => ["participant", "speaker", "first", "last", "email", "bio", "pronoun", "gender", "linkedin", "twitter", "facebook", "website", "company", "job"].some((token) => String(key).toLowerCase().includes(token));
const normalizedKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const emptyAnswer = (value) => Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
const opaqueAnswerKey = (key) => /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(String(key)) || /^[a-f\d-]{24,}$/i.test(String(key));

function answerForField(answers, field) {
  if (Object.prototype.hasOwnProperty.call(answers, field.id)) return answers[field.id];
  if (Object.prototype.hasOwnProperty.call(answers, field.label)) return answers[field.label];
  const candidate = Object.entries(answers).find(([key]) => normalizedKey(key) === normalizedKey(field.label));
  return candidate?.[1];
}

function visibleSubmissionAnswers(answers = {}, fields = [], blind = false) {
  const coreFields = new Set(["title", "description", "format", "track"]);
  const seenLabels = new Set();
  const seenValues = new Set();
  const output = [];
  const visibleSchemaFields = visibleFields(fields, answers);

  for (const field of visibleSchemaFields) {
    const label = field.label || field.id;
    const normalized = normalizedKey(label);
    const value = answerForField(answers, field);
    if (!normalized || coreFields.has(normalized) || emptyAnswer(value) || (blind && participantAnswer(label))) continue;
    const valueKey = `${normalized}:${JSON.stringify(value)}`;
    if (seenLabels.has(normalized) || seenValues.has(valueKey)) continue;
    seenLabels.add(normalized);
    seenValues.add(valueKey);
    output.push([label, value]);
  }

  for (const [key, value] of Object.entries(answers)) {
    const normalized = normalizedKey(key);
    const valueKey = `${normalized}:${JSON.stringify(value)}`;
    if (!normalized || opaqueAnswerKey(key) || coreFields.has(normalized) || emptyAnswer(value) || (blind && participantAnswer(key)) || seenLabels.has(normalized) || seenValues.has(valueKey)) continue;
    seenLabels.add(normalized);
    seenValues.add(valueKey);
    output.push([key, value]);
  }
  return output.slice(0, 10);
}

function criterionKind(criterion) {
  const text = `${criterion?.id || ""} ${criterion?.label || ""} ${criterion?.type || ""}`.toLowerCase();
  if (/comment|long.?text|feedback/.test(text)) return "comments";
  if (/recommend|accept|approve|maybe|reject|decline|deny/.test(text)) return "recommendation";
  return "numeric";
}

export function EvaluationScreen({ onNavigate }) {
  const { data, update, session, persistenceStatus } = useAppStore();
  const reviewerMode = session?.role === "reviewer";
  const reviewerOptions = reviewerMode ? [{ id: session.userId, name: session.name || session.email }] : (persistenceStatus === "d1" ? (data.reviewers ?? []) : reviewers);
  useEffect(() => {
    if (reviewerMode || persistenceStatus !== "d1") return undefined;
    let cancelled = false;
    fetch("/api/reviewers", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : { items: [] }))
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.items)) {
          update((state) => ({ ...state, reviewers: payload.items }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [persistenceStatus, reviewerMode, update]);
  const rounds = data.evaluationRounds?.length
    ? data.evaluationRounds
    : reviewerMode || persistenceStatus === "d1"
      ? []
      : defaultRounds(data.abstracts ?? []);
  const [roundId, setRoundId] = useState(rounds[0]?.id);
  const [tab, setTab] = useState("assignments");
  const [abstractId, setAbstractId] = useState(rounds[0]?.assignments?.[0]?.abstractId ?? data.abstracts?.[0]?.id);
  const [reviewerId, setReviewerId] = useState(rounds[0]?.assignments?.[0]?.reviewerId ?? reviewers[0].id);
  const [scores, setScores] = useState({});
  const [comments, setComments] = useState("");
  const [recommendation, setRecommendation] = useState("Approve");
  const [ai, setAi] = useState(null);
  const [configure, setConfigure] = useState(false);
  const [roundDraft, setRoundDraft] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState({ abstractId: "", reviewerId: "" });
  const [saveMessage, setSaveMessage] = useState("");
  const [decidingId, setDecidingId] = useState(null);
  const [decisionNotice, setDecisionNotice] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const round = rounds.find((item) => item.id === roundId) ?? rounds[0] ?? {
    id: "",
    name: "No assigned reviews",
    number: 0,
    status: "Open",
    blind: true,
    criteria: [],
    assignments: [],
  };
  const abstracts = data.abstracts ?? [];
  const reviews = data.reviews ?? [];
  const assignments = round?.assignments ?? [];
  const selected = abstracts.find((item) => item.id === abstractId) ?? abstracts[0];
  const existing = reviews.find((review) => review.roundId === round?.id && review.abstractId === selected?.id && review.reviewerId === reviewerId);
  const selectedForm = (data.forms ?? []).find((form) => form.id === selected?.formId);
  const numericCriteria = round.criteria.filter((criterion) => criterionKind(criterion) === "numeric");
  const ignoredCriteria = round.criteria.filter((criterion) => criterionKind(criterion) !== "numeric");
  const nextRound = rounds.find((candidate) => candidate.number === round.number + 1);
  const currentScores = Object.keys(scores).length ? scores : existing?.scores ?? {};
  const completion = assignments.filter((assignment) => reviews.some((review) => review.roundId === round.id && review.abstractId === assignment.abstractId && review.reviewerId === assignment.reviewerId && review.final)).length;
  const persistRounds = (next) => update((state) => ({ ...state, evaluationRounds: next }));
  const signOut = async () => {
    setSigningOut(true);
    await logoutSharedSession();
    window.location.hash = "/organizer-login";
    window.location.reload();
  };
  const patchRound = async (patch) => {
    if (persistenceStatus === "d1") {
      const result = await patchSharedResource("evaluation-rounds", round.id, round.version, patch);
      if (!result.ok) { setSaveMessage(result.error === "VERSION_CONFLICT" ? "This round changed elsewhere. Reload before saving." : "The round could not be saved."); return false; }
      persistRounds(rounds.map((item) => item.id === round.id ? { ...item, ...result.item, status: String(result.item.status || "Upcoming").replace(/^./, (value) => value.toUpperCase()), blind: Boolean(result.item.blind), assignments: item.assignments } : item));
      setSaveMessage("Round settings saved to the shared workspace.");
      return true;
    }
    persistRounds(rounds.map((item) => item.id === round.id ? { ...item, ...patch } : item));
    return true;
  };
  const openConfigure = () => { setRoundDraft({ ...round, criteria: round.criteria.map((criterion) => ({ ...criterion })) }); setConfigure(true); };
  const openReview = (assignment) => {
    const assignedReview = reviews.find((review) => review.roundId === round.id && review.abstractId === assignment.abstractId && review.reviewerId === assignment.reviewerId);
    const savedRecommendation = String(assignedReview?.recommendation || "").toLowerCase();
    setAbstractId(assignment.abstractId);
    setReviewerId(assignment.reviewerId);
    setScores({});
    setComments(assignedReview?.comments || "");
    setRecommendation(savedRecommendation === "deny" || savedRecommendation === "decline" ? "Deny" : savedRecommendation === "maybe" || savedRecommendation === "hold" ? "Maybe" : "Approve");
    setAi(null);
    setTab("review");
  };
  const saveReview = async (final = false) => {
    if (!selected) return;
    const cleanedScores = Object.fromEntries(numericCriteria.filter((criterion) => currentScores[criterion.id] !== undefined).map((criterion) => [criterion.id, currentScores[criterion.id]]));
    const review = { id: existing?.id ?? `review-${Date.now()}`, roundId: round.id, abstractId: selected.id, reviewerId, scores: cleanedScores, comments, recommendation, total: weightedScore(numericCriteria, cleanedScores), final, updated: new Date().toLocaleString() };
    if (reviewerMode && persistenceStatus === "d1") {
      if (!existing?.id || !existing.version) { setSaveMessage("This review assignment is not ready. Reload and try again."); return; }
      const result = await patchSharedResource("reviews", existing.id, existing.version, { scores: cleanedScores, totalScore: review.total, recommendation: recommendation.toLowerCase(), notes: comments, status: final ? "submitted" : "draft" });
      if (!result.ok) { setSaveMessage(result.error === "VERSION_CONFLICT" ? "This review changed elsewhere. Reload before saving again." : "The review could not be saved."); return; }
      review.id = result.item.id;
      review.version = result.item.version;
      review.final = String(result.item.status).toLowerCase() === "submitted";
      review.updated = result.item.updatedAt;
    }
    update((state) => ({ ...state, reviews: existing ? (state.reviews ?? []).map((item) => item.id === existing.id ? review : item) : [...(state.reviews ?? []), review] }));
    setSaveMessage(final ? "Review submitted to the shared workspace." : "Draft saved to the shared workspace.");
  };
  const addRound = async () => {
    const number = rounds.length + 1;
    let created = { id: `round-${Date.now()}`, name: `Round ${number} · Review`, number, status: "Upcoming", blind: false, criteria: defaultCriteria().map((criterion) => ({ ...criterion, id: `${number}-${criterion.id}` })), assignments: [] };
    if (persistenceStatus === "d1") {
      const result = await createSharedResource("evaluation-rounds", { name: created.name, number, status: "upcoming", blind: 0, criteria: created.criteria });
      if (!result.ok) { setSaveMessage("The next review round could not be created."); return; }
      created = { ...created, ...result.item, status: "Upcoming", blind: Boolean(result.item.blind), assignments: [] };
      setSaveMessage("A new shared review round was created.");
    }
    persistRounds([...rounds, created]); setRoundId(created.id);
  };
  const openAssignment = () => {
    setAssignmentDraft({ abstractId: abstracts.find((item) => !assignments.some((assignment) => assignment.abstractId === item.id))?.id || abstracts[0]?.id || "", reviewerId: reviewerOptions[0]?.id || "" });
    setAssignOpen(true);
  };
  const createAssignment = async () => {
    if (!assignmentDraft.abstractId || !assignmentDraft.reviewerId) { setSaveMessage("Choose a submission and reviewer."); return; }
    let review = { id: `review-${Date.now()}`, roundId: round.id, abstractId: assignmentDraft.abstractId, reviewerId: assignmentDraft.reviewerId, scores: {}, comments: "", recommendation: "Approve", total: 0, final: false, status: "assigned", version: 1 };
    if (persistenceStatus === "d1") {
      const result = await createSharedResource("reviews", { submissionId: assignmentDraft.abstractId, reviewerUserId: assignmentDraft.reviewerId, roundId: round.id, round: round.number, scores: {}, status: "assigned" });
      if (!result.ok) { setSaveMessage(result.error === "RESOURCE_CONFLICT" ? "This reviewer is already assigned in this round." : "The assignment could not be saved."); return; }
      review = { ...review, id: result.item.id, roundId: result.item.roundId, abstractId: result.item.submissionId, reviewerId: result.item.reviewerUserId, version: result.item.version, status: result.item.status };
    }
    update((state) => ({ ...state, reviews: [...(state.reviews ?? []), review], evaluationRounds: (state.evaluationRounds ?? rounds).map((item) => item.id === round.id ? { ...item, assignments: [...item.assignments, { id: `assignment-${review.id}`, reviewId: review.id, abstractId: review.abstractId, reviewerId: review.reviewerId, status: "Assigned", version: review.version }] } : item) }));
    setAssignOpen(false);
    setSaveMessage("Reviewer assignment saved to the shared workspace.");
  };
  const reassignReviewer = async (assignment, nextReviewerId) => {
    const assignedReview = reviews.find((review) => review.id === assignment.reviewId) || reviews.find((review) => review.roundId === round.id && review.abstractId === assignment.abstractId && review.reviewerId === assignment.reviewerId);
    if (!nextReviewerId) {
      if (persistenceStatus === "d1") {
        if (!assignedReview?.id || !assignedReview.version) { setSaveMessage("Reload before removing this assignment."); return; }
        const removed = await deleteSharedResource("reviews", assignedReview.id, assignedReview.version);
        if (!removed.ok) { setSaveMessage(removed.error === "VERSION_CONFLICT" ? "This assignment changed elsewhere. Reload before removing it." : "The assignment could not be removed."); return; }
      }
      update((state) => ({
        ...state,
        reviews: (state.reviews ?? []).filter((item) => item.id !== assignedReview?.id),
        evaluationRounds: (state.evaluationRounds ?? rounds).map((item) => item.id === round.id ? { ...item, assignments: item.assignments.filter((entry) => entry.id !== assignment.id) } : item),
      }));
      setSaveMessage("Reviewer assignment removed.");
      return;
    }
    let version = assignedReview?.version;
    if (persistenceStatus === "d1") {
      if (!assignedReview?.id || !version) { setSaveMessage("Reload before changing this assignment."); return; }
      const result = await patchSharedResource("reviews", assignedReview.id, version, { reviewerUserId: nextReviewerId, scores: {}, totalScore: 0, recommendation: "", notes: "", status: "assigned" });
      if (!result.ok) { setSaveMessage(result.error === "VERSION_CONFLICT" ? "This assignment changed elsewhere. Reload before saving." : "The reviewer could not be changed."); return; }
      version = result.item.version;
    }
    update((state) => ({ ...state,
      reviews: (state.reviews ?? []).map((item) => item.id === assignedReview?.id ? { ...item, reviewerId: nextReviewerId, scores: {}, total: 0, recommendation: "", comments: "", final: false, status: "assigned", version } : item),
      evaluationRounds: (state.evaluationRounds ?? rounds).map((item) => item.id === round.id ? { ...item, assignments: item.assignments.map((entry) => entry.id === assignment.id ? { ...entry, reviewerId: nextReviewerId, version } : entry) } : item),
    }));
    setSaveMessage("Reviewer assignment updated.");
  };
  const decide = async (abstract, decision) => {
    if (!abstract || decidingId) return;
    setDecidingId(abstract.id);
    setDecisionNotice(null);
    const status = decision === "Advance" ? "Pending" : decision;
    let sharedSession;
    let sharedVersion = abstract.version;
    let sharedDecision;
    let sharedOnboarding;
    if (persistenceStatus === "d1" && !reviewerMode) {
      const result = await decideSharedSubmission(abstract.id, abstract.version, decision, { roundId: round.id, reviewerUserId: decision === "Advance" ? reviewerOptions[0]?.id : undefined });
      if (!result.ok) { setSaveMessage(result.error === "VERSION_CONFLICT" ? "This submission changed elsewhere. Reload before deciding." : "The shared decision could not be saved."); setDecidingId(null); return; }
      sharedSession = result.session;
      sharedVersion = result.item.version;
      sharedDecision = result.decision;
      sharedOnboarding = result.onboarding;
    }
    const onboardingTaskIds = new Set(sharedOnboarding?.taskIds || []);
    const onboardingTasks = (sharedOnboarding?.tasks || []).map((task) => ({ id: task.id, title: task.title, personId: task.assigneePersonId, scope: task.kind === "submission" ? "Submission" : "Contact", mode: "Automatic", notes: task.instructions || "", due: task.dueAt || "", complete: ["complete", "completed", "done"].includes(String(task.status).toLowerCase()), version: task.version }));
    const onboardingResource = sharedOnboarding?.resource ? { id: sharedOnboarding.resource.id, title: sharedOnboarding.resource.title, kind: sharedOnboarding.resource.kind, description: sharedOnboarding.resource.content || sharedOnboarding.resource.url || "", content: sharedOnboarding.resource.content || "", url: sharedOnboarding.resource.url || "", audience: sharedOnboarding.resource.audience, version: sharedOnboarding.resource.version } : null;
    update((state) => ({ ...state,
      abstracts: (state.abstracts ?? []).map((item) => item.id === abstract.id ? { ...item, status, version: sharedVersion, reviewRound: decision === "Advance" ? round.number + 1 : round.number, decision } : item),
      sessions: decision === "Accepted"
        ? (state.sessions ?? []).some((session) => session.sourceAbstractId === abstract.id)
          ? state.sessions.map((session) => session.sourceAbstractId === abstract.id ? { ...session, id: sharedSession?.id || session.id, title: abstract.title, description: abstract.description, track: abstract.track, participants: sharedSession?.participantIds ?? abstract.participantIds ?? session.participants ?? [], status: "Accepted", version: sharedSession?.version || session.version } : session)
          : [...(state.sessions ?? []), { id: sharedSession?.id || `session-${Date.now()}`, sourceAbstractId: abstract.id, title: abstract.title, description: abstract.description, status: "Accepted", track: abstract.track, participants: sharedSession?.participantIds ?? abstract.participantIds ?? [], startsAt: sharedSession?.startsAt || "", endsAt: sharedSession?.endsAt || "", room: sharedSession?.room || "", version: sharedSession?.version }]
        : ["Declined", "Waitlisted"].includes(decision)
          ? (state.sessions ?? []).filter((session) => session.sourceAbstractId !== abstract.id)
          : (state.sessions ?? []),
      evaluationDecisions: [...(state.evaluationDecisions ?? []), sharedDecision ? { ...sharedDecision, abstractId: sharedDecision.submissionId } : { id: `decision-${Date.now()}`, roundId: round.id, abstractId: abstract.id, decision, created: new Date().toLocaleString() }],
      evaluationRounds: decision === "Advance" && rounds[round.number] ? rounds.map((item, index) => index === round.number && !item.assignments.some((assignment) => assignment.abstractId === abstract.id) ? { ...item, assignments: [...item.assignments, { id: `assignment-${item.id}-${abstract.id}`, abstractId: abstract.id, reviewerId: reviewerOptions[0]?.id, status: "Assigned" }] } : item) : (state.evaluationRounds ?? rounds),
      tasks: [...(state.tasks || []).filter((task) => !onboardingTaskIds.has(task.id)), ...onboardingTasks],
      resources: onboardingResource ? [...(state.resources || []).filter((resource) => resource.id !== onboardingResource.id), onboardingResource] : (state.resources || []),
    }));
    const taskCount = sharedOnboarding?.tasks?.length ?? (decision === "Accepted" ? 4 : 0);
    setDecisionNotice({
      title: decision === "Accepted" ? `${abstract.title} was accepted` : decision === "Advance" ? `${abstract.title} moved to ${nextRound?.name || "the next round"}` : `${abstract.title} marked ${status}`,
      detail: decision === "Accepted" ? `The program session was created and ${taskCount} onboarding task${taskCount === 1 ? "" : "s"} were assigned.` : "The decision is saved in the shared workspace.",
    });
    setDecidingId(null);
  };
  const saveRoundConfiguration = async () => {
    const saved = await patchRound({ name: roundDraft.name, status: String(roundDraft.status || "upcoming").toLowerCase(), blind: roundDraft.blind ? 1 : 0, criteria: roundDraft.criteria });
    if (saved) setConfigure(false);
  };
  const aggregate = (abstract) => {
    const relevant = reviews.filter((review) => review.roundId === round.id && review.abstractId === abstract.id && review.final);
    return relevant.length ? Math.round((relevant.reduce((sum, review) => sum + review.total, 0) / relevant.length) * 100) / 100 : null;
  };
  const roundTotals = (abstract) => rounds.map((candidate) => {
    const relevant = reviews.filter((review) => review.roundId === candidate.id && review.abstractId === abstract.id && review.final);
    const score = relevant.length ? Math.round((relevant.reduce((sum, review) => sum + review.total, 0) / relevant.length) * 100) / 100 : null;
    return `R${candidate.number}: ${score ?? "—"}`;
  }).join(" · ");

  return <div className="eval-screen"><style>{EVALUATION_STYLES}{EVALUATION_AUX_STYLES}</style><header className="eval-header"><div className="eval-heading"><span className="eval-icon"><ClipboardCheck size={25} /></span><div><h1>Evaluation</h1><p>{reviewerMode ? "Review only the submissions assigned to you." : "Assign reviewers, score submissions, and advance the strongest program."}</p></div></div>{reviewerMode ? <Button icon={LogOut} disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</Button> : <Button variant="primary" icon={Plus} onClick={addRound}>Add Round</Button>}</header><div className="eval-layout"><aside className="eval-rail"><div className="eval-rail-label">Review rounds</div>{rounds.map((item) => { const complete = item.assignments.filter((assignment) => reviews.some((review) => review.roundId === item.id && review.abstractId === assignment.abstractId && review.reviewerId === assignment.reviewerId && review.final)).length; return <button className={`round-button ${item.id === round.id ? "active" : ""}`} key={item.id} onClick={() => { setRoundId(item.id); setTab("assignments"); }}><span className="round-number">{item.number}</span><span><b>{item.name}</b><small>{complete} of {item.assignments.length} complete · {item.status}</small></span></button>; })}</aside><main className="eval-main"><div className="eval-toolbar"><Tabs value={tab} onChange={setTab} items={[{ label: "Assignments", value: "assignments" }, { label: "Review workspace", value: "review" }, ...(!reviewerMode ? [{ label: "Decisions", value: "decisions" }] : [])]} />{!reviewerMode ? <Button icon={Settings} onClick={openConfigure}>Configure round</Button> : null}</div><div className="eval-summary"><div className="eval-stat"><span>Submissions</span><b>{assignments.length}</b></div><div className="eval-stat"><span>Completed</span><b>{completion}</b></div><div className="eval-stat"><span>Reviewers</span><b>{new Set(assignments.map((item) => item.reviewerId)).size}</b></div><div className="eval-stat"><span>Blind review</span><b>{round.blind ? "On" : "Off"}</b></div></div>{saveMessage ? <div className="ai-box"><p>{saveMessage}</p></div> : null}
    {tab === "assignments" ? <section className="eval-card"><header><h2>{round.name} assignments</h2><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Pill tone={round.status === "Open" ? "success" : "neutral"}>{round.status}</Pill>{!reviewerMode ? <Button icon={Plus} onClick={openAssignment}>Add assignment</Button> : null}</div></header><table className="eval-table"><thead><tr><th>Submission</th><th>Reviewer</th><th>Status</th><th /></tr></thead><tbody>{assignments.map((assignment) => { const abstract = abstracts.find((item) => item.id === assignment.abstractId); const done = reviews.some((review) => review.roundId === round.id && review.abstractId === assignment.abstractId && review.reviewerId === assignment.reviewerId && review.final); return <tr key={assignment.id}><td className="eval-title-cell"><b>{abstract?.title ?? "Missing submission"}</b><span>{abstract?.track ?? "Unassigned"} · {abstract?.reviewRoute ?? "Default route"}</span></td><td>{reviewerMode ? <span>{reviewerOptions.find((reviewer) => reviewer.id === assignment.reviewerId)?.name || session?.email}</span> : <select className="reviewer-select" aria-label={`Reviewer for ${abstract?.title ?? "submission"}`} value={assignment.reviewerId} onChange={(event) => reassignReviewer(assignment, event.target.value)}><option value="">Unassigned</option>{reviewerOptions.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>)}</select>}</td><td><Pill tone={done ? "success" : "warning"}>{done ? "Complete" : "Assigned"}</Pill></td><td><Button onClick={() => openReview(assignment)}>Review <ChevronRight size={15} /></Button></td></tr>; })}</tbody></table></section> : null}
    {tab === "review" ? selected ? <div className="review-layout"><section className="submission-pane"><header><h2>{round.blind ? "Blind submission" : "Submission details"}</h2></header><div className="submission-body"><h3>{selected.title}</h3><div className="meta"><Pill>{selected.track}</Pill><Pill>{selected.tags?.[0]}</Pill>{round.blind ? <Pill><EyeOff size={12} /> Speaker hidden</Pill> : null}</div><div className="abstract-copy">{selected.description}</div>{selected.answers ? <dl className="answer-grid">{visibleSubmissionAnswers(selected.answers, selectedForm?.abstractFields || [], round.blind).map(([key, value]) => <div key={key} style={{ display: "contents" }}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : value}</dd></div>)}</dl> : null}</div></section><section className="score-pane"><header><h2>Scorecard</h2></header><div className="score-body">{numericCriteria.map((criterion) => <div className="criterion-row" key={criterion.id}><header><b>{criterion.label}</b><small>{criterion.weight}% weight</small></header><div className="score-buttons">{[1,2,3,4,5].map((value) => <button className={Number(currentScores[criterion.id]) === value ? "active" : ""} key={value} onClick={() => setScores({ ...currentScores, [criterion.id]: value })}>{value}</button>)}</div></div>)}{ignoredCriteria.length ? <div className="criterion-note">Recommendation and written feedback are collected below instead of being scored numerically.</div> : null}<div className="review-total"><span>Weighted score</span><b>{weightedScore(numericCriteria, currentScores)} / 5</b></div><span className="review-section-label">Recommendation</span><p className="review-helper">Choose the outcome you recommend to the program committee.</p><div className="recommendation">{["Approve", "Maybe", "Deny"].map((value) => <button className={recommendation === value ? "active" : ""} key={value} onClick={() => setRecommendation(value)}>{value}</button>)}</div><label className="review-comments">Reviewer comments<textarea placeholder="Explain your recommendation or ask the organizer to request changes." value={comments} onChange={(event) => setComments(event.target.value)} /></label>{ai ? <div className="ai-box"><header><Bot size={20} /><h4>{ai.label}</h4><span className="ai-label">No external API</span></header><p>{ai.summary}</p><div className="ai-scores">{numericCriteria.map((criterion) => <Pill key={criterion.id}>{criterion.label}: {ai.scores[criterion.id]}</Pill>)}</div><p>{ai.disclaimer}</p><Button icon={Sparkles} onClick={() => setScores(ai.scores)}>Use suggested scores as draft</Button></div> : <Button icon={Bot} onClick={() => setAi(localAiSuggestion(selected, numericCriteria))}>Generate local AI-assist suggestion</Button>}<div className="review-actions"><Button onClick={() => saveReview(false)}>Save draft</Button><Button variant="primary" icon={Check} onClick={() => saveReview(true)}>Submit review</Button></div></div></section></div> : <div className="eval-card"><header><h2>No submission selected</h2></header></div> : null}
    {tab === "decisions" ? <>{decisionNotice ? <div className="decision-success" role="status"><Check size={19} /><div><b>{decisionNotice.title}</b><span>{decisionNotice.detail}</span></div></div> : null}<section className="eval-card"><header><div><h2>Program decisions</h2><p className="decision-guidance">Accept adds the talk to the program and creates speaker onboarding. Maybe keeps it under consideration. {nextRound ? `Send to ${nextRound.name} only when another review is required.` : "This is the final configured review round."}</p></div><span>{round.name}</span></header><div className="decision-list">{[...new Set(assignments.map((assignment) => assignment.abstractId))].map((id) => { const abstract = abstracts.find((item) => item.id === id); const score = aggregate(abstract); const decided = ["Accepted", "Declined", "Waitlisted"].includes(abstract?.status); const busy = decidingId === id; const statusLabel = abstract?.status === "Waitlisted" ? "Maybe" : abstract?.status; return <div className={`decision-row ${String(abstract?.status || "").toLowerCase()}`} key={id}><div><h3>{abstract?.title}</h3><p>{score ? `Average score ${score} / 5` : "Awaiting completed reviews"} · {roundTotals(abstract)}</p></div><div className="decision-status"><Pill tone={abstract?.status === "Accepted" ? "success" : decided ? "neutral" : score >= 4 ? "success" : score ? "warning" : "neutral"}>{decided ? statusLabel : score ?? "—"}</Pill></div><div className="decision-actions"><button className="accept" disabled={busy || abstract?.status === "Accepted"} onClick={() => decide(abstract, "Accepted")}>{busy ? "Saving…" : abstract?.status === "Accepted" ? "Accepted" : "Accept"}</button><button disabled={busy || abstract?.status === "Waitlisted"} onClick={() => decide(abstract, "Waitlisted")}>Maybe</button><button disabled={busy || abstract?.status === "Declined"} onClick={() => decide(abstract, "Declined")}>Deny</button>{nextRound && !decided ? <button title={`Assign this submission to ${nextRound.name}`} disabled={busy} onClick={() => decide(abstract, "Advance")}>Send to next round <ArrowRight size={12} /></button> : null}</div></div>; })}</div></section></> : null}
  </main></div><Modal open={configure} title="Configure review round" subtitle="Each round owns its criteria, weights, assignments, and blind-review setting." onClose={() => setConfigure(false)}>{roundDraft ? <><div className="criteria-editor"><div className="round-settings-grid"><Field label="Round name"><input value={roundDraft.name} onChange={(event) => setRoundDraft({ ...roundDraft, name: event.target.value })} /></Field><Field label="Status"><select value={roundDraft.status} onChange={(event) => setRoundDraft({ ...roundDraft, status: event.target.value })}><option>Upcoming</option><option>Open</option><option>Closed</option></select></Field></div><Toggle checked={roundDraft.blind} onChange={(blind) => setRoundDraft({ ...roundDraft, blind })} label="Hide participant identity from reviewers" /><h3>Scoring criteria</h3>{roundDraft.criteria.map((criterion) => <div className="criteria-row" key={criterion.id}><Field label="Criterion"><input value={criterion.label} onChange={(event) => setRoundDraft({ ...roundDraft, criteria: roundDraft.criteria.map((item) => item.id === criterion.id ? { ...item, label: event.target.value } : item) })} /></Field><Field label="Weight %"><input type="number" min="0" max="100" value={criterion.weight} onChange={(event) => setRoundDraft({ ...roundDraft, criteria: roundDraft.criteria.map((item) => item.id === criterion.id ? { ...item, weight: Number(event.target.value) } : item) })} /></Field><button className="plain-icon-button" aria-label={`Remove ${criterion.label}`} onClick={() => setRoundDraft({ ...roundDraft, criteria: roundDraft.criteria.filter((item) => item.id !== criterion.id) })}><Trash2 size={16} /></button></div>)}<Button icon={Plus} onClick={() => setRoundDraft({ ...roundDraft, criteria: [...roundDraft.criteria, { id: `criterion-${Date.now()}`, label: "New criterion", weight: 0 }] })}>Add criterion</Button>{(() => { const total = roundDraft.criteria.reduce((sum, item) => sum + Number(item.weight), 0); return <div className={`criteria-total ${total !== 100 ? "invalid" : ""}`}>Total weight: {total}% {total === 100 ? "" : "· must equal 100%"}</div>; })()}</div><div className="modal-actions"><Button onClick={() => setConfigure(false)}>Cancel</Button><Button variant="primary" disabled={roundDraft.criteria.reduce((sum, item) => sum + Number(item.weight), 0) !== 100} onClick={saveRoundConfiguration}>Save round</Button></div></> : null}</Modal><Modal open={assignOpen} title="Add reviewer assignment" subtitle={`${round?.name || "Review round"} keeps its own reviewer workload and scorecard.`} onClose={() => setAssignOpen(false)}><div className="criteria-editor"><div className="round-settings-grid"><Field label="Submission"><select value={assignmentDraft.abstractId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, abstractId: event.target.value })}>{abstracts.map((abstract) => <option value={abstract.id} key={abstract.id}>{abstract.title}</option>)}</select></Field><Field label="Reviewer"><select value={assignmentDraft.reviewerId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, reviewerId: event.target.value })}>{reviewerOptions.map((reviewer) => <option value={reviewer.id} key={reviewer.id}>{reviewer.name || reviewer.email}</option>)}</select></Field></div>{!reviewerOptions.length ? <p className="criteria-total invalid">Create and redeem a reviewer access grant before assigning work.</p> : null}</div><div className="modal-actions"><Button onClick={() => setAssignOpen(false)}>Cancel</Button><Button variant="primary" disabled={!assignmentDraft.abstractId || !assignmentDraft.reviewerId} onClick={createAssignment}>Add assignment</Button></div></Modal></div>;
}
