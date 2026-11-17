import { handler, body, bad, must, oid } from "@/lib/api";
import { Client, Site, PurchaseOrder, Invoice } from "@/models";

export const GET = handler("masters.view", async ({ params }) => must(await Client.findById(oid(params.id)).lean(), "Client"));

export const PATCH = handler("masters.edit", async ({ req, params }) => {
  const b = await body(req);
  delete b._id;
  const c = must(await Client.findByIdAndUpdate(oid(params.id), b, { new: true, runValidators: true }), "Client");
  return c;
});

export const DELETE = handler("masters.edit", async ({ params }) => {
  const id = oid(params.id);
  const used = (await Site.countDocuments({ client: id })) + (await PurchaseOrder.countDocuments({ client: id })) + (await Invoice.countDocuments({ client: id }));
  if (used) throw bad("Client has sites / POs / invoices. Mark it inactive instead.");
  await Client.findByIdAndDelete(id);
  return { ok: true };
});
