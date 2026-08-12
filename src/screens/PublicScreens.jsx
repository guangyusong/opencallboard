import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Home,
  List,
  LogOut,
  Mail,
  Upload,
  UserCircle,
} from "lucide-react";
import { useAppStore } from "../store.jsx";
import { SpeakerOnboardingPanel } from "../components/SpeakerOnboarding.jsx";
import {
  abstractsForParticipant,
  participantForEmail,
  tasksForParticipant,
} from "../lib/domain.js";
import {
  answerKey,
  crossFieldUsage,
  isFormClosed,
  eventDateTime,
  normalizePublicForm,
  parsePublicFormRoute,
  publicFormPath,
  resolveRoutingRule,
  submissionLimitState,
  validateCrossFieldRules,
  validateFields,
  visibleFields,
} from "../lib/formEngine.js";
import {
  createIdempotencyKey,
  loadPublicDraft,
  loadPublicForm,
  logoutSharedSession,
  patchSharedResource,
  savePublicDraft,
  submitPortalFormResponse,
  submitPublicCfp,
  uploadSharedFile,
} from "../lib/sharedApi.js";

const CFP_STEPS = [
  ["Welcome!", ""],
  ["Account", "account"],
  ["Submission", "submission"],
  ["Participant", "participant"],
  ["Review", "review"],
];

const PUBLIC_STYLES = `
.cfp-root{min-height:100vh;background:#fbfbfb;padding:32px 20px 70px;color:#292a2f;font-family:Montserrat,"Proxima Nova",Arial,sans-serif}.cfp-card{width:min(1120px,100%);margin:0 auto;background:#fff;border:1px solid #e4e5e8;border-radius:10px;box-shadow:0 12px 25px rgba(22,29,38,.15);padding:58px 86px 46px}.cfp-steps{display:flex;align-items:center;gap:12px;margin-bottom:27px;white-space:nowrap}.cfp-step{display:flex;align-items:center;gap:9px;color:#6d7381;font-weight:600;font-size:16px}.cfp-step-dot{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#a4a6ae;color:#fff;font-size:12px;font-weight:700}.cfp-step.active{color:#4b55dd}.cfp-step.active .cfp-step-dot{background:#fff;color:#4b55dd;border:3px solid #4b55dd}.cfp-step.done .cfp-step-dot{background:#439f82}.cfp-arrow{color:#7a7e88}.cfp-notice{border:1px solid #dbdce0;border-radius:4px;text-align:center;padding:17px 20px;margin-bottom:34px;font-size:14px;font-weight:600;line-height:1.9}.cfp-card h1{margin:0 0 34px;font-size:34px;line-height:1.18;letter-spacing:-.025em}.cfp-card h2{margin:0 0 22px;font-size:22px}.cfp-rich{font-size:17px;line-height:1.62}.cfp-rich h3{margin:0 0 15px;font-size:18px}.cfp-rich p{margin:0 0 20px}.cfp-rich ul{margin:0 0 22px;padding-left:42px}.cfp-rich a{color:#2563dc;text-decoration:underline}.cfp-actions{display:flex;align-items:center;justify-content:space-between;margin-top:34px}.cfp-back{border:0;background:transparent;padding:12px 0;font-size:14px;cursor:pointer}.cfp-primary{min-height:45px;border:0;border-radius:24px;background:rgb(73 98 226);color:#fff;padding:0 25px;display:inline-flex;align-items:center;gap:10px;font-weight:500;cursor:pointer}.cfp-primary:disabled{opacity:.45;cursor:not-allowed}.cfp-panel{background:#f6f6f6;border-radius:9px;padding:27px 26px 20px}.cfp-field{display:grid;gap:10px;margin-bottom:20px;font-size:13px}.cfp-field em{color:#d94343;font-style:normal}.cfp-field input,.cfp-field select,.cfp-field textarea{width:100%;height:42px;border:1px solid #d8d9dd;border-radius:7px;background:#fff;padding:0 13px;outline:0}.cfp-field textarea{height:118px;padding-top:12px;resize:vertical}.cfp-field input:focus,.cfp-field select:focus,.cfp-field textarea:focus{border-color:#4b62e2;box-shadow:0 0 0 2px rgba(73,98,226,.12)}.cfp-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.cfp-review{display:grid;gap:14px}.cfp-review-card{border:1px solid #e2e3e7;border-radius:8px;padding:18px 20px}.cfp-review-card h3{margin:0 0 12px;font-size:15px}.cfp-review-card dl{display:grid;grid-template-columns:145px 1fr;gap:8px;margin:0;font-size:13px}.cfp-review-card dt{color:#767c88}.cfp-review-card dd{margin:0;font-weight:500}.cfp-success{text-align:center;padding:45px 20px}.cfp-success svg{color:#32a56c}.cfp-success h1{margin:18px 0 12px}.cfp-success p{color:#667085;line-height:1.6}.cfp-powered{text-align:center;color:#c2c4ca;font-size:10px;margin-top:38px}
.speaker-root{min-height:100vh;background:#fff;color:#3b3d43;font-family:Montserrat,"Proxima Nova",Arial,sans-serif}.speaker-top{height:72px;border-bottom:1px solid #e1e5eb;display:flex;justify-content:flex-end;align-items:center;padding:0 36px;position:relative}.speaker-account{border:0;background:transparent;display:flex;align-items:center;gap:10px;font-weight:600;cursor:pointer}.speaker-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#eef0f3;color:#566070;font-size:12px}.speaker-menu{position:absolute;z-index:20;right:35px;top:62px;width:290px;background:#fff;border:1px solid #dfe4ec;border-radius:10px;box-shadow:0 8px 24px rgba(17,24,39,.15);overflow:hidden}.speaker-menu-head{padding:16px 19px;border-bottom:1px solid #e7eaf0}.speaker-menu-head b,.speaker-menu-head span{display:block}.speaker-menu-head span{margin-top:5px;color:#8090a6;font-size:12px}.speaker-menu button{width:100%;height:55px;border:0;border-bottom:1px solid #e7eaf0;background:#fff;display:flex;align-items:center;gap:13px;padding:0 20px;text-align:left;cursor:pointer}.speaker-menu button:hover{background:#f7f8fa}.speaker-wrap{width:min(1650px,calc(100% - 40px));margin:0 auto;padding:0 0 60px}.speaker-title{text-align:center;font-size:36px;line-height:1;margin:0;padding:26px 0 27px;border-bottom:1px solid #e1e5eb}.speaker-tabs{display:flex;justify-content:center;gap:24px;padding:36px 0 46px;border-bottom:1px solid #e1e5eb;margin-bottom:48px}.speaker-tabs button{height:56px;border:1px solid #dfe3e9;border-radius:9px;background:#fff;padding:0 25px;display:flex;align-items:center;gap:10px;font-size:16px;color:#4b4e53;cursor:pointer}.speaker-tabs button.active{color:#4d68ed;border:2px solid #6078ef;background:#f5f7ff}.speaker-home-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px 48px}.speaker-card{border:1px solid #e1e5eb;border-radius:13px;background:#fff;overflow:hidden;box-shadow:0 2px 5px rgba(16,24,40,.06)}.speaker-card.full{grid-column:1/-1}.speaker-card-head{min-height:82px;background:#4564e9;color:#fff;padding:0 29px;display:flex;align-items:center;justify-content:space-between;font-size:18px}.speaker-card-head span{display:flex;align-items:center;gap:12px}.speaker-card-body{padding:25px}.speaker-card-head button{border:0;background:transparent;color:#fff;cursor:pointer}.speaker-submission{border:1px solid #dde1e8;border-radius:10px;padding:23px 25px;margin-bottom:18px}.speaker-submission:last-child{margin-bottom:0}.speaker-submission h3{margin:0 0 12px;font-size:18px}.speaker-submission p{margin:0 0 11px;color:#7c818a;font-size:14px}.speaker-status{display:flex;align-items:center;gap:7px;font-size:14px;color:#6d737c}.speaker-status.accepted svg{color:#35c970}.speaker-status.pending svg{color:#ff861b}.speaker-profile-summary{display:flex;align-items:center;gap:17px}.speaker-profile-summary .speaker-avatar{width:72px;height:72px;border-radius:11px;font-size:18px}.speaker-profile-summary b,.speaker-profile-summary span{display:block}.speaker-profile-summary span{margin-top:5px;color:#767b83}.speaker-link{display:inline-block;margin-top:19px;border:0;background:transparent;padding:0;color:#4564e9;font-weight:600;cursor:pointer}.speaker-task-tabs{display:flex;border-bottom:1px solid #e2e6ec;gap:3px}.speaker-task-tabs button{border:0;border-bottom:3px solid transparent;background:transparent;padding:9px 16px 18px;color:#686d75;cursor:pointer}.speaker-task-tabs button.active{color:#4564e9;border-bottom-color:#4564e9}.speaker-task-filter{margin-left:auto!important;display:flex;align-items:center;gap:7px}.speaker-task-group{margin-top:24px}.speaker-task-group-head{min-height:70px;border-radius:10px;background:#f7f7f7;padding:0 24px;display:flex;align-items:center;gap:10px}.speaker-task-group-head h3{margin:0;font-size:20px}.speaker-task-group-head .speaker-open-actions{margin-left:auto;display:flex;gap:13px;color:#4564e9;font-size:12px}.speaker-empty{padding:28px 0 12px;color:#777d86;font-size:14px}.speaker-task-row{display:flex;align-items:center;gap:13px;margin-top:12px;padding:17px 18px;border:1px solid #e3e6eb;border-radius:9px}.speaker-task-row button{margin-left:auto;border:1px solid #dce1e8;border-radius:7px;background:#fff;padding:8px 12px;cursor:pointer}.speaker-task-row.complete{opacity:.6}.speaker-task-row.complete b{text-decoration:line-through}.speaker-profile-page{display:grid;grid-template-columns:2.25fr 1fr;gap:34px}.speaker-identity{grid-column:1/-1;display:flex;align-items:center;gap:20px}.speaker-identity .speaker-avatar{width:108px;height:108px;font-size:26px}.speaker-profile-tab{grid-column:1/-1;width:max-content;border:0;border-radius:8px;background:#f6f7f9;box-shadow:0 2px 4px rgba(0,0,0,.09);padding:12px 17px}.speaker-profile-box{border:1px solid #dae2ec;border-radius:12px;background:#f9fbfd;padding:26px}.speaker-profile-box h3{margin:0 0 24px;display:flex;justify-content:space-between}.speaker-bio-editor{height:270px;border:1px solid #dbe1e8;border-radius:10px;background:#fff;overflow:hidden}.speaker-editor-bar{height:66px;border-bottom:1px solid #e4e8ee;display:flex;align-items:center;gap:22px;padding:0 24px;font-size:20px}.speaker-bio-editor textarea{width:100%;height:200px;border:0;outline:0;resize:none;padding:24px;background:transparent}.speaker-counter{margin:9px 0 27px;color:#7e8ca2;font-size:12px}.speaker-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.speaker-field{display:grid;gap:8px;font-size:13px}.speaker-field input,.speaker-field select{height:52px;border:1px solid #dbe2eb;border-radius:9px;background:#fff;padding:0 13px}.speaker-links{display:grid;gap:24px}.speaker-save{margin-top:28px;display:flex;justify-content:flex-end}.speaker-save button{height:44px;border:0;border-radius:9px;background:#4564e9;color:#fff;padding:0 24px;font-weight:600;cursor:pointer}.speaker-toast{position:fixed;right:25px;bottom:25px;background:#fff;border:1px solid #dfe4eb;border-radius:10px;box-shadow:0 10px 30px rgba(16,24,40,.15);padding:17px 20px;font-size:13px}
@media(max-width:900px){.cfp-card{padding:42px 42px}.cfp-steps{align-items:flex-start;flex-direction:column;gap:8px}.cfp-arrow{display:none}.speaker-home-grid,.speaker-profile-page{grid-template-columns:1fr}.speaker-card.full,.speaker-identity,.speaker-profile-tab{grid-column:auto}.speaker-form-grid{grid-template-columns:1fr 1fr}.speaker-tabs{gap:8px;overflow:auto;justify-content:flex-start;padding-inline:10px}.speaker-tabs button{padding:0 15px;white-space:nowrap}}
@media(max-width:600px){.cfp-root{padding:30px 15px 60px}.cfp-card{padding:39px 24px}.cfp-card h1{font-size:28px}.cfp-rich{font-size:15px}.cfp-grid{grid-template-columns:1fr}.cfp-actions{gap:18px}.cfp-notice{font-size:12px}.speaker-top{padding:0 16px}.speaker-wrap{width:calc(100% - 24px)}.speaker-title{font-size:28px}.speaker-tabs{padding-top:24px;padding-bottom:28px;margin-bottom:28px}.speaker-tabs button{height:48px;font-size:0;padding:0 15px}.speaker-tabs button svg{width:21px;height:21px}.speaker-home-grid{gap:20px}.speaker-card-head{min-height:62px;padding:0 18px}.speaker-card-body{padding:16px}.speaker-profile-page{gap:18px}.speaker-form-grid{grid-template-columns:1fr}.speaker-profile-box{padding:18px}.speaker-menu{right:12px;width:calc(100vw - 24px)}}
`;

