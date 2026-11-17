"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client";
import { UNITS, isoDate, today } from "@/lib/format";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";
import { useSites } from "./lookups";
import { useToast } from "./toast";

type Item = { type: "work" | "material"; description: string; unit: string; qty: number | string; remarks?: string };
const blank = (type: Item["type"] = "work"): Item => ({ type, description: "", unit: "Nos", qty: "" });

export function WorkEntryForm({ initial, onSaved }: { initial?: any; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const sites = useSites();
  const [f, setF] = useState({
    site: initial?.site?._id || initial?.site || "",
    workDate: initial ? isoDate(initial.workDate) : today(),
    recordedBy: initial?.recordedBy || "",
    remarks: initial?.remarks || "",
  });
  const [items, setItems] = useState<Item[]>(initial?.items?.length ? initial.items : [blank()]);
  const [busy, setBusy] = useState<string | null>(null);
  const set = (i: number, p: Partial<Item>) => setItems(items.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save(submit: boolean) {
    setBusy(submit ? "submit" : "draft");
    try {
      const payload = { ...f, items, submit };
      let id = initial?._id;
      if (id) {
        await api(`/api/work-entries/${id}`, { method: "PATCH", body: payload });
        if (submit && ["draft", "rejected"].includes(initial.status)) await api(`/api/work-entries/${id}`, { body: { action: "submit" } });
      } else {
        id = (await api("/api/work-entries", { body: payload }))._id;
      }
      toast.success(submit ? "Submitted for validation" : "Saved");
      if (onSaved) {
        setBusy(null);
        onSaved();
      } else router.push(`/work-entries/${id}`);
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card title="Entry details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Site" required className="lg:col-span-2">
            <Select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} placeholder="Select site" options={sites.map((s) => ({ value: s._id, label: `${s.name}${s.client ? " — " + s.client.name : ""}` }))} />
          </Field>
          <Field label="Work date" required>
            <Input type="date" value={f.workDate} onChange={(e) => setF({ ...f, workDate: e.target.value })} />
          </Field>
          <Field label="Recorded by (labour / supervisor)">
            <Input value={f.recordedBy} onChange={(e) => setF({ ...f, recordedBy: e.target.value })} placeholder="Name" />
          </Field>
        </div>
      </Card>

      <Card
        title="Work done & material used"
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems([...items, blank("work")])}>
              Work
            </Button>
            <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setItems([...items, blank("material")])}>
              Material
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-slate-200 p-3 sm:border-0 sm:p-0">
              <div className="col-span-4 sm:col-span-2">
                <select className="cell-input" value={it.type} onChange={(e) => set(i, { type: e.target.value as Item["type"] })}>
                  <option value="work">Work</option>
                  <option value="material">Material</option>
                </select>
              </div>
              <div className="col-span-8 sm:col-span-5">
                <input className="cell-input" placeholder="Description" value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <select className="cell-input" value={it.unit} onChange={(e) => set(i, { unit: e.target.value })}>
                  {[...new Set([...UNITS, it.unit])].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4 sm:col-span-1">
                <input className="cell-input text-right" type="number" step="any" min={0} placeholder="Qty" value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <input className="cell-input" placeholder="Remarks" value={it.remarks || ""} onChange={(e) => set(i, { remarks: e.target.value })} />
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Remove">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Field label="Remarks" className="mt-4">
          <Textarea value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
        </Field>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => (onSaved ? onSaved() : router.back())}>
          Cancel
        </Button>
        <Button variant="secondary" loading={busy === "draft"} disabled={!!busy} onClick={() => save(false)}>
          Save draft
        </Button>
        <Button loading={busy === "submit"} disabled={!!busy} onClick={() => save(true)}>
          Save & submit for validation
        </Button>
      </div>
    </div>
  );
}
