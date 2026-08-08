import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exporter = path.join(project, "scripts/export-public-dashboard.mjs");

test("exports reports while removing local and private research fields", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "lattice-public-export-"));
  await mkdir(path.join(cwd, "research-data/reports"), { recursive: true });
  await mkdir(path.join(cwd, "public-site/data"), { recursive: true });

  const profile = {
    currentVersion: 1,
    versions: [{
      version: 1,
      createdAt: "2026-08-08T00:00:00.000Z",
      summary: "A public profile.",
      topics: [], methods: [], mathematics: [], categories: [], exclusions: [],
      seeds: [{ id: "seed-1", title: "Seed", sourceType: "pdf", label: "core", note: "PRIVATE SEED NOTE", localPdfPath: "uploads/private.pdf", active: true, addedAt: "2026-08-08T00:00:00.000Z" }],
      changeSummary: ["Created profile."],
      sourceInboxIds: ["PRIVATE INBOX ID"],
    }],
  };
  const report = { report_level: "full", executive_summary: "Public report", why_it_fits: "Fit", problem_formulation: "Problem", contributions: [], method: "Method", key_equations: [], experiments: "Experiments", limitations: [], reproducibility: "Reproducibility", research_ideas: [], warnings: [] };
  const paper = {
    id: "2601.00001", title: "Public paper", authors: ["A. Author"], primaryCategory: "cs.LG",
    publishedAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    score: 90, breakdown: { semantic: 90, topic: 90, method: 90, style: 90, recency: 90 },
    rationale: "Public rationale", tags: ["Theory"], mathDensity: "High", reportStatus: "Ready",
    reportPath: "reports/2601.00001.json", abstractUrl: "https://arxiv.org/abs/2601.00001",
    pdfUrl: "https://arxiv.org/pdf/2601.00001", htmlUrl: "https://arxiv.org/html/2601.00001", sourceUrl: "https://arxiv.org/src/2601.00001",
    firstRecommendedAt: "2026-08-08T00:00:00.000Z", runId: "scan-1",
    read: true, saved: true, personalTags: ["PRIVATE TAG"], personalNote: "PRIVATE PAPER NOTE",
  };

  await Promise.all([
    writeFile(path.join(cwd, "research-data/profile.json"), JSON.stringify(profile)),
    writeFile(path.join(cwd, "research-data/library.json"), JSON.stringify({ runs: [], papers: [paper] })),
    writeFile(path.join(cwd, "research-data/activity.json"), "[]"),
    writeFile(path.join(cwd, "research-data/reports/2601.00001.json"), JSON.stringify(report)),
  ]);

  const result = spawnSync(process.execPath, [exporter], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(await readFile(path.join(cwd, "public-site/data/dashboard.json"), "utf8"));
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.library.papers[0].report.executive_summary, "Public report");
  assert.equal(snapshot.profile.versions[0].seeds[0].title, "Seed");
  for (const forbidden of ["PRIVATE SEED NOTE", "uploads/private.pdf", "PRIVATE INBOX ID", "PRIVATE TAG", "PRIVATE PAPER NOTE", "personalNote", "personalTags", "reportPath", "sourceInboxIds", "localPdfPath"]) {
    assert.equal(serialized.includes(forbidden), false, `public snapshot contains ${forbidden}`);
  }
});
