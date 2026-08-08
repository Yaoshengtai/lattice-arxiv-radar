import type { DashboardState, PublicDashboardSnapshot } from "./research-types";

export function hydratePublicDashboard(snapshot: PublicDashboardSnapshot): DashboardState {
  return {
    profile: {
      currentVersion: snapshot.profile.currentVersion,
      versions: snapshot.profile.versions.map((version) => ({
        ...version,
        sourceInboxIds: [],
        seeds: version.seeds.map((seed) => ({ ...seed, note: "" })),
      })),
    },
    library: {
      runs: snapshot.library.runs,
      papers: snapshot.library.papers.map((paper) => ({
        ...paper,
        reportPath: null,
        read: false,
        saved: false,
        personalTags: [],
        personalNote: "",
      })),
    },
    inbox: [],
    activity: snapshot.activity,
  };
}
