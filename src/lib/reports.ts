import "server-only";
import { Invoice, PurchaseOrder, Payment, WorkEntry, Client, Site } from "@/models";
import { round2, daysBetween } from "./format";

export const AGE_BUCKETS = [
  { key: "b0_30", label: "0-30 days", min: 0, max: 30 },
  { key: "b31_60", label: "31-60 days", min: 31, max: 60 },
  { key: "b61_90", label: "61-90 days", min: 61, max: 90 },
  { key: "b91_180", label: "91-180 days", min: 91, max: 180 },
  { key: "b180", label: "180+ days", min: 181, max: Infinity },
];

export interface Filters {
  from?: string;
  to?: string;
  client?: string;
  site?: string;
}

function dateRange(field: string, f: Filters) {
  if (!f.from && !f.to) return {};
  const r: any = {};
  if (f.from) r.$gte = new Date(f.from);
  if (f.to) r.$lte = new Date(f.to + "T23:59:59");
  return { [field]: r };
}
function scope(f: Filters) {
  const q: any = {};
  if (f.client) q.client = f.client;
  if (f.site) q.site = f.site;
  return q;
}

const ACTIVE_INV = { status: { $in: ["issued", "submitted"] } };
const ACTIVE_PO = { status: { $in: ["approved", "closed"] } };

export function ageOf(inv: any, asOf = new Date()) {
  const base = inv.submittedAt || inv.invoiceDate;
  return Math.max(0, daysBetween(base, asOf));
}
export function bucketOf(days: number) {
  return AGE_BUCKETS.find((b) => days >= b.min && days <= b.max)!.key;
}
export function isOverdue(inv: any, asOf = new Date()) {
  return !!inv.dueDate && inv.outstanding > 0 && new Date(inv.dueDate) < asOf;
}

/* ---------------- Dashboard ---------------- */
export async function dashboardData(f: Filters = {}) {
  const now = new Date();
  const [pos, invoices, payments, pendingWork, clients, sites] = await Promise.all([
    PurchaseOrder.find({ ...scope(f), ...dateRange("poDate", f) }).select("client site status total subtotal billedAmount poDate").lean<any[]>(),
    Invoice.find({ ...scope(f), ...dateRange("invoiceDate", f), status: { $ne: "cancelled" } })
      .select("client site status total subtotal outstanding amountReceived tdsDeducted invoiceDate submittedAt dueDate invoiceNo draftRef paymentStatus")
      .populate("client", "name")
      .lean<any[]>(),
    Payment.find({ ...scope(f), ...dateRange("paymentDate", f) }).select("client site amount tds otherDeductions paymentDate").lean<any[]>(),
    WorkEntry.countDocuments({ ...scope(f), status: "submitted" }),
    Client.find().select("name").lean<any[]>(),
    Site.find().select("name code client").lean<any[]>(),
  ]);

  const active = invoices.filter((i) => ["issued", "submitted"].includes(i.status));
  const approvedPOs = pos.filter((p) => ["approved", "closed"].includes(p.status));
  const sum = (arr: any[], k: string) => round2(arr.reduce((a, x) => a + (x[k] || 0), 0));

  const totalPoValue = sum(approvedPOs, "total");
  const totalBilling = sum(active, "total");
  const totalReceived = sum(payments, "amount");
  const totalTds = round2(sum(payments, "tds") + sum(payments, "otherDeductions"));
  const totalOutstanding = sum(active, "outstanding");
  const overdueList = active.filter((i) => isOverdue(i, now));
  const overdueOutstanding = sum(overdueList, "outstanding");

  const pendingApprovals = pos.filter((p) => ["draft", "sent"].includes(p.status));
  const unbilledPOs = approvedPOs.filter((p) => p.status === "approved" && round2((p.subtotal || 0) - (p.billedAmount || 0)) > 0.5);
  const unbilledValue = round2(unbilledPOs.reduce((a, p) => a + (p.subtotal - (p.billedAmount || 0)), 0));
  const draftInvoices = invoices.filter((i) => i.status === "draft");
  const notSubmitted = invoices.filter((i) => i.status === "issued");

  // Monthly (last 12 months)
  const months: { key: string; label: string; billing: number; collection: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), billing: 0, collection: 0 });
  }
  const mk = (d: Date) => `${new Date(d).getFullYear()}-${new Date(d).getMonth()}`;
  for (const i of active) {
    const m = months.find((x) => x.key === mk(i.invoiceDate));
    if (m) m.billing += i.total;
  }
  for (const p of payments) {
    const m = months.find((x) => x.key === mk(p.paymentDate));
    if (m) m.collection += p.amount + (p.tds || 0) + (p.otherDeductions || 0);
  }
  months.forEach((m) => {
    m.billing = round2(m.billing);
    m.collection = round2(m.collection);
  });

  // Ageing
  const ageing = AGE_BUCKETS.map((b) => ({ ...b, amount: 0, count: 0 }));
  for (const i of active.filter((x) => x.outstanding > 0)) {
    const b = ageing.find((x) => x.key === bucketOf(ageOf(i, now)))!;
    b.amount = round2(b.amount + i.outstanding);
    b.count++;
  }

  const clientWise = groupSummary(clients, "client", approvedPOs, active, payments).filter((r) => r.poValue || r.billed || r.received).sort((a, b) => b.billed - a.billed);
  const siteWise = groupSummary(sites, "site", approvedPOs, active, payments).filter((r) => r.poValue || r.billed || r.received).sort((a, b) => b.billed - a.billed);

  const topOverdue = overdueList
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8)
    .map((i) => ({ _id: i._id, invoiceNo: i.invoiceNo, client: i.client?.name, outstanding: i.outstanding, dueDate: i.dueDate, days: daysBetween(i.dueDate, now) }));

  return {
    kpis: {
      totalPoValue,
      totalBilling,
      totalReceived,
      totalTds,
      totalOutstanding,
      overdueOutstanding,
      overdueCount: overdueList.length,
      pendingPoApprovals: pendingApprovals.length,
      pendingPoValue: sum(pendingApprovals, "total"),
      unbilledPOs: unbilledPOs.length,
      unbilledValue,
      draftInvoices: draftInvoices.length,
      notSubmitted: notSubmitted.length,
      pendingWork,
      collectionRate: totalBilling ? round2(((totalBilling - totalOutstanding) / totalBilling) * 100) : 0,
    },
    monthly: months,
    ageing,
    clientWise: clientWise.slice(0, 15),
    siteWise: siteWise.slice(0, 15),
    topOverdue,
  };
}

