"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MapPin, FileCheck2, Receipt, Wallet, Clock4 } from "lucide-react";
import { useApi, qs } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { Badge, PageHeader, Spinner, cx } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/lookups";

const summaryCols = (label: string): Column[] => [
  { key: "name", label },
  { key: "poCount", label: "POs", type: "number", total: true },
  { key: "poValue", label: "PO Value", type: "money", total: true },
  { key: "invoiceCount", label: "Bills", type: "number", total: true },
  { key: "billed", label: "Billed", type: "money", total: true },
  { key: "unbilled", label: "Unbilled (PO)", type: "money", total: true },
  { key: "received", label: "Received", type: "money", total: true },
  { key: "deductions", label: "TDS/Ded.", type: "money", total: true },
  { key: "outstanding", label: "Outstanding", type: "money", total: true },
  { key: "overdue", label: "Overdue", type: "money", total: true },
];

const REPORTS: { key: string; label: string; icon: any; desc: string; cols: Column[]; link?: (r: any) => string }[] = [
  { key: "client-summary", label: "Client-wise Billing", icon: Building2, desc: "PO value, billing, collections & dues per client", cols: summaryCols("Client") },
  { key: "site-summary", label: "Site-wise Billing", icon: MapPin, desc: "Business summary per site", cols: summaryCols("Site") },
  {
    key: "po-register",
    label: "PO Register",
    icon: FileCheck2,
    desc: "All purchase orders with billed / unbilled value",
    link: (r) => `/purchase-orders/${r._id}`,
    cols: [
      { key: "poNumber", label: "PO No" },
      { key: "clientPoNumber", label: "Client PO" },
      { key: "poDate", label: "Date", type: "date" },
      { key: "client", label: "Client" },
      { key: "site", label: "Site" },
      { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
      { key: "approvedAt", label: "Approved", type: "date" },
      { key: "subtotal", label: "Taxable", type: "money", total: true },
      { key: "taxTotal", label: "GST", type: "money", total: true },
      { key: "total", label: "PO Value", type: "money", total: true },
      { key: "billed", label: "Billed", type: "money", total: true },
      { key: "unbilled", label: "Unbilled", type: "money", total: true },
    ],
  },
  {
    key: "invoice-register",
    label: "Invoice Register",
    icon: Receipt,
    desc: "Issued invoices with GST break-up (for GSTR-1)",
    link: (r) => `/invoices/${r._id}`,
    cols: [
      { key: "invoiceNo", label: "Invoice No" },
      { key: "invoiceDate", label: "Date", type: "date" },
      { key: "client", label: "Client" },
      { key: "gstin", label: "GSTIN" },
      { key: "site", label: "Site" },
      { key: "poNumber", label: "PO" },
      { key: "subtotal", label: "Taxable", type: "money", total: true },
      { key: "cgst", label: "CGST", type: "money", total: true },
      { key: "sgst", label: "SGST", type: "money", total: true },
      { key: "igst", label: "IGST", type: "money", total: true },
      { key: "total", label: "Total", type: "money", total: true },
      { key: "outstanding", label: "Outstanding", type: "money", total: true },
      { key: "status", label: "Status", value: (r) => (r.status === "cancelled" ? "cancelled" : r.paymentStatus), render: (r) => <Badge status={r.status === "cancelled" ? "cancelled" : r.paymentStatus} /> },
    ],
  },
  {
    key: "payments",
    label: "Payment Report",
    icon: Wallet,
    desc: "Receipts with TDS & deductions",
    link: (r) => `/invoices/${r.invoiceId}`,
    cols: [
      { key: "paymentDate", label: "Date", type: "date" },
      { key: "invoiceNo", label: "Invoice" },
      { key: "client", label: "Client" },
      { key: "site", label: "Site" },
      { key: "mode", label: "Mode" },
      { key: "reference", label: "Reference" },
      { key: "amount", label: "Received", type: "money", total: true },
      { key: "tds", label: "TDS", type: "money", total: true },
      { key: "otherDeductions", label: "Other", type: "money", total: true },
    ],
  },
  {
    key: "outstanding",
    label: "Outstanding Report",
    icon: Clock4,
    desc: "Bill-wise outstanding with ageing buckets",
    link: (r) => `/invoices/${r._id}`,
    cols: [
      { key: "invoiceNo", label: "Invoice" },
      { key: "invoiceDate", label: "Date", type: "date" },
      { key: "client", label: "Client" },
      { key: "site", label: "Site" },
      { key: "total", label: "Bill Amt", type: "money", total: true },
      { key: "outstanding", label: "Outstanding", type: "money", total: true },
      { key: "dueDate", label: "Due", type: "date" },
      { key: "age", label: "Age", type: "number" },
      { key: "b0_30", label: "0-30", type: "money", total: true },
      { key: "b31_60", label: "31-60", type: "money", total: true },
      { key: "b61_90", label: "61-90", type: "money", total: true },
      { key: "b91_180", label: "91-180", type: "money", total: true },
      { key: "b180", label: "180+", type: "money", total: true },
    ],
  },
];

export default function Reports() {
  const router = useRouter();
  const [type, setType] = useState(REPORTS[0].key);
  const [f, setF] = useState<any>({});
  const rep = REPORTS.find((r) => r.key === type)!;
  const { data, loading } = useApi<any[]>(`/api/reports${qs({ type, ...f })}`);
  const period = f.from || f.to ? `Period: ${f.from ? fmtDate(f.from) : "start"} to ${f.to ? fmtDate(f.to) : "today"}` : "All dates";

  return (
    <>
      <PageHeader title="Reports" subtitle="Export any report to Excel or PDF" />
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setType(r.key)}
            className={cx(
              "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
              type === r.key ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <r.icon className={cx("size-5", type === r.key ? "text-brand-600" : "text-slate-400")} />
            <span className="text-sm font-semibold text-slate-800">{r.label}</span>
            <span className="hidden text-xs text-slate-500 sm:block">{r.desc}</span>
          </button>
        ))}
      </div>
      <div className="mb-3">
        <FilterBar value={f} onChange={setF} />
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <DataTable key={type} title={rep.label} subtitle={period} rows={data || []} columns={rep.cols} onRowClick={rep.link ? (r: any) => router.push(rep.link!(r)) : undefined} />
      )}
    </>
  );
}
