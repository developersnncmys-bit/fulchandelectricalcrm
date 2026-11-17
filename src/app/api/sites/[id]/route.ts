import { handler, body, bad, must, oid } from "@/lib/api";
import { Site, WorkEntry, PurchaseOrder } from "@/models";

export const PATCH = handler("masters.edit", async ({ req, params }) => {
  const b = await body(req);
  delete b._id;
  return must(await Site.findByIdAndUpdate(oid(params.id), b, { new: true, runValidators: true }), "Site");
});

export const DELETE = handler("masters.edit", async ({ params }) => {
  const id = oid(params.id);
  const used = (await WorkEntry.countDocuments({ site: id })) + (await PurchaseOrder.countDocuments({ site: id }));
  if (used) throw bad("Site has work entries / POs. Mark it completed instead.");
  await Site.findByIdAndDelete(id);
  return { ok: true };
});
