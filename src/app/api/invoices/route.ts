import { handler, body, bad } from "@/lib/api";
import { Invoice, PurchaseOrder, Client, Site } from "@/models";
import { nextDraftRef } from "@/lib/numbering";
import { buildInvoiceItemsFromPO, isInterState, priceDoc, recalcPOBilled } from "@/lib/services";

export const GET = handler("invoice.view", async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("status")) q.status = { $in: sp.get("status")!.split(",") };
  if (sp.get("paymentStatus")) q.paymentStatus = { $in: sp.get("paymentStatus")!.split(",") };
  if (sp.get("client")) q.client = sp.get("client");
  if (sp.get("site")) q.site = sp.get("site");
  if (sp.get("po")) q.purchaseOrder = sp.get("po");
  if (sp.get("from") || sp.get("to")) {
    q.invoiceDate = {};
    if (sp.get("from")) q.invoiceDate.$gte = new Date(sp.get("from")!);
    if (sp.get("to")) q.invoiceDate.$lte = new Date(sp.get("to") + "T23:59:59");
  }
  if (sp.get("outstanding") === "1") {
    q.status = { $in: ["issued", "submitted"] };
    q.outstanding = { $gt: 0 };
  }
  return Invoice.find(q)
    .select("-history -items")
    .populate("client", "name")
    .populate("site", "name code")
    .populate("purchaseOrder", "poNumber clientPoNumber")
    .sort({ invoiceDate: -1, createdAt: -1 })
    .limit(2000)
    .lean();
});

export const POST = handler("invoice.edit", async ({ req, user }) => {
  const b = await body(req);
  if (!b.invoiceDate) throw bad("Invoice date is required");
  let clientId = b.client;
  let siteId = b.site;
  let interState: boolean;
  let lines = b.items || [];

  if (b.purchaseOrder) {
    const po = await PurchaseOrder.findById(b.purchaseOrder).lean<any>();
    if (!po) throw bad("PO not found");
    clientId = po.client;
    siteId = po.site;
    interState = po.interState;
    lines = await buildInvoiceItemsFromPO(po, lines);
  } else {
    if (!clientId) throw bad("Client is required for a bill without PO");
    const client = await Client.findById(clientId).lean<any>();
    if (!client) throw bad("Client not found");
    if (siteId && !(await Site.exists({ _id: siteId, client: clientId }))) throw bad("Site does not belong to client");
    interState = b.interState ?? (await isInterState(client.stateCode));
  }

  const priced = await priceDoc(lines, interState);
  const inv = await Invoice.create({
    draftRef: await nextDraftRef(),
    purchaseOrder: b.purchaseOrder || undefined,
    client: clientId,
    site: siteId || undefined,
    invoiceDate: new Date(b.invoiceDate),
    billType: b.billType || "Tax Invoice",
    notes: b.notes,
    ...priced,
    status: "draft",
    outstanding: 0,
    createdBy: user.id,
    history: [{ action: "Draft created", by: user.id, byName: user.name }],
  });
  await recalcPOBilled(b.purchaseOrder);
  return inv;
});
