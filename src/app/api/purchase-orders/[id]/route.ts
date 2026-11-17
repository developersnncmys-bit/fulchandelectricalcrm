import { handler, body, bad, must, oid } from "@/lib/api";
import { PurchaseOrder, WorkEntry, Invoice, DocumentFile } from "@/models";
import { assertSiteAccess } from "@/lib/scope";
import { can } from "@/lib/roles";
import { priceDoc } from "@/lib/services";
import { round2 } from "@/lib/format";

export const GET = handler("po.view", async ({ params, user }) => {
  const po = must(
    await PurchaseOrder.findById(oid(params.id))
      .populate("client")
      .populate("site", "name code address city")
      .populate("workEntries", "entryNo workDate status items")
      .populate("createdBy", "name")
      .lean<any>(),
    "Purchase order"
  );
  await assertSiteAccess(user, String(po.site._id));
  const invoices = can(user.role, "invoice.view")
    ? await Invoice.find({ purchaseOrder: po._id }).select("invoiceNo draftRef invoiceDate billType subtotal total status paymentStatus outstanding").sort({ createdAt: 1 }).lean()
    : [];
  const documents = await DocumentFile.find({ refModel: "PurchaseOrder", refId: po._id }).sort({ createdAt: -1 }).lean();
  return { ...po, invoices, documents };
});

export const PATCH = handler("po.edit", async ({ req, params, user }) => {
  const po = must(await PurchaseOrder.findById(oid(params.id)), "Purchase order");
  if (["closed"].includes(po.status)) throw bad("Closed POs cannot be edited");
  const b = await body(req);

  if (b.items) {
    if (po.status === "approved") throw bad("Approved POs cannot change items. Reopen the PO first.");
    const old = new Map((po.items as any[]).map((i) => [String(i._id), i]));
    const incoming = new Set(b.items.filter((i: any) => i._id).map((i: any) => String(i._id)));
    for (const [id, prev] of old) if ((prev.billedQty || 0) > 0 && !incoming.has(id)) throw bad(`"${prev.description}" is already billed and cannot be removed`);
    for (const it of b.items) {
      const prev = it._id && old.get(String(it._id));
      if (prev && Number(it.qty) < (prev.billedQty || 0)) throw bad(`Qty for "${it.description}" cannot be below billed qty ${prev.billedQty}`);
    }
    const interState = b.interState ?? po.interState;
    const priced = await priceDoc(b.items, interState);
    priced.items = priced.items.map((i: any) => ({ ...i, billedQty: (i._id && old.get(String(i._id))?.billedQty) || 0 }));
    Object.assign(po, priced);
  }
  for (const f of ["clientPoNumber", "subject", "notes", "approvalRef"]) if (b[f] !== undefined) (po as any)[f] = b[f];
  if (b.poDate) po.poDate = new Date(b.poDate);
  po.history.push({ action: "Edited", by: user.id, byName: user.name });
  await po.save();
  return po;
});

export const DELETE = handler("po.edit", async ({ params }) => {
  const po = must(await PurchaseOrder.findById(oid(params.id)), "Purchase order");
  if (await Invoice.countDocuments({ purchaseOrder: po._id, status: { $ne: "cancelled" } })) throw bad("PO has invoices and cannot be deleted");
  if (!["draft", "rejected"].includes(po.status)) throw bad("Only draft / rejected POs can be deleted");
  await WorkEntry.updateMany({ purchaseOrder: po._id }, { $set: { status: "validated" }, $unset: { purchaseOrder: 1 } });
  await po.deleteOne();
  return { ok: true };
});

/** Status workflow: send | approve | reject | close | reopen */
export const POST = handler("po.status", async ({ req, params, user }) => {
  const { action, note, approvalRef, clientPoNumber, date } = await body(req);
  const po = must(await PurchaseOrder.findById(oid(params.id)), "Purchase order");
  const at = date ? new Date(date) : new Date();
  const log = (a: string) => po.history.push({ action: a, by: user.id, byName: user.name, note, at: new Date() });

  switch (action) {
    case "send":
      if (!["draft", "rejected"].includes(po.status)) throw bad("Only draft / rejected POs can be sent");
      po.status = "sent";
      po.sentAt = at;
      log("Sent to client for approval");
      break;
    case "approve":
      if (!["sent", "draft"].includes(po.status)) throw bad("PO must be draft or sent to approve");
      po.status = "approved";
      po.approvedAt = at;
      if (approvalRef) po.approvalRef = approvalRef;
      if (clientPoNumber) po.clientPoNumber = clientPoNumber;
      po.rejectionReason = undefined;
      log("Approved by client");
      break;
    case "reject":
      if (po.status !== "sent") throw bad("Only sent POs can be rejected");
      if (!note) throw bad("Please give the rejection reason");
      po.status = "rejected";
      po.rejectionReason = note;
      log("Rejected by client");
      break;
    case "close":
      if (po.status !== "approved") throw bad("Only approved POs can be closed");
      po.status = "closed";
      log("Closed");
      break;
    case "reopen":
      if (!["approved", "closed"].includes(po.status)) throw bad("Only approved / closed POs can be reopened");
      po.status = po.status === "closed" ? "approved" : "draft";
      log("Reopened");
      break;
    default:
      throw bad("Unknown action");
  }
  po.billedAmount = round2(po.billedAmount || 0);
  await po.save();
  return po;
});
