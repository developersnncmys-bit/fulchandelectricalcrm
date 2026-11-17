import { handler, bad } from "@/lib/api";
import { report } from "@/lib/reports";

const TYPES = ["client-summary", "site-summary", "po-register", "invoice-register", "payments", "outstanding", "ageing-summary"];

export const GET = handler("reports.view", async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || "";
  if (!TYPES.includes(type)) throw bad("Unknown report type");
  return report(type, {
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    client: sp.get("client") || undefined,
    site: sp.get("site") || undefined,
  });
});
