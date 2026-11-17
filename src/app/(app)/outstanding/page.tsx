"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, qs } from "@/lib/client";
import { inr } from "@/lib/format";
import { Badge, PageHeader, Spinner, Stat, Tabs } from "@/components/ui";
import { DataTable, type Column } from "@/components/data-table";
import { FilterBar } from "@/components/lookups";

const BUCKETS = [
  { key: "b0_30", label: "0-30" },
  { key: "b31_60", label: "31-60" },
  { key: "b61_90", label: "61-90" },
  { key: "b91_180", label: "91-180" },
  { key: "b180", label: "180+" },
];
const bucketCols: Column[] = BUCKETS.map((b) => ({ key: b.key, label: `${b.label} days`, type: "money", total: true }));

export default function Outstanding() {
  const router = useRouter();
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [f, setF] = useState<any>({});
  const { data: detail, loading } = useApi<any[]>(`/api/reports${qs({ type: "outstanding", ...f })}`);
  const { data: summary } = useApi<any[]>(`/api/reports${qs({ type: "ageing-summary", ...f })}`);
  const rows = detail || [];
  const total = rows.reduce((a, r) => a + r.outstanding, 0);
  const overdue = rows.filter((r) => r.overdueDays > 0).reduce((a, r) => a + r.outstanding, 0);
  const notSubmitted = rows.filter((r) => !r.submittedAt).reduce((a, r) => a + r.outstanding, 0);

  return (
    <>
      <PageHeader title="Outstanding & Ageing" subtitle="Ageing is counted from the bill submission date (or invoice date if not yet submitted)" />
      <div className="mb-4">
        <FilterBar value={f} onChange={setF} />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total outstanding" value={inr(total, 0)} sub={`${rows.length} bills`} tone="amber" />
        <Stat label="Overdue (past due date)" value={inr(overdue, 0)} tone="red" />
        <Stat label="Not yet submitted" value={inr(notSubmitted, 0)} sub="Issued but not submitted" tone="slate" />
        <Stat label="Clients with dues" value={summary?.length ?? 0} tone="brand" />
      </div>
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: "summary", label: "Client-wise ageing" },
          { value: "detail", label: "Bill-wise" },
        ]}
      />
      {loading && !detail ? (
        <Spinner />
      ) : view === "summary" ? (
        <DataTable
          title="Client-wise Outstanding Ageing"
          rows={summary || []}
          columns={[{ key: "client", label: "Client" }, { key: "count", label: "Bills", type: "number", total: true }, ...bucketCols, { key: "overdue", label: "Overdue", type: "money", total: true }, { key: "outstanding", label: "Total", type: "money", total: true }]}
        />
      ) : (
        <DataTable
          title="Bill-wise Outstanding"
          rows={rows}
          onRowClick={(r: any) => router.push(`/invoices/${r._id}`)}
          columns={[
            { key: "invoiceNo", label: "Invoice", render: (r) => <span className="font-medium text-brand-700">{r.invoiceNo}</span> },
            { key: "invoiceDate", label: "Date", type: "date" },
            { key: "client", label: "Client" },
            { key: "site", label: "Site" },
            { key: "total", label: "Bill Amt", type: "money", total: true },
            { key: "received", label: "Settled", type: "money", total: true },
            { key: "outstanding", label: "Outstanding", type: "money", total: true },
            { key: "dueDate", label: "Due", type: "date" },
            { key: "age", label: "Age (days)", type: "number" },
            {
              key: "overdueDays",
              label: "Overdue",
              type: "number",
              render: (r) => (r.overdueDays > 0 ? <Badge status="overdue">{r.overdueDays} days</Badge> : r.submittedAt ? <span className="text-slate-400">—</span> : <Badge status="draft">Not submitted</Badge>),
            },
          ]}
        />
      )}
    </>
  );
}
