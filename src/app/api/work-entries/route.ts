import { handler, body } from "@/lib/api";
import { WorkEntry } from "@/models";
import { allowedSiteIds, assertSiteAccess } from "@/lib/scope";
import { createWorkEntry } from "@/lib/services";
import { can } from "@/lib/roles";

export const GET = handler("work.view", async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("status")) q.status = { $in: sp.get("status")!.split(",") };
  if (sp.get("site")) q.site = sp.get("site");
  if (sp.get("client")) q.client = sp.get("client");
  if (sp.get("noPo") === "1") q.purchaseOrder = { $exists: false };
  const ids = await allowedSiteIds(user);
  if (ids) q.site = q.site ? (ids.includes(q.site) ? q.site : "000000000000000000000000") : { $in: ids };
  return WorkEntry.find(q)
    .populate("site", "name code")
    .populate("client", "name")
    .populate("createdBy", "name")
    .populate("validatedBy", "name")
    .sort({ workDate: -1, createdAt: -1 })
    .limit(500)
    .lean();
});

export const POST = handler("work.create", async ({ req, user }) => {
  const b = await body(req);
  await assertSiteAccess(user, b.site);
  if (b.validated && !can(user.role, "work.validate")) b.validated = false;
  return createWorkEntry(b, user);
});
