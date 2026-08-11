"use client";

import katex from "katex";
import { useMemo } from "react";
import { parseInlineMath } from "../lib/inline-math";

function sanitizeLatex(value: string) {
  return value.replace(/\\(?:href|url|includegraphics|input|include|htmlClass|htmlStyle|htmlId)\b(?:\[[^\]]*\])?\{[^}]*\}/g, "\\text{[unsupported command]}");
}

function InlineFormula({ latex }: { latex: string }) {
  const html = useMemo(
    () => katex.renderToString(sanitizeLatex(latex), { displayMode: false, throwOnError: false, trust: false, strict: "warn", output: "htmlAndMathml" }),
    [latex],
  );
  return <span className="inline-math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function InlineMathText({ children }: { children: string }) {
  return parseInlineMath(children).map((segment, index) =>
    segment.kind === "math"
      ? <InlineFormula key={`${index}-${segment.value}`} latex={segment.value} />
      : <span key={`${index}-${segment.value}`}>{segment.value}</span>,
  );
}
