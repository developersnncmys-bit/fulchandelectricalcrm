"use client";
import { Plus, Trash2 } from "lucide-react";
import { GST_RATES, UNITS, inr, round2 } from "@/lib/format";
import { computeTax } from "@/lib/gst";
import { Button } from "./ui";

export interface PricedItem {
  _id?: string;
  description: string;
  hsn?: string;
  unit: string;
  qty: number | string;
  rate: number | string;
  gstRate: number;
  billedQty?: number;
}

export const blankItem = (gstRate = 18): PricedItem => ({ description: "", hsn: "", unit: "Nos", qty: "", rate: "", gstRate });

/** Editable priced line-items table (PO / manual invoice) with live GST totals. */
export function LineItemsEditor({
  items,
  onChange,
  interState,
  defaultGst = 18,
  roundOff = true,
}: {
  items: PricedItem[];
  onChange: (v: PricedItem[]) => void;
  interState: boolean;
  defaultGst?: number;
  roundOff?: boolean;
}) {
  const set = (i: number, patch: Partial<PricedItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const t = computeTax(items.map((i) => ({ qty: Number(i.qty) || 0, rate: Number(i.rate) || 0, gstRate: i.gstRate })), interState, roundOff);

  return (
    <div>
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="tbl min-w-[860px]">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Description</th>
              <th className="w-24">HSN/SAC</th>
              <th className="w-24">Unit</th>
              <th className="w-24 text-right">Qty</th>
              <th className="w-28 text-right">Rate (₹)</th>
              <th className="w-20">GST %</th>
              <th className="w-32 text-right">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="text-slate-400">{i + 1}</td>
                <td>
                  <input className="cell-input min-w-[240px]" value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Work / material description" />
                  {!!it.billedQty && <p className="mt-0.5 text-[11px] text-amber-700">Billed: {it.billedQty}</p>}
                </td>
                <td>
                  <input className="cell-input" value={it.hsn || ""} onChange={(e) => set(i, { hsn: e.target.value })} placeholder="9954" />
                </td>
                <td>
                  <select className="cell-input" value={it.unit} onChange={(e) => set(i, { unit: e.target.value })}>
                    {[...new Set([...UNITS, it.unit])].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input className="cell-input text-right" type="number" step="any" min={it.billedQty || 0} value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} />
                </td>
                <td>
                  <input className="cell-input text-right" type="number" step="any" min={0} value={it.rate} onChange={(e) => set(i, { rate: e.target.value })} />
                </td>
                <td>
                  <select className="cell-input" value={it.gstRate} onChange={(e) => set(i, { gstRate: Number(e.target.value) })}>
                    {GST_RATES.map((g) => (
                      <option key={g} value={g}>
                        {g}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num font-medium">{inr(round2((Number(it.qty) || 0) * (Number(it.rate) || 0)))}</td>
                <td>
                  <button
                    type="button"
                    disabled={!!it.billedQty}
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    title="Remove"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => onChange([...items, blankItem(defaultGst)])}>
          Add line
        </Button>
        <TotalsBox t={t} interState={interState} />
      </div>
    </div>
  );
}

export function TotalsBox({ t, interState }: { t: ReturnType<typeof computeTax> | any; interState: boolean }) {
  const rows: [string, number][] = [["Taxable value", t.subtotal]];
  if (interState) rows.push(["IGST", t.igst]);
  else rows.push(["CGST", t.cgst], ["SGST", t.sgst]);
  if (t.roundOff) rows.push(["Round off", t.roundOff]);
  return (
    <div className="w-full rounded-xl bg-slate-50 p-3 text-sm sm:w-72">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between py-0.5 text-slate-600">
          <span>{k}</span>
          <span className="tabular-nums">{inr(v)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{inr(t.total)}</span>
      </div>
    </div>
  );
}
