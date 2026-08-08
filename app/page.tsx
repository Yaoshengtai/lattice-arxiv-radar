import RadarApp from "./radar-app";
import { loadDashboardState } from "../lib/research-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <RadarApp initialState={await loadDashboardState()} />;
}
