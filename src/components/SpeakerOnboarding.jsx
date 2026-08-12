import { useMemo, useState } from "react";
import {
  Download,
  FileInput,
  FileText,
  Globe2,
  Image,
  Upload,
} from "lucide-react";
import { useAppStore } from "../store.jsx";
import {
  abstractsForParticipant,
  acceptedParticipants,
} from "../lib/domain.js";
import { uploadSharedFile } from "../lib/sharedApi.js";

const styles = `
.onboarding-grid{grid-column:1/-1;display:grid;grid-template-columns:1.05fr 1fr;gap:34px}.onboarding-card{border:1px solid #e1e5eb;border-radius:13px;background:#fff;overflow:hidden;box-shadow:0 2px 5px rgba(16,24,40,.06)}.onboarding-head{min-height:70px;background:#4564e9;color:#fff;padding:0 24px;display:flex;align-items:center;gap:11px;font-size:17px}.onboarding-head span:last-child{margin-left:auto;font-size:12px}.onboarding-body{padding:22px}.upload-kind{display:flex;gap:8px;margin-bottom:14px}.upload-kind button{height:35px;padding:0 12px;border:1px solid #dce2ea;border-radius:8px;background:#fff;color:#637086;font-size:11px;cursor:pointer}.upload-kind button.active{border-color:#5570ec;background:#f2f5ff;color:#4564e9}.speaker-upload{position:relative;min-height:116px;border:1px dashed #bac6d6;border-radius:10px;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#718096;cursor:pointer}.speaker-upload b{margin:8px 0 4px;color:#2e3746;font-size:13px}.speaker-upload small{font-size:10px}.speaker-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}.speaker-file-list,.speaker-resource-list{display:grid;gap:10px;margin-top:16px}.speaker-file,.speaker-resource{min-height:63px;border:1px solid #e1e6ed;border-radius:9px;padding:11px 12px;display:flex;align-items:center;gap:12px}.speaker-file-icon,.speaker-resource-icon{width:38px;height:38px;border-radius:8px;background:#eef2ff;color:#4564e9;display:grid;place-items:center;flex:none}.speaker-file b,.speaker-file small,.speaker-resource b,.speaker-resource small{display:block}.speaker-file b,.speaker-resource b{font-size:12px}.speaker-file small,.speaker-resource small{margin-top:4px;color:#79869a;font-size:10px}.speaker-file a,.speaker-resource a,.speaker-resource button{margin-left:auto;border:0;background:transparent;color:#4564e9;cursor:pointer}.resource-html{margin-top:10px;border:1px solid #e1e6ed;border-radius:9px;overflow:hidden}.resource-html iframe{width:100%;height:180px;border:0;background:#fff}@media(max-width:900px){.onboarding-grid{grid-template-columns:1fr}}
.request-list{margin-top:22px}.request-list h4,.portal-library h4{margin:0 0 10px;font-size:12px}.request-row{position:relative;min-height:60px;border:1px solid #e1e6ed;border-radius:9px;padding:11px 12px;display:flex;align-items:center;gap:11px}.request-row+.request-row{margin-top:8px}.request-row input{position:absolute;inset:0;opacity:0;cursor:pointer}.request-row span{margin-left:auto;color:#4564e9;font-size:10px}.portal-library{margin-top:20px}
.speaker-files-page .onboarding-grid{gap:18px}.speaker-files-page .onboarding-card{border-radius:10px;box-shadow:none}.speaker-files-page .onboarding-head{min-height:52px;padding:0 18px;font-size:14px}.speaker-files-page .onboarding-body{padding:16px}.speaker-files-page .speaker-upload{min-height:88px}.speaker-files-page .speaker-file-list,.speaker-files-page .speaker-resource-list{margin-top:12px;gap:8px}.speaker-files-page .speaker-file,.speaker-files-page .speaker-resource{min-height:55px;padding:9px 11px}.speaker-files-page .request-list{margin-top:16px}
`;

const fallbackResources = [
  {
    id: "resource-guide",
    title: "Speaker preparation guide",
    kind: "Article",
    description:
      "Dates, deliverables, accessibility guidance, and presentation tips.",
    audience: "Accepted speakers",
  },
  {
    id: "resource-av",
    title: "Stage and A/V specifications",
    kind: "Article",
    description:
      "Presentation format, slide dimensions, microphones, and rehearsal guidance.",
    audience: "Accepted speakers",
  },
  {
    id: "resource-code",
    title: "Speaker code of conduct",
    kind: "Link",
    url: "https://example.com/code-of-conduct",
    description: "Review the event code of conduct before presenting.",
    audience: "All portal users",
  },
];

