import { CampusBoard } from "@/components/dashboard/campus-board";
import { readDashboardView } from "@/features/campus/dashboard-repository";

export const metadata = {
  title: "Dashboard",
};

// Rendered per request — but the request only reads the stored snapshot, so it
// is two indexed queries rather than a walk of the 42 API.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const view = await readDashboardView();
  return <CampusBoard view={view} />;
}
