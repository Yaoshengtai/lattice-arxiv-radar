import "server-only";

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ActivityItem,
  DashboardState,
  InboxItem,
  LibraryFile,
  PaperReport,
  ProfileFile,
} from "./research-types";

const ROOT = path.join(process.cwd(), "research-data");
const INBOX = path.join(ROOT, "inbox");
const REPORTS = path.join(ROOT, "reports");
const UPLOADS = path.join(ROOT, "uploads");
const PROFILE_PATH = path.join(ROOT, "profile.json");
const LIBRARY_PATH = path.join(ROOT, "library.json");
const ACTIVITY_PATH = path.join(ROOT, "activity.json");

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

const initialProfile: ProfileFile = {
  currentVersion: 1,
  versions: [{
    version: 1,
    createdAt: "2026-08-08T00:00:00.000Z",
    summary: "No research profile has been processed yet.",
    topics: [],
    methods: [],
    mathematics: [],
    categories: [],
    exclusions: [],
    seeds: [],
    changeSummary: ["Created an empty local research profile."],
    sourceInboxIds: [],
  }],
};

const initialLibrary: LibraryFile = { runs: [], papers: [] };
const initialActivity: ActivityItem[] = [];

async function ensureData() {
  await Promise.all([
    mkdir(INBOX, { recursive: true }),
    mkdir(REPORTS, { recursive: true }),
    mkdir(UPLOADS, { recursive: true }),
  ]);
  await Promise.all([
    ensureJson(PROFILE_PATH, initialProfile),
    ensureJson(LIBRARY_PATH, initialLibrary),
    ensureJson(ACTIVITY_PATH, initialActivity),
  ]);
}

async function ensureJson(file: string, value: unknown) {
  try {
    await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await atomicWriteJson(file, value);
  }
}

export async function atomicWriteJson(file: string, value: unknown) {
  const resolved = path.resolve(file);
  if (!resolved.startsWith(`${path.resolve(ROOT)}${path.sep}`) && resolved !== path.resolve(ROOT)) {
    throw new Error("Refusing to write outside the research-data directory.");
  }
  await mkdir(path.dirname(resolved), { recursive: true });
  const temporary = `${resolved}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, resolved);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function loadDashboardState(): Promise<DashboardState> {
  await ensureData();
  const [profile, library, activity, names] = await Promise.all([
    readJson<ProfileFile>(PROFILE_PATH),
    readJson<LibraryFile>(LIBRARY_PATH),
    readJson<ActivityItem[]>(ACTIVITY_PATH),
    import("node:fs/promises").then(({ readdir }) => readdir(INBOX)),
  ]);
  const inbox = (await Promise.all(names.filter((name) => name.endsWith(".json")).map(async (name) => {
    try { return await readJson<InboxItem>(path.join(INBOX, name)); }
    catch { return null; }
  }))).filter((item): item is InboxItem => item !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const papers = await Promise.all(library.papers.map(async (paper) => {
    let report: PaperReport | null = null;
    if (paper.reportPath) {
      const reportFile = safeResearchPath(paper.reportPath);
      try { report = await readJson<PaperReport>(reportFile); } catch { report = null; }
    }
    return { ...paper, report };
  }));
  return { profile, library: { runs: library.runs, papers }, inbox, activity };
}

export function safeResearchPath(relative: string) {
  const normalized = relative.replaceAll("\\", "/").replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, normalized);
  if (!resolved.startsWith(`${path.resolve(ROOT)}${path.sep}`)) throw new Error("Invalid local data path.");
  return resolved;
}

export function sanitizeFilename(value: string) {
  const cleaned = path.basename(value).normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "paper.pdf").slice(-120);
}

export async function enqueueProfileUpdate(input: {
  message: string;
  arxivId: string | null;
  label: "core" | "interested";
  note: string;
  pdf: File | null;
}) {
  await ensureData();
  const id = `inbox-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
  let savedPdf: InboxItem["pdf"] = null;
  let absolutePdf: string | null = null;
  if (input.pdf) {
    if (input.pdf.type !== "application/pdf") throw new Error("Upload a PDF file.");
    if (input.pdf.size > MAX_PDF_BYTES) throw new Error("PDFs are limited to 50 MB.");
    const bytes = new Uint8Array(await input.pdf.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("The file signature is not a valid PDF.");
    const binary = new TextDecoder("windows-1252").decode(bytes);
    const pages = Math.max(1, (binary.match(/\/Type\s*\/Page\b/g) ?? []).length);
    const filename = `${id}-${sanitizeFilename(input.pdf.name).replace(/\.pdf$/i, "")}.pdf`;
    absolutePdf = path.join(UPLOADS, filename);
    await writeFile(absolutePdf, bytes, { flag: "wx" });
    savedPdf = { originalName: sanitizeFilename(input.pdf.name), storedPath: `uploads/${filename}`, bytes: bytes.length, pages };
  }
  const item: InboxItem = {
    id,
    createdAt: new Date().toISOString(),
    status: "pending",
    message: input.message,
    arxivId: input.arxivId,
    label: input.label,
    note: input.note,
    pdf: savedPdf,
  };
  try {
    await atomicWriteJson(path.join(INBOX, `${id}.json`), item);
  } catch (error) {
    if (absolutePdf) await unlink(absolutePdf).catch(() => undefined);
    throw error;
  }
  return item;
}

export async function updatePaperState(input: {
  id: string;
  read?: boolean;
  saved?: boolean;
  personalTags?: string[];
  personalNote?: string;
}) {
  await ensureData();
  const library = await readJson<LibraryFile>(LIBRARY_PATH);
  const index = library.papers.findIndex((paper) => paper.id === input.id);
  if (index < 0) throw new Error("Paper not found.");
  const paper = library.papers[index];
  library.papers[index] = {
    ...paper,
    ...(typeof input.read === "boolean" ? { read: input.read } : {}),
    ...(typeof input.saved === "boolean" ? { saved: input.saved } : {}),
    ...(Array.isArray(input.personalTags) ? { personalTags: input.personalTags.slice(0, 20).map((tag) => tag.trim().slice(0, 50)).filter(Boolean) } : {}),
    ...(typeof input.personalNote === "string" ? { personalNote: input.personalNote.slice(0, 10_000) } : {}),
  };
  await atomicWriteJson(LIBRARY_PATH, library);
  return library.papers[index];
}

export async function rollbackProfile(version: number) {
  await ensureData();
  const profile = await readJson<ProfileFile>(PROFILE_PATH);
  if (!profile.versions.some((item) => item.version === version)) throw new Error("Profile version not found.");
  profile.currentVersion = version;
  await atomicWriteJson(PROFILE_PATH, profile);
  const activity = await readJson<ActivityItem[]>(ACTIVITY_PATH);
  activity.unshift({ id: crypto.randomUUID(), type: "profile", at: new Date().toISOString(), title: `Profile restored to v${version}`, detail: "A previous profile snapshot is active again." });
  await atomicWriteJson(ACTIVITY_PATH, activity.slice(0, 200));
  return profile;
}

export const researchPaths = { root: ROOT, inbox: INBOX, reports: REPORTS, uploads: UPLOADS };
