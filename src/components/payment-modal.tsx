"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { inr, round2, today } from "@/lib/format";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";

const MODES = ["NEFT", "RTGS", "IMPS", "Cheque", "UPI", "Cash", "Other"];

/** Record a full or partial payment. Pass invoice to lock it, or let the user choose an outstanding invoice. */
export function PaymentModal({ open, onClose, invoice, onDone }: { open: boolean; onClose: () => void; invoice?: any; onDone: () => void }) {
  const toast = useToast();
  const { data: list } = useApi<any[]>(open && !invoice ? "/api/invoices?outstanding=1" : null);
  const [invId, setInvId] = useState("");
  const [f, setF] = useState<any>({ paymentDate: today(), mode: "NEFT", amount: "", tds: "", otherDeductions: "" });
  const [busy, setBusy] = useState(false);
  const inv = invoice || list?.find((i) => i._id === invId);

  useEffect(() => {
    if (open) {
      setF({ paymentDate: today(), mode: "NEFT", amount: invoice ? String(invoice.outstanding) : "", tds: "", otherDeductions: "" });
      setInvId("");
    }
  }, [open, invoice]);

  const settled = round2((Number(f.amount) || 0) + (Number(f.tds) || 0) + (Number(f.otherDeductions) || 0));
  const balance = inv ? round2(inv.outstanding - settled) : 0;

  async function save() {
    if (!inv) return toast.error("Select an invoice");
    setBusy(true);
    try {
      await api("/api/payments", { body: { ...f, invoice: inv._id } });
      toast.success(balance <= 0.5 ? "Payment recorded — invoice fully paid" : "Partial payment recorded");
      onClose();
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" loading={busy} onClick={save} disabled={!inv || settled <= 0 || balance < -0.5}>
            Save payment
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {invoice ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm sm:col-span-2">
            <p className="font-semibold">{invoice.invoiceNo}</p>
            <p className="text-slate-600">
              {invoice.client?.name} · Total {inr(invoice.total)} · Outstanding <b>{inr(invoice.outstanding)}</b>
            </p>
          </div>
        ) : (
          <Field label="Invoice" required className="sm:col-span-2">
            <Select
              value={invId}
              onChange={(e) => {
                setInvId(e.target.value);
                const i = list?.find((x) => x._id === e.target.value);
                if (i) setF({ ...f, amount: String(i.outstanding) });
              }}
              placeholder="Select outstanding invoice"
              options={(list || []).map((i) => ({ value: i._id, label: `${i.invoiceNo} — ${i.client?.name} — ${inr(i.outstanding)} due` }))}
            />
          </Field>
        )}
        <Field label="Payment date" required>
          <Input type="date" value={f.paymentDate} onChange={(e) => setF({ ...f, paymentDate: e.target.value })} />
        </Field>
        <Field label="Mode">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={MODES.map((m) => ({ value: m, label: m }))} />
        </Field>
        <Field label="Amount received (₹)" required>
          <Input type="number" step="any" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="TDS deducted (₹)">
          <Input type="number" step="any" min={0} value={f.tds} onChange={(e) => setF({ ...f, tds: e.target.value })} />
        </Field>
        <Field label="Other deductions (₹)" hint="Retention, penalty, etc.">
          <Input type="number" step="any" min={0} value={f.otherDeductions} onChange={(e) => setF({ ...f, otherDeductions: e.target.value })} />
        </Field>
        <Field label="Reference / UTR / Cheque no.">
          <Input value={f.reference || ""} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {inv && (
          <div className={`rounded-lg p-3 text-sm sm:col-span-2 ${balance < -0.5 ? "bg-red-50 text-red-800" : balance <= 0.5 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            Settling {inr(settled)} → balance after this payment: <b>{inr(Math.max(0, balance))}</b>
            {balance < -0.5 && " (exceeds outstanding)"}
            {balance <= 0.5 && balance >= -0.5 && " · Fully paid"}
          </div>
        )}
      </div>
    </Modal>
  );
}
