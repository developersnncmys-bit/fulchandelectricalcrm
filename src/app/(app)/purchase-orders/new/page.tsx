"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Spinner } from "@/components/ui";
import { POForm } from "@/components/po-form";

function NewPO() {
  const sp = useSearchParams();
  return (
    <>
      <PageHeader title="New Purchase Order" back="/purchase-orders" subtitle="Prepare a PO from validated site work, then send it to the client for approval. Attach the signed PO copy after saving." />
      <POForm presetSite={sp.get("site") || undefined} presetEntries={sp.get("entries")?.split(",").filter(Boolean)} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewPO />
    </Suspense>
  );
}
