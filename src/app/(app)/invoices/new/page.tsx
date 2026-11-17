"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/client";
import { inr, fmtDate, round2 } from "@/lib/format";
import { Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { InvoiceForm } from "@/components/invoice-form";

function NewInvoice() {
  const sp = useSearchParams();
  const router = useRouter();
  const po = sp.get("po");
  const [manual, setManual] = useState(sp.get("manual") === "1");
  const { data: pos } = useApi<any[]>(!po && !manual ? "/api/purchase-orders?status=approved" : null);

  if (po || manual)
    return (
      <>
        <PageHeader title="Generate Bill" back="/invoices" subtitle={po ? "Bill against an approved purchase order" : "Bill without a purchase order"} />
        <InvoiceForm poId={po || undefined} />
      </>
    );

  const open = (pos || []).filter((p) => round2((p.subtotal || 0) - (p.billedAmount || 0)) > 0.5);
  return (
    <>
      <PageHeader
        title="Generate Bill"
        back="/invoices"
        subtitle="Select an approved PO with unbilled value"
        actions={
          <Button variant="secondary" onClick={() => setManual(true)}>
            Bill without PO
          </Button>
        }
      />
      {!pos ? (
        <Spinner />
      ) : !open.length ? (
        <Card>
          <Empty title="No approved POs with pending billing">Approve a PO first, or create a bill without PO.</Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {open.map((p) => (
            <button key={p._id} onClick={() => router.push(`/invoices/new?po=${p._id}`)} className="rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-card transition hover:border-brand-300 hover:shadow-md">
              <p className="font-semibold text-brand-700">
                {p.poNumber} {p.clientPoNumber && <span className="font-normal text-slate-500">/ {p.clientPoNumber}</span>}
              </p>
              <p className="mt-1 text-sm text-slate-800">{p.client?.name}</p>
              <p className="text-xs text-slate-500">
                {p.site?.name} · {fmtDate(p.poDate)}
              </p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-500">Unbilled (taxable)</span>
                <span className="font-semibold tabular-nums">{inr(p.subtotal - (p.billedAmount || 0))}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewInvoice />
    </Suspense>
  );
}
