"use client";

import { Check, Copy } from "lucide-react";
import katex from "katex";
import { useMemo, useState } from "react";

function sanitizeLatex(value: string) {
  return value.replace(/\\(?:href|url|includegraphics|input|include|htmlClass|htmlStyle|htmlId)\b(?:\[[^\]]*\])?\{[^}]*\}/g, "\\text{[unsupported command]}");
}

export default function MathBlock({ latex, label }: { latex: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const safeLatex = sanitizeLatex(latex);
  const html = useMemo(
    () => katex.renderToString(safeLatex, { displayMode: true, throwOnError: false, trust: false, strict: "warn", output: "htmlAndMathml" }),
    [safeLatex],
  );

  async function copy() {
    await navigator.clipboard.writeText(latex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="equation-shell">
      <div className="equation-bar">
        <span>{label}</span>
        <button className="copy-button" onClick={copy} aria-label={`Copy ${label} LaTeX`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy LaTeX"}
        </button>
      </div>
      <div className="equation-render" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
