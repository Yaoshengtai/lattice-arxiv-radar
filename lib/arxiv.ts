const modern = /(?:arxiv\.org\/(?:abs|pdf|html|src)\/)?(\d{4}\.\d{4,5})(?:v(\d+))?(?:\.pdf)?/i;
const legacy = /(?:arxiv\.org\/(?:abs|pdf|html|src)\/)?([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v(\d+))?(?:\.pdf)?/i;

export function normalizeArxivId(value: string) {
  const decoded = decodeURIComponent(value.trim());
  const match = decoded.match(modern) ?? decoded.match(legacy);
  if (!match) throw new Error("Enter a valid arXiv ID or URL.");
  return { baseId: match[1], version: Number(match[2] ?? 1) };
}

export function isWithinTwoYears(publishedAt: Date | string | number, now = new Date()) {
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime()) || published > now) return false;
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  return published >= cutoff;
}
