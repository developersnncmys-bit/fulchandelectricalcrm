"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client";
import { computeTax } from "@/lib/gst";
import { inr, isoDate, num, round2, today, fmtDate } from "@/lib/format";
import { Button, Card, Field, Input, Select, Textarea, Spinner } from "./ui";
import { LineItemsEditor, TotalsBox, blankItem, type PricedItem } from "./line-items";
import { useClients, useSettings, useSites } from "./lookups";
import { useToast } from "./toast";

const BILL_TYPES = ["Tax Invoice", "RA Bill 1", "RA Bill 2", "RA Bill 3", "RA Bill 4", "Final Bill", "Supply Bill", "Service Bill"];

export function InvoiceForm({ poId, initial, onSaved }: { poId?: string; initial?: any; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const effectivePo = initial?.purchaseOrder?._id || poId;
  const { data: po } = useApi<any>(effectivePo ? `/api/purchase-orders/${effectivePo}` : null);
  const [f, setF] = useState({
    invoiceDate: initial ? isoDate(initial.invoiceDate) : today(),
    billType: initial?.billType || "Tax Invoice",
    notes: initial?.notes || "",
    client: initial?.client?._id || "",
    site: initial?.site?._id || "",
  });
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<PricedItem[]>(initial && !effectivePo ? initial.items : []);
  const [busy, setBusy] = useState(false);
  const clients = useClients();
  const sites = useSites(f.client);

  // Remaining qty per PO line; when editing a draft, add back this invoice's own qty.
  const lines = useMemo(() => {
    if (!po) return [];
    const own = new Map<string, number>();
    for (const it of initial?.items || []) if (it.poItemId) own.set(String(it.poItemId), (own.get(String(it.poItemId)) || 0) + it.qty);
    return po.items.map((it: any) => ({ ...it, remaining: round2(it.qty - (it.billedQty || 0) + (own.get(String(it._id)) || 0)), own: own.get(String(it._id)) || 0 }));
  }, [po, initial]);

  useEffect(() => {
    if (!lines.length) return;
    setQtys(Object.fromEntries(lines.map((l: any) => [l._id, String(initial ? l.own : l.remaining)])));
  }, [lines, initial]);

  // Inter-state: from PO, or by client state vs company state for manual bills
  const client = clients.find((c) => c._id === f.client);
  const interState = po ? po.interState : initial ? initial.interState : !!(client?.stateCode && settings?.stateCode && client.stateCode !== settings.stateCode);

  const poItems = lines.map((l: any) => ({ poItemId: l._id, qty: Number(qtys[l._id]) || 0, rate: l.rate, gstRate: l.gstRate }));
  const totals = po
    ? computeTax(poItems, interState, settings?.roundOff !== false)
    : computeTax(manual.map((m) => ({ qty: Number(m.qty) || 0, rate: Number(m.rate) || 0, gstRate: m.gstRate })), interState, settings?.roundOff !== false);

  async function save() {
    setBusy(true);
    try {
      const items = po ? poItems.filter((i: any) => i.qty > 0) : manual;
      const body: any = { invoiceDate: f.invoiceDate, billType: f.billType, notes: f.notes, items };
      if (!po) Object.assign(body, { client: f.client, site: f.site || undefined, interState });
      else body.purchaseOrder = po._id;
      if (initial) {
        await api(`/api/invoices/${initial._id}`, { method: "PATCH", body });
        toast.success("Draft updated");
        onSaved?.();
      } else {
        const inv = await api("/api/invoices", { body });
        toast.success("Draft bill generated");
        router.push(`/invoices/${inv._id}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (effectivePo && !po) return <Spinner />;

  return (
    <div className="space-y-5">
      <Card title="Bill details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {po ? (
            <>
              <Field label="Client">
                <Input disabled value={po.client?.name} />
              </Field>
              <Field label="Against PO">
                <Input disabled value={`${po.poNumber}${po.clientPoNumber ? " / " + po.clientPoNumber : ""} (${fmtDate(po.poDate)})`} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Client" required>
                <Select disabled={!!initial} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value, site: "" })} placeholder="Select client" options={clients.map((c) => ({ value: c._id, label: c.name }))} />
              </Field>
              <Field label="Site">
                <Select disabled={!!initial} value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} placeholder="—" options={sites.map((s) => ({ value: s._id, label: s.name }))} />
              </Field>
            </>
          )}
          <Field label="Invoice date" required>
            <Input type="date" value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} />
          </Field>
          <Field label="Bill type">
            <Input list="billtypes" value={f.billType} onChange={(e) => setF({ ...f, billType: e.target.value })} />
            <datalist id="billtypes">
              {BILL_TYPES.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Tax: {interState ? "IGST (inter-state supply)" : "CGST + SGST (intra-state supply)"} · Invoice number is assigned automatically when the bill is issued
          {settings?.invoicePreview ? ` (format: ${settings.invoicePreview})` : ""}.
        </p>
      </Card>

      {po ? (
        <Card title="Billable quantities (from approved PO)">
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="tbl min-w-[800px]">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="text-right">PO Qty</th>
                  <th className="text-right">Available</th>
                  <th className="w-32 text-right">Bill Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => {
                  const q = Number(qtys[l._id]) || 0;
                  const over = q > l.remaining + 1e-9;
                  return (
                    <tr key={l._id}>
                      <td className="min-w-[220px] whitespace-normal">{l.description}</td>
                      <td>{l.unit}</td>
                      <td className="num">{num(l.qty, 3)}</td>
                      <td className="num text-slate-500">{num(l.remaining, 3)}</td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={l.remaining}
                          className={`cell-input text-right ${over ? "border-red-400 ring-2 ring-red-200" : ""}`}
                          value={qtys[l._id] ?? ""}
                          onChange={(e) => setQtys({ ...qtys, [l._id]: e.target.value })}
                          disabled={l.remaining <= 0}
                        />
                      </td>
                      <td className="num">{inr(l.rate)}</td>
                      <td className="num">{l.gstRate}%</td>
                      <td className="num font-medium">{inr(round2(q * l.rate))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQtys(Object.fromEntries(lines.map((l: any) => [l._id, String(l.remaining)])))}>
                Bill all remaining
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setQtys(Object.fromEntries(lines.map((l: any) => [l._id, "0"])))}>
                Clear
              </Button>
            </div>
            <TotalsBox t={totals} interState={interState} />
          </div>
        </Card>
      ) : (
        <Card title="Line items">
          <LineItemsEditor
            items={manual.length ? manual : []}
            onChange={setManual}
            interState={interState}
            defaultGst={settings?.defaultGstRate ?? 18}
            roundOff={settings?.roundOff !== false}
          />
          {!manual.length && (
            <Button size="sm" className="mt-2" variant="ghost" onClick={() => setManual([blankItem(settings?.defaultGstRate ?? 18)])}>
              Start with one line
            </Button>
          )}
        </Card>
      )}

      <Card>
        <Field label="Notes (printed on bill)">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => (onSaved ? onSaved() : router.back())}>
          Cancel
        </Button>
        <Button loading={busy} onClick={save} disabled={!(totals.total > 0)}>
          {initial ? "Save draft" : `Generate bill · ${inr(totals.total)}`}
        </Button>
      </div>
    </div>
  );
}
