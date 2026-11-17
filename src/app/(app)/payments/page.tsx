"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { inr } from "@/lib/format";
import { Button, PageHeader, Spinner, Stat } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/lookups";
import { PaymentModal } from "@/components/payment-modal";
import { useUser } from "@/components/shell";

function Payments() {
  const sp = useSearchParams();
  const user = useUser();
  const [f, setF] = useState<any>({});
  const [open, setOpen] = useState(sp.get("record") === "1");
  const { data, loading, reload } = useApi<any[]>(`/api/payments${qs(f)}`);
  const rows = data || [];
  const sum = (k: string) => rows.reduce((a, r) => a + (r[k] || 0), 0);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Full and partial payments received against bills"
        actions={
          can(user.role, "payment.edit") && (
            <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
              Record Payment
            </Button>
          )
        }
      />
      <div className="mb-4">
        <FilterBar value={f} onChange={setF} />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Amount received" value={inr(sum("amount"), 0)} tone="green" />
        <Stat label="TDS deducted" value={inr(sum("tds"), 0)} tone="slate" />
        <Stat label="Other deductions" value={inr(sum("otherDeductions"), 0)} tone="slate" />
      </div>
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Payment Register"
          rows={rows}
          columns={[
            { key: "paymentDate", label: "Date", type: "date" },
            {
              key: "invoice",
              label: "Invoice",
              value: (r) => r.invoice?.invoiceNo,
              render: (r) => (
                <Link className="font-medium text-brand-700 hover:underline" href={`/invoices/${r.invoice?._id}`}>
                  {r.invoice?.invoiceNo}
                </Link>
              ),
            },
            { key: "client", label: "Client", value: (r) => r.client?.name },
            { key: "site", label: "Site", value: (r) => r.site?.name || "" },
            { key: "mode", label: "Mode" },
            { key: "reference", label: "Reference" },
            { key: "amount", label: "Received", type: "money", total: true },
            { key: "tds", label: "TDS", type: "money", total: true },
            { key: "otherDeductions", label: "Other", type: "money", total: true },
            { key: "createdBy", label: "Entered by", value: (r) => r.createdBy?.name },
          ]}
        />
      )}
      <PaymentModal open={open} onClose={() => setOpen(false)} onDone={reload} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Payments />
    </Suspense>
  );
}
