"use client";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { Badge, Button, PageHeader, Spinner, Tabs } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/lookups";
import { useUser } from "@/components/shell";

const TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "issued", label: "Issued (not submitted)" },
  { value: "submitted", label: "Submitted" },
  { value: "outstanding", label: "Outstanding" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

function Invoices() {
  const user = useUser();
  const router = useRouter();
  const [tab, setTab] = useState("");
  const [f, setF] = useState<any>({});
  const params: any = { ...f };
  if (["draft", "issued", "submitted", "cancelled"].includes(tab)) params.status = tab;
  if (tab === "outstanding") params.outstanding = "1";
  if (tab === "paid") params.paymentStatus = "paid";
  const { data, loading } = useApi<any[]>(`/api/invoices${qs(params)}`);
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Bills / Invoices"
        subtitle="GST invoices generated from approved POs"
        actions={
          can(user.role, "invoice.edit") && (
            <Button href="/invoices/new" icon={<Plus className="size-4" />}>
              Generate Bill
            </Button>
          )
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="mb-3">
        <FilterBar value={f} onChange={setF} />
      </div>
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Invoice Register"
          rows={data || []}
          onRowClick={(r: any) => router.push(`/invoices/${r._id}`)}
          columns={[
            { key: "invoiceNo", label: "Invoice No", value: (r) => r.invoiceNo || r.draftRef, render: (r) => <span className="font-medium text-brand-700">{r.invoiceNo || <span className="text-slate-400">{r.draftRef}</span>}</span> },
            {
              key: "status",
              label: "Status",
              value: (r) => `${r.status} ${r.paymentStatus}`,
              render: (r) => (
                <div className="flex gap-1">
                  <Badge status={r.status} />
                  {["issued", "submitted"].includes(r.status) && <Badge status={r.paymentStatus} />}
                  {r.dueDate && r.outstanding > 0 && new Date(r.dueDate).getTime() < now && <Badge status="overdue" />}
                </div>
              ),
            },
            { key: "invoiceDate", label: "Date", type: "date" },
            { key: "client", label: "Client", value: (r) => r.client?.name },
            { key: "site", label: "Site", value: (r) => r.site?.name || "" },
            { key: "po", label: "PO", value: (r) => r.purchaseOrder?.clientPoNumber || r.purchaseOrder?.poNumber || "" },
            { key: "billType", label: "Type" },
            { key: "total", label: "Amount", type: "money", total: true },
            { key: "outstanding", label: "Outstanding", type: "money", total: true },
            { key: "dueDate", label: "Due", type: "date" },
          ]}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Invoices />
    </Suspense>
  );
}
