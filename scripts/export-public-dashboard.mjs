#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const researchRoot = path.join(projectRoot, "research-data");
const outputFile = path.join(projectRoot, "public-site", "data", "dashboard.json");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function safeReportPath(relativePath) {
  const normalized = String(relativePath).replaceAll("\\", "/").replace(/^\/+/, "");
  const resolved = path.resolve(researchRoot, normalized);
  if (!resolved.startsWith(`${researchRoot}${path.sep}`)) {
    throw new Error(`Invalid report path: ${relativePath}`);
  }
  return resolved;
}

function sanitizeSeed(seed) {
  const safe = { ...seed };
  delete safe.note;
  delete safe.localPdfPath;
  return safe;
}

function sanitizeProfileVersion(version) {
  const safe = { ...version };
  delete safe.sourceInboxIds;
  return {
    ...safe,
    seeds: Array.isArray(version.seeds) ? version.seeds.map(sanitizeSeed) : [],
  };
}

async function sanitizePaper(paper) {
  const reportPath = paper.reportPath;
  const safe = { ...paper };
  delete safe.read;
  delete safe.saved;
  delete safe.personalTags;
  delete safe.personalNote;
  delete safe.reportPath;
  const report = reportPath ? await readJson(safeReportPath(reportPath)) : null;
  return { ...safe, report };
}

async function exportSnapshot() {
  const [profile, library, activity] = await Promise.all([
    readJson(path.join(researchRoot, "profile.json")),
    readJson(path.join(researchRoot, "library.json")),
    readJson(path.join(researchRoot, "activity.json")),
  ]);

  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profile: {
      currentVersion: profile.currentVersion,
      versions: profile.versions.map(sanitizeProfileVersion),
    },
    library: {
      runs: library.runs,
      papers: await Promise.all(library.papers.map(sanitizePaper)),
    },
    activity,
  };

  await mkdir(path.dirname(outputFile), { recursive: true });
  const temporary = `${outputFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
  await rename(temporary, outputFile);
  process.stdout.write(`Exported public dashboard snapshot to ${path.relative(projectRoot, outputFile)}.\n`);
}

await exportSnapshot();
