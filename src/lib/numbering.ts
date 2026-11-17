import "server-only";
import { Counter, Settings } from "@/models";
import { financialYear } from "./format";

export async function getSettings() {
  let s = await Settings.findOne({ key: "main" }).lean<any>();
  if (!s) s = (await Settings.create({ key: "main" })).toObject();
  return s;
}

async function nextSeq(key: string) {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean<any>();
  return c.seq as number;
}

/** Apply a format like "{PREFIX}/{FY}/{SEQ}" */
function applyFormat(fmt: string, prefix: string, fy: string, seq: number, pad: number, date: Date) {
  return fmt
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{FY\}/g, fy)
    .replace(/\{YYYY\}/g, String(date.getFullYear()))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, "0"))
    .replace(/\{SEQ\}/g, String(seq).padStart(pad, "0"));
}

export async function nextInvoiceNumber(date: Date) {
  const s = await getSettings();
  const fy = financialYear(date);
  const key = s.invoiceResetYearly ? `invoice:${fy}` : "invoice";
  const seq = await nextSeq(key);
  return applyFormat(s.invoiceFormat || "{PREFIX}/{FY}/{SEQ}", s.invoicePrefix || "INV", fy, seq, s.invoiceSeqPadding ?? 4, date);
}

export function previewInvoiceNumber(s: any, date = new Date(), seq = 1) {
  return applyFormat(s.invoiceFormat || "{PREFIX}/{FY}/{SEQ}", s.invoicePrefix || "INV", financialYear(date), seq, s.invoiceSeqPadding ?? 4, date);
}

export async function nextPoNumber(date: Date) {
  const s = await getSettings();
  const fy = financialYear(date);
  const seq = await nextSeq(`po:${fy}`);
  return `${s.poPrefix || "PO"}/${fy}/${String(seq).padStart(4, "0")}`;
}

export async function nextWorkNumber(date: Date) {
  const s = await getSettings();
  const fy = financialYear(date);
  const seq = await nextSeq(`work:${fy}`);
  return `${s.workPrefix || "WE"}/${fy}/${String(seq).padStart(4, "0")}`;
}

export async function nextDraftRef() {
  const seq = await nextSeq("invoice-draft");
  return `DRAFT-${String(seq).padStart(4, "0")}`;
}
