export const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["report_level", "executive_summary", "why_it_fits", "problem_formulation", "contributions", "method", "key_equations", "experiments", "limitations", "reproducibility", "research_ideas", "warnings"],
  properties: {
    report_level: { type: "string", enum: ["full", "abstract_level"] },
    executive_summary: { type: "string" },
    why_it_fits: { type: "string" },
    problem_formulation: { type: "string" },
    contributions: { type: "array", items: { type: "string" } },
    method: { type: "string" },
    key_equations: { type: "array", items: { type: "object", additionalProperties: false, required: ["label", "latex", "symbol_definitions", "interpretation", "role", "assumptions", "derivation_outline", "locator", "provenance", "extraction_confidence", "interpretation_confidence"], properties: {
      label: { type: "string" }, latex: { type: "string" }, symbol_definitions: { type: "array", items: { type: "string" } }, interpretation: { type: "string" }, role: { type: "string" }, assumptions: { type: "array", items: { type: "string" } }, derivation_outline: { type: "string" }, locator: { type: "string" }, provenance: { type: "string", enum: ["HTML", "TeX Source", "PDF Reconstruction"] }, extraction_confidence: { type: "number", minimum: 0, maximum: 1 }, interpretation_confidence: { type: "number", minimum: 0, maximum: 1 },
    } } },
    experiments: { type: "string" }, limitations: { type: "array", items: { type: "string" } }, reproducibility: { type: "string" }, research_ideas: { type: "array", items: { type: "string" } }, warnings: { type: "array", items: { type: "string" } },
  },
} as const;
