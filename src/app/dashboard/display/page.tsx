import { CampusBoard } from "@/components/dashboard/campus-board";
import { getInitialDashboard } from "@/features/campus/initial-dashboard";

export const metadata = {
  title: "Display Mode",
};

// Rendered per request rather than prerendered: the build machine has no 42 API
// credentials, so a build-time render would bake in the empty mock payload. The
// expensive part is cached in `getInitialDashboard`, so this stays fast.
export const dynamic = "force-dynamic";

export default async function DashboardDisplayPage() {
  const initialData = await getInitialDashboard();
  return <CampusBoard displayMode initialData={initialData} />;
}
