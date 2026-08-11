export type InlineMathSegment = {
  kind: "text" | "math";
  value: string;
};

const greekAliases = [
  "alpha", "beta", "chi", "delta", "epsilon", "gamma", "lambda", "mu",
  "omega", "pi", "rho", "sigma", "tau", "theta",
] as const;

function replaceWord(value: string, word: string, replacement: string) {
  return value.replace(new RegExp(`(^|[^\\\\A-Za-z])${word}(?=$|[^A-Za-z])`, "g"), `$1${replacement}`);
}

export function normalizeInlineLatex(value: string) {
  let normalized = value
    .replaceAll("≤", "\\le")
    .replaceAll("≥", "\\ge")
    .replaceAll("→", "\\to")
    .replaceAll("∞", "\\infty");

  normalized = replaceWord(normalized, "infinity", "\\infty");
  for (const alias of greekAliases) normalized = replaceWord(normalized, alias, `\\${alias === "epsilon" ? "varepsilon" : alias}`);
  for (const operator of ["argmin", "dist", "GNN", "Law", "Prox", "WNN"]) normalized = replaceWord(normalized, operator, `\\operatorname{${operator}}`);
  for (const operator of ["lim", "max", "min", "sup"]) normalized = replaceWord(normalized, operator, `\\${operator}`);

  normalized = normalized.replace(/_([A-Za-z][A-Za-z0-9]{1,})/g, (_match, subscript: string) =>
    subscript.startsWith("\\") ? `_${subscript}` : `_{\\mathrm{${subscript}}}`,
  );

  const bigO = normalized.match(/^O\((.*)\)$/s);
  return bigO ? `\\mathcal{O}\\!\\left(${bigO[1]}\\right)` : normalized;
}

function looksLikeLegacyMath(token: string) {
  if (/^O\(.+\)$/.test(token)) return true;
  if (/^(?:https?:\/\/|www\.)/.test(token)) return false;
  return /[_^=]|\\[A-Za-z]+|\|\||[≤≥→∞]/.test(token);
}

function parseLegacyText(value: string): InlineMathSegment[] {
  const segments: InlineMathSegment[] = [];
  const tokens = /\S+/g;
  let cursor = 0;

  for (const match of value.matchAll(tokens)) {
    const index = match.index;
    const token = match[0];
    if (index > cursor) segments.push({ kind: "text", value: value.slice(cursor, index) });

    const parts = token.match(/^([[("'“]*)(.*?)([.,;:!?"'”]*)$/s);
    const leading = parts?.[1] ?? "";
    const candidate = parts?.[2] ?? token;
    const trailing = parts?.[3] ?? "";
    if (candidate && looksLikeLegacyMath(candidate)) {
      if (leading) segments.push({ kind: "text", value: leading });
      segments.push({ kind: "math", value: normalizeInlineLatex(candidate) });
      if (trailing) segments.push({ kind: "text", value: trailing });
    } else {
      segments.push({ kind: "text", value: token });
    }
    cursor = index + token.length;
  }

  if (cursor < value.length) segments.push({ kind: "text", value: value.slice(cursor) });
  return segments;
}

export function parseInlineMath(value: string): InlineMathSegment[] {
  const segments: InlineMathSegment[] = [];
  const explicit = /\$([^$\n]+)\$|\\\((.+?)\\\)/g;
  let cursor = 0;

  for (const match of value.matchAll(explicit)) {
    const index = match.index;
    if (index > cursor) segments.push(...parseLegacyText(value.slice(cursor, index)));
    segments.push({ kind: "math", value: match[1] ?? match[2] });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) segments.push(...parseLegacyText(value.slice(cursor)));
  return segments;
}
