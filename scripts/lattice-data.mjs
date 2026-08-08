#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "research-data");
const profilePath = path.join(root, "profile.json");
const libraryPath = path.join(root, "library.json");
const activityPath = path.join(root, "activity.json");
const inboxPath = path.join(root, "inbox");
const reportsPath = path.join(root, "reports");

function fail(message) { throw new Error(message); }
function isString(value) { return typeof value === "string" && value.trim().length > 0; }
function clamp(value) { return Math.max(0, Math.min(100, Number(value))); }

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function atomicWrite(file, value) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail("Refusing to write outside research-data.");
  await mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, resolved);
}

function normalizeArxivId(value) {
  const decoded = decodeURIComponent(String(value).trim());
  const modern = decoded.match(/(?:arxiv\.org\/(?:abs|pdf|html|src)\/)?(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/i);
  const legacy = decoded.match(/(?:arxiv\.org\/(?:abs|pdf|html|src)\/)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?(?:\.pdf)?/i);
  const id = (modern ?? legacy)?.[1];
  if (!id) fail(`Invalid arXiv ID: ${value}`);
  return id;
}

function validateReport(report) {
  const required = ["report_level", "executive_summary", "why_it_fits", "problem_formulation", "contributions", "method", "key_equations", "experiments", "limitations", "reproducibility", "research_ideas", "warnings"];
  if (!report || typeof report !== "object") fail("Each selected paper requires a report object.");
  for (const key of required) if (!(key in report)) fail(`Report is missing ${key}.`);
  if (!["full", "abstract_level"].includes(report.report_level)) fail("Invalid report level.");
  if (!Array.isArray(report.key_equations)) fail("key_equations must be an array.");
  for (const equation of report.key_equations) {
    for (const key of ["label", "latex", "symbol_definitions", "interpretation", "role", "assumptions", "derivation_outline", "locator", "provenance", "extraction_confidence", "interpretation_confidence"]) {
      if (!(key in equation)) fail(`Equation is missing ${key}.`);
    }
  }
}

async function appendActivity(item) {
  const activity = await readJson(activityPath);
  activity.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...item });
  await atomicWrite(activityPath, activity.slice(0, 200));
}

async function applyProfile(inputFile) {
  const input = await readJson(path.resolve(inputFile));
  const profile = await readJson(profilePath);
  const inboxIds = Array.isArray(input.sourceInboxIds) ? input.sourceInboxIds : [];
  if (!inboxIds.length) fail("sourceInboxIds must contain at least one pending inbox item.");
  const pending = new Map();
  for (const name of await readdir(inboxPath)) {
    if (!name.endsWith(".json")) continue;
    const item = await readJson(path.join(inboxPath, name));
    pending.set(item.id, { item, file: path.join(inboxPath, name) });
  }
  for (const id of inboxIds) {
    const found = pending.get(id);
    if (!found || found.item.status !== "pending") fail(`Inbox item is not pending: ${id}`);
  }
  const nextVersion = Math.max(...profile.versions.map((version) => version.version), 0) + 1;
  const snapshot = {
    version: nextVersion,
    createdAt: new Date().toISOString(),
    summary: String(input.summary ?? "").trim(),
    topics: Array.isArray(input.topics) ? input.topics.map((topic) => ({ name: String(topic.name).trim(), weight: Math.round(clamp(topic.weight)), evidence: Array.isArray(topic.evidence) ? topic.evidence.map(String) : [] })).filter((topic) => topic.name) : [],
    methods: uniqueStrings(input.methods),
    mathematics: uniqueStrings(input.mathematics),
    categories: uniqueStrings(input.categories),
    exclusions: uniqueStrings(input.exclusions),
    seeds: Array.isArray(input.seeds) ? input.seeds : [],
    changeSummary: uniqueStrings(input.changeSummary),
    sourceInboxIds: inboxIds,
  };
  if (!snapshot.summary) fail("Profile summary is required.");
  profile.versions.push(snapshot);
  profile.currentVersion = nextVersion;
  await atomicWrite(profilePath, profile);
  for (const id of inboxIds) {
    const found = pending.get(id);
    found.item.status = "processed";
    found.item.processedAt = snapshot.createdAt;
    await atomicWrite(found.file, found.item);
  }
  await appendActivity({ type: "profile", title: `Profile updated to v${nextVersion}`, detail: snapshot.summary, changes: snapshot.changeSummary });
  process.stdout.write(`Applied profile version ${nextVersion} from ${inboxIds.length} inbox item(s).\n`);
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean))];
}

