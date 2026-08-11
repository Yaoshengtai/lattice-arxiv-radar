"use client";

import {
  ArrowLeft, ArrowUpRight, Atom, Bookmark, BookOpen, Check, ChevronRight,
  CircleGauge, Clipboard, Clock3, FileText, FlaskConical, History,
  Globe2, LibraryBig, Menu, NotebookPen, Plus, Radar, RefreshCw, Search, Sparkles,
  Tag, Upload, UserRound, X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { DashboardPaper, DashboardState, PaperRecord, ProfileSnapshot } from "../lib/research-types";
import InlineMathText from "./inline-math-text";
import MathBlock from "./math-block";

type View = "radar" | "library" | "profile" | "report";
type Notice = { text: string; error?: boolean } | null;

function currentProfile(state: DashboardState): ProfileSnapshot {
  return state.profile.versions.find((version) => version.version === state.profile.currentVersion)
    ?? state.profile.versions.at(-1)!;
}

function scoreTone(score: number) {
  if (score >= 90) return "score-exceptional";
  if (score >= 80) return "score-strong";
  return "score-good";
}

function ScoreRing({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  return <div className={`score-ring ${size} ${scoreTone(score)}`} style={{ "--score": score } as React.CSSProperties} aria-label={`${score} percent fit`}><strong>{score}</strong>{size === "large" && <span>FIT</span>}</div>;
}

function Breakdown({ paper }: { paper: DashboardPaper }) {
  return <div className="breakdown">{Object.entries(paper.breakdown).map(([label, value]) => <div className="breakdown-row" key={label}><span>{label}</span><div className="score-track"><i style={{ width: `${value}%` }} /></div><strong>{value}</strong></div>)}</div>;
}

export default function RadarApp({ initialState, mode = "local", snapshotGeneratedAt }: { initialState: DashboardState; mode?: "local" | "public"; snapshotGeneratedAt?: string }) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<View>("radar");
  const [selectedId, setSelectedId] = useState(initialState.library.papers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [reloading, setReloading] = useState(false);
  const profile = currentProfile(state);
  const selected = state.library.papers.find((paper) => paper.id === selectedId) ?? null;
  const pendingCount = state.inbox.filter((item) => item.status === "pending").length;
  const isPublic = mode === "public";
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.library.papers;
    return state.library.papers.filter((paper) => `${paper.title} ${paper.authors.join(" ")} ${paper.tags.join(" ")} ${paper.personalTags.join(" ")}`.toLowerCase().includes(needle));
  }, [query, state.library.papers]);

  function notify(text: string, error = false) {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 3200);
  }

  function navigate(next: View) {
    setView(next); setSidebarOpen(false); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openReport(id: string) { setSelectedId(id); navigate("report"); }

  async function reload() {
    setReloading(true);
    try {
      const response = await fetch("/api/local", { cache: "no-store" });
      const result = await response.json() as DashboardState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Local data could not be refreshed.");
      setState(result); notify("Local research data refreshed.");
    } catch (error) { notify(error instanceof Error ? error.message : "Refresh failed.", true); }
    finally { setReloading(false); }
  }

  async function copyCommand(command: string) {
    await navigator.clipboard.writeText(command);
    notify(`Copied: ${command}`);
  }

  async function patchPaper(id: string, update: Partial<Pick<PaperRecord, "read" | "saved" | "personalTags" | "personalNote">>) {
    const response = await fetch("/api/local", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "paper-state", id, ...update }) });
    const result = await response.json() as { paper?: PaperRecord; error?: string };
    if (!response.ok || !result.paper) { notify(result.error ?? "Paper state could not be saved.", true); return; }
    setState((current) => ({ ...current, library: { ...current.library, papers: current.library.papers.map((paper) => paper.id === id ? { ...paper, ...result.paper } : paper) } }));
    notify("Library changes saved locally.");
  }

  return <main className="app-canvas">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <button className="brand" onClick={() => navigate("radar")}><span className="brand-mark"><Atom size={21} /></span><span><strong>Lattice</strong><small>{isPublic ? "PUBLIC RESEARCH SNAPSHOT" : "LOCAL RESEARCH LIBRARY"}</small></span></button>
      <nav aria-label="Main navigation">
        <button className={view === "radar" ? "active" : ""} onClick={() => navigate("radar")}><Radar size={18} /> Radar <span>{state.library.runs.at(-1)?.selectedIds.length ?? 0}</span></button>
        <button className={view === "library" ? "active" : ""} onClick={() => navigate("library")}><LibraryBig size={18} /> Library</button>
        <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><UserRound size={18} /> Research profile</button>
      </nav>
      <div className="sidebar-rule" />
      <div className="profile-mini"><div className="mini-label"><span>PROFILE VERSION</span><strong>v{profile.version}</strong></div><div className="mini-progress"><i style={{ width: `${Math.min(100, profile.topics.length * 16 + profile.seeds.length * 7)}%` }} /></div><p>{profile.summary}</p><button onClick={() => navigate("profile")}>Open profile <ChevronRight size={15} /></button></div>
      <div className="sidebar-bottom"><div className="avatar">L</div><div><strong>{isPublic ? "Public snapshot" : "Local workspace"}</strong><span>{isPublic ? "Read-only GitHub Pages" : "Files stay on this computer"}</span></div><Check size={16} /></div>
    </aside>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

    <section className="main-shell">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="top-search"><Search size={17} /><input aria-label="Search papers" placeholder="Search papers, authors, concepts, or personal tags…" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="top-actions">{isPublic ? <button className="secondary-action" onClick={() => copyCommand("Process profile inbox")}><Clipboard size={16} /> Copy profile command</button> : <button className="secondary-action" onClick={() => setAddOpen(true)}><Plus size={17} /> Update profile</button>}<button className="primary-action" onClick={() => copyCommand("Run an arXiv scan using my current profile")}><Clipboard size={16} /> Copy scan command</button>{!isPublic && <button className="icon-button" aria-label="Refresh local data" onClick={reload}><RefreshCw size={17} className={reloading ? "spinning" : ""} /></button>}</div></header>
      {isPublic && <div className="public-snapshot-banner"><Globe2 size={17} /><span><strong>Public read-only snapshot</strong>To update it, run a Lattice command in Codex. Published {snapshotGeneratedAt ? new Date(snapshotGeneratedAt).toLocaleString("en-US") : "from the local workspace"}.</span></div>}
      {view === "radar" && <Dashboard state={state} papers={filtered} profile={profile} openReport={openReport} copyCommand={copyCommand} isPublic={isPublic} />}
      {view === "library" && <LibraryView papers={filtered} openReport={openReport} patchPaper={patchPaper} isPublic={isPublic} />}
      {view === "profile" && <ProfileView state={state} profile={profile} openForm={() => setAddOpen(true)} copyCommand={copyCommand} notify={notify} setState={setState} isPublic={isPublic} />}
      {view === "report" && selected && <ReportView paper={selected} back={() => navigate("radar")} patchPaper={patchPaper} isPublic={isPublic} />}
      {view === "report" && !selected && <EmptyState title="No report selected" detail="Run a Codex scan or open a paper from the library." />}
    </section>
    {!isPublic && addOpen && <ProfileUpdateModal close={() => setAddOpen(false)} submitted={async (message) => { setAddOpen(false); notify(message); await reload(); }} notify={notify} />}
    {notice && <div className={`toast ${notice.error ? "error" : ""}`}><Check size={17} /> {notice.text}</div>}
    {!isPublic && pendingCount > 0 && view !== "profile" && <button className="pending-pill" onClick={() => navigate("profile")}>{pendingCount} profile update{pendingCount === 1 ? "" : "s"} pending</button>}
  </main>;
}