function groupSummary(masters: any[], key: "client" | "site", pos: any[], invoices: any[], payments: any[]) {
  const now = new Date();
  return masters.map((m) => {
    const id = String(m._id);
    const p = pos.filter((x) => String(x[key]?._id || x[key]) === id);
    const inv = invoices.filter((x) => String(x[key]?._id || x[key]) === id);
    const pay = payments.filter((x) => String(x[key]?._id || x[key]) === id);
    const poValue = round2(p.reduce((a, x) => a + (x.total || 0), 0));
    const billed = round2(inv.reduce((a, x) => a + (x.total || 0), 0));
    const received = round2(pay.reduce((a, x) => a + (x.amount || 0), 0));
    const deductions = round2(pay.reduce((a, x) => a + (x.tds || 0) + (x.otherDeductions || 0), 0));
    const outstanding = round2(inv.reduce((a, x) => a + (x.outstanding || 0), 0));
    const overdue = round2(inv.filter((x) => isOverdue(x, now)).reduce((a, x) => a + x.outstanding, 0));
    return {
      _id: id,
      name: m.name + (key === "site" && m.code ? ` (${m.code})` : ""),
      poCount: p.length,
      poValue,
      invoiceCount: inv.length,
      billed,
      received,
      deductions,
      outstanding,
      overdue,
      unbilled: round2(p.reduce((a, x) => a + Math.max(0, (x.subtotal || 0) - (x.billedAmount || 0)), 0)),
    };
  });
}

