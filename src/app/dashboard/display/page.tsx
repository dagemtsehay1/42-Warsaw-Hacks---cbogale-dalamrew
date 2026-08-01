import { CampusBoard } from "@/components/dashboard/campus-board";
import { readDashboardView } from "@/features/campus/dashboard-repository";

export const metadata = {
  title: "Display Mode",
};

export const dynamic = "force-dynamic";

export default async function DashboardDisplayPage() {
  const view = await readDashboardView();
  return <CampusBoard view={view} displayMode />;
}
