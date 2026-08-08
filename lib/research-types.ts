export type PreferenceLabel = "core" | "interested";

export type TopicSignal = {
  name: string;
  weight: number;
  evidence: string[];
};

export type ProfileSeed = {
  id: string;
  title: string;
  sourceType: "text" | "arxiv" | "pdf";
  label: PreferenceLabel;
  note: string;
  arxivId?: string;
  localPdfPath?: string;
  active: boolean;
  addedAt: string;
};

export type ProfileSnapshot = {
  version: number;
  createdAt: string;
  summary: string;
  topics: TopicSignal[];
  methods: string[];
  mathematics: string[];
  categories: string[];
  exclusions: string[];
  seeds: ProfileSeed[];
  changeSummary: string[];
  sourceInboxIds: string[];
};

export type ProfileFile = {
  currentVersion: number;
  versions: ProfileSnapshot[];
};

export type ScoreBreakdown = {
  semantic: number;
  topic: number;
  method: number;
  style: number;
  recency: number;
};

export type KeyEquation = {
  label: string;
  latex: string;
  symbol_definitions: string[];
  interpretation: string;
  role: string;
  assumptions: string[];
  derivation_outline: string;
  locator: string;
  provenance: "HTML" | "TeX Source" | "PDF Reconstruction";
  extraction_confidence: number;
  interpretation_confidence: number;
};

export type PaperReport = {
  report_level: "full" | "abstract_level";
  executive_summary: string;
  why_it_fits: string;
  problem_formulation: string;
  contributions: string[];
  method: string;
  key_equations: KeyEquation[];
  experiments: string;
  limitations: string[];
  reproducibility: string;
  research_ideas: string[];
  warnings: string[];
};

export type PaperRecord = {
  id: string;
  title: string;
  authors: string[];
  primaryCategory: string;
  publishedAt: string;
  updatedAt: string;
  score: number;
  breakdown: ScoreBreakdown;
  rationale: string;
  tags: string[];
  mathDensity: "High" | "Medium" | "Low";
  reportStatus: "Ready" | "Abstract only" | "Failed";
  reportPath: string | null;
  abstractUrl: string;
  pdfUrl: string;
  htmlUrl: string;
  sourceUrl: string;
  firstRecommendedAt: string;
  runId: string;
  read: boolean;
  saved: boolean;
  personalTags: string[];
  personalNote: string;
};

export type RecommendationRun = {
  id: string;
  createdAt: string;
  profileVersion: number;
  candidateCount: number;
  selectedIds: string[];
  warnings: string[];
};

export type LibraryFile = {
  runs: RecommendationRun[];
  papers: PaperRecord[];
};

export type InboxItem = {
  id: string;
  createdAt: string;
  status: "pending" | "processed" | "failed";
  message: string;
  arxivId: string | null;
  label: PreferenceLabel;
  note: string;
  pdf: null | {
    originalName: string;
    storedPath: string;
    bytes: number;
    pages: number;
  };
  processedAt?: string;
  error?: string;
};

export type ActivityItem = {
  id: string;
  type: "profile" | "scan" | "library" | "error";
  at: string;
  title: string;
  detail: string;
  changes?: string[];
};

export type DashboardPaper = PaperRecord & { report: PaperReport | null };

export type DashboardState = {
  profile: ProfileFile;
  library: Omit<LibraryFile, "papers"> & { papers: DashboardPaper[] };
  inbox: InboxItem[];
  activity: ActivityItem[];
};

export type PublicProfileSeed = Omit<ProfileSeed, "note" | "localPdfPath">;

export type PublicProfileSnapshot = Omit<ProfileSnapshot, "seeds" | "sourceInboxIds"> & {
  seeds: PublicProfileSeed[];
};

export type PublicPaper = Omit<
  DashboardPaper,
  "read" | "saved" | "personalTags" | "personalNote" | "reportPath"
>;

export type PublicDashboardSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  profile: {
    currentVersion: number;
    versions: PublicProfileSnapshot[];
  };
  library: {
    runs: RecommendationRun[];
    papers: PublicPaper[];
  };
  activity: ActivityItem[];
};
