import { round2 } from "./format";

export interface TaxLine {
  qty: number;
  rate: number;
  gstRate: number;
}

export interface TaxTotals {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  roundOff: number;
  total: number;
}

/**
 * Compute GST totals. Intra-state supply → CGST + SGST (half each),
 * inter-state → IGST. Grand total rounded to nearest rupee.
 */
export function computeTax(lines: TaxLine[], interState: boolean, roundToRupee = true): TaxTotals {
  let subtotal = 0;
  let tax = 0;
  let half = 0;
  for (const l of lines) {
    const amt = round2((Number(l.qty) || 0) * (Number(l.rate) || 0));
    subtotal += amt;
    const t = round2((amt * (Number(l.gstRate) || 0)) / 100);
    tax += t;
    half += round2(t / 2);
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  const cgst = interState ? 0 : round2(half);
  const sgst = interState ? 0 : round2(half);
  const igst = interState ? tax : 0;
  const taxTotal = round2(cgst + sgst + igst);
  const raw = round2(subtotal + taxTotal);
  const total = roundToRupee ? Math.round(raw) : raw;
  return { subtotal, cgst, sgst, igst, taxTotal, roundOff: round2(total - raw), total };
}

export function lineAmount(qty: number, rate: number) {
  return round2((Number(qty) || 0) * (Number(rate) || 0));
}