const SPEAKER_FILE_STYLES = `
.speaker-file-grid{display:grid;gap:16px}.speaker-file-request{border:1px solid #dde3eb;border-radius:10px;padding:20px 22px}.speaker-file-request h3{margin:0 0 8px;font-size:17px}.speaker-file-request p{margin:0 0 14px;color:#6f7b8e;line-height:1.55}.speaker-file-meta{display:flex;align-items:center;gap:14px;color:#78859a;font-size:12px}.speaker-file-meta label{margin-left:auto;min-height:38px;border-radius:8px;background:#4564e9;color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;cursor:pointer}.speaker-file-meta label.disabled{opacity:.45;cursor:not-allowed}.speaker-file-picker{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.speaker-file-uploaded{margin-top:12px;padding:11px 13px;border-radius:8px;background:#f5f8fc;display:flex;align-items:center;gap:9px;font-size:13px}.speaker-file-uploaded a{margin-left:auto;color:#4564e9}.speaker-storage-note{border:1px solid #dce3ec;border-radius:9px;background:#fbfcfd;padding:15px 17px;margin-bottom:17px;color:#657286;font-size:13px}
.speaker-edit{margin-top:18px;border-top:1px solid #e3e7ed;padding-top:18px;display:grid;gap:12px}.speaker-edit label,.speaker-form-question{display:grid;gap:7px;color:#5f6c80;font-size:12px}.speaker-edit input,.speaker-edit textarea,.speaker-edit select,.speaker-form-question input,.speaker-form-question textarea,.speaker-form-question select{width:100%;border:1px solid #d9e0e9;border-radius:8px;background:#fff;padding:11px 12px;font:inherit;color:#283344}.speaker-edit textarea,.speaker-form-question textarea{min-height:110px;resize:vertical}.speaker-edit-actions{display:flex;justify-content:flex-end;gap:9px}.speaker-edit-actions button,.speaker-form-submit{min-height:39px;border:1px solid #d8dfe8;border-radius:8px;background:#fff;padding:0 15px;cursor:pointer}.speaker-edit-actions button:last-child,.speaker-form-submit{border-color:#4564e9;background:#4564e9;color:#fff}.speaker-form-list{display:grid;gap:18px}.speaker-form-card{border:1px solid #dde3eb;border-radius:10px;padding:22px}.speaker-form-card h3{margin:0 0 7px}.speaker-form-card>p{margin:0 0 18px;color:#6f7b8e;font-size:13px}.speaker-form-questions{display:grid;gap:15px}.speaker-form-complete{display:flex;align-items:center;gap:8px;color:#15825f;font-size:13px}.speaker-avatar-image{width:100%;height:100%;object-fit:cover;border-radius:inherit}
.speaker-top{height:54px;padding:0 24px}.speaker-wrap{width:min(1180px,calc(100% - 32px));padding-bottom:36px}.speaker-title{font-size:26px;padding:20px 0 16px;border-bottom:0;text-align:left}.speaker-tabs{position:sticky;top:0;z-index:10;justify-content:flex-start;gap:8px;padding:0 0 14px;margin-bottom:20px;background:#fff;border-bottom:1px solid #e1e5eb}.speaker-tabs button{height:40px;padding:0 14px;font-size:13px;border-radius:7px}.speaker-tabs button svg{width:17px;height:17px}.speaker-home-grid{gap:18px}.speaker-next-action{grid-column:1/-1;border:1px solid #d9e1ff;border-radius:11px;background:#f5f7ff;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:24px}.speaker-next-action h2{font-size:20px;margin:5px 0 6px}.speaker-next-action p{margin:0;color:#647188;font-size:13px}.speaker-next-action>button{border:0;border-radius:8px;background:#4564e9;color:#fff;min-height:40px;padding:0 17px;display:flex;align-items:center;gap:8px;white-space:nowrap}.speaker-kicker{text-transform:uppercase;letter-spacing:.08em;color:#4564e9;font-size:10px;font-weight:700}.speaker-card{border-radius:10px;box-shadow:none}.speaker-card-head{min-height:52px;padding:0 18px;font-size:14px}.speaker-card-head svg{width:18px;height:18px}.speaker-card-body{padding:16px}.speaker-submission{padding:14px 16px;margin-bottom:10px}.speaker-submission h3{font-size:14px;margin-bottom:7px}.speaker-submission p,.speaker-status{font-size:12px}.speaker-profile-summary .speaker-avatar{width:48px;height:48px;font-size:13px}.speaker-profile-summary{gap:12px}.speaker-profile-summary span{font-size:12px}.speaker-link{margin-top:12px;font-size:12px}.speaker-task-tabs button{padding:8px 12px 11px;font-size:12px}.speaker-task-group{margin-top:14px}.speaker-task-group-head{min-height:48px;padding:8px 14px;border-radius:8px}.speaker-task-group-head h3{font-size:14px;margin:0}.speaker-task-group-head span{display:block;margin-top:3px;color:#7d899c;font-size:10px}.speaker-task-row{margin-top:8px;padding:11px 13px}.speaker-task-row b{font-size:13px}.speaker-task-row div div{margin-top:3px;color:#748095;font-size:10px}.speaker-task-row button{font-size:11px}.speaker-profile-page{grid-template-columns:1.65fr 1fr;gap:16px}.speaker-identity{gap:14px}.speaker-identity .speaker-avatar{width:62px;height:62px;font-size:17px}.speaker-identity h2{margin:0 0 4px;font-size:20px}.speaker-identity span{font-size:12px}.speaker-profile-tab{padding:8px 12px;font-size:12px;box-shadow:none;border:1px solid #e2e6ec}.speaker-profile-requirements{grid-column:1/-1;display:flex;align-items:center;gap:8px;border:1px solid #dce4f2;border-radius:8px;padding:10px 12px;color:#627086;font-size:11px}.speaker-profile-requirements button{margin-left:auto;border:0;background:transparent;color:#4564e9;font-weight:600;cursor:pointer}.speaker-profile-box{border-radius:9px;padding:18px}.speaker-profile-box h3{margin-bottom:14px;font-size:14px}.speaker-bio-editor{height:190px}.speaker-editor-bar{height:42px;gap:15px;padding:0 15px;font-size:15px}.speaker-bio-editor textarea{height:146px;padding:14px;font-size:12px;line-height:1.5}.speaker-counter{margin:7px 0 14px}.speaker-form-grid{gap:12px}.speaker-field{gap:6px;font-size:11px}.speaker-field input,.speaker-field select{height:40px}.speaker-links{gap:12px}.speaker-save{margin-top:16px}.speaker-save button{height:40px}.speaker-files-page{display:grid;gap:18px}.speaker-files-page .onboarding-grid{grid-column:auto}.speaker-form-list{gap:12px}.speaker-form-card{padding:16px}.speaker-form-card.focused{border-color:#4564e9;box-shadow:0 0 0 3px rgba(69,100,233,.12)}.speaker-form-card>p{margin-bottom:13px}.speaker-form-response dl{margin:12px 0;display:grid;gap:8px}.speaker-form-response dl div{display:grid;grid-template-columns:minmax(130px,220px) 1fr;gap:12px;font-size:12px}.speaker-form-response dt{color:#718096}.speaker-form-response dd{margin:0;color:#2e3746}.speaker-secondary-action{border:1px solid #d8dfe8;border-radius:7px;background:#fff;padding:7px 11px;color:#4564e9;cursor:pointer}.speaker-file-request{padding:15px 17px}.speaker-file-request h3{font-size:14px}.speaker-file-request p{margin-bottom:10px}.speaker-file-uploaded span{display:flex;flex-direction:column}.speaker-file-uploaded small{margin-top:2px;color:#7b8799;font-size:10px}
@media(max-width:900px){.speaker-profile-requirements{grid-column:auto}.speaker-next-action{align-items:flex-start;flex-direction:column}.speaker-wrap{width:min(760px,calc(100% - 24px))}}
`;

function formatEventDeadline(value, timezone = "UTC") {
  if (!value) return "";
  const date = eventDateTime(value, timezone);
  if (!date) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(date);
}

