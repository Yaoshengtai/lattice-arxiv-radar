import RadarApp from "../../app/radar-app";
import { hydratePublicDashboard } from "../../lib/public-dashboard";
import type { PublicDashboardSnapshot } from "../../lib/research-types";
import snapshotJson from "../data/dashboard.json";

const snapshot = snapshotJson as PublicDashboardSnapshot;

export default function PublicHome() {
  return (
    <RadarApp
      initialState={hydratePublicDashboard(snapshot)}
      mode="public"
      snapshotGeneratedAt={snapshot.generatedAt}
    />
  );
}
