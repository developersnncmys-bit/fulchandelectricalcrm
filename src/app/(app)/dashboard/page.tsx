"use client";
import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileCheck2, IndianRupee, Wallet, AlertTriangle, Clock4, Receipt, ClipboardCheck, FileClock } from "lucide-react";
import { useApi, qs } from "@/lib/client";
import { inr, inrShort, fmtDate } from "@/lib/format";
import { Card, PageHeader, Spinner, Stat, ErrorBox, Tabs } from "@/components/ui";
import { FilterBar } from "@/components/lookups";
import { DataTable } from "@/components/data-table";

// Categorical slots 1 & 2 of the validated reference palette
const C_BILL = "#3b3f48";
const C_COLL = "#b8571a";

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-slate-900">{inr(p.value, 0)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [f, setF] = useState<any>({});
  const [tab, setTab] = useState<"client" | "site">("client");
  const { data, loading, error } = useApi<any>(`/api/dashboard${qs(f)}`);

  return (
    <>
      <PageHeader title="Management Dashboard" subtitle="Real-time billing, collections & outstanding overview" />
      <div className="mb-5">
        <FilterBar value={f} onChange={setF} />
      </div>
      {error && <ErrorBox error={error} />}
      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total PO Value (approved)" value={inr(data.kpis.totalPoValue, 0)} icon={<FileCheck2 className="size-5" />} tone="brand" href="/purchase-orders" />
            <Stat label="Total Billing" value={inr(data.kpis.totalBilling, 0)} icon={<Receipt className="size-5" />} tone="violet" href="/invoices" />
            <Stat
              label="Payment Received"
              value={inr(data.kpis.totalReceived, 0)}
              sub={data.kpis.totalTds ? `+ ${inr(data.kpis.totalTds, 0)} TDS/deductions` : `${data.kpis.collectionRate}% collected`}
              icon={<Wallet className="size-5" />}
              tone="green"
              href="/payments"
            />
            <Stat label="Total Outstanding" value={inr(data.kpis.totalOutstanding, 0)} icon={<IndianRupee className="size-5" />} tone="amber" href="/outstanding" />
            <Stat
              label="Overdue Outstanding"
              value={inr(data.kpis.overdueOutstanding, 0)}
              sub={`${data.kpis.overdueCount} overdue bill(s)`}
              icon={<AlertTriangle className="size-5" />}
              tone="red"
              href="/outstanding"
            />
            <Stat label="Pending PO Approvals" value={data.kpis.pendingPoApprovals} sub={inr(data.kpis.pendingPoValue, 0)} icon={<FileClock className="size-5" />} tone="slate" href="/purchase-orders?status=draft,sent" />
            <Stat
              label="Pending Bills"
              value={data.kpis.unbilledPOs + data.kpis.draftInvoices}
              sub={`${inr(data.kpis.unbilledValue, 0)} unbilled · ${data.kpis.notSubmitted} not submitted`}
              icon={<Clock4 className="size-5" />}
              tone="violet"
              href="/invoices"
            />
            <Stat label="Work Awaiting Validation" value={data.kpis.pendingWork} icon={<ClipboardCheck className="size-5" />} tone="brand" href="/work-entries?status=submitted" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card title="Monthly Billing vs Collections (last 12 months)" className="xl:col-span-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} barGap={2} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#eef0f4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => inrShort(v)} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(42,120,214,0.06)" }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#475569" }} />
                    <Bar dataKey="billing" name="Billing" fill={C_BILL} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={400} />
                    <Bar dataKey="collection" name="Collections" fill={C_COLL} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={400} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Outstanding Ageing" actions={<Link href="/outstanding" className="text-xs font-medium text-brand-600 hover:underline">View report →</Link>}>
              <AgeingBars ageing={data.ageing} />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "client", label: "Client-wise" },
                  { value: "site", label: "Site-wise" },
                ]}
              />
              <DataTable
                title={tab === "client" ? "Client-wise business summary" : "Site-wise business summary"}
                rows={tab === "client" ? data.clientWise : data.siteWise}
                search={false}
                columns={[
                  { key: "name", label: tab === "client" ? "Client" : "Site" },
                  { key: "poValue", label: "PO Value", type: "money", total: true },
                  { key: "billed", label: "Billed", type: "money", total: true },
                  { key: "received", label: "Received", type: "money", total: true },
                  { key: "outstanding", label: "Outstanding", type: "money", total: true },
                  { key: "overdue", label: "Overdue", type: "money", total: true, render: (r) => <span className={r.overdue ? "font-semibold text-red-600" : ""}>{inr(r.overdue)}</span> },
                ]}
              />
            </div>
            <Card title="Top Overdue Bills" bodyClass="p-0">
              {data.topOverdue.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No overdue bills. 🎉</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.topOverdue.map((o: any) => (
                    <li key={o._id}>
                      <Link href={`/invoices/${o._id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{o.client}</p>
                          <p className="text-xs text-slate-500">
                            {o.invoiceNo} · due {fmtDate(o.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-slate-900">{inr(o.outstanding, 0)}</p>
                          <p className="text-xs font-medium text-red-600">{o.days} days late</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AgeingBars({ ageing }: { ageing: any[] }) {
  const max = Math.max(1, ...ageing.map((a) => a.amount));
  const total = ageing.reduce((a, b) => a + b.amount, 0);
  return (
    <div className="space-y-3.5">
      {ageing.map((a) => (
        <div key={a.key} className="group" title={`${a.label}: ${inr(a.amount)} across ${a.count} bill(s)`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-slate-600">{a.label}</span>
            <span className="tabular-nums text-slate-800">
              {inr(a.amount, 0)} <span className="text-slate-400">({a.count})</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#3b3f48] transition-all group-hover:bg-[#1c5cab]" style={{ width: `${(a.amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold">
        <span>Total outstanding</span>
        <span className="tabular-nums">{inr(total, 0)}</span>
      </div>
    </div>
  );
}
