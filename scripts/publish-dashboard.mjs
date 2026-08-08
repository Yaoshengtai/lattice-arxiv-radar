#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const snapshotPath = "public-site/data/dashboard.json";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? (result.stderr || result.stdout).trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`);
  }
  return result;
}

function output(command, args) {
  return run(command, args, { capture: true }).stdout.trim();
}

run(process.execPath, ["scripts/lattice-data.mjs", "validate"]);
run(process.execPath, ["scripts/export-public-dashboard.mjs"]);

run("git", ["rev-parse", "--is-inside-work-tree"], { capture: true });
const branch = output("git", ["branch", "--show-current"]);
if (branch !== "main") {
  throw new Error(`Dashboard publishing must run from main; current branch is ${branch || "detached HEAD"}.`);
}
run("git", ["remote", "get-url", "origin"], { capture: true });

const staged = output("git", ["diff", "--cached", "--name-only"])
  .split("\n")
  .filter(Boolean);
const unrelated = staged.filter((file) => file !== snapshotPath);
if (unrelated.length) {
  throw new Error(`Refusing to publish with unrelated staged files: ${unrelated.join(", ")}`);
}

run("git", ["add", "--", snapshotPath]);
const diff = run("git", ["diff", "--cached", "--quiet", "--", snapshotPath], {
  capture: true,
  allowFailure: true,
});
if (diff.status === 0) {
  process.stdout.write("The public dashboard snapshot is already current; nothing to publish.\n");
  process.exit(0);
}
if (diff.status !== 1) throw new Error("Could not inspect the staged dashboard snapshot.");

const snapshot = JSON.parse(await readFile(path.join(projectRoot, snapshotPath), "utf8"));
const date = String(snapshot.generatedAt).slice(0, 10);
run("git", ["commit", "-m", `chore(data): publish Lattice snapshot ${date}`, "--", snapshotPath]);
run("git", ["push", "origin", "main"]);
process.stdout.write("Published the latest read-only dashboard snapshot to origin/main.\n");