function responseAnswer(answers = {}, question = {}) {
  const direct = answers[question.id] ?? answers[question.label];
  if (direct !== undefined && direct !== null && String(direct).trim()) return direct;
  const normalizedLabel = String(question.label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const matchingKey = Object.keys(answers).find(
    (key) =>
      String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ===
      normalizedLabel,
  );
  return matchingKey ? answers[matchingKey] : "";
}

function Stepper({ current }) {
  return (
    <div className="cfp-steps">
      {CFP_STEPS.map(([label], index) => (
        <div key={label} style={{ display: "contents" }}>
          <div
            className={`cfp-step ${index === current ? "active" : ""} ${index < current ? "done" : ""}`}
          >
            <span className="cfp-step-dot">
              {index < current ? (
                <Check size={12} strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </div>
          {index < CFP_STEPS.length - 1 ? (
            <ArrowRight className="cfp-arrow" size={15} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CfpField({ label, required, children }) {
  return (
    <label className="cfp-field">
      <span>
        {label}
        {required ? <em> *</em> : null}
      </span>
      {children}
    </label>
  );
}

function ReferenceWelcomeMessage() {
  return (
    <>
      <h3>Call for Speakers</h3>
      <p>
        Our event welcomes leaders, practitioners, and change-makers from around
        the world to collaborate and learn from the best. Sessions for the
        agenda will be selected from these submissions.
      </p>
      <p>
        Our conference will take place October 12–14, 2026 in New York City.
      </p>
      <p>Here are the different tracks we&apos;re offering:</p>
      <ul>
        <li>Agents</li>
        <li>Infrastructure</li>
        <li>Applied AI</li>
        <li>Responsible AI</li>
      </ul>
      <p>
        If you&apos;re interested in submitting a topic for us to consider,
        please use the following form. You can use the portal to keep up to date
        on the status of your submissions. If approved, you&apos;ll receive a
        list of tasks to complete within the portal.
      </p>
      <h3>Helpful Tips and Important Information</h3>
      <ul>
        <li>
          <a href="#terms">Speaker Agreement Terms and Conditions</a>
        </li>
        <li>
          <a href="#faq">FAQs for Speaker Application Process</a>
        </li>
        <li>
          <a href="#guide">Speaker Tips and Resources Guide</a>
        </li>
      </ul>
      <h3>Dates and Deadlines</h3>
      <ul>
        <li>Call for Speakers is open now.</li>
        <li>
          Presentation submissions are due{" "}
          <b>September 15, 2026 at 11:59 PM PDT.</b>
        </li>
        <li>
          <i>Late submissions will not be accepted after the deadline.</i>
        </li>
        <li>Our event takes place October 12–14, 2026.</li>
      </ul>
    </>
  );
}

function LegacyPublicCfpScreen({ route, onNavigate }) {
  const { data, update } = useAppStore();
  const slug = route.split("/")[2] || "";
  const current = Math.max(
    0,
    CFP_STEPS.findIndex(([, path], index) =>
      index === 0 ? !slug : path === slug,
    ),
  );
  const [email, setEmail] = useState(data.organizer.email);
  const [submission, setSubmission] = useState({
    title: "Building reliable AI systems",
    description:
      "A practical session about observability, evaluation, and dependable AI infrastructure.",
    format: "Featured Keynote",
    track: "Topic A",
  });
  const [participant, setParticipant] = useState({
    firstName: data.organizer.firstName,
    lastName: data.organizer.name.replace(`${data.organizer.firstName} `, ""),
    pronouns: "",
    bio: data.participants[0]?.bio ?? "",
  });
  const [submitted, setSubmitted] = useState(false);
  const go = (index) =>
    onNavigate(
      `/submit${CFP_STEPS[index][1] ? `/${CFP_STEPS[index][1]}` : ""}`,
    );
  const complete = () => {
    const id = `abs-${Date.now()}`;
    update((state) => ({
      ...state,
      abstracts: [
        ...state.abstracts,
        {
          id,
          source: "Call for Speakers",
          title: submission.title,
          description: submission.description,
          status: "Pending",
          track: submission.track,
          tags: [submission.format],
          submitted: new Date().toLocaleString(),
        },
      ],
      participants: state.participants.map((person, index) =>
        index === 0
          ? {
              ...person,
              name: `${participant.firstName} ${participant.lastName}`.trim(),
              email,
              bio: participant.bio,
            }
          : person,
      ),
    }));
    setSubmitted(true);
  };
  return (
    <div className="cfp-root">
      <style>{PUBLIC_STYLES}</style>
      <main className="cfp-card">
        <Stepper current={current} />
        <div className="cfp-notice">
          {current === 0 ? (
            <>
              <div>
                Form submissions will be accepted until September 15 at 11:59 PM
                PDT.
              </div>
            </>
          ) : null}
          <div>Submission Limit: 3 submissions per user</div>
        </div>
        {current === 0 ? (
          <>
            <h1>Welcome to our event!</h1>
            <div className="cfp-rich">
              <h3>Call for Speakers</h3>
              <p>
                Our event is the premiere event welcoming leaders,
                practitioners, and change-makers from all around the world to
                collaborate and learn from the best. Sessions for our agenda
                will be selected from these submissions.
              </p>
              <p>Our conference will take place on X date at Y time.</p>
              <p>Here are the different tracks we offering:</p>
              <ul>
                <li>Topic A</li>
                <li>Topic B</li>
                <li>Topic C</li>
                <li>Topic D</li>
              </ul>
              <p>
                If you&apos;re interested in submitting a topic for us to
                consider, please use the following form. You can use the portal
                to keep up to date on the status of your submissions. If
                approved, you&apos;ll receive a list of tasks to complete within
                the portal.
              </p>
              <h3>Helpful Tips and Important Information</h3>
              <ul>
                <li>
                  <a href="#terms">Speaker Agreement Terms and Conditions</a>
                </li>
                <li>
                  <a href="#faq">FAQs for Speaker Application Process</a>
                </li>
                <li>
                  <a href="#guide">Speaker Tips and Resources Guide</a>
                </li>
              </ul>
              <h3>Dates and Deadlines</h3>
              <ul>
                <li>
                  Call for Speakers will open <b>X Date.</b>
                </li>
                <li>
                  Presentation submissions are due by{" "}
                  <b>Y Date, by 11:59 PM EST</b>
                </li>
                <li>
                  <i>Late submissions will not be accepted, no exceptions.</i>
                </li>
                <li>Our event will take place the week of X Date.</li>
              </ul>
            </div>
            <div className="cfp-actions">
              <span />
              <button className="cfp-primary" onClick={() => go(1)}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : null}
        {current === 1 ? (
          <>
            <h2>Get started</h2>
            <div className="cfp-panel">
              <CfpField label="Your Email Address:" required>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </CfpField>
              <div className="cfp-actions" style={{ marginTop: 8 }}>
                <span />
                <button
                  className="cfp-primary"
                  disabled={!email.includes("@")}
                  onClick={() => go(2)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="cfp-actions">
              <button className="cfp-back" onClick={() => go(0)}>
                Back
              </button>
            </div>
          </>
        ) : null}
        {current === 2 ? (
          <>
            <h2>Tell us about your submission</h2>
            <div className="cfp-panel">
              <CfpField label="Session title" required>
                <input
                  value={submission.title}
                  onChange={(event) =>
                    setSubmission({ ...submission, title: event.target.value })
                  }
                />
              </CfpField>
              <CfpField label="Session description" required>
                <textarea
                  value={submission.description}
                  onChange={(event) =>
                    setSubmission({
                      ...submission,
                      description: event.target.value,
                    })
                  }
                />
              </CfpField>
              <div className="cfp-grid">
                <CfpField label="Format" required>
                  <select
                    value={submission.format}
                    onChange={(event) =>
                      setSubmission({
                        ...submission,
                        format: event.target.value,
                      })
                    }
                  >
                    <option>Featured Keynote</option>
                    <option>Keynote</option>
                    <option>Breakout Session</option>
                    <option>Panel</option>
                  </select>
                </CfpField>
                <CfpField label="Track" required>
                  <select
                    value={submission.track}
                    onChange={(event) =>
                      setSubmission({
                        ...submission,
                        track: event.target.value,
                      })
                    }
                  >
                    {["Topic A", "Topic B", "Topic C", "Topic D"].map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </CfpField>
              </div>
              <div className="cfp-actions">
                <button className="cfp-back" onClick={() => go(1)}>
                  Back
                </button>
                <button
                  className="cfp-primary"
                  disabled={!submission.title || !submission.description}
                  onClick={() => go(3)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
        {current === 3 ? (
          <>
            <h2>Participant information</h2>
            <div className="cfp-panel">
              <div className="cfp-grid">
                <CfpField label="First name" required>
                  <input
                    value={participant.firstName}
                    onChange={(event) =>
                      setParticipant({
                        ...participant,
                        firstName: event.target.value,
                      })
                    }
                  />
                </CfpField>
                <CfpField label="Last name" required>
                  <input
                    value={participant.lastName}
                    onChange={(event) =>
                      setParticipant({
                        ...participant,
                        lastName: event.target.value,
                      })
                    }
                  />
                </CfpField>
              </div>
              <CfpField label="Pronouns">
                <select
                  value={participant.pronouns}
                  onChange={(event) =>
                    setParticipant({
                      ...participant,
                      pronouns: event.target.value,
                    })
                  }
                >
                  <option value="">Select...</option>
                  <option>she/her</option>
                  <option>he/him</option>
                  <option>they/them</option>
                </select>
              </CfpField>
              <CfpField label="Biography">
                <textarea
                  value={participant.bio}
                  onChange={(event) =>
                    setParticipant({ ...participant, bio: event.target.value })
                  }
                />
              </CfpField>
              <div className="cfp-actions">
                <button className="cfp-back" onClick={() => go(2)}>
                  Back
                </button>
                <button
                  className="cfp-primary"
                  disabled={!participant.firstName || !participant.lastName}
                  onClick={() => go(4)}
                >
                  Review <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
        {current === 4 && !submitted ? (
          <>
            <h2>Review your application</h2>
            <div className="cfp-review">
              <section className="cfp-review-card">
                <h3>Submission</h3>
                <dl>
                  <dt>Title</dt>
                  <dd>{submission.title}</dd>
                  <dt>Format</dt>
                  <dd>{submission.format}</dd>
                  <dt>Track</dt>
                  <dd>{submission.track}</dd>
                  <dt>Description</dt>
                  <dd>{submission.description}</dd>
                </dl>
              </section>
              <section className="cfp-review-card">
                <h3>Participant</h3>
                <dl>
                  <dt>Name</dt>
                  <dd>
                    {participant.firstName} {participant.lastName}
                  </dd>
                  <dt>Email</dt>
                  <dd>{email}</dd>
                  <dt>Biography</dt>
                  <dd>{participant.bio || "—"}</dd>
                </dl>
              </section>
            </div>
            <div className="cfp-actions">
              <button className="cfp-back" onClick={() => go(3)}>
                Back
              </button>
              <button className="cfp-primary" onClick={complete}>
                Submit application <Check size={16} />
              </button>
            </div>
          </>
        ) : null}
        {current === 4 && submitted ? (
          <div className="cfp-success">
            <CheckCircle2 size={54} />
            <h1>Submission received</h1>
            <p>
              Your session is now pending review. You can follow its status and
              complete speaker tasks in your portal.
            </p>
            <button
              className="cfp-primary"
              onClick={() => onNavigate("/speaker-portal")}
            >
              Open speaker portal <ArrowRight size={16} />
            </button>
          </div>
        ) : null}
      </main>
      <div className="cfp-powered">Powered by Callboard</div>
    </div>
  );
}

const SCHEMA_CFP_STYLES = `
.cfp-errors{margin:0 0 20px;padding:14px 17px;border:1px solid #efb1b1;border-radius:7px;background:#fff2f2;color:#9e2c2c;font-size:13px}.cfp-errors b{display:block;margin-bottom:7px}.cfp-errors ul{margin:0;padding-left:19px}.cfp-field-error{color:#b42318;font-size:11px}.cfp-checkboxes{display:grid;gap:8px;padding:4px 0}.cfp-checkboxes label{display:flex;align-items:center;gap:9px}.cfp-checkboxes input{width:18px!important;height:18px!important}.cfp-rule-usage{margin:-4px 0 15px;padding:10px 12px;border-radius:6px;background:#eef1f7;color:#697386;font-size:11px}.cfp-rule-usage.over{background:#fff1f1;color:#aa2e2e}.cfp-closed{padding:26px;border:1px solid #e4b6b6;border-radius:9px;background:#fff7f7;text-align:center}.cfp-closed h2{margin-bottom:9px}.cfp-route{margin-top:13px;padding:11px 13px;border-radius:7px;background:#eef2ff;color:#4556bd;font-size:12px}.cfp-success-message{white-space:pre-line}.cfp-file-note{color:#7b8290;font-size:11px}.cfp-review-card dd{white-space:pre-wrap}.cfp-local-only{margin-top:16px;color:#8a909b;font-size:11px}.cfp-participant-card{margin-bottom:16px;border:1px solid #dfe3e9;border-radius:9px;background:#fff;padding:18px}.cfp-participant-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:15px}.cfp-participant-head h3{margin:0;font-size:14px}.cfp-participant-head button{border:0;background:transparent;color:#9f2f2f;font-size:12px;cursor:pointer}.cfp-add-participant{width:100%;height:45px;border:1px dashed #9aa9bd;border-radius:8px;background:#fff;color:#425674;font-weight:600;cursor:pointer}.cfp-participant-limit{margin:0 0 14px;color:#697386;font-size:12px}.cfp-draftbar{display:flex;align-items:center;gap:12px;margin:-16px 0 28px;padding:13px 15px;border:1px solid #dbe2ee;border-radius:8px;background:#f7f9fd;color:#536178;font-size:12px}.cfp-draftbar strong{color:#2e3746}.cfp-draftbar>span:first-child{margin-right:auto}.cfp-draftbar button{min-height:34px;border:1px solid #cfd7e5;border-radius:7px;background:#fff;color:#42516a;padding:0 12px;display:inline-flex;align-items:center;gap:7px;font-weight:600;cursor:pointer}.cfp-draftbar button:disabled{opacity:.5;cursor:not-allowed}.cfp-draftbar .new-draft{border-color:transparent;background:transparent;color:#4b62e2}@media(max-width:600px){.cfp-draftbar{align-items:stretch;flex-direction:column}.cfp-draftbar>span:first-child{margin-right:0}.cfp-draftbar button{justify-content:center}}
`;

function SchemaStepper({ steps, current }) {
  return (
    <div className="cfp-steps">
      {steps.map(([label], index) => (
        <div key={label} style={{ display: "contents" }}>
          <div
            className={`cfp-step ${index === current ? "active" : ""} ${index < current ? "done" : ""}`}
          >
            <span className="cfp-step-dot">
              {index < current ? (
                <Check size={12} strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
            {label}
          </div>
          {index < steps.length - 1 ? (
            <ArrowRight className="cfp-arrow" size={15} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function schemaInitialAnswers(form, data, email, session) {
  const person =
    session?.role === "speaker"
      ? data.participants?.find((entry) => entry.id === data.portalPersonId) ?? {}
      : {};
  const nameParts = String(person.name ?? "").trim().split(/\s+/).filter(Boolean);
  const defaults = {
    "First Name": nameParts[0] ?? "",
    "Last Name": nameParts.slice(1).join(" "),
    Email: email,
    "Professional Title": person.title ?? "",
    Company: person.company ?? "",
    Biography: person.bio ?? "",
  };
  return [...form.abstractFields, ...form.participantFields].reduce(
    (answers, field) => {
      const value =
        field.type === "Checkbox" ? [] : (defaults[field.label] ?? "");
      answers[answerKey(field)] = value;
      answers[field.label] = value;
      return answers;
    },
    {},
  );
}

const publicDraftStorageKey = (formId) =>
  `callboard-public-draft:${String(formId || "unknown")}`;

function readDeviceDraft(formId) {
  try {
    return window.localStorage.getItem(publicDraftStorageKey(formId)) || "";
  } catch {
    return "";
  }
}

function rememberDeviceDraft(formId, token) {
  try {
    if (token) window.localStorage.setItem(publicDraftStorageKey(formId), token);
    else window.localStorage.removeItem(publicDraftStorageKey(formId));
  } catch {
    // A private resume link still works when browser storage is unavailable.
  }
}

function blankParticipantAnswers(form) {
  return (form.participantFields ?? []).reduce((answers, field) => {
    const value = field.type === "Checkbox" ? [] : "";
    answers[answerKey(field)] = value;
    answers[field.label] = value;
    return answers;
  }, {});
}

function SchemaField({ field, answers, setAnswer, error }) {
  const key = answerKey(field);
  const value = answers[key] ?? "";
  let control;
  if (["Wysiwyg", "Textarea"].includes(field.type))
    control = (
      <textarea
        maxLength={field.max}
        value={value}
        onChange={(event) => setAnswer(field, event.target.value)}
      />
    );
  else if (field.type === "Dropdown")
    control = (
      <select
        value={value}
        onChange={(event) => setAnswer(field, event.target.value)}
      >
        <option value="">Select...</option>
        {(field.options ?? []).map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  else if (field.type === "Checkbox" && field.options?.length)
    control = (
      <div className="cfp-checkboxes">
        {field.options.map((option) => {
          const checked = Array.isArray(value) && value.includes(option);
          return (
            <label key={option}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setAnswer(
                    field,
                    checked
                      ? value.filter((item) => item !== option)
                      : [...(Array.isArray(value) ? value : []), option],
                  )
                }
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  else if (field.type === "File")
    control = (
      <>
        <input
          type="file"
          onChange={(event) =>
            setAnswer(field, event.target.files?.[0]?.name ?? "")
          }
        />
        {value ? (
          <span className="cfp-file-note">Selected: {value}</span>
        ) : null}
      </>
    );
  else
    control = (
      <input
        type={
          field.type === "Email"
            ? "email"
            : field.type === "Number"
              ? "number"
              : field.type === "Phone"
                ? "tel"
                : "text"
        }
        maxLength={field.max}
        value={value}
        onChange={(event) => setAnswer(field, event.target.value)}
      />
    );
  return (
    <CfpField label={field.label} required={field.required}>
      {control}
      {field.max ? (
        <span className="cfp-file-note">
          {String(value).length} / {field.max.toLocaleString()}
        </span>
      ) : null}
      {error ? <span className="cfp-field-error">{error}</span> : null}
    </CfpField>
  );
}

export function PublicCfpScreen({ route, onNavigate }) {
  const { data, update, session } = useAppStore();
  const parsed = parsePublicFormRoute(route, data.forms ?? []);
  const [remoteRawForm, setRemoteRawForm] = useState(null);
  const rawForm =
    remoteRawForm ??
    data.forms?.find((item) => item.id === parsed.formId) ??
    data.forms?.[0] ??
    {};
  const form = useMemo(() => normalizePublicForm(rawForm), [rawForm]);
  const referenceWelcome =
    rawForm.id === "form-2" &&
    rawForm.externalTitle === "Session Submission Form" &&
    !rawForm.welcomeMessage;
  const speakerEmail = session?.role === "speaker" ? session.email || "" : "";
  const [email, setEmail] = useState(speakerEmail);
  const [answers, setAnswers] = useState(() =>
    schemaInitialAnswers(form, data, speakerEmail, session),
  );
  const [additionalParticipants, setAdditionalParticipants] = useState([]);
  const [additionalErrors, setAdditionalErrors] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionMode, setSubmissionMode] = useState("local");
  const [portalReady, setPortalReady] = useState(false);
  const [redirectSeconds, setRedirectSeconds] = useState(10);
  const [draftToken, setDraftToken] = useState(parsed.draftToken || "");
  const [draftVersion, setDraftVersion] = useState(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [deviceDraftToken, setDeviceDraftToken] = useState(() =>
    parsed.draftToken ? "" : readDeviceDraft(parsed.formId),
  );
  const loadedDraft = useRef("");
  const idempotencyKey = useRef(createIdempotencyKey("cfp"));
  useEffect(() => {
    let cancelled = false;
    loadPublicForm(parsed.formId).then((result) => {
      if (!cancelled && result.available && result.form)
        setRemoteRawForm(result.form);
    });
    return () => {
      cancelled = true;
    };
  }, [parsed.formId]);
  useEffect(() => {
    setEmail(speakerEmail);
    setAnswers(schemaInitialAnswers(form, data, speakerEmail, session));
    setAdditionalParticipants([]);
    setAdditionalErrors([]);
    setErrors({});
    setSubmitted(false);
    setSubmitting(false);
    setSubmissionMode("local");
    setPortalReady(false);
    setDeviceDraftToken(
      parsed.draftToken ? "" : readDeviceDraft(form.id || parsed.formId),
    );
    idempotencyKey.current = createIdempotencyKey("cfp");
  }, [form.id, session?.role, session?.email]);
  useEffect(() => {
    const token = parsed.draftToken || "";
    setDraftToken(token);
    if (!token || !form.id || loadedDraft.current === `${form.id}:${token}`)
      return undefined;
    let cancelled = false;
    setDraftBusy(true);
    setDraftNotice("Loading saved draft…");
    loadPublicDraft(form.id, token).then((result) => {
      if (cancelled) return;
      setDraftBusy(false);
      if (!result.ok) {
        rememberDeviceDraft(form.id, "");
        setDeviceDraftToken("");
        setDraftNotice(
          "This draft link is invalid, expired, or has already been submitted.",
        );
        return;
      }
      loadedDraft.current = `${form.id}:${token}`;
      rememberDeviceDraft(form.id, token);
      setDeviceDraftToken("");
      setEmail(result.item.email);
      setAnswers(result.item.answers || {});
      setAdditionalParticipants(result.item.participants || []);
      setAdditionalErrors([]);
      setErrors({});
      setDraftVersion(result.item.version);
      setDraftNotice(
        `Draft restored · saved ${new Date(result.item.updatedAt).toLocaleString()}`,
      );
      if (!parsed.stepName && result.item.stepName)
        onNavigate(publicFormPath(form.id, result.item.stepName, token));
    });
    return () => {
      cancelled = true;
    };
  }, [form.id, parsed.draftToken]);
  const continueToPortal = () => {
    if (portalReady) {
      window.location.hash = "/speaker-portal";
      window.location.reload();
      return;
    }
    onNavigate("/speaker-portal");
  };
  useEffect(() => {
    if (
      !submitted ||
      !form.autoRedirect ||
      (submissionMode === "shared" && !portalReady)
    )
      return undefined;
    setRedirectSeconds(10);
    const interval = window.setInterval(
      () => setRedirectSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    const timeout = window.setTimeout(continueToPortal, 10000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [submitted, form.autoRedirect, submissionMode, portalReady]);

  const steps = [
    [form.pageHeading || "Welcome!", ""],
    ["Account", "account"],
    [form.abstractSection.heading || "Submission", "submission"],
    ...(form.collectParticipants
      ? [[form.participantSection.heading || "Participant", "participant"]]
      : []),
    ["Review", "review"],
  ];
  const current = Math.max(
    0,
    steps.findIndex(([, path]) => path === parsed.stepName),
  );
  const submissionFields = visibleFields(form.abstractFields, answers);
  const participantFields = visibleFields(form.participantFields, answers);
  const participantRole = form.participantRoles?.find(
    (role) => role.enabled,
  ) ?? { label: "Speaker", min: 1, max: 3 };
  const participantMinimum = Math.max(1, Number(participantRole.min || 1));
  const participantMaximum = Math.max(
    participantMinimum,
    Number(participantRole.max || 3),
  );
  const limit = submissionLimitState(data, form, email);
  const closed = isFormClosed(form, Date.now(), data.event?.timezone || "UTC");
  const crossErrors = validateCrossFieldRules(
    form.crossFieldRules,
    form.abstractFields,
    answers,
  );
  const setAnswer = (field, value) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [answerKey(field)]: value,
      [field.label]: value,
    }));
    setErrors((currentErrors) => {
      if (!currentErrors[answerKey(field)] && !currentErrors._cross)
        return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[answerKey(field)];
      delete nextErrors._cross;
      return nextErrors;
    });
  };
  const setAdditionalAnswer = (index, field, value) => {
    setAdditionalParticipants((participants) =>
      participants.map((participant, participantIndex) =>
        participantIndex === index
          ? { ...participant, [answerKey(field)]: value, [field.label]: value }
          : participant,
      ),
    );
    setAdditionalErrors((entries) =>
      entries.map((entry, participantIndex) => {
        if (participantIndex !== index || !entry?.[answerKey(field)])
          return entry;
        const nextEntry = { ...entry };
        delete nextEntry[answerKey(field)];
        return nextEntry;
      }),
    );
  };
  const validateParticipants = () => {
    const primary = validateFields(form.participantFields, answers);
    const secondary = additionalParticipants.map((participant) =>
      validateFields(form.participantFields, { ...answers, ...participant }),
    );
    const emails = [
      answers.Email ??
        answers[
          answerKey(
            form.participantFields.find((field) => field.type === "Email") ??
              {},
          )
        ],
      ...additionalParticipants.map(
        (participant) =>
          participant.Email ??
          participant[
            answerKey(
              form.participantFields.find((field) => field.type === "Email") ??
                {},
            )
          ],
      ),
    ]
      .map((value) =>
        String(value ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    if (new Set(emails).size !== emails.length)
      primary._participantEmails =
        "Each participant must use a unique email address.";
    if (1 + additionalParticipants.length < participantMinimum)
      primary._participants = `Add at least ${participantMinimum - 1} additional ${participantRole.label.toLowerCase()}${participantMinimum - 1 === 1 ? "" : "s"}.`;
    if (1 + additionalParticipants.length > participantMaximum)
      primary._participants = `This form allows at most ${participantMaximum} ${participantRole.label.toLowerCase()}${participantMaximum === 1 ? "" : "s"}.`;
    setErrors(primary);
    setAdditionalErrors(secondary);
    return {
      primary,
      secondary,
      valid:
        !Object.keys(primary).length &&
        secondary.every((entry) => !Object.keys(entry).length),
    };
  };
  const go = (index) =>
    onNavigate(publicFormPath(form.id, steps[index][1], draftToken));
  const saveDraft = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setDraftNotice("Enter a valid email address before saving a draft.");
      return;
    }
    setDraftBusy(true);
    const result = await savePublicDraft(
      form.id,
      {
        email,
        answers,
        participants: additionalParticipants,
        stepName: steps[current]?.[1] || "submission",
      },
      { resumeToken: draftToken, version: draftVersion },
    );
    setDraftBusy(false);
    if (!result.ok) {
      const messages = {
        MULTIPLE_DRAFTS_DISABLED:
          "This form allows only one active draft for this email address.",
        SUBMISSION_LIMIT_REACHED:
          "Your saved drafts and submissions have reached this form's limit.",
        VERSION_CONFLICT:
          "This draft changed in another browser. Reopen its resume link before saving again.",
      };
      setDraftNotice(
        messages[result.error] ||
          "The draft could not be saved. Please try again.",
      );
      return;
    }
    setDraftToken(result.resumeToken);
    setDraftVersion(result.item.version);
    rememberDeviceDraft(form.id, result.resumeToken);
    setDeviceDraftToken("");
    setDraftNotice(
      `Draft saved · expires ${new Date(result.item.expiresAt).toLocaleDateString()}`,
    );
    if (!draftToken)
      onNavigate(
        publicFormPath(
          form.id,
          steps[current]?.[1] || "submission",
          result.resumeToken,
        ),
      );
  };
  const copyDraftLink = async () => {
    if (!draftToken) return;
    const path = publicFormPath(
      form.id,
      steps[current]?.[1] || "submission",
      draftToken,
    );
    await navigator.clipboard.writeText(
      `${window.location.origin}${window.location.pathname}${window.location.search}#${path}`,
    );
    setDraftNotice(
      "Private resume link copied. Anyone with this link can open this draft.",
    );
  };
  const startAnotherDraft = () => {
    loadedDraft.current = "";
    setDraftToken("");
    setDraftVersion(null);
    setDraftNotice("");
    setEmail("");
    setAnswers(schemaInitialAnswers(form, data, speakerEmail, session));
    setAdditionalParticipants([]);
    setAdditionalErrors([]);
    setErrors({});
    idempotencyKey.current = createIdempotencyKey("cfp");
    onNavigate(publicFormPath(form.id, "account"));
  };
  const validateStep = (fields, nextIndex) => {
    const nextErrors = validateFields(fields, answers);
    const combined =
      fields === form.abstractFields && crossErrors.length
        ? { ...nextErrors, _cross: crossErrors[0].message }
        : nextErrors;
    setErrors(combined);
    if (!Object.keys(combined).length) go(nextIndex);
  };
  const complete = async () => {
    const participantValidation = form.collectParticipants
      ? validateParticipants()
      : { primary: {}, secondary: [], valid: true };
    const allErrors = {
      ...validateFields(form.abstractFields, answers),
      ...participantValidation.primary,
    };
    participantValidation.secondary.forEach((entry, index) =>
      Object.entries(entry).forEach(([key, message]) => {
        allErrors[`participant-${index}-${key}`] =
          `Additional participant ${index + 1}: ${message}`;
      }),
    );
    if (crossErrors.length) allErrors._cross = crossErrors[0].message;
    if (closed) allErrors._form = "This form is closed.";
    if (limit.reached)
      allErrors._limit = `You have reached the ${limit.limit}-submission limit.`;
    setErrors(allErrors);
    if (Object.keys(allErrors).length) return;
    const routing = resolveRoutingRule(form, answers);
    const titleField = form.abstractFields.find(
      (field) => field.label.toLowerCase() === "title",
    );
    const descriptionField = form.abstractFields.find(
      (field) => field.label.toLowerCase() === "description",
    );
    const trackField = form.abstractFields.find(
      (field) => field.label.toLowerCase() === "track",
    );
    const formatField = form.abstractFields.find(
      (field) => field.label.toLowerCase() === "format",
    );
    const participantFirst = form.participantFields.find((field) =>
      field.label.toLowerCase().includes("first"),
    );
    const participantLast = form.participantFields.find((field) =>
      field.label.toLowerCase().includes("last"),
    );
    const participantBio = form.participantFields.find((field) =>
      field.label.toLowerCase().includes("bio"),
    );
    const participantTitle = form.participantFields.find(
      (field) => field.label.toLowerCase() === "professional title",
    );
    const participantCompany = form.participantFields.find(
      (field) => field.label.toLowerCase() === "company",
    );
    const participantEmail = form.participantFields.find(
      (field) => field.type === "Email",
    );
    const participantAnswerSets = [answers, ...additionalParticipants];
    const nextPeople = participantAnswerSets.map(
      (participantAnswers, index) => {
        const participantEmailValue = String(
          participantAnswers[answerKey(participantEmail ?? {})] ??
            participantAnswers.Email ??
            (index === 0 ? email : ""),
        ).trim();
        const existingPerson = participantForEmail(data, participantEmailValue);
        const personId = existingPerson?.id ?? `person-${Date.now()}-${index}`;
        const firstName =
          participantAnswers[answerKey(participantFirst ?? {})] ??
          existingPerson?.name?.split(" ")[0] ??
          participantEmailValue.split("@")[0];
        const lastName =
          participantAnswers[answerKey(participantLast ?? {})] ??
          existingPerson?.name?.split(" ").slice(1).join(" ") ??
          "";
        const name = `${firstName} ${lastName}`.trim();
        return {
          ...(existingPerson ?? {}),
          id: personId,
          name,
          email: participantEmailValue,
          initials:
            `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() ||
            "SP",
          role: participantRole.label || "Speaker",
          title:
            participantAnswers[answerKey(participantTitle ?? {})] ??
            existingPerson?.title ??
            "",
          company:
            participantAnswers[answerKey(participantCompany ?? {})] ??
            existingPerson?.company ??
            "",
          bio:
            participantAnswers[answerKey(participantBio ?? {})] ??
            existingPerson?.bio ??
            "",
        };
      },
    );
    const [nextPerson] = nextPeople;
    const personId = nextPerson.id;
    const firstName = nextPerson.name.split(" ")[0] ?? "Speaker";
    const name = nextPerson.name;
    const record = {
      id: `abs-${Date.now()}`,
      formId: form.id,
      source: form.name,
      title:
        answers[answerKey(titleField ?? {})] ??
        answers.Title ??
        "Untitled submission",
      description:
        answers[answerKey(descriptionField ?? {})] ?? answers.Description ?? "",
      status: "Pending",
      track:
        answers[answerKey(trackField ?? {})] ?? answers.Track ?? "Unassigned",
      tags: [
        answers[answerKey(formatField ?? {})] ?? answers.Format ?? form.kind,
      ],
      submitted: new Date().toLocaleString(),
      submitter: email,
      submitterEmail: email,
      speakers: nextPeople.map((person) => person.name),
      participantIds: nextPeople.map((person) => person.id),
      answers: { ...answers, additionalParticipants },
      reviewRoute: routing?.destination ?? "Round 1 · Technical review",
      routingRuleId: routing?.id ?? null,
      reviewRound: 1,
    };
    const renderConfirmation = (value = "") =>
      String(value)
        .replaceAll("{{submission.title}}", record.title)
        .replaceAll("{{participant.firstName}}", firstName)
        .replaceAll("{{event.name}}", data.event?.name ?? "Sample Event");
    const confirmationEntry = {
      id: `email-${Date.now()}`,
      type: "submission-confirmation",
      action: "preview",
      templateName: "Submission confirmation",
      recipientCount: 1,
      recipients: [{ id: personId, name, email }],
      subject: renderConfirmation(form.confirmationSubject),
      body: renderConfirmation(form.confirmationBody),
      status: "Preview only · not sent",
      provider: "Local preview",
      createdAt: new Date().toISOString(),
    };
    setSubmitting(true);
    const remote = await submitPublicCfp(
      form.id,
      {
        email,
        title: record.title,
        abstract: record.description,
        category: record.track,
        answers: record.answers,
        participants: nextPeople.map((person) => ({
          email: person.email,
          name: person.name,
          title: person.title,
          company: person.company,
          bio: person.bio,
          role: person.role,
        })),
        draftToken: draftToken || undefined,
      },
      { idempotencyKey: idempotencyKey.current },
    );
    if (remote.available && !remote.ok) {
      const remoteMessage = {
        SUBMISSION_LIMIT_REACHED:
          "You have reached this form's submission limit.",
        FORM_CLOSED:
          "This call for speakers is closed. Your answers remain on this page so you can copy them or contact the event team.",
        FORM_NOT_OPEN:
          "This call for speakers is not accepting submissions yet.",
      }[remote.error];
      setErrors({
        _remote:
          remoteMessage ||
          "The shared workspace could not accept this submission. Please try again.",
      });
      setSubmitting(false);
      return;
    }
    if (!remote.available && !remote.fallbackAllowed) {
      setErrors({
        _remote:
          "The shared workspace is temporarily unavailable. Your submission was not recorded; please try again.",
      });
      setSubmitting(false);
      return;
    }
    const remotePeople =
      remote.ok && remote.item?.participants?.length
        ? remote.item.participants.map((person) => ({
            id: person.id,
            name: person.name,
            email: person.email,
            role: person.role || participantRole.label || "Speaker",
            title: person.title || "",
            company: person.company || "",
            bio: person.bio || "",
            initials: String(person.name || "SP")
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          }))
        : nextPeople;
    const savedRecord = remote.ok
      ? {
          ...record,
          id: remote.item.id,
          status: "Pending",
          submitted: remote.item.createdAt,
          reviewRoute: remote.item.reviewRoute || record.reviewRoute,
          routingRuleId: remote.item.routingRuleId || record.routingRuleId,
          reviewRound: remote.item.round || record.reviewRound,
          participantIds: remotePeople.map((person) => person.id),
          speakers: remotePeople.map((person) => person.name),
        }
      : record;
    const savedPrimary = remotePeople[0] || nextPerson;
    const savedConfirmation = {
      ...confirmationEntry,
      recipients: [
        {
          id: savedPrimary.id,
          name: savedPrimary.name,
          email: savedPrimary.email,
        },
      ],
    };
    update((state) => ({
      ...state,
      abstracts: [
        ...(state.abstracts ?? []).filter((item) => item.id !== savedRecord.id),
        savedRecord,
      ],
      forms: (state.forms ?? []).map((item) =>
        item.id === form.id
          ? { ...item, submissions: Number(item.submissions ?? 0) + 1 }
          : item,
      ),
      participants: [
        ...(state.participants ?? []).filter(
          (person) =>
            !remotePeople.some(
              (next) =>
                next.id === person.id ||
                next.email.toLowerCase() === String(person.email).toLowerCase(),
            ),
        ),
        ...remotePeople,
      ],
      portalPersonId: savedPrimary.id,
      evaluationRounds: (state.evaluationRounds ?? []).length
        ? state.evaluationRounds.map((round, index) => {
            const targetIndex = routing?.destination?.includes("Round 2")
              ? 1
              : 0;
            if (
              index !== targetIndex ||
              round.assignments?.some(
                (assignment) => assignment.abstractId === savedRecord.id,
              )
            )
              return round;
            const reviewerId = routing?.destination?.includes("Infrastructure")
              ? "reviewer-marcus"
              : routing?.destination?.includes("Applied AI")
                ? "reviewer-monica"
                : "reviewer-sarah";
            return {
              ...round,
              assignments: [
                ...(round.assignments ?? []),
                {
                  id: `assignment-${round.id}-${savedRecord.id}`,
                  abstractId: savedRecord.id,
                  reviewerId,
                  status: "Assigned",
                },
              ],
            };
          })
        : state.evaluationRounds,
      emailLog: form.submissionConfirmation
        ? [...(state.emailLog ?? []), savedConfirmation]
        : (state.emailLog ?? []),
    }));
    setSubmissionMode(remote.ok ? "shared" : "local");
    setPortalReady(Boolean(remote.ok && remote.portalAccess?.authenticated));
    rememberDeviceDraft(form.id, "");
    setDeviceDraftToken("");
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="cfp-root">
      <style>
        {PUBLIC_STYLES}
        {SCHEMA_CFP_STYLES}
      </style>
      <main className="cfp-card">
        <SchemaStepper steps={steps} current={current} />
        <div className="cfp-notice">
          {form.closeDate ? (
            <div>
              Form submissions will be accepted until{" "}
              {formatEventDeadline(form.closeDate, data.event?.timezone || "UTC")}.
            </div>
          ) : rawForm.closes ? (
            <div>Form submissions will be accepted until {rawForm.closes}.</div>
          ) : null}
          <div>
            Submission Limit: {form.setLimit ? form.submissionLimit : 3}{" "}
            submissions per user
          </div>
        </div>
        {!closed && current > 0 && !submitted ? (
          <div className="cfp-draftbar">
            <span>
              <strong>
                {draftToken ? "Saved draft" : "Not ready to submit?"}
              </strong>
              <br />
              {draftNotice ||
                "Save your progress and copy a private link to resume on another device."}
            </span>
            <button disabled={draftBusy} onClick={saveDraft}>
              {draftBusy
                ? "Saving…"
                : draftToken
                  ? "Save changes"
                  : "Save draft"}
            </button>
            {draftToken ? (
              <button onClick={copyDraftLink}>
                <Copy size={15} /> Copy resume link
              </button>
            ) : null}
            {draftToken && form.allowMultipleDrafts ? (
              <button className="new-draft" onClick={startAnotherDraft}>
                Start another draft
              </button>
            ) : null}
          </div>
        ) : null}
        {closed && !submitted ? (
          <div className="cfp-closed">
            <h2>Submissions are closed</h2>
            <p>This form is no longer accepting new or updated submissions.</p>
          </div>
        ) : null}
        {!closed && current === 0 ? (
          <>
            <h1>
              {referenceWelcome ? "Welcome to our event!" : form.externalTitle}
            </h1>
            {form.welcomeEnabled ? (
              <div className="cfp-rich">
                {referenceWelcome ? (
                  <ReferenceWelcomeMessage />
                ) : (
                  <>
                    <h3>{form.name}</h3>
                    {form.welcomeMessage
                      .split("\n")
                      .map((line, index) =>
                        line ? <p key={index}>{line}</p> : null,
                      )}
                  </>
                )}
              </div>
            ) : null}
            {deviceDraftToken ? (
              <div className="cfp-draftbar" style={{ margin: "18px 0 0" }}>
                <span>
                  <strong>Draft saved on this device</strong>
                  <br />
                  Continue where you left off using its private resume link.
                </span>
                <button
                  onClick={() =>
                    onNavigate(
                      publicFormPath(form.id, "submission", deviceDraftToken),
                    )
                  }
                >
                  Resume draft
                </button>
              </div>
            ) : null}
            <div className="cfp-actions">
              <span />
              <button className="cfp-primary" onClick={() => go(1)}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : null}
        {!closed && current === 1 ? (
          <>
            <h2>Get started</h2>
            <div className="cfp-panel">
              <CfpField label="Your Email Address:" required>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    const emailField = form.participantFields.find(
                      (field) => field.type === "Email",
                    );
                    if (emailField) setAnswer(emailField, event.target.value);
                  }}
                />
                {limit.reached ? (
                  <span className="cfp-field-error">
                    You have reached this form&apos;s submission limit.
                  </span>
                ) : null}
              </CfpField>
              <div className="cfp-actions" style={{ marginTop: 8 }}>
                <span />
                <button
                  className="cfp-primary"
                  disabled={!/^\S+@\S+\.\S+$/.test(email) || limit.reached}
                  onClick={() => go(2)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="cfp-actions">
              <button className="cfp-back" onClick={() => go(0)}>
                Back
              </button>
            </div>
          </>
        ) : null}
        {!closed && current === 2 ? (
          <>
            <h2>{form.abstractSection.title}</h2>
            <p className="section-copy">{form.abstractSection.description}</p>
            {Object.keys(errors).length ? (
              <div className="cfp-errors">
                <b>Please review the highlighted fields.</b>
                <ul>
                  {Object.values(errors).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="cfp-panel">
              {submissionFields.map((field) => (
                <SchemaField
                  key={field.id}
                  field={field}
                  answers={answers}
                  setAnswer={setAnswer}
                  error={errors[answerKey(field)]}
                />
              ))}
              {form.crossFieldRules.map((rule) => {
                const usage = crossFieldUsage(
                  rule,
                  form.abstractFields,
                  answers,
                );
                return (
                  <div
                    key={rule.id}
                    className={`cfp-rule-usage ${usage > rule.max ? "over" : ""}`}
                  >
                    {rule.label}: {usage.toLocaleString()} /{" "}
                    {Number(rule.max).toLocaleString()} characters
                  </div>
                );
              })}
              <div className="cfp-actions">
                <button className="cfp-back" onClick={() => go(1)}>
                  Back
                </button>
                <button
                  className="cfp-primary"
                  onClick={() => validateStep(form.abstractFields, 3)}
                >
                  Next <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
        {!closed && form.collectParticipants && current === 3 ? (
          <>
            <h2>{form.participantSection.title}</h2>
            <p className="section-copy">
              {form.participantSection.description}
            </p>
            {Object.keys(errors).length ||
            additionalErrors.some((entry) => Object.keys(entry).length) ? (
              <div className="cfp-errors">
                <b>Please review the highlighted fields.</b>
                <ul>
                  {[
                    ...Object.values(errors),
                    ...additionalErrors.flatMap((entry, index) =>
                      Object.values(entry).map(
                        (message) =>
                          `Additional participant ${index + 1}: ${message}`,
                      ),
                    ),
                  ].map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="cfp-panel">
              <p className="cfp-participant-limit">
                {participantRole.label}: {1 + additionalParticipants.length} of{" "}
                {participantMaximum}
                {participantMinimum > 1
                  ? ` · minimum ${participantMinimum}`
                  : ""}
              </p>
              <section className="cfp-participant-card">
                <div className="cfp-participant-head">
                  <h3>Primary {participantRole.label}</h3>
                </div>
                {participantFields.map((field) => (
                  <SchemaField
                    key={field.id}
                    field={field}
                    answers={answers}
                    setAnswer={setAnswer}
                    error={errors[answerKey(field)]}
                  />
                ))}
              </section>
              {additionalParticipants.map((participantAnswers, index) => (
                <section className="cfp-participant-card" key={index}>
                  <div className="cfp-participant-head">
                    <h3>
                      Additional {participantRole.label} {index + 1}
                    </h3>
                    <button
                      onClick={() => {
                        setAdditionalParticipants((participants) =>
                          participants.filter(
                            (_, participantIndex) => participantIndex !== index,
                          ),
                        );
                        setAdditionalErrors((entries) =>
                          entries.filter(
                            (_, participantIndex) => participantIndex !== index,
                          ),
                        );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {visibleFields(form.participantFields, {
                    ...answers,
                    ...participantAnswers,
                  }).map((field) => (
                    <SchemaField
                      key={field.id}
                      field={field}
                      answers={participantAnswers}
                      setAnswer={(item, value) =>
                        setAdditionalAnswer(index, item, value)
                      }
                      error={additionalErrors[index]?.[answerKey(field)]}
                    />
                  ))}
                </section>
              ))}
              {1 + additionalParticipants.length < participantMaximum ? (
                <button
                  className="cfp-add-participant"
                  onClick={() => {
                    setAdditionalParticipants((participants) => [
                      ...participants,
                      blankParticipantAnswers(form),
                    ]);
                    setAdditionalErrors((entries) => [...entries, {}]);
                  }}
                >
                  + Add another {participantRole.label.toLowerCase()}
                </button>
              ) : null}
              <div className="cfp-actions">
                <button className="cfp-back" onClick={() => go(2)}>
                  Back
                </button>
                <button
                  className="cfp-primary"
                  onClick={() => {
                    const validation = validateParticipants();
                    if (validation.valid) go(4);
                  }}
                >
                  Review <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
        {!closed && current === steps.length - 1 && !submitted ? (
          <>
            <h2>Review your application</h2>
            {Object.keys(errors).length ? (
              <div className="cfp-errors">
                <b>Submission could not be completed.</b>
                <ul>
                  {Object.values(errors).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="cfp-review">
              <section className="cfp-review-card">
                <h3>{form.abstractSection.heading}</h3>
                <dl>
                  {submissionFields.map((field) => (
                    <div key={field.id} style={{ display: "contents" }}>
                      <dt>{field.label}</dt>
                      <dd>
                        {Array.isArray(answers[answerKey(field)])
                          ? answers[answerKey(field)].join(", ")
                          : answers[answerKey(field)] || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {resolveRoutingRule(form, answers) ? (
                  <div className="cfp-route">
                    Routed to {resolveRoutingRule(form, answers).destination}
                  </div>
                ) : null}
              </section>
              {form.collectParticipants
                ? [answers, ...additionalParticipants].map(
                    (participantAnswers, index) => (
                      <section
                        className="cfp-review-card"
                        key={`participant-${index}`}
                      >
                        <h3>
                          {index === 0 ? "Primary" : `Additional ${index}`}{" "}
                          {form.participantSection.heading}
                        </h3>
                        <dl>
                          {visibleFields(form.participantFields, {
                            ...answers,
                            ...participantAnswers,
                          }).map((field) => (
                            <div key={field.id} style={{ display: "contents" }}>
                              <dt>{field.label}</dt>
                              <dd>
                                {participantAnswers[answerKey(field)] || "—"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ),
                  )
                : null}
            </div>
            <div className="cfp-actions">
              <button className="cfp-back" onClick={() => go(steps.length - 2)}>
                Back
              </button>
              <button
                className="cfp-primary"
                disabled={submitting}
                onClick={complete}
              >
                {submitting ? "Submitting…" : "Submit application"}{" "}
                <Check size={16} />
              </button>
            </div>
          </>
        ) : null}
        {submitted ? (
          <div className="cfp-success">
            <CheckCircle2 size={54} />
            <h1>Submission received</h1>
            <p className="cfp-success-message">{form.successMessage}</p>
            {form.autoRedirect &&
            (submissionMode === "local" || portalReady) ? (
              <p>Opening your speaker portal in {redirectSeconds} seconds…</p>
            ) : null}
            {submissionMode === "local" || portalReady ? (
              <button className="cfp-primary" onClick={continueToPortal}>
                Continue to portal <ArrowRight size={16} />
              </button>
            ) : (
              <p>
                Portal access will be sent to the primary speaker after
                identity-email delivery is enabled.
              </p>
            )}
            <div className="cfp-local-only">
              {submissionMode === "shared"
                ? portalReady
                  ? "Saved to the shared event workspace. A role-scoped portal session is ready for this newly created event identity; confirmation delivery remains disabled."
                  : "Saved to the shared event workspace. Confirmation delivery is still disabled until the email release is approved."
                : "Saved in this browser only. Confirmation email recorded as preview-only; no external message was sent."}
            </div>
          </div>
        ) : null}
      </main>
      <div className="cfp-powered">Powered by Callboard</div>
    </div>
  );
}

function PortalTabs({ active, onNavigate }) {
  const items = [
    ["home", Home, "Home"],
    ["submissions", CalendarDays, "Submissions"],
    ["profile", UserCircle, "Profile"],
    ["tasks", BriefcaseBusiness, "Tasks"],
    ["forms", ClipboardList, "Forms"],
    ["files", FileText, "Files"],
  ];
  return (
    <div className="speaker-tabs">
      {items.map(([value, Icon, label]) => (
        <button
          key={value}
          className={active === value ? "active" : ""}
          onClick={() =>
            onNavigate(
              value === "home" ? "/speaker-portal" : `/speaker-portal/${value}`,
            )
          }
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </div>
  );
}

function PortalSubmission({ item, onEdit }) {
  const accepted = item.status === "Accepted";
  const editable = ["Pending", "Draft"].includes(item.status);
  return (
    <article className="speaker-submission">
      <h3>
        Proposal — {item.title}
      </h3>
      <p>
        {item.tags?.[0] || "Keynote"} · {item.track || "Unassigned"}
      </p>
      <div className={`speaker-status ${accepted ? "accepted" : "pending"}`}>
        {accepted ? <CheckCircle2 size={20} /> : <Circle size={20} />}{" "}
        {item.status}
        {editable && onEdit ? (
          <button
            className="speaker-link"
            style={{ margin: 0, marginLeft: "auto" }}
            onClick={() => onEdit(item)}
          >
            Edit submission
          </button>
        ) : null}
      </div>
    </article>
  );
}

function cleanPortalBiography(value = "") {
  // Biography text belongs to the speaker. Preserve it byte-for-byte apart from
  // the surrounding whitespace a normal form submission cannot represent.
  return String(value).trim();
}

function relatedSubmission(task, submissions) {
  return submissions.find((submission) => task.id?.includes(submission.id));
}

function relatedPortalForm(task, forms) {
  return forms.find(
    (form) => task.id?.includes(form.id) || task.title === form.title,
  );
}

function dedupePortalTasks(tasks) {
  const profileTasks = tasks.filter((task) =>
    task.title?.toLowerCase().includes("speaker profile"),
  );
  const otherTasks = tasks.filter(
    (task) => !task.title?.toLowerCase().includes("speaker profile"),
  );
  if (!profileTasks.length) return otherTasks;
  const representative = profileTasks.find((task) => !task.complete) || profileTasks[0];
  return [
    {
      ...representative,
      id: `profile-work-${representative.personId || "speaker"}`,
      complete: profileTasks.every((task) => task.complete),
      backingTaskIds: profileTasks.map((task) => task.id),
      notes: "Save a complete biography and upload an approved headshot.",
    },
    ...otherTasks,
  ];
}

function SpeakerFileRequestsPanel({ active }) {
  const { data, update, persistenceStatus } = useAppStore();
  const person =
    data.participants.find((entry) => entry.id === data.portalPersonId) ||
    data.participants[0];
  const submissions = abstractsForParticipant(data, person?.id);
  const requests =
    persistenceStatus === "d1"
      ? data.fileRequests || []
      : (data.fileRequests || []).filter(
          (request) =>
            request.assigneePersonId === person?.id ||
            submissions.some(
              (submission) => submission.id === request.submissionId,
            ),
        );
  const files = [
    ...new Map(
      [...(data.portalFiles || []), ...(data.speakerFiles || [])].map((file) => [
        file.id,
        file,
      ]),
    ).values(),
  ];
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  if (active !== "files") return null;
  const upload = async (request, file) => {
    if (!file || !data.objectStorageAvailable) return;
    setUploading(request.id);
    setError("");
    const uploadKind = request.title?.toLowerCase().includes("headshot")
      ? "Headshot"
      : request.title;
    const result = await uploadSharedFile(file, {
      kind: uploadKind,
      submissionId: request.submissionId || undefined,
      fileRequestId: request.id,
    });
    setUploading("");
    if (!result.ok) {
      setError(
        result.error === "FILE_REQUEST_NOT_ASSIGNED"
          ? "This request is not assigned to your account."
          : "The file could not be uploaded. Try again.",
      );
      return;
    }
    const item = {
      id: result.item.id,
      name: result.item.name,
      type: result.item.mimeType,
      size: result.item.sizeBytes,
      kind: result.item.kind,
      personId: result.item.ownerPersonId,
      fileRequestId: result.item.fileRequestId,
      submissionId: result.item.submissionId,
      status: result.item.status,
      version: result.item.version,
      uploaded: result.item.createdAt,
      downloadUrl: `/api/files/${encodeURIComponent(result.item.id)}/content`,
    };
    update((state) => {
      const profileCompleted =
        uploadKind === "Headshot" &&
        Boolean(result.person?.headshotUrl) &&
        Boolean(
          state.participants
            .find((participant) => participant.id === person?.id)
            ?.bio?.trim(),
        );
      const appendUnique = (source) => [
        ...new Map([...(source || []), item].map((entry) => [entry.id, entry])).values(),
      ];
      return {
        ...state,
        portalFiles: appendUnique(state.portalFiles),
        speakerFiles: appendUnique(state.speakerFiles),
        participants: result.person
          ? state.participants.map((participant) =>
              participant.id === result.person.id
                ? {
                    ...participant,
                    headshotUrl: result.person.headshotUrl,
                    version: result.person.version,
                  }
                : participant,
            )
          : state.participants,
        tasks: profileCompleted
          ? state.tasks.map((task) =>
              task.personId === person?.id &&
              task.title?.toLowerCase().includes("speaker profile")
                ? { ...task, complete: true }
                : task,
            )
          : state.tasks,
      };
    });
  };
  return (
    <section className="speaker-card">
      <header className="speaker-card-head">
        <span>
          <FileText size={23} />
          Requested files ({requests.length})
        </span>
      </header>
      <div className="speaker-card-body">
        {!data.objectStorageAvailable ? (
          <div className="speaker-storage-note">
            <b>Private file storage is being connected.</b>
            <br />
            Your assigned requests are visible now; upload controls activate
            only when secure object storage is enabled.
          </div>
        ) : null}
        {error ? <div className="speaker-storage-note">{error}</div> : null}
        <div className="speaker-file-grid">
          {requests.length ? (
            requests.map((request) => {
              const uploaded = files.filter(
                (file) => file.fileRequestId === request.id,
              );
              const pickerId = `speaker-file-request-${request.id}`;
              return (
                <article className="speaker-file-request" key={request.id}>
                  <h3>{request.title}</h3>
                  <p>
                    {request.instructions || "Upload the requested event file."}
                  </p>
                  <div className="speaker-file-meta">
                    <span>{request.type}</span>
                    {request.dueAt ? (
                      <span>
                        Due {new Date(request.dueAt).toLocaleDateString()}
                      </span>
                    ) : null}
                    <label
                      htmlFor={pickerId}
                      className={
                        !data.objectStorageAvailable || uploading === request.id
                          ? "disabled"
                          : ""
                      }
                    >
                      <Upload size={16} />
                      {uploading === request.id
                        ? "Uploading…"
                        : uploaded.length
                          ? "Upload replacement"
                          : "Choose file"}
                      <input
                        id={pickerId}
                        className="speaker-file-picker"
                        type="file"
                        aria-label={`Upload file for ${request.title}`}
                        disabled={
                          !data.objectStorageAvailable ||
                          uploading === request.id
                        }
                        onChange={(event) =>
                          upload(request, event.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                  {uploaded.map((file) => (
                    <div className="speaker-file-uploaded" key={file.id}>
                      <CheckCircle2 size={17} />
                      <span>
                        {file.name}
                        {file.version ? <small>Version {file.version}</small> : null}
                      </span>
                      {file.downloadUrl ? (
                        <a href={file.downloadUrl}>
                          <Download size={17} />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </article>
              );
            })
          ) : (
            <div className="speaker-empty">
              No file requests are assigned to you.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SpeakerPortalForms({ active, focusFormId }) {
  const { data, update, persistenceStatus } = useAppStore();
  const forms = data.portalForms || [];
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(
      forms.map((form) => [
        form.id,
        {
          ...(form.response?.answers || {}),
          ...Object.fromEntries(
            (form.questions || []).map((question) => [
              question.id,
              responseAnswer(form.response?.answers || {}, question),
            ]),
          ),
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [editingResponse, setEditingResponse] = useState("");
  useEffect(() => {
    if (active !== "forms" || !focusFormId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`portal-form-${focusFormId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [active, focusFormId]);
  if (active !== "forms") return null;
  const submit = async (form) => {
    const formAnswers = answers[form.id] || {};
    if (
      String(formAnswers.needs_hotel || "").toLowerCase() === "yes" &&
      !String(formAnswers.arrival_date || "").trim()
    ) {
      setMessage("Add an arrival date when requesting a hotel room.");
      return;
    }
    if (
      String(formAnswers.needs_reimbursement || "").toLowerCase() === "yes" &&
      !String(formAnswers.departure_city || "").trim()
    ) {
      setMessage("Add a departure city when requesting flight reimbursement.");
      return;
    }
    setBusy(form.id);
    setMessage("");
    const result =
      persistenceStatus === "d1"
        ? await submitPortalFormResponse(form.id, formAnswers)
        : {
            ok: true,
            response: {
              answers: formAnswers,
              submittedAt: new Date().toISOString(),
            },
            completedTaskIds: [],
          };
    setBusy("");
    if (!result.ok) {
      setMessage(
        result.error === "FIELDS_REQUIRED"
          ? "Complete the required questions before submitting."
          : "This form could not be submitted. Try again.",
      );
      return;
    }
    update((state) => ({
      ...state,
      portalForms: (state.portalForms || []).map((item) =>
        item.id === form.id
          ? {
              ...item,
              response: result.response,
              version: result.item?.version || item.version,
            }
          : item,
      ),
      tasks: (state.tasks || []).map((task) =>
        result.completedTaskIds.includes(task.id)
          ? { ...task, complete: true, version: (task.version || 0) + 1 }
          : task,
      ),
    }));
    setEditingResponse("");
    setMessage(`${form.title} submitted.`);
  };
  return (
    <section className="speaker-card">
      <header className="speaker-card-head">
        <span>
          <ClipboardList size={23} />
          Onboarding forms ({forms.length})
        </span>
      </header>
      <div className="speaker-card-body">
        {message ? <div className="speaker-storage-note">{message}</div> : null}
        <div className="speaker-form-list">
          {forms.length ? (
            forms.map((form) => {
              const isEditing = editingResponse === form.id;
              return (
              <article
                className={`speaker-form-card ${focusFormId === form.id ? "focused" : ""}`}
                id={`portal-form-${form.id}`}
                key={form.id}
              >
                <h3>{form.title}</h3>
                <p>
                  {form.instructions ||
                    "Complete this form for the event team."}
                </p>
                {form.response && !isEditing ? (
                  <div className="speaker-form-response">
                    <div className="speaker-form-complete">
                      <CheckCircle2 size={18} />
                      Submitted{" "}
                      {new Date(form.response.submittedAt).toLocaleString()}
                    </div>
                    <dl>
                      {(form.questions || []).map((question) => (
                        <div key={question.id}>
                          <dt>{question.label}</dt>
                          <dd>{responseAnswer(form.response.answers, question) || "Not provided"}</dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      className="speaker-secondary-action"
                      onClick={() => setEditingResponse(form.id)}
                    >
                      Edit response
                    </button>
                  </div>
                ) : (
                  <div className="speaker-form-questions">
                    {(form.questions || []).map((question) => (
                      <label
                        className="speaker-form-question"
                        key={question.id}
                      >
                        {question.label}
                        {question.required ? " *" : ""}
                        {String(question.type).toLowerCase() === "dropdown" ? (
                          <select
                            value={answers[form.id]?.[question.id] || ""}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [form.id]: {
                                  ...(current[form.id] || {}),
                                  [question.id]: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Select…</option>
                            {(question.options || ["Yes", "No"]).map(
                              (option) => (
                                <option key={option}>{option}</option>
                              ),
                            )}
                          </select>
                        ) : (
                          <input
                            type={
                              String(question.type).toLowerCase() === "date"
                                ? "date"
                                : "text"
                            }
                            value={answers[form.id]?.[question.id] || ""}
                            onClick={(event) =>
                              event.currentTarget.type === "date" &&
                              event.currentTarget.showPicker?.()
                            }
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [form.id]: {
                                  ...(current[form.id] || {}),
                                  [question.id]: event.target.value,
                                },
                              }))
                            }
                          />
                        )}
                      </label>
                    ))}
                    <button
                      className="speaker-form-submit"
                      disabled={busy === form.id}
                      onClick={() => submit(form)}
                    >
                      {busy === form.id ? "Submitting…" : "Submit form"}
                    </button>
                  </div>
                )}
              </article>
              );
            })
          ) : (
            <div className="speaker-empty">
              Forms appear here after a submission is accepted.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function SpeakerPortalScreen({ route, onNavigate }) {
  const { data, update, session, persistenceStatus } = useAppStore();
  const active = route.split("/")[2] || "home";
  const person =
    data.participants.find((entry) => entry.id === data.portalPersonId) ||
    data.participants[0];
  const submissions = abstractsForParticipant(data, person?.id);
  const publicFormId =
    submissions.find((item) => item.formId)?.formId ||
    data.forms?.find((form) => form.status === "Open")?.id ||
    data.forms?.[0]?.id ||
    "";
  const portalTasks = dedupePortalTasks(tasksForParticipant(data, person?.id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskTab, setTaskTab] = useState("all");
  const [focusFormId, setFocusFormId] = useState("");
  const [profile, setProfile] = useState({
    firstName: person?.name?.split(" ")[0] ?? "",
    lastName: person?.name?.split(" ").slice(1).join(" ") ?? "",
    title: person?.title ?? "",
    company: person?.company ?? "",
    bio: cleanPortalBiography(person?.bio),
    salutation: "",
    honorific: "",
    pronouns: "",
    gender: "",
    linkedin: person?.linkedin ?? "",
    twitter: "",
    facebook: "",
    website: person?.website ?? "",
  });
  useEffect(() => {
    if (!person) return;
    setProfile((current) => ({
      ...current,
      firstName: person.name?.split(" ")[0] ?? "",
      lastName: person.name?.split(" ").slice(1).join(" ") ?? "",
      title: person.title ?? "",
      company: person.company ?? "",
      bio: cleanPortalBiography(person.bio),
      linkedin: person.linkedin ?? current.linkedin ?? "",
      website: person.website ?? current.website ?? "",
    }));
  }, [
    person?.id,
    person?.version,
    person?.name,
    person?.title,
    person?.company,
    person?.bio,
  ]);
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState(
    "Your speaker information has been saved.",
  );
  const [savedTitle, setSavedTitle] = useState("Profile updated");
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(null);
  const personTasks = portalTasks.filter((task) => task.scope === "Contact");
  const submissionTasks = portalTasks.filter(
    (task) => task.scope !== "Contact",
  );
  const openTasks = portalTasks.filter((task) => !task.complete);
  const shownTasks =
    taskTab === "mine"
      ? personTasks
      : taskTab === "submissions"
        ? submissionTasks
        : portalTasks;
  const activeTitle =
    active === "home"
      ? "Home"
      : active === "submissions"
        ? "Submissions"
        : active === "profile"
          ? "Profile"
          : active === "files"
            ? "Files"
            : active === "forms"
              ? "Forms"
              : "Tasks";
  const setTaskIdsComplete = async (taskIds, complete = true) => {
    const uniqueIds = [...new Set(taskIds)].filter(Boolean);
    const updatedVersions = new Map();
    if (persistenceStatus === "d1") {
      for (const id of uniqueIds) {
        const task = data.tasks.find((entry) => entry.id === id);
        if (!task || task.complete === complete) continue;
        const result = await patchSharedResource("tasks", id, task.version, {
          status: complete ? "completed" : "open",
        });
        if (!result.ok) {
          setSaveError(
            "The task changed elsewhere or could not be saved. Reload and try again.",
          );
          return false;
        }
        updatedVersions.set(id, result.item.version);
      }
    }
    update((state) => ({
      ...state,
      tasks: state.tasks.map((entry) =>
        uniqueIds.includes(entry.id)
          ? {
              ...entry,
              complete,
              version: updatedVersions.get(entry.id) || entry.version,
            }
          : entry,
      ),
    }));
    return true;
  };
  const markTask = async (task) => {
    const taskIds = task.backingTaskIds || [task.id];
    await setTaskIdsComplete(taskIds, !task.complete);
  };
  const openTask = (task) => {
    const form = relatedPortalForm(task, data.portalForms || []);
    if (task.kind === "form" && form) {
      setFocusFormId(form.id);
      onNavigate("/speaker-portal/forms");
      return;
    }
    if (task.title?.toLowerCase().includes("speaker profile")) {
      onNavigate("/speaker-portal/profile");
      return;
    }
    if (task.scope === "Submission") {
      const submission = relatedSubmission(task, submissions);
      if (submission) {
        setEditing({
          ...submission,
          reviewOnly: true,
          completionTaskIds: task.backingTaskIds || [task.id],
        });
        onNavigate("/speaker-portal/submissions");
      }
      return;
    }
    markTask(task);
  };
  const saveProfile = async () => {
    const nextPerson = {
      ...person,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      title: profile.title,
      company: profile.company,
      bio: cleanPortalBiography(profile.bio),
      linkedin: profile.linkedin,
      website: profile.website,
    };
    if (persistenceStatus === "d1") {
      const result = await patchSharedResource(
        "people",
        person.id,
        person.version,
        {
          name: nextPerson.name,
          title: nextPerson.title,
          company: nextPerson.company,
          bio: nextPerson.bio,
        },
      );
      if (!result.ok) {
        setSaveError(
          "Your profile changed elsewhere or could not be saved. Reload and try again.",
        );
        return;
      }
      nextPerson.version = result.item.version;
    }
    update((state) => ({
      ...state,
      participants: state.participants.map((entry) =>
        entry.id === person?.id ? nextPerson : entry,
      ),
    }));
    const hasHeadshot = Boolean(
      nextPerson.headshotUrl ||
        (data.speakerFiles || []).some(
          (file) =>
            file.personId === person?.id &&
            String(file.kind).toLowerCase().includes("headshot"),
        ),
    );
    const profileTasks = data.tasks.filter(
      (task) =>
        task.personId === person?.id &&
        task.title?.toLowerCase().includes("speaker profile"),
    );
    if (nextPerson.name && nextPerson.bio && hasHeadshot) {
      const tasksSaved = await setTaskIdsComplete(
        profileTasks.map((task) => task.id),
        true,
      );
      if (!tasksSaved) return;
      setSavedMessage("Profile saved and the profile task is complete.");
    } else {
      setSavedMessage(
        hasHeadshot
          ? "Profile saved. Add your name and biography to complete the profile task."
          : "Profile saved. Upload a headshot in Files to complete the profile task.",
      );
    }
    setSavedTitle("Profile updated");
    setSaveError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };
  const logout = async () => {
    if (persistenceStatus === "d1") await logoutSharedSession();
    window.location.hash = publicFormId
      ? `/submit/${publicFormId}`
      : "/organizer-login";
    window.location.reload();
  };
  const saveSubmission = async () => {
    if (!editing) return;
    if (editing.reviewOnly) {
      if (!editing.title?.trim() || !editing.description?.trim()) {
        setSaveError("A session title and description are required before confirmation.");
        return;
      }
      const completed = await setTaskIdsComplete(
        editing.completionTaskIds || [],
        true,
      );
      if (!completed) return;
      setEditing(null);
      setSavedTitle("Session confirmed");
      setSavedMessage("Session details confirmed and the related task is complete.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
      return;
    }
    const original = data.abstracts.find((item) => item.id === editing.id);
    const result =
      persistenceStatus === "d1"
        ? await patchSharedResource(
            "submissions",
            editing.id,
            original.version,
            {
              title: editing.title,
              abstract: editing.description,
              category: editing.track,
              answers: original.answers || {},
            },
          )
        : { ok: true, item: { version: (original.version || 0) + 1 } };
    if (!result.ok) {
      setSaveError(
        "Your submission changed elsewhere or could not be saved. Reload and try again.",
      );
      return;
    }
    update((state) => ({
      ...state,
      abstracts: state.abstracts.map((item) =>
        item.id === editing.id
          ? {
              ...item,
              title: editing.title,
              description: editing.description,
              track: editing.track,
              version: result.item.version,
            }
          : item,
      ),
    }));
    setEditing(null);
    setSavedTitle("Submission updated");
    setSavedMessage("Your submission changes have been saved.");
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };
  return (
    <div className="speaker-root">
      <style>
        {PUBLIC_STYLES}
        {SPEAKER_FILE_STYLES}
      </style>
      <header className="speaker-top">
        <button
          className="speaker-account"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="speaker-avatar">
            {person?.initials || data.organizer.initials}
          </span>
          {person?.name || data.organizer.name}
          <ChevronDown size={17} />
        </button>
        {menuOpen ? (
          <div className="speaker-menu">
            <div className="speaker-menu-head">
              <b>{person?.name}</b>
              <span>{person?.email}</span>
            </div>
            <button
              onClick={() => {
                onNavigate("/speaker-portal/profile");
                setMenuOpen(false);
              }}
            >
              <UserCircle size={19} /> Profile
            </button>
            {session?.role !== "speaker" ? (
              <button onClick={() => onNavigate("/dashboard")}>
                <BriefcaseBusiness size={19} /> Back to Admin Mode
              </button>
            ) : null}
            <button onClick={logout}>
              <LogOut size={19} /> Logout
            </button>
          </div>
        ) : null}
      </header>
      <main className="speaker-wrap">
        <h1 className="speaker-title">{activeTitle}</h1>
        <PortalTabs active={active} onNavigate={onNavigate} />
        {active === "home" ? (
          <div className="speaker-home-grid">
            <section className="speaker-next-action">
              <div>
                <span className="speaker-kicker">
                  {openTasks.length ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}` : "Onboarding complete"}
                </span>
                <h2>
                  {openTasks.length
                    ? openTasks[0].title
                    : "You’re ready for the event"}
                </h2>
                <p>
                  {openTasks.length
                    ? openTasks[0].notes || "Complete this item for the event team."
                    : "All currently assigned speaker work is complete."}
                </p>
              </div>
              {openTasks.length ? (
                <button onClick={() => openTask(openTasks[0])}>
                  Continue <ArrowRight size={16} />
                </button>
              ) : null}
            </section>
            <section className="speaker-card speaker-summary-card">
              <header className="speaker-card-head">
                <span>
                  <CalendarDays size={23} />
                  My Submissions ({submissions.length})
                </span>
                <button
                  onClick={() => onNavigate("/speaker-portal/submissions")}
                >
                  View All
                </button>
              </header>
              <div className="speaker-card-body">
                {submissions.slice(0, 1).map((item, index) => (
                  <PortalSubmission key={item.id} item={item} index={index} />
                ))}
              </div>
            </section>
            <section className="speaker-card speaker-summary-card">
              <header className="speaker-card-head">
                <span>
                  <UserCircle size={23} />
                  My Profile
                </span>
              </header>
              <div className="speaker-card-body">
                <div className="speaker-profile-summary">
                  <span className="speaker-avatar">{person?.initials}</span>
                  <div>
                    <b>{person?.name}</b>
                    <span>{person?.email}</span>
                  </div>
                </div>
                <button
                  className="speaker-link"
                  onClick={() => onNavigate("/speaker-portal/profile")}
                >
                  Edit profile
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {active === "submissions" ? (
          <section className="speaker-card">
            <header className="speaker-card-head">
              <span>
                <CalendarDays size={23} />
                My Submissions ({submissions.length})
              </span>
              <button
                disabled={!publicFormId}
                title={publicFormId ? "Start another proposal" : "No open submission form is available"}
                onClick={() => publicFormId && onNavigate(`/submit/${publicFormId}`)}
              >
                New Submission
              </button>
            </header>
            <div className="speaker-card-body">
              {submissions.map((item, index) => (
                <PortalSubmission
                  key={item.id}
                  item={item}
                  index={index}
                  onEdit={setEditing}
                />
              ))}
              {editing ? (
                <div className="speaker-edit">
                  {editing.reviewOnly ? (
                    <div className="speaker-storage-note">
                      Review the accepted session below. Confirming it completes
                      only this session’s onboarding task.
                    </div>
                  ) : null}
                  <label>
                    Session title
                    <input
                      readOnly={editing.reviewOnly}
                      value={editing.title}
                      onChange={(event) =>
                        setEditing({ ...editing, title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      readOnly={editing.reviewOnly}
                      value={editing.description}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Track
                    <input
                      readOnly={editing.reviewOnly}
                      value={editing.track}
                      onChange={(event) =>
                        setEditing({ ...editing, track: event.target.value })
                      }
                    />
                  </label>
                  <div className="speaker-edit-actions">
                    <button onClick={() => setEditing(null)}>Cancel</button>
                    <button
                      disabled={!editing.title.trim()}
                      onClick={saveSubmission}
                    >
                      {editing.reviewOnly ? "Confirm session details" : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {active === "tasks" ? (
          <section className="speaker-card">
            <header className="speaker-card-head">
              <span>
                <BriefcaseBusiness size={23} />
                Tasks
              </span>
            </header>
            <div className="speaker-card-body">
              <div className="speaker-task-tabs">
                <button
                  className={taskTab === "all" ? "active" : ""}
                  onClick={() => setTaskTab("all")}
                >
                  All tasks ({portalTasks.filter((task) => !task.complete).length} open)
                </button>
                <button
                  className={taskTab === "mine" ? "active" : ""}
                  onClick={() => setTaskTab("mine")}
                >
                  Profile ({personTasks.filter((task) => !task.complete).length} open)
                </button>
                <button
                  className={taskTab === "submissions" ? "active" : ""}
                  onClick={() => setTaskTab("submissions")}
                >
                  Sessions &amp; forms ({submissionTasks.filter((task) => !task.complete).length} open)
                </button>
              </div>
              <PortalTaskGroups
                tasks={shownTasks}
                submissions={submissions}
                onAction={openTask}
                onToggle={markTask}
              />
            </div>
          </section>
        ) : null}
        {active === "profile" ? (
          <div className="speaker-profile-page">
            <div className="speaker-identity">
              <span className="speaker-avatar">
                {person?.headshotUrl ? (
                  <img
                    className="speaker-avatar-image"
                    src={person.headshotUrl}
                    alt=""
                  />
                ) : (
                  person?.initials
                )}
              </span>
              <div>
                <h2>{person?.name}</h2>
                <span>{person?.email}</span>
              </div>
            </div>
            <button className="speaker-profile-tab">Profile Info</button>
            <div className="speaker-profile-requirements">
              <CheckCircle2 size={17} />
              Profile tasks complete after a biography and approved headshot are saved.
              <button onClick={() => onNavigate("/speaker-portal/files")}>Manage headshot</button>
            </div>
            <section className="speaker-profile-box">
              <h3>
                General <ChevronDown size={18} />
              </h3>
              <label className="speaker-field">
                Biography
                <div className="speaker-bio-editor">
                  <div className="speaker-editor-bar">
                    <b>B</b>
                    <i>I</i>
                    <u>U</u>
                    <List size={20} />
                    <AlignLeft size={20} />
                  </div>
                  <textarea
                    placeholder="Enter text here..."
                    maxLength={5000}
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile({ ...profile, bio: event.target.value })
                    }
                  />
                </div>
                <span className="speaker-counter">
                  {profile.bio.length} / 5,000 characters
                </span>
              </label>
              <div className="speaker-form-grid">
                <PortalInput
                  label="Salutation"
                  value={profile.salutation}
                  onChange={(value) =>
                    setProfile({ ...profile, salutation: value })
                  }
                />
                <PortalInput
                  label="First Name"
                  value={profile.firstName}
                  onChange={(value) =>
                    setProfile({ ...profile, firstName: value })
                  }
                />
                <PortalInput
                  label="Last Name"
                  value={profile.lastName}
                  onChange={(value) =>
                    setProfile({ ...profile, lastName: value })
                  }
                />
                <PortalInput
                  label="Honorific"
                  value={profile.honorific}
                  onChange={(value) =>
                    setProfile({ ...profile, honorific: value })
                  }
                />
                <PortalInput
                  label="Professional Title"
                  value={profile.title}
                  onChange={(value) =>
                    setProfile({ ...profile, title: value })
                  }
                />
                <PortalInput
                  label="Company"
                  value={profile.company}
                  onChange={(value) =>
                    setProfile({ ...profile, company: value })
                  }
                />
                <PortalSelect
                  label="Pronouns"
                  value={profile.pronouns}
                  onChange={(value) =>
                    setProfile({ ...profile, pronouns: value })
                  }
                />
                <PortalSelect
                  label="Gender"
                  value={profile.gender}
                  onChange={(value) =>
                    setProfile({ ...profile, gender: value })
                  }
                />
              </div>
            </section>
            <section className="speaker-profile-box">
              <h3>
                My Links <ChevronDown size={18} />
              </h3>
              <div className="speaker-links">
                <PortalInput
                  label="LinkedIn URL"
                  value={profile.linkedin}
                  onChange={(value) =>
                    setProfile({ ...profile, linkedin: value })
                  }
                />
                <PortalInput
                  label="X (Twitter) URL"
                  value={profile.twitter}
                  onChange={(value) =>
                    setProfile({ ...profile, twitter: value })
                  }
                />
                <PortalInput
                  label="Facebook URL"
                  value={profile.facebook}
                  onChange={(value) =>
                    setProfile({ ...profile, facebook: value })
                  }
                />
                <PortalInput
                  label="Website"
                  value={profile.website}
                  onChange={(value) =>
                    setProfile({ ...profile, website: value })
                  }
                />
              </div>
              <div className="speaker-save">
                <button onClick={saveProfile}>Save Profile</button>
              </div>
            </section>
          </div>
        ) : null}
        <SpeakerPortalForms
          active={active}
          focusFormId={focusFormId}
        />
        {active === "files" ? (
          <div className="speaker-files-page">
            <SpeakerOnboardingPanel personId={person?.id} showRequests={false} />
            <SpeakerFileRequestsPanel active={active} />
          </div>
        ) : null}
      </main>
      {saved ? (
        <div className="speaker-toast">
          <b>{savedTitle}</b>
          <br />
          {savedMessage}
        </div>
      ) : null}
      {saveError ? (
        <div className="speaker-toast">
          <b>Save failed</b>
          <br />
          {saveError}
        </div>
      ) : null}
    </div>
  );
}

function PortalTaskGroups({ tasks, submissions, onToggle, onAction }) {
  const groups = tasks.reduce((current, task) => {
    const submission = relatedSubmission(task, submissions);
    const title = submission?.title ||
      (task.scope === "Contact" ? "Speaker profile" : "Travel and logistics");
    current.set(title, [...(current.get(title) || []), task]);
    return current;
  }, new Map());
  const render = (title, rows) => {
    const orderedRows = [...rows].sort(
      (left, right) => Number(left.complete) - Number(right.complete),
    );
    const openCount = orderedRows.filter((task) => !task.complete).length;
    return (
    <section className="speaker-task-group">
      <div className="speaker-task-group-head">
        <div>
          <h3>{title}</h3>
          <span>{openCount ? `${openCount} open` : "Complete"}</span>
        </div>
      </div>
      {orderedRows.length ? (
        orderedRows.map((task) => {
          const actionable =
            task.kind === "form" ||
            task.scope === "Submission" ||
            task.title?.toLowerCase().includes("speaker profile");
          return (
          <div
            key={task.id}
            className={`speaker-task-row ${task.complete ? "complete" : ""}`}
          >
            <BriefcaseBusiness size={18} />
            <div>
              <b>{task.title}</b>
              <div>{task.notes || task.scope}</div>
            </div>
          <button onClick={() => actionable ? onAction(task) : onToggle(task)}>
            {task.complete
              ? "Completed"
              : task.kind === "form"
                ? "Open form"
                : task.scope === "Submission"
                  ? "Review details"
                  : task.title?.toLowerCase().includes("speaker profile")
                    ? "Edit profile"
                    : "Mark complete"}
            </button>
          </div>
          );
        })
      ) : (
        <div className="speaker-empty">No {title.toLowerCase()} found.</div>
      )}
    </section>
    );
  };
  return (
    <>
      {[...groups.entries()]
        .sort(([, leftRows], [, rightRows]) =>
          Number(leftRows.every((task) => task.complete)) -
          Number(rightRows.every((task) => task.complete)),
        )
        .map(([title, rows]) => (
          <div key={title}>{render(title, rows)}</div>
        ))}
    </>
  );
}

function PortalInput({ label, value, onChange }) {
  return (
    <label className="speaker-field">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
function PortalSelect({ label, value, onChange }) {
  return (
    <label className="speaker-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select...</option>
        <option>she/her</option>
        <option>he/him</option>
        <option>they/them</option>
        <option>Prefer not to say</option>
      </select>
    </label>
  );
}
