"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { fmtDate, isoDate, today, stateName } from "@/lib/format";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";
import { LineItemsEditor, blankItem, type PricedItem } from "./line-items";
import { useSettings, useSites } from "./lookups";
import { useToast } from "./toast";

export function POForm({ initial, presetSite, presetEntries, onSaved }: { initial?: any; presetSite?: string; presetEntries?: string[]; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const sites = useSites();
  const isEdit = !!initial;
  const [f, setF] = useState({
    site: initial?.site?._id || presetSite || "",
    poDate: initial ? isoDate(initial.poDate) : today(),
    clientPoNumber: initial?.clientPoNumber || "",
    subject: initial?.subject || "",
    notes: initial?.notes || "",
  });
  const [selected, setSelected] = useState<string[]>(presetEntries || []);
  const [items, setItems] = useState<PricedItem[]>(initial?.items || []);
  const [busy, setBusy] = useState(false);
  const [interOverride, setInterOverride] = useState<boolean | null>(initial ? initial.interState : null);

  const site = sites.find((s) => s._id === f.site);
  const autoInter = !!(site?.client?.stateCode && settings?.stateCode && site.client.stateCode !== settings.stateCode);
  const interState = interOverride ?? autoInter;

  const { data: entries } = useApi<any[]>(!isEdit && f.site ? `/api/work-entries?site=${f.site}&status=validated&noPo=1` : null);

  const pull = useMemo(
    () => () => {
      const chosen = (entries || []).filter((e) => selected.includes(e._id));
      const map = new Map<string, PricedItem>();
      for (const e of chosen)
        for (const it of e.items) {
          const k = `${it.description.trim().toLowerCase()}|${it.unit}`;
          const ex = map.get(k);
          if (ex) ex.qty = Number(ex.qty) + Number(it.qty);
          else map.set(k, { ...blankItem(settings?.defaultGstRate ?? 18), description: it.description, unit: it.unit, qty: it.qty });
        }
      const kept = items.filter((i) => i.description);
      setItems([...kept, ...map.values()]);
    },
    [entries, selected, items, settings]
  );

  // Auto-pull preset entries once loaded
  useEffect(() => {
    if (presetEntries?.length && entries?.length && !items.length) pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  async function save() {
    setBusy(true);
    try {
      const body = { ...f, items, interState, workEntries: selected };
      if (isEdit) {
        await api(`/api/purchase-orders/${initial._id}`, { method: "PATCH", body });
        toast.success("PO updated");
        onSaved?.();
      } else {
        const po = await api("/api/purchase-orders", { body });
        toast.success(`PO ${po.poNumber} created`);
        router.push(`/purchase-orders/${po._id}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="PO details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Site" required className="lg:col-span-2">
            <Select
              disabled={isEdit}
              value={f.site}
              onChange={(e) => {
                setF({ ...f, site: e.target.value });
                setSelected([]);
                setInterOverride(null);
              }}
              placeholder="Select site"
              options={sites.map((s) => ({ value: s._id, label: `${s.name} — ${s.client?.name || ""}` }))}
            />
          </Field>
          <Field label="PO date" required>
            <Input type="date" value={f.poDate} onChange={(e) => setF({ ...f, poDate: e.target.value })} />
          </Field>
          <Field label="Client PO number" hint="If the client issues their own PO no.">
            <Input value={f.clientPoNumber} onChange={(e) => setF({ ...f, clientPoNumber: e.target.value })} />
          </Field>
          <Field label="Subject / scope" className="sm:col-span-2 lg:col-span-3">
            <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="e.g. Electrical works for Tower A — Floors 1-5" />
          </Field>
          <Field label="Tax type">
            <Select
              value={interState ? "inter" : "intra"}
              onChange={(e) => setInterOverride(e.target.value === "inter")}
              options={[
                { value: "intra", label: "Intra-state (CGST + SGST)" },
                { value: "inter", label: "Inter-state (IGST)" },
              ]}
            />
            {site && <p className="mt-1 text-xs text-slate-400">Client state: {stateName(site.client?.stateCode) || "—"}</p>}
          </Field>
        </div>
      </Card>

      {!isEdit && f.site && (
        <Card
          title="Validated work entries (not yet in a PO)"
          actions={
            <Button size="sm" variant="secondary" icon={<ArrowDownToLine className="size-4" />} disabled={!selected.length} onClick={pull}>
              Pull {selected.length || ""} into PO lines
            </Button>
          }
          bodyClass="p-0"
        >
          {!entries?.length ? (
            <p className="p-5 text-sm text-slate-500">No validated entries pending for this site. You can still add PO lines manually below.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e._id}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-brand-600"
                      checked={selected.includes(e._id)}
                      onChange={(ev) => setSelected(ev.target.checked ? [...selected, e._id] : selected.filter((x) => x !== e._id))}
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-slate-800">
                        {e.entryNo} <span className="font-normal text-slate-500">· {fmtDate(e.workDate)}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{e.items.map((i: any) => `${i.description} (${i.qty} ${i.unit})`).join(" · ")}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="PO line items & rates">
        {items.length === 0 && <p className="mb-3 text-sm text-slate-500">Pull items from validated work entries above, or add lines manually.</p>}
        <LineItemsEditor items={items} onChange={setItems} interState={interState} defaultGst={settings?.defaultGstRate ?? 18} roundOff={settings?.roundOff !== false} />
        <Field label="Notes" className="mt-4">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => (onSaved ? onSaved() : router.back())}>
          Cancel
        </Button>
        <Button loading={busy} onClick={save}>
          {isEdit ? "Save changes" : "Create PO"}
        </Button>
      </div>
    </div>
  );
}