function Dashboard({ state, papers, profile, openReport, copyCommand, isPublic }: { state: DashboardState; papers: DashboardPaper[]; profile: ProfileSnapshot; openReport: (id: string) => void; copyCommand: (command: string) => void; isPublic: boolean }) {
  const run = state.library.runs.at(-1);
  const selected = run ? run.selectedIds.map((id) => papers.find((paper) => paper.id === id)).filter((paper): paper is DashboardPaper => Boolean(paper)) : [];
  return <div className="page dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><span /> ON-DEMAND PAPER RADAR</div><h1>Your research frontier,<br /><em>{isPublic ? "published as a snapshot." : "organized locally."}</em></h1></div><div className="next-run"><Clock3 size={16} /><span>HOW TO SCAN<strong>Ask Codex when you are ready</strong></span><button onClick={() => copyCommand("Run an arXiv scan using my current profile")}><Clipboard size={16} /></button></div></div>
    <div className="batch-summary"><div><span>LATEST RUN</span><strong>{run ? new Date(run.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not run yet"}</strong></div><div><span>CANDIDATES</span><strong>{run?.candidateCount ?? 0}</strong></div><div><span>SELECTED</span><strong>{run?.selectedIds.length ?? 0} / 5</strong></div><div><span>PROFILE</span><strong>v{profile.version}</strong></div><button onClick={() => copyCommand("Run an arXiv scan using my current profile")}><Sparkles size={16} /> Copy Codex command</button></div>
    <div className="section-title"><div><h2>Latest recommendations</h2><p>Full, math-aware reports scoring 60 or higher. Previously recommended arXiv IDs are excluded.</p></div></div>
    <div className="paper-list">{selected.length ? selected.map((paper, index) => <PaperCard key={paper.id} paper={paper} rank={index + 1} open={() => openReport(paper.id)} />) : <EmptyState title="Your radar is ready" detail="Copy the scan command and send it in the Lattice Codex search task." action={() => copyCommand("Run an arXiv scan using my current profile")} />}</div>
    <div className="dashboard-lower"><section className="insight-card"><div className="card-heading"><span><CircleGauge size={17} /> Current profile</span></div><h3>{profile.summary}</h3><p>{profile.topics.length ? `Strongest signals: ${profile.topics.slice(0, 3).map((topic) => topic.name).join(", ")}.` : "Submit research notes, arXiv links, or PDFs to build your first profile."}</p><div className="signal-tags">{profile.topics.slice(0, 5).map((topic) => <span key={topic.name}>{topic.name} <b>{topic.weight}%</b></span>)}</div></section><section className="activity-card"><div className="card-heading"><span><History size={17} /> Recent activity</span></div>{state.activity.slice(0, 4).map((item) => <div className="activity-row" key={item.id}><i /><span><strong>{item.title}</strong><small>{item.detail}</small></span><time>{new Date(item.at).toLocaleDateString("en-US")}</time></div>)}{!state.activity.length && <p className="muted-copy">Profile changes and scans will appear here.</p>}</section></div>
  </div>;
}

function PaperCard({ paper, rank, open }: { paper: DashboardPaper; rank: number; open: () => void }) {
  return <article className="paper-card"><div className="paper-rank">{String(rank).padStart(2, "0")}</div><ScoreRing score={paper.score} /><div className="paper-main"><div className="paper-meta"><span>{paper.primaryCategory}</span><span>{new Date(paper.publishedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span><span className={`density ${paper.mathDensity.toLowerCase()}`}><FlaskConical size={12} /> {paper.mathDensity} math</span><span className={`status ${paper.reportStatus === "Ready" ? "ready" : "working"}`}>{paper.reportStatus}</span></div><h3><button className="paper-title-button" onClick={open}>{paper.title}</button></h3><p className="authors">{paper.authors.join(", ")}</p><p className="rationale">{paper.rationale}</p><div className="paper-tags">{paper.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="paper-side"><Breakdown paper={paper} /><button onClick={open} aria-label={`Open report for ${paper.title}`}><ArrowUpRight size={18} /></button></div></article>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: () => void }) {
  return <div className="empty-state"><Search size={26} /><h3>{title}</h3><p>{detail}</p>{action && <button className="primary-action" onClick={action}><Clipboard size={15} /> Copy command</button>}</div>;
}

function LibraryView({ papers, openReport, patchPaper, isPublic }: { papers: DashboardPaper[]; openReport: (id: string) => void; patchPaper: (id: string, update: Partial<PaperRecord>) => void; isPublic: boolean }) {
  const [filter, setFilter] = useState<"All" | "Saved" | "Unread">("All");
  const visible = papers.filter((paper) => isPublic || filter === "All" || (filter === "Saved" ? paper.saved : !paper.read));
  return <div className="page simple-page"><div className="simple-heading"><div><div className="eyebrow"><span /> {isPublic ? "PUBLIC RESEARCH LIBRARY" : "LOCAL RESEARCH LIBRARY"}</div><h1>Your paper archive.</h1><p>{isPublic ? "A read-only collection of published recommendations and reports." : "Reports, reading state, tags, and notes are stored as local project files."}</p></div></div>{!isPublic && <div className="filter-tabs">{(["All", "Saved", "Unread"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>}{visible.length ? <div className={`library-table ${isPublic ? "public-library-table" : ""}`}><div className="table-head"><span>PAPER</span><span>FIT</span>{!isPublic && <span>READ</span>}<span>DATE</span>{!isPublic && <span />}</div>{visible.map((paper) => <div className="table-row" key={paper.id}><button className="table-paper" onClick={() => openReport(paper.id)}><span className="paper-icon"><FileText size={18} /></span><span><strong>{paper.title}</strong><small>{paper.authors.join(", ")} · {paper.id}{!isPublic && paper.personalTags.length ? ` · ${paper.personalTags.join(", ")}` : ""}</small></span></button><ScoreRing score={paper.score} size="small" />{!isPublic && <label className="switch"><span className="sr-only">Mark as read</span><input type="checkbox" checked={paper.read} onChange={(event) => patchPaper(paper.id, { read: event.target.checked })} /><i /></label>}<span>{new Date(paper.publishedAt).toLocaleDateString("en-US")}</span>{!isPublic && <button className={paper.saved ? "saved" : ""} aria-label="Toggle saved" onClick={() => patchPaper(paper.id, { saved: !paper.saved })}><Bookmark size={17} fill={paper.saved ? "currentColor" : "none"} /></button>}</div>)}</div> : <EmptyState title="No papers match this view" detail="Try another filter or run a new scan in Codex." />}</div>;
}

function ProfileView({ state, profile, openForm, copyCommand, notify, setState, isPublic }: { state: DashboardState; profile: ProfileSnapshot; openForm: () => void; copyCommand: (command: string) => void; notify: (text: string, error?: boolean) => void; setState: React.Dispatch<React.SetStateAction<DashboardState>>; isPublic: boolean }) {
  async function restore(version: number) {
    const response = await fetch("/api/local", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rollback-profile", version }) });
    const result = await response.json() as { profile?: DashboardState["profile"]; error?: string };
    if (!response.ok || !result.profile) { notify(result.error ?? "Profile could not be restored.", true); return; }
    setState((current) => ({ ...current, profile: result.profile! })); notify(`Profile v${version} restored.`);
  }
  const pending = state.inbox.filter((item) => item.status === "pending");
  return <div className="page simple-page"><div className="simple-heading"><div><div className="eyebrow"><span /> PROFILE VERSION {profile.version}</div><h1>Your research signal.</h1><p>{isPublic ? "This published profile is a read-only snapshot. Run the process command in Codex to update it." : "Submit locally, then ask Codex to process the inbox and record a transparent profile diff."}</p></div><div className="heading-actions"><button className="secondary-action" onClick={() => copyCommand("Process profile inbox")}><Clipboard size={16} /> Copy process command</button>{!isPublic && <button className="primary-action" onClick={openForm}><Plus size={16} /> Add profile input</button>}</div></div>
    {!isPublic && pending.length > 0 && <section className="inbox-banner"><NotebookPen size={22} /><div><strong>{pending.length} update{pending.length === 1 ? "" : "s"} waiting for Codex</strong><span>Send “Process profile inbox” in the Update research profile task.</span></div><button onClick={() => copyCommand("Process profile inbox")}><Clipboard size={15} /> Copy command</button></section>}
    <div className="profile-grid"><section className="settings-card wide"><div className="card-heading"><span><CircleGauge size={17} /> Topic weights</span><small>{new Date(profile.createdAt).toLocaleString("en-US")}</small></div>{profile.topics.length ? profile.topics.map((topic) => <div className="topic-slider" key={topic.name}><span>{topic.name}<b>{topic.weight}%</b></span><div className="profile-track"><i style={{ width: `${topic.weight}%` }} /></div><small>{topic.evidence.join(" · ")}</small></div>) : <p className="muted-copy">No topics have been extracted yet.</p>}</section><section className="settings-card"><div className="card-heading"><span><Atom size={17} /> arXiv categories</span></div><div className="editable-tags">{profile.categories.map((item) => <span key={item}>{item}</span>)}{!profile.categories.length && <small>None yet</small>}</div></section><section className="settings-card"><div className="card-heading"><span><FlaskConical size={17} /> Mathematical preferences</span></div><div className="preference-list">{profile.mathematics.map((item) => <span key={item}><Check size={14} /> {item}</span>)}{!profile.mathematics.length && <small>None yet</small>}</div></section><section className="settings-card wide"><div className="card-heading"><span><BookOpen size={17} /> Active research seeds</span></div>{profile.seeds.map((seed) => <div className="seed-row" key={seed.id}><span className="paper-icon"><FileText size={17} /></span><span><strong>{seed.title}</strong><small>{seed.label === "core" ? "Core Research" : "Interested Paper"} · {seed.sourceType}</small></span><Check size={16} /></div>)}{!profile.seeds.length && <p className="muted-copy">No active seeds yet.</p>}</section><section className="settings-card"><div className="card-heading"><span><Tag size={17} /> Methods</span></div><div className="editable-tags">{profile.methods.map((item) => <span key={item}>{item}</span>)}</div></section><section className="settings-card"><div className="card-heading"><span><X size={17} /> Excluded signals</span></div><div className="editable-tags negative">{profile.exclusions.map((item) => <span key={item}>{item}</span>)}</div></section><section className="settings-card wide"><div className="card-heading"><span><History size={17} /> Version history</span></div>{[...state.profile.versions].reverse().map((version) => <div className="version-row" key={version.version}><div><strong>Version {version.version}{version.version === state.profile.currentVersion ? " · Active" : ""}</strong><span>{new Date(version.createdAt).toLocaleString("en-US")} · {version.changeSummary.join(" ")}</span></div>{!isPublic && version.version !== state.profile.currentVersion && <button onClick={() => restore(version.version)}>Restore</button>}</div>)}</section></div>
  </div>;
}

function ReportView({ paper, back, patchPaper, isPublic }: { paper: DashboardPaper; back: () => void; patchPaper: (id: string, update: Partial<PaperRecord>) => void; isPublic: boolean }) {
  const [note, setNote] = useState(paper.personalNote);
  const [tags, setTags] = useState(paper.personalTags.join(", "));
  const report = paper.report;
  if (!report) return <div className="page simple-page"><button className="back-link" onClick={back}><ArrowLeft size={16} /> Back to radar</button><EmptyState title="Report file unavailable" detail="Ask Codex to regenerate this report, then refresh local data." /></div>;
  const sections = ["Summary", "Fit", "Problem", "Contributions", "Method", "Equations", "Experiments", "Limitations", "Ideas", ...(!isPublic ? ["Notes"] : [])];
  return <div className="report-layout"><aside className="report-toc"><button className="back-link" onClick={back}><ArrowLeft size={16} /> Back to radar</button><span>IN THIS REPORT</span>{sections.map((section, index) => <a key={section} href={`#section-${index}`}>{String(index + 1).padStart(2, "0")} {section}</a>)}</aside><article className="report-page"><button className="mobile-report-back" onClick={back}><ArrowLeft size={16} /> Back to radar</button><div className="report-meta"><span>{paper.primaryCategory}</span><span>arXiv:{paper.id}</span><span>{new Date(paper.publishedAt).toLocaleDateString("en-US")}</span><span className="verified"><Check size={12} /> {report.report_level === "full" ? "Full report" : "Abstract-level report"}</span></div><h1>{paper.title}</h1><p className="report-authors">{paper.authors.join(", ")}</p><div className="report-actions"><a href={paper.abstractUrl} target="_blank" rel="noreferrer">Abstract <ArrowUpRight size={14} /></a><a href={paper.pdfUrl} target="_blank" rel="noreferrer">PDF <ArrowUpRight size={14} /></a><a href={paper.htmlUrl} target="_blank" rel="noreferrer">HTML <ArrowUpRight size={14} /></a><a href={paper.sourceUrl} target="_blank" rel="noreferrer">Source <ArrowUpRight size={14} /></a></div><div className="report-score-panel"><ScoreRing score={paper.score} /><div><strong>Profile fit: {paper.score}/100</strong><p><InlineMathText>{paper.rationale}</InlineMathText></p></div><Breakdown paper={paper} /></div>
    <ReportSection id="section-0" number="01" title="Executive summary"><p className="lead-copy"><InlineMathText>{report.executive_summary}</InlineMathText></p></ReportSection><ReportSection id="section-1" number="02" title="Why it fits"><p><InlineMathText>{report.why_it_fits}</InlineMathText></p><div className="fit-pills">{paper.tags.map((tag) => <span key={tag}><Check size={13} /> {tag}</span>)}</div></ReportSection><ReportSection id="section-2" number="03" title="Problem formulation"><p><InlineMathText>{report.problem_formulation}</InlineMathText></p></ReportSection><ReportSection id="section-3" number="04" title="Key contributions"><ol className="contribution-list">{report.contributions.map((item) => <li key={item}><InlineMathText>{item}</InlineMathText></li>)}</ol></ReportSection><ReportSection id="section-4" number="05" title="Method"><p><InlineMathText>{report.method}</InlineMathText></p></ReportSection><ReportSection id="section-5" number="06" title="Key equations" accent><p>Original notation is kept separate from model interpretation. Provenance and confidence are shown for every expression.</p>{report.key_equations.map((equation) => <div className="equation-card" key={`${equation.label}-${equation.locator}`}><MathBlock latex={equation.latex} label={equation.label} /><div className="equation-content"><div><span>SYMBOL DEFINITIONS</span><p><InlineMathText>{equation.symbol_definitions.join(" · ") || "Not explicitly specified in the paper"}</InlineMathText></p></div><div><span>PLAIN-ENGLISH INTERPRETATION</span><p><InlineMathText>{equation.interpretation}</InlineMathText></p></div><div><span>ROLE IN THE METHOD</span><p><InlineMathText>{equation.role}</InlineMathText></p></div><div className="equation-foot"><span>{equation.locator}</span><span>{equation.provenance}</span><span>{Math.round(equation.extraction_confidence * 100)}% extraction</span><span>{Math.round(equation.interpretation_confidence * 100)}% interpretation</span></div></div></div>)}</ReportSection><ReportSection id="section-6" number="07" title="Experiments and results"><p><InlineMathText>{report.experiments}</InlineMathText></p></ReportSection><ReportSection id="section-7" number="08" title="Limitations"><ul>{report.limitations.map((item) => <li key={item}><InlineMathText>{item}</InlineMathText></li>)}</ul><h4>Reproducibility</h4><p><InlineMathText>{report.reproducibility}</InlineMathText></p>{report.warnings.length > 0 && <div className="evidence-note"><FileText size={16} /><span><strong>Extraction warnings</strong><InlineMathText>{report.warnings.join(" · ")}</InlineMathText></span></div>}</ReportSection><ReportSection id="section-8" number="09" title="Research ideas"><ol className="idea-list">{report.research_ideas.map((item) => <li key={item}><Sparkles size={16} /><span><InlineMathText>{item}</InlineMathText></span></li>)}</ol></ReportSection>{!isPublic && <><ReportSection id="section-9" number="10" title="Personal organization"><div className="notes-form"><label>Personal tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="causal inference, read next" /></label><label>Personal note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write your own observations…" /></label><button className="primary-action" onClick={() => patchPaper(paper.id, { personalTags: tags.split(","), personalNote: note })}>Save notes</button></div></ReportSection><div className="report-feedback"><div><strong>Reading state</strong><span>These changes are stored in research-data/library.json.</span></div><button onClick={() => patchPaper(paper.id, { read: !paper.read })}><BookOpen size={17} /> {paper.read ? "Mark unread" : "Mark read"}</button><button className={paper.saved ? "saved" : ""} onClick={() => patchPaper(paper.id, { saved: !paper.saved })}><Bookmark size={17} fill={paper.saved ? "currentColor" : "none"} /> {paper.saved ? "Saved" : "Save"}</button></div></>}</article></div>;
}

function ReportSection({ id, number, title, children, accent = false }: { id: string; number: string; title: string; children: React.ReactNode; accent?: boolean }) {
  return <section id={id} className={`report-section ${accent ? "accent" : ""}`}><div className="report-section-heading"><span>{number}</span><h2>{title}</h2></div>{children}</section>;
}

function ProfileUpdateModal({ close, submitted, notify }: { close: () => void; submitted: (message: string) => void; notify: (text: string, error?: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget); form.set("action", "enqueue-profile-update");
    try {
      const response = await fetch("/api/local", { method: "POST", body: form });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Profile input could not be saved.");
      await submitted(result.message ?? "Saved locally — ask Codex to process the profile inbox.");
    } catch (error) { notify(error instanceof Error ? error.message : "Profile input could not be saved.", true); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><button className="modal-dismiss" aria-label="Close profile update dialog" onClick={close} /><div className="modal" role="dialog" aria-modal="true" aria-labelledby="profile-update-title"><div className="modal-heading"><div><span>LOCAL PROFILE INBOX</span><h2 id="profile-update-title">Add a research signal.</h2></div><button aria-label="Close" onClick={close}><X size={19} /></button></div><form onSubmit={submit}><label>What should Codex learn?<textarea name="message" placeholder="I am increasingly interested in identifiability guarantees for sparse representations…" /></label><label>arXiv ID or URL<input name="arxiv" placeholder="https://arxiv.org/abs/2402.08954" /></label><label>Research paper PDF<span className="file-drop"><Upload size={22} /><strong>Choose an optional PDF</strong><small>Validated and stored locally only · 50 MB maximum</small><input name="pdf" type="file" accept="application/pdf" /></span></label><label>Signal type<select name="label"><option value="core">Core Research</option><option value="interested">Interested Paper</option></select></label><label>Optional note<textarea name="note" placeholder="What do you value about this paper or preference?" /></label><button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving locally…" : "Save to profile inbox"} <ArrowUpRight size={16} /></button></form></div></div>;
}
