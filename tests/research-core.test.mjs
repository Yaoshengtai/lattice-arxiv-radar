import assert from "node:assert/strict";
import test from "node:test";

import { isWithinTwoYears, normalizeArxivId } from "../lib/arxiv.ts";
import { annotateSymbolDefinitionMath, parseInlineMath } from "../lib/inline-math.ts";
import { fitScore, mmr } from "../lib/ranking.ts";

test("normalizes modern, versioned, URL, and legacy arXiv IDs", () => {
  assert.deepEqual(normalizeArxivId("2402.08954v3"), { baseId: "2402.08954", version: 3 });
  assert.deepEqual(normalizeArxivId("https://arxiv.org/pdf/2402.08954v2.pdf"), { baseId: "2402.08954", version: 2 });
  assert.deepEqual(normalizeArxivId("hep-th/9901001v4"), { baseId: "hep-th/9901001", version: 4 });
  assert.throws(() => normalizeArxivId("not-an-id"));
});

test("uses an exact two-year date boundary", () => {
  const now = new Date("2026-08-08T12:00:00.000Z");
  assert.equal(isWithinTwoYears("2024-08-08T12:00:00.000Z", now), true);
  assert.equal(isWithinTwoYears("2024-08-08T11:59:59.000Z", now), false);
  assert.equal(isWithinTwoYears("2026-08-09T00:00:00.000Z", now), false);
});

test("calculates the documented transparent fit score", () => {
  assert.equal(fitScore({ semantic: 90, topic: 80, method: 70, style: 60, recency: 100 }), 82);
  assert.equal(fitScore({ semantic: 200, topic: -4, method: 0, style: 0, recency: 0 }), 45);
});

test("MMR avoids selecting only identical candidates", () => {
  const selected = mmr([
    { id: "a", score: 95, vector: [1, 0] },
    { id: "b", score: 94, vector: [0.999, 0.001] },
    { id: "c", score: 88, vector: [0, 1] },
  ], 2, 0.6);
  assert.deepEqual(selected.map((item) => item.id), ["a", "c"]);
});

test("detects explicit and legacy inline formulas in report prose", () => {
  const segments = parseInlineMath("The rate is nearly O(n^{-min(1-b/2,alpha_2)}), while $D_\\chi$ controls L^infinity geometry.");
  assert.deepEqual(segments.filter((segment) => segment.kind === "math").map((segment) => segment.value), [
    "\\mathcal{O}\\!\\left(n^{-\\min(1-b/2,\\alpha_2)}\\right)",
    "D_\\chi",
    "L^\\infty",
  ]);
});

test("marks standalone symbols and functions in symbol definitions", () => {
  assert.equal(annotateSymbolDefinitionMath("u is the coordinate and X(.,t) is the feature in I=[0,1]."), "$u$ is the coordinate and $X(\\cdot,t)$ is the feature in I=[0,1].");
  assert.equal(annotateSymbolDefinitionMath("mathcal H uses Phi, rho, and tilde C."), "$\\mathcal{H}$ uses $\\Phi$, $\\rho$, and $\\widetilde{C}$.");
});
