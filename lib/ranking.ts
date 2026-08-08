export type RankingSignals = { semantic: number; topic: number; method: number; style: number; recency: number };

export function fitScore(signals: RankingSignals) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return Math.round(clamp(signals.semantic) * .45 + clamp(signals.topic) * .25 + clamp(signals.method) * .15 + clamp(signals.style) * .10 + clamp(signals.recency) * .05);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

export function mmr<T extends { id: string; score: number; vector: number[] }>(candidates: T[], limit: number, lambda = .78) {
  const selected: T[] = [];
  const remaining = [...candidates];
  while (selected.length < limit && remaining.length) {
    let bestIndex = 0; let bestValue = -Infinity;
    remaining.forEach((candidate, index) => {
      const redundancy = selected.length ? Math.max(...selected.map((item) => cosineSimilarity(candidate.vector, item.vector))) : 0;
      const value = lambda * candidate.score / 100 - (1 - lambda) * redundancy;
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    });
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}
