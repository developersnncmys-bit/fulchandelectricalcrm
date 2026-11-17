import "server-only";
import { bad } from "./api";
import { WorkEntry, Site, PurchaseOrder, Invoice, Payment } from "@/models";
import { computeTax, lineAmount } from "./gst";
import { round2 } from "./format";
import { getSettings, nextWorkNumber } from "./numbering";
export async function createWorkEntry(b: any, user: { id: string; name: string }) {
  if (!b.site) throw bad("Site is required");
  if (!b.workDate) throw bad("Work date is required");
  const items = (b.items || []).filter((i: any) => i.description && Number(i.qty) > 0);
  if (!items.length) throw bad("Add at least one item with description and quantity");
  const site = await Site.findById(b.site).lean<any>();
  if (!site) throw bad("Site not found");
  const date = new Date(b.workDate);
  const status = b.validated ? "validated" : b.submit ? "submitted" : "draft";
  return WorkEntry.create({
    entryNo: await nextWorkNumber(date),
    site: site._id,
    client: site.client,
    workDate: date,
    recordedBy: b.recordedBy,
    items: items.map((i: any) => ({ type: i.type || "work", description: i.description, unit: i.unit || "Nos", qty: Number(i.qty), remarks: i.remarks })),
    remarks: b.remarks,
    status,
    createdBy: user.id,
    ...(status === "validated" ? { validatedBy: user.id, validatedAt: new Date() } : {}),
    history: [
      {
        action: status === "validated" ? "Imported as validated" : status === "submitted" ? "Created & submitted" : "Created as draft",
        by: user.id,
        byName: user.name,
      },
    ],
  });
}


/* ---------------- Tax / PO / Invoice helpers ---------------- */

export async function isInterState(clientStateCode?: string) {
  const s = await getSettings();
  if (!clientStateCode || !s.stateCode) return false;
  return String(clientStateCode) !== String(s.stateCode);
}

/** Normalise line items and attach totals to a PO / invoice document body. */
export async function priceDoc(items: any[], interState: boolean) {
  const s = await getSettings();
  const clean = items
    .filter((i) => i.description && Number(i.qty) > 0)
    .map((i) => ({
      ...i,
      qty: round2(Number(i.qty)),
      rate: round2(Number(i.rate) || 0),
      gstRate: Number(i.gstRate ?? s.defaultGstRate ?? 18),
      amount: lineAmount(i.qty, i.rate),
    }));
  if (!clean.length) throw bad("Add at least one line item with quantity");
  const t = computeTax(clean, interState, s.roundOff !== false);
  return { items: clean, interState, ...t };
}

/** Recalculate billed quantities on a PO from all non-cancelled invoices. */
export async function recalcPOBilled(poId: any) {
  if (!poId) return;
  const po = await PurchaseOrder.findById(poId);
  if (!po) return;
  const invoices = await Invoice.find({ purchaseOrder: poId, status: { $ne: "cancelled" } }).lean<any[]>();
  const billed = new Map<string, number>();
  for (const inv of invoices)
    for (const it of inv.items) if (it.poItemId) billed.set(String(it.poItemId), (billed.get(String(it.poItemId)) || 0) + it.qty);
  let billedAmount = 0;
  for (const it of po.items as any[]) {
    it.billedQty = round2(billed.get(String(it._id)) || 0);
    billedAmount += lineAmount(it.billedQty, it.rate);
  }
  po.billedAmount = round2(billedAmount);
  await po.save();
}

/** Recalculate received / outstanding on an invoice from its payments. */
export async function recalcInvoicePayments(invoiceId: any) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) return;
  const pays = await Payment.find({ invoice: invoiceId }).sort({ paymentDate: 1 }).lean<any[]>();
  const received = round2(pays.reduce((a, p) => a + (p.amount || 0), 0));
  const tds = round2(pays.reduce((a, p) => a + (p.tds || 0), 0));
  const other = round2(pays.reduce((a, p) => a + (p.otherDeductions || 0), 0));
  inv.amountReceived = received;
  inv.tdsDeducted = tds;
  inv.otherDeductions = other;
  const settled = round2(received + tds + other);
  inv.outstanding = inv.status === "cancelled" ? 0 : Math.max(0, round2((inv.total || 0) - settled));
  inv.paymentStatus = settled <= 0 ? "unpaid" : inv.outstanding <= 0.5 ? "paid" : "partial";
  if (inv.paymentStatus === "paid") {
    inv.outstanding = 0;
    inv.paidAt = pays.length ? pays[pays.length - 1].paymentDate : new Date();
  } else inv.paidAt = undefined;
  await inv.save();
}

/**
 * Validate invoice lines against an approved PO's remaining quantities.
 * Rates / GST / HSN are taken from the PO to keep bills consistent with the approval.
 */
export async function buildInvoiceItemsFromPO(po: any, lines: any[], excludeInvoiceId?: any) {
  if (!["approved", "closed"].includes(po.status)) throw bad("Bills can only be generated against an approved PO");
  const others = await Invoice.find({
    purchaseOrder: po._id,
    status: { $ne: "cancelled" },
    ...(excludeInvoiceId ? { _id: { $ne: excludeInvoiceId } } : {}),
  }).lean<any[]>();
  const used = new Map<string, number>();
  for (const inv of others)
    for (const it of inv.items) if (it.poItemId) used.set(String(it.poItemId), (used.get(String(it.poItemId)) || 0) + it.qty);

  const out: any[] = [];
  for (const l of lines) {
    if (!(Number(l.qty) > 0)) continue;
    if (!l.poItemId) {
      // Extra (non-PO) line e.g. additional work — allowed with explicit rate
      out.push({ description: l.description, hsn: l.hsn, unit: l.unit, qty: Number(l.qty), rate: Number(l.rate) || 0, gstRate: l.gstRate });
      continue;
    }
    const pi = po.items.find((x: any) => String(x._id) === String(l.poItemId));
    if (!pi) throw bad("PO line not found");
    const remaining = round2(pi.qty - (used.get(String(pi._id)) || 0));
    if (Number(l.qty) > remaining + 1e-9) throw bad(`"${pi.description}": billing qty ${l.qty} exceeds remaining PO qty ${remaining}`);
    out.push({ poItemId: pi._id, description: pi.description, hsn: pi.hsn, unit: pi.unit, qty: Number(l.qty), rate: pi.rate, gstRate: pi.gstRate });
  }
  return out;
}
