"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { inr } from "@/lib/format";
import { Badge, Button, PageHeader, Spinner, Tabs } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/lookups";
import { useUser } from "@/components/shell";

const TABS = [
  { value: "", label: "All" },
  { value: "draft,sent", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

function POList() {
  const user = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") || "");
  const [f, setF] = useState<any>({});
  const { data, loading } = useApi<any[]>(`/api/purchase-orders${qs({ status, client: f.client, site: f.site })}`);

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        subtitle="Site-wise and client-wise PO records with approval tracking"
        actions={
          can(user.role, "po.edit") && (
            <Button href="/purchase-orders/new" icon={<Plus className="size-4" />}>
              New PO
            </Button>
          )
        }
      />
      <Tabs tabs={TABS} value={status} onChange={setStatus} />
      <div className="mb-3">
        <FilterBar value={f} onChange={setF} dates={false} />
      </div>
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="PO Register"
          rows={data || []}
          onRowClick={(r: any) => router.push(`/purchase-orders/${r._id}`)}
          columns={[
            { key: "poNumber", label: "PO No", render: (r) => <span className="font-medium text-brand-700">{r.poNumber}</span> },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "clientPoNumber", label: "Client PO No" },
            { key: "poDate", label: "Date", type: "date" },
            { key: "client", label: "Client", value: (r) => r.client?.name },
            { key: "site", label: "Site", value: (r) => r.site?.name },
            { key: "total", label: "PO Value", type: "money", total: true },
            {
              key: "billed",
              label: "Billed %",
              value: (r) => (r.subtotal ? Math.round(((r.billedAmount || 0) / r.subtotal) * 100) : 0),
              render: (r) => {
                const p = r.subtotal ? Math.min(100, Math.round(((r.billedAmount || 0) / r.subtotal) * 100)) : 0;
                return (
                  <div className="flex items-center gap-2" title={`${inr(r.billedAmount)} of ${inr(r.subtotal)} taxable billed`}>
                    <div className="h-1.5 w-16 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#3b3f48]" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-slate-600">{p}%</span>
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <POList />
    </Suspense>
  );
}
