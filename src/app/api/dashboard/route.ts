import { handler } from "@/lib/api";
import { dashboardData } from "@/lib/reports";

export const GET = handler("dashboard.view", async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  return dashboardData({
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    client: sp.get("client") || undefined,
    site: sp.get("site") || undefined,
  });
});