/* ---------------- Reports ---------------- */
export async function report(type: string, f: Filters) {
  switch (type) {
    case "client-summary":
    case "site-summary": {
      const key = type === "client-summary" ? "client" : "site";
      const [masters, pos, invoices, payments] = await Promise.all([
        key === "client" ? Client.find(f.client ? { _id: f.client } : {}).lean<any[]>() : Site.find({ ...(f.client ? { client: f.client } : {}), ...(f.site ? { _id: f.site } : {}) }).lean<any[]>(),
        PurchaseOrder.find({ ...scope(f), ...dateRange("poDate", f), ...ACTIVE_PO }).lean<any[]>(),
        Invoice.find({ ...scope(f), ...dateRange("invoiceDate", f), ...ACTIVE_INV }).lean<any[]>(),
        Payment.find({ ...scope(f), ...dateRange("paymentDate", f) }).lean<any[]>(),
      ]);
      return groupSummary(masters, key, pos, invoices, payments).filter((r) => r.poCount || r.invoiceCount || r.received);
    }
    case "po-register": {
      const rows = await PurchaseOrder.find({ ...scope(f), ...dateRange("poDate", f) })
        .populate("client", "name")
        .populate("site", "name code")
        .sort({ poDate: -1 })
        .lean<any[]>();
      return rows.map((p) => ({
        _id: p._id,
        poNumber: p.poNumber,
        clientPoNumber: p.clientPoNumber || "",
        poDate: p.poDate,
        client: p.client?.name,
        site: p.site?.name,
        status: p.status,
        subtotal: p.subtotal,
        taxTotal: p.taxTotal,
        total: p.total,
        billed: p.billedAmount || 0,
        unbilled: round2(Math.max(0, (p.subtotal || 0) - (p.billedAmount || 0))),
        approvedAt: p.approvedAt,
      }));
    }
    case "invoice-register": {
      const rows = await Invoice.find({ ...scope(f), ...dateRange("invoiceDate", f), status: { $in: ["issued", "submitted", "cancelled"] } })
        .populate("client", "name gstin")
        .populate("site", "name")
        .populate("purchaseOrder", "poNumber clientPoNumber")
        .sort({ invoiceDate: -1 })
        .lean<any[]>();
      return rows.map((i) => ({
        _id: i._id,
        invoiceNo: i.invoiceNo,
        invoiceDate: i.invoiceDate,
        client: i.client?.name,
        gstin: i.client?.gstin || "",
        site: i.site?.name || "",
        poNumber: i.purchaseOrder?.clientPoNumber || i.purchaseOrder?.poNumber || "",
        billType: i.billType,
        subtotal: i.subtotal,
        cgst: i.cgst,
        sgst: i.sgst,
        igst: i.igst,
        total: i.total,
        received: i.amountReceived,
        tds: i.tdsDeducted,
        outstanding: i.outstanding,
        status: i.status,
        paymentStatus: i.paymentStatus,
        submittedAt: i.submittedAt,
        dueDate: i.dueDate,
      }));
    }
    case "payments": {
      const rows = await Payment.find({ ...scope(f), ...dateRange("paymentDate", f) })
        .populate("client", "name")
        .populate("site", "name")
        .populate("invoice", "invoiceNo total")
        .sort({ paymentDate: -1 })
        .lean<any[]>();
      return rows.map((p) => ({
        _id: p._id,
        paymentDate: p.paymentDate,
        client: p.client?.name,
        site: p.site?.name || "",
        invoiceNo: p.invoice?.invoiceNo,
        invoiceId: p.invoice?._id,
        amount: p.amount,
        tds: p.tds,
        otherDeductions: p.otherDeductions,
        mode: p.mode,
        reference: p.reference || "",
      }));
    }
    case "outstanding": {
      const now = new Date();
      const rows = await Invoice.find({ ...scope(f), ...dateRange("invoiceDate", f), ...ACTIVE_INV, outstanding: { $gt: 0 } })
        .populate("client", "name")
        .populate("site", "name")
        .sort({ invoiceDate: 1 })
        .lean<any[]>();
      return rows.map((i) => {
        const age = ageOf(i, now);
        const b = bucketOf(age);
        const r: any = {
          _id: i._id,
          invoiceNo: i.invoiceNo,
          invoiceDate: i.invoiceDate,
          client: i.client?.name,
          site: i.site?.name || "",
          total: i.total,
          received: round2((i.amountReceived || 0) + (i.tdsDeducted || 0) + (i.otherDeductions || 0)),
          outstanding: i.outstanding,
          submittedAt: i.submittedAt,
          dueDate: i.dueDate,
          age,
          overdueDays: i.dueDate && new Date(i.dueDate) < now ? daysBetween(i.dueDate, now) : 0,
        };
        for (const x of AGE_BUCKETS) r[x.key] = x.key === b ? i.outstanding : 0;
        return r;
      });
    }
    case "ageing-summary": {
      const rows = (await report("outstanding", f)) as any[];
      const map = new Map<string, any>();
      for (const r of rows) {
        if (!map.has(r.client)) map.set(r.client, { _id: r.client, client: r.client, count: 0, outstanding: 0, overdue: 0, ...Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])) });
        const g = map.get(r.client);
        g.count++;
        g.outstanding = round2(g.outstanding + r.outstanding);
        if (r.overdueDays > 0) g.overdue = round2(g.overdue + r.outstanding);
        for (const b of AGE_BUCKETS) g[b.key] = round2(g[b.key] + r[b.key]);
      }
      return [...map.values()].sort((a, b) => b.outstanding - a.outstanding);
    }
    default:
      throw new Error("Unknown report");
  }
}