function readUpload(file) {
  if (!file || file.size > 1_500_000) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function SpeakerOnboardingPanel({ personId, showRequests = true }) {
  const { data, update, persistenceStatus } = useAppStore();
  const [kind, setKind] = useState("Headshot");
  const shared = persistenceStatus === "d1";
  const storageReady = shared && Boolean(data.objectStorageAvailable);
  const [uploadError, setUploadError] = useState("");
  const isAccepted = acceptedParticipants(data).some(
    (person) => person.id === personId,
  );
  const resourceSource = shared
    ? data.resources || []
    : data.resources?.length
      ? data.resources
      : fallbackResources;
  const resources = resourceSource.filter(
    (resource) => resource.audience !== "Accepted speakers" || isAccepted,
  );
  const files = useMemo(() => {
    return (data.speakerFiles || [])
      .filter((file) => file.personId === personId)
      .sort(
        (left, right) =>
          Number(right.version || 1) - Number(left.version || 1) ||
          String(right.uploadedAt || right.uploaded || "").localeCompare(
            String(left.uploadedAt || left.uploaded || ""),
          ),
      );
  }, [data.speakerFiles, personId]);
  const abstractIds = useMemo(
    () =>
      new Set(
        abstractsForParticipant(data, personId).map((abstract) => abstract.id),
      ),
    [data, personId],
  );
  const requests = useMemo(
    () =>
      (data.fileRequests || []).filter(
        (request) =>
          request.type !== "Submission" ||
          !(request.submissionId || request.abstractId) ||
          abstractIds.has(request.submissionId || request.abstractId),
      ),
    [data.fileRequests, abstractIds],
  );
  const fileContext = (file) => {
    const submission = data.abstracts.find(
      (item) => item.id === file.submissionId,
    );
    return submission?.title || "Speaker profile";
  };

  const addFile = async (file, request = null) => {
    if (!file) return;
    if (shared) {
      if (!storageReady) return;
      setUploadError("");
      const uploadKind = request?.title?.toLowerCase().includes("headshot")
        ? "Headshot"
        : request?.title || kind;
      const result = await uploadSharedFile(file, {
        kind: uploadKind,
        fileRequestId: request?.id,
        submissionId: request?.submissionId || request?.abstractId,
      });
      if (!result.ok) {
        setUploadError(
          result.error === "FILE_TOO_LARGE"
            ? "Choose a file smaller than 10 MB."
            : "The file could not be uploaded.",
        );
        return;
      }
      const record = {
        id: result.item.id,
        personId: result.item.ownerPersonId,
        requestId: result.item.fileRequestId || request?.id || null,
        fileRequestId: result.item.fileRequestId || request?.id || null,
        submissionId: result.item.submissionId || request?.submissionId || null,
        kind: result.item.kind,
        name: result.item.name,
        size: result.item.sizeBytes,
        mimeType: result.item.mimeType,
        uploadedAt: result.item.createdAt,
        downloadUrl: `/api/files/${encodeURIComponent(result.item.id)}/content`,
        version: result.item.version,
      };
      const profileHasBiography = Boolean(
        data.participants.find((person) => person.id === personId)?.bio?.trim(),
      );
      const profileCompleted =
        uploadKind === "Headshot" &&
        profileHasBiography &&
        Boolean(result.person?.headshotUrl);
      update((state) => ({
        ...state,
        speakerFiles: [...(state.speakerFiles || []), record],
        portalFiles: [...(state.portalFiles || []), record],
        participants: result.person
          ? state.participants.map((person) =>
              person.id === result.person.id
                ? {
                    ...person,
                    headshotUrl: result.person.headshotUrl,
                    version: result.person.version,
                  }
                : person,
            )
          : state.participants,
        tasks: state.tasks.map((task) =>
          profileCompleted &&
          task.personId === personId &&
          task.title?.toLowerCase().includes("speaker profile")
            ? {
                ...task,
                complete: true,
              }
            : task,
        ),
      }));
      return;
    }
    const dataUrl = await readUpload(file);
    const record = {
      id: `speaker-file-${Date.now()}`,
      personId,
      requestId: request?.id ?? null,
      submissionId: request?.submissionId || request?.abstractId || null,
      kind: request ? "Requested document" : kind,
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      dataUrl,
    };
    update((state) => ({
      ...state,
      speakerFiles: [...(state.speakerFiles || []), record],
      fileRequests: request
        ? (state.fileRequests || []).map((item) =>
            item.id === request.id
              ? { ...item, files: [...(item.files || []), record.id] }
              : item,
          )
        : state.fileRequests,
      participants:
        kind === "Headshot"
          ? state.participants.map((person) =>
              person.id === personId
                ? {
                    ...person,
                    headshotUrl: dataUrl || "",
                    headshotName: file.name,
                  }
                : person,
            )
          : state.participants,
      tasks: state.tasks.map((task) => {
        const assignedToPerson = task.personId === personId;
        const assignedAbstract =
          task.abstractId &&
          state.abstracts.some(
            (abstract) =>
              abstract.id === task.abstractId &&
              abstract.participantIds?.includes(personId),
          );
        if (request)
          return task.fileRequestId === request.id &&
            (assignedToPerson || assignedAbstract)
            ? { ...task, complete: true }
            : task;
        return (assignedToPerson || assignedAbstract) &&
          task.title.toLowerCase().includes(kind.toLowerCase())
          ? { ...task, complete: true }
          : task;
      }),
    }));
  };

  return (
    <>
      <style>{styles}</style>
      <div className="onboarding-grid">
        <section className="onboarding-card">
          <header className="onboarding-head">
            <Upload size={21} />
            My files <span>{files.length} uploaded</span>
          </header>
          <div className="onboarding-body">
            <div className="upload-kind">
              {["Headshot", "Slides", "Supporting document"].map((label) => (
                <button
                  className={kind === label ? "active" : ""}
                  key={label}
                  onClick={() => setKind(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="speaker-upload">
              <Upload size={25} />
              <b>
                {shared && !storageReady
                  ? "File uploads are not connected yet"
                  : `Upload ${kind.toLowerCase()}`}
              </b>
              <small>
                {shared && !storageReady
                  ? "The shared preview will enable this after scoped object storage is connected."
                  : shared
                    ? "Private files up to 10 MB are stored in the shared event workspace."
                    : "Files are saved to this local demo. Production uses object storage."}
              </small>
              <input
                type="file"
                disabled={shared && !storageReady}
                accept={kind === "Headshot" ? "image/*" : undefined}
                onChange={(event) => addFile(event.target.files?.[0])}
              />
            </label>
            {uploadError ? (
              <small
                style={{ color: "#b42318", display: "block", marginTop: 8 }}
              >
                {uploadError}
              </small>
            ) : null}
            <div className="speaker-file-list">
              {files.map((file) => (
                <article className="speaker-file" key={file.id}>
                  <span className="speaker-file-icon">
                    {file.kind === "Headshot" ? (
                      <Image size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </span>
                  <div>
                    <b>{file.name}</b>
                    <small>
                      {file.kind} · {Math.max(1, Math.round(file.size / 1024))}{" "}
                      KB · {fileContext(file)}
                      {file.version ? ` · version ${file.version}` : ""}
                    </small>
                  </div>
                  {file.dataUrl || file.downloadUrl ? (
                    <a
                      href={file.dataUrl || file.downloadUrl}
                      download={file.name}
                      aria-label={`Download ${file.name}`}
                    >
                      <Download size={17} />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
            {showRequests && requests.length ? (
              <div className="request-list">
                <h4>Requested files</h4>
                {requests.map((request) => {
                  const fulfilled = files.filter(
                    (file) => file.requestId === request.id,
                  ).length;
                  return (
                    <label className="request-row" key={request.id}>
                      <FileInput size={18} />
                      <div>
                        <b>{request.title}</b>
                        <small>
                          {request.instructions ||
                            "Upload the requested document"}
                        </small>
                      </div>
                      <span>
                        {fulfilled ? `${fulfilled} uploaded` : "Upload"}
                      </span>
                      <input
                        type="file"
                        onChange={(event) =>
                          addFile(event.target.files?.[0], request)
                        }
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
        <section className="onboarding-card">
          <header className="onboarding-head">
            <Globe2 size={21} />
            Resources &amp; wiki <span>{resources.length} available</span>
          </header>
          <div className="onboarding-body">
            <div className="speaker-resource-list">
              {resources.map((resource) => (
                <div key={resource.id}>
                  {resource.kind === "HTML Embed" ? (
                    <div className="resource-html">
                      <iframe
                        title={resource.title}
                        sandbox=""
                        srcDoc={resource.description || ""}
                      />
                    </div>
                  ) : (
                    <article className="speaker-resource">
                      <span className="speaker-resource-icon">
                        {resource.kind === "Link" ? (
                          <Globe2 size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </span>
                      <div>
                        <b>{resource.title}</b>
                        <small>
                          {resource.description || resource.audience}
                        </small>
                      </div>
                      {resource.kind === "Link" && resource.url ? (
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        <button type="button">Read</button>
                      )}
                    </article>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
