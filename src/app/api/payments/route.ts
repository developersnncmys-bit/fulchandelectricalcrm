import { handler, body, bad } from "@/lib/api";
import { Payment, Invoice } from "@/models";
import { recalcInvoicePayments } from "@/lib/services";
import { round2 } from "@/lib/format";

export const GET = handler("payment.view", async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("client")) q.client = sp.get("client");
  if (sp.get("site")) q.site = sp.get("site");
  if (sp.get("invoice")) q.invoice = sp.get("invoice");
  if (sp.get("from") || sp.get("to")) {
    q.paymentDate = {};
    if (sp.get("from")) q.paymentDate.$gte = new Date(sp.get("from")!);
    if (sp.get("to")) q.paymentDate.$lte = new Date(sp.get("to") + "T23:59:59");
  }
  return Payment.find(q)
    .populate("client", "name")
    .populate("site", "name")
    .populate("invoice", "invoiceNo total")
    .populate("createdBy", "name")
    .sort({ paymentDate: -1, createdAt: -1 })
    .limit(2000)
    .lean();
});

export const POST = handler("payment.edit", async ({ req, user }) => {
  const b = await body(req);
  const inv = await Invoice.findById(b.invoice);
  if (!inv) throw bad("Invoice not found");
  if (!["issued", "submitted"].includes(inv.status)) throw bad("Payments can only be recorded against issued / submitted invoices");
  const amount = round2(Number(b.amount) || 0);
  const tds = round2(Number(b.tds) || 0);
  const other = round2(Number(b.otherDeductions) || 0);
  if (amount + tds + other <= 0) throw bad("Enter the amount received");
  if (amount + tds + other > (inv.outstanding || 0) + 0.5) throw bad(`Amount exceeds outstanding of ₹${inv.outstanding}`);
  if (!b.paymentDate) throw bad("Payment date is required");
  const p = await Payment.create({
    invoice: inv._id,
    client: inv.client,
    site: inv.site,
    paymentDate: new Date(b.paymentDate),
    amount,
    tds,
    otherDeductions: other,
    mode: b.mode || "NEFT",
    reference: b.reference,
    notes: b.notes,
    createdBy: user.id,
  });
  inv.history.push({ action: `Payment recorded ₹${amount}${tds ? ` (+TDS ₹${tds})` : ""}`, by: user.id, byName: user.name });
  await inv.save();
  await recalcInvoicePayments(inv._id);
  return p;
});
