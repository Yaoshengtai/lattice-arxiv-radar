import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(project, "scripts/lattice-data.mjs");

async function fixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), "lattice-data-test-"));
  await cp(path.join(project, "research-data"), path.join(cwd, "research-data"), { recursive: true });
  await mkdir(path.join(cwd, "work"));
  return cwd;
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
}

test("applies a profile version and marks source inbox records processed", async () => {
  const cwd = await fixture();
  const inbox = { id: "inbox-test", createdAt: new Date().toISOString(), status: "pending", message: "I study spectral methods.", arxivId: null, label: "core", note: "", pdf: null };
  await writeFile(path.join(cwd, "research-data/inbox/inbox-test.json"), JSON.stringify(inbox));
  const candidate = { summary: "Research on spectral methods.", topics: [{ name: "Spectral methods", weight: 90, evidence: ["inbox-test"] }], methods: ["Eigendecomposition"], mathematics: ["Spectral analysis"], categories: ["cs.LG"], exclusions: [], seeds: [], changeSummary: ["Added spectral methods."], sourceInboxIds: ["inbox-test"] };
  const input = path.join(cwd, "work/profile.json");
  await writeFile(input, JSON.stringify(candidate));
  const result = run(cwd, "apply-profile", input);
  assert.equal(result.status, 0, result.stderr);
  const profile = JSON.parse(await readFile(path.join(cwd, "research-data/profile.json"), "utf8"));
  const updatedInbox = JSON.parse(await readFile(path.join(cwd, "research-data/inbox/inbox-test.json"), "utf8"));
  assert.equal(profile.currentVersion, 2);
  assert.equal(profile.versions.at(-1).topics[0].name, "Spectral methods");
  assert.equal(updatedInbox.status, "processed");
});

test("records a valid scan and permanently rejects duplicate base IDs", async () => {
  const cwd = await fixture();
  const report = { report_level: "full", executive_summary: "Summary", why_it_fits: "Fit", problem_formulation: "Problem", contributions: ["Contribution"], method: "Method", key_equations: [], experiments: "Experiments", limitations: ["Limitation"], reproducibility: "Reproducibility", research_ideas: ["Idea"], warnings: [] };
  const scan = { candidateCount: 12, warnings: [], papers: [{ id: "2402.08954v2", title: "A paper", authors: ["A. Author"], primaryCategory: "cs.LG", publishedAt: "2025-01-01T00:00:00.000Z", score: 88, breakdown: { semantic: 90, topic: 88, method: 80, style: 85, recency: 95 }, rationale: "Strong fit.", tags: ["Theory"], mathDensity: "High", report }] };
  const input = path.join(cwd, "work/scan.json");
  await writeFile(input, JSON.stringify(scan));
  assert.equal(run(cwd, "record-scan", input).status, 0);
  const duplicate = run(cwd, "record-scan", input);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Duplicate recommendation/);
  const library = JSON.parse(await readFile(path.join(cwd, "research-data/library.json"), "utf8"));
  assert.equal(library.papers[0].id, "2402.08954");
  assert.equal(library.papers.length, 1);
});