async function recordScan(inputFile) {
  const input = await readJson(path.resolve(inputFile));
  const profile = await readJson(profilePath);
  const library = await readJson(libraryPath);
  const current = profile.versions.find((item) => item.version === profile.currentVersion);
  if (!current) fail("Current profile version is missing.");
  const candidates = Array.isArray(input.papers) ? input.papers : [];
  if (candidates.length > 5) fail("A scan may select no more than five papers.");
  const known = new Set(library.papers.map((paper) => normalizeArxivId(paper.id)));
  const seen = new Set();
  const createdAt = new Date().toISOString();
  const runId = `scan-${createdAt.replace(/[:.]/g, "-")}`;
  const records = [];
  for (const candidate of candidates) {
    const id = normalizeArxivId(candidate.id);
    if (known.has(id) || seen.has(id)) fail(`Duplicate recommendation: ${id}`);
    seen.add(id);
    const score = Math.round(clamp(candidate.score));
    if (score < 60) fail(`Paper ${id} is below the 60-point threshold.`);
    if (!isString(candidate.title) || !Array.isArray(candidate.authors)) fail(`Paper ${id} has incomplete metadata.`);
    validateReport(candidate.report);
    const reportName = `${id.replace("/", "-")}.json`;
    await atomicWrite(path.join(reportsPath, reportName), candidate.report);
    records.push({
      id,
      title: candidate.title.trim(),
      authors: candidate.authors.map(String),
      primaryCategory: String(candidate.primaryCategory ?? "unknown"),
      publishedAt: new Date(candidate.publishedAt).toISOString(),
      updatedAt: new Date(candidate.updatedAt ?? candidate.publishedAt).toISOString(),
      score,
      breakdown: {
        semantic: Math.round(clamp(candidate.breakdown?.semantic)),
        topic: Math.round(clamp(candidate.breakdown?.topic)),
        method: Math.round(clamp(candidate.breakdown?.method)),
        style: Math.round(clamp(candidate.breakdown?.style)),
        recency: Math.round(clamp(candidate.breakdown?.recency)),
      },
      rationale: String(candidate.rationale ?? ""),
      tags: uniqueStrings(candidate.tags),
      mathDensity: ["High", "Medium", "Low"].includes(candidate.mathDensity) ? candidate.mathDensity : "Low",
      reportStatus: candidate.report.report_level === "full" ? "Ready" : "Abstract only",
      reportPath: `reports/${reportName}`,
      abstractUrl: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}`,
      htmlUrl: `https://arxiv.org/html/${id}`,
      sourceUrl: `https://arxiv.org/src/${id}`,
      firstRecommendedAt: createdAt,
      runId,
      read: false,
      saved: false,
      personalTags: [],
      personalNote: "",
    });
  }
  library.papers.push(...records);
  library.runs.push({ id: runId, createdAt, profileVersion: current.version, candidateCount: Math.max(0, Number(input.candidateCount ?? candidates.length)), selectedIds: records.map((paper) => paper.id), warnings: uniqueStrings(input.warnings) });
  await atomicWrite(libraryPath, library);
  await appendActivity({ type: "scan", title: `arXiv scan selected ${records.length} paper${records.length === 1 ? "" : "s"}`, detail: `${input.candidateCount ?? candidates.length} candidates reviewed with profile v${current.version}.` });
  process.stdout.write(`Recorded scan ${runId} with ${records.length} paper(s).\n`);
}

async function validate() {
  const [profile, library] = await Promise.all([readJson(profilePath), readJson(libraryPath)]);
  if (!profile.versions.some((item) => item.version === profile.currentVersion)) fail("Current profile version is invalid.");
  const ids = library.papers.map((paper) => normalizeArxivId(paper.id));
  if (new Set(ids).size !== ids.length) fail("Library contains duplicate base arXiv IDs.");
  for (const paper of library.papers) if (paper.reportPath) validateReport(await readJson(path.join(root, paper.reportPath)));
  process.stdout.write(`Validated ${profile.versions.length} profile version(s), ${library.runs.length} scan(s), and ${library.papers.length} paper(s).\n`);
}

const [command, input] = process.argv.slice(2);
if (command === "apply-profile" && input) await applyProfile(input);
else if (command === "record-scan" && input) await recordScan(input);
else if (command === "validate") await validate();
else fail("Usage: lattice-data.mjs apply-profile <json> | record-scan <json> | validate");
