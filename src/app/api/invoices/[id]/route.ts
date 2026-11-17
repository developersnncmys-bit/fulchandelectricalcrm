import { handler, body, bad, must, oid } from "@/lib/api";
import { Invoice, PurchaseOrder, Payment, DocumentFile } from "@/models";
import { getSettings, nextInvoiceNumber } from "@/lib/numbering";
import { buildInvoiceItemsFromPO, priceDoc, recalcInvoicePayments, recalcPOBilled } from "@/lib/services";

export const GET = handler("invoice.view", async ({ params }) => {
  const inv = must(
    await Invoice.findById(oid(params.id))
      .populate("client")
      .populate("site", "name code address city stateCode")
      .populate("purchaseOrder", "poNumber clientPoNumber poDate approvalRef items status")
      .populate("createdBy", "name")
      .lean<any>(),
    "Invoice"
  );
  const [payments, documents, settings] = await Promise.all([
    Payment.find({ invoice: inv._id }).sort({ paymentDate: 1 }).lean(),
    DocumentFile.find({ refModel: "Invoice", refId: inv._id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);
  return { ...inv, payments, documents, settings };
});

export const PATCH = handler("invoice.edit", async ({ req, params, user }) => {
  const inv = must(await Invoice.findById(oid(params.id)), "Invoice");
  const b = await body(req);
  if (inv.status !== "draft") {
    // After issue only notes / submission date tweaks are allowed
    if (b.notes !== undefined) inv.notes = b.notes;
    inv.history.push({ action: "Notes updated", by: user.id, byName: user.name });
    await inv.save();
    return inv;
  }
  if (b.items) {
    let lines = b.items;
    if (inv.purchaseOrder) {
      const po = await PurchaseOrder.findById(inv.purchaseOrder).lean<any>();
      lines = await buildInvoiceItemsFromPO(po, lines, inv._id);
    }
    Object.assign(inv, await priceDoc(lines, b.interState ?? inv.interState));
  }
  for (const f of ["billType", "notes"]) if (b[f] !== undefined) (inv as any)[f] = b[f];
  if (b.invoiceDate) inv.invoiceDate = new Date(b.invoiceDate);
  inv.history.push({ action: "Draft edited", by: user.id, byName: user.name });
  await inv.save();
  await recalcPOBilled(inv.purchaseOrder);
  return inv;
});

export const DELETE = handler("invoice.edit", async ({ params }) => {
  const inv = must(await Invoice.findById(oid(params.id)), "Invoice");
  if (inv.status !== "draft") throw bad("Only drafts can be deleted. Cancel issued invoices instead.");
  const po = inv.purchaseOrder;
  await inv.deleteOne();
  await recalcPOBilled(po);
  return { ok: true };
});

/** Workflow: issue | submit | cancel */
export const POST = handler("invoice.edit", async ({ req, params, user }) => {
  const { action, date, note } = await body(req);
  const inv = must(await Invoice.findById(oid(params.id)).populate("client", "paymentTermsDays"), "Invoice");
  const log = (a: string) => inv.history.push({ action: a, by: user.id, byName: user.name, note, at: new Date() });

  switch (action) {
    case "issue": {
      if (inv.status !== "draft") throw bad("Only drafts can be issued");
      if (!inv.items.length || !(inv.total > 0)) throw bad("Invoice has no billable amount");
      inv.invoiceNo = await nextInvoiceNumber(inv.invoiceDate);
      inv.status = "issued";
      inv.issuedAt = new Date();
      inv.outstanding = inv.total;
      log(`Issued as ${inv.invoiceNo}`);
      break;
    }
    case "submit": {
      if (!["issued", "submitted"].includes(inv.status)) throw bad("Issue the invoice before submitting");
      const at = date ? new Date(date) : new Date();
      const s = await getSettings();
      const terms = (inv.client as any)?.paymentTermsDays ?? s.defaultPaymentTerms ?? 30;
      inv.status = "submitted";
      inv.submittedAt = at;
      inv.dueDate = new Date(at.getTime() + terms * 86400000);
      log(`Submitted to client (due in ${terms} days)`);
      break;
    }
    case "cancel": {
      if (inv.status === "cancelled") throw bad("Already cancelled");
      if (await Payment.exists({ invoice: inv._id })) throw bad("Delete the payments recorded against this invoice first");
      if (!note) throw bad("Please give a reason for cancellation");
      inv.status = "cancelled";
      inv.outstanding = 0;
      log("Cancelled");
      break;
    }
    default:
      throw bad("Unknown action");
  }
  await inv.save();
  if (action === "cancel") await recalcPOBilled(inv.purchaseOrder);
  else await recalcInvoicePayments(inv._id);
  return inv;
});
