import { handler, body, bad } from "@/lib/api";
import { PurchaseOrder, Site, WorkEntry } from "@/models";
import { allowedSiteIds } from "@/lib/scope";
import { nextPoNumber } from "@/lib/numbering";
import { isInterState, priceDoc } from "@/lib/services";

export const GET = handler("po.view", async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("status")) q.status = { $in: sp.get("status")!.split(",") };
  if (sp.get("client")) q.client = sp.get("client");
  if (sp.get("site")) q.site = sp.get("site");
  const ids = await allowedSiteIds(user);
  if (ids) q.site = { $in: ids };
  return PurchaseOrder.find(q)
    .select("-history")
    .populate("client", "name stateCode")
    .populate("site", "name code")
    .sort({ poDate: -1, createdAt: -1 })
    .limit(1000)
    .lean();
});

export const POST = handler("po.edit", async ({ req, user }) => {
  const b = await body(req);
  if (!b.site) throw bad("Site is required");
  if (!b.poDate) throw bad("PO date is required");
  const site = await Site.findById(b.site).populate("client").lean<any>();
  if (!site) throw bad("Site not found");

  const weIds: string[] = b.workEntries || [];
  if (weIds.length) {
    const entries = await WorkEntry.find({ _id: { $in: weIds } }).lean<any[]>();
    for (const e of entries) {
      if (String(e.site) !== String(site._id)) throw bad(`${e.entryNo} belongs to another site`);
      if (e.status !== "validated" || e.purchaseOrder) throw bad(`${e.entryNo} is not validated or already linked to a PO`);
    }
  }

  const interState = b.interState ?? (await isInterState(site.client?.stateCode));
  const priced = await priceDoc(b.items || [], interState);
  const date = new Date(b.poDate);
  const po = await PurchaseOrder.create({
    poNumber: await nextPoNumber(date),
    clientPoNumber: b.clientPoNumber,
    client: site.client._id,
    site: site._id,
    poDate: date,
    subject: b.subject,
    workEntries: weIds,
    notes: b.notes,
    ...priced,
    status: "draft",
    createdBy: user.id,
    history: [{ action: "Created", by: user.id, byName: user.name }],
  });

  if (weIds.length) {
    await WorkEntry.updateMany(
      { _id: { $in: weIds } },
      { $set: { status: "po_created", purchaseOrder: po._id }, $push: { history: { action: `Added to ${po.poNumber}`, by: user.id, byName: user.name, at: new Date() } } }
    );
  }
  return po;
});
