"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, Stamp, Send, Ban, Pencil, Trash2, Wallet } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { can } from "@/lib/roles";
import { fmtDate, inr, num, today, amountInWords, daysBetween } from "@/lib/format";
import { invoicePdf } from "@/lib/invoice-pdf";
import { Badge, Button, Card, DL, ErrorBox, Field, History, Input, Modal, PageHeader, Spinner, Textarea } from "@/components/ui";
import { TotalsBox } from "@/components/line-items";
import { DocumentsPanel } from "@/components/documents-panel";
import { InvoiceForm } from "@/components/invoice-form";
import { PaymentModal } from "@/components/payment-modal";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

export default function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const toast = useToast();
  const { data: inv, loading, error, reload } = useApi<any>(`/api/invoices/${id}`);
  const [editing, setEditing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [modal, setModal] = useState<null | "submit" | "cancel">(null);
  const [m, setM] = useState<any>({ date: today() });
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string, extra: any = {}) {
    setBusy(action);
    try {
      const r = await api(`/api/invoices/${id}`, { body: { action, ...extra } });
      toast.success(action === "issue" ? `Issued as ${r.invoiceNo}` : "Updated");
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm("Delete this draft?")) return;
    try {
      await api(`/api/invoices/${id}`, { method: "DELETE" });
      router.push("/invoices");
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function deletePayment(pid: string) {
    if (!confirm("Delete this payment entry?")) return;
    try {
      await api(`/api/payments/${pid}`, { method: "DELETE" });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !inv) return <Spinner />;
  if (editing)
    return (
      <>
        <PageHeader title={`Edit ${inv.draftRef}`} />
        <InvoiceForm
          initial={inv}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      </>
    );

  const edit = can(user.role, "invoice.edit");
  const active = ["issued", "submitted"].includes(inv.status);
  const overdue = inv.dueDate && inv.outstanding > 0 && new Date(inv.dueDate) < new Date();

  return (
    <>
      <PageHeader
        back="/invoices"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {inv.invoiceNo || inv.draftRef} <Badge status={inv.status} />
            {active && <Badge status={inv.paymentStatus} />}
            {overdue && <Badge status="overdue">Overdue {daysBetween(inv.dueDate, new Date())}d</Badge>}
          </span>
        }
        subtitle={`${inv.client?.name}${inv.site ? " · " + inv.site.name : ""} · ${inv.billType}`}
        actions={
          <>
            <Button variant="secondary" icon={<Eye className="size-4" />} onClick={() => invoicePdf(inv, "open")}>
              Preview
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => invoicePdf(inv, "save")}>
              PDF
            </Button>
            {edit && inv.status === "draft" && (
              <>
                <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>
                  Delete
                </Button>
                <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button icon={<Stamp className="size-4" />} loading={busy === "issue"} onClick={() => confirm("Issue this invoice? A permanent invoice number will be assigned and items locked.") && act("issue")}>
                  Issue Invoice
                </Button>
              </>
            )}
            {edit && active && inv.paymentStatus !== "paid" && (
              <Button variant="ghost" icon={<Ban className="size-4" />} onClick={() => setModal("cancel")}>
                Cancel
              </Button>
            )}
            {edit && inv.status === "issued" && (
              <Button icon={<Send className="size-4" />} onClick={() => setModal("submit")}>
                Mark submitted to client
              </Button>
            )}
            {can(user.role, "payment.edit") && active && inv.outstanding > 0 && (
              <Button variant="success" icon={<Wallet className="size-4" />} onClick={() => setPayOpen(true)}>
                Record Payment
              </Button>
            )}
          </>
        }
      />

      {inv.status === "draft" && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is a <b>draft</b>. Review the bill and click <b>Issue Invoice</b> to assign the invoice number. Then mark it submitted to start the payment due-date clock.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Invoice total", inr(inv.total)],
          ["Received", inr(inv.amountReceived)],
          ["TDS / deductions", inr((inv.tdsDeducted || 0) + (inv.otherDeductions || 0))],
          ["Outstanding", inr(inv.outstanding)],
        ].map(([k, v], i) => (
          <div key={k} className={`rounded-xl border bg-white p-4 shadow-card ${i === 3 && inv.outstanding > 0 ? (overdue ? "border-red-200" : "border-amber-200") : "border-slate-200/80"}`}>
            <p className="text-xs text-slate-500">{k}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Bill details">
            <DL
              cols={3}
              items={[
                ["Client", inv.client?.name],
                ["Client GSTIN", inv.client?.gstin],
                ["Site", inv.site?.name],
                ["Invoice date", fmtDate(inv.invoiceDate)],
                ["Against PO", inv.purchaseOrder ? <Link className="text-brand-600 hover:underline" href={`/purchase-orders/${inv.purchaseOrder._id}`}>{inv.purchaseOrder.clientPoNumber || inv.purchaseOrder.poNumber}</Link> : "—"],
                ["Tax type", inv.interState ? "IGST" : "CGST + SGST"],
                ["Submitted on", fmtDate(inv.submittedAt)],
                ["Due date", fmtDate(inv.dueDate)],
                ["Paid on", fmtDate(inv.paidAt)],
              ]}
            />
          </Card>
          <Card title="Items" bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>HSN</th>
                    <th className="text-right">Qty</th>
                    <th>Unit</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="min-w-[220px] whitespace-normal">{it.description}</td>
                      <td>{it.hsn}</td>
                      <td className="num">{num(it.qty, 3)}</td>
                      <td>{it.unit}</td>
                      <td className="num">{inr(it.rate)}</td>
                      <td className="num">{it.gstRate}%</td>
                      <td className="num font-medium">{inr(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-sm text-sm italic text-slate-600">{amountInWords(inv.total)}</p>
              <TotalsBox t={inv} interState={inv.interState} />
            </div>
          </Card>
          <Card title={`Payments (${inv.payments.length})`} bodyClass="p-0">
            {!inv.payments.length ? (
              <p className="p-5 text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Reference</th>
                      <th className="text-right">Received</th>
                      <th className="text-right">TDS</th>
                      <th className="text-right">Other</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {inv.payments.map((p: any) => (
                      <tr key={p._id}>
                        <td>{fmtDate(p.paymentDate)}</td>
                        <td>{p.mode}</td>
                        <td>{p.reference}</td>
                        <td className="num font-medium">{inr(p.amount)}</td>
                        <td className="num">{inr(p.tds)}</td>
                        <td className="num">{inr(p.otherDeductions)}</td>
                        <td className="text-right">
                          {can(user.role, "payment.edit") && (
                            <button onClick={() => deletePayment(p._id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {inv.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-line text-sm text-slate-700">{inv.notes}</p>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <DocumentsPanel refModel="Invoice" refId={inv._id} category="invoice" client={inv.client?._id} site={inv.site?._id} title="Bill documents / acknowledgements" />
          <Card title="Activity">
            <History items={inv.history} />
          </Card>
        </div>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} invoice={inv} onDone={reload} />
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="sm"
        title={modal === "submit" ? "Bill submitted to client" : "Cancel invoice"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Close
            </Button>
            <Button variant={modal === "cancel" ? "danger" : "primary"} loading={!!busy} onClick={() => act(modal!, { date: m.date, note: m.note })}>
              Confirm
            </Button>
          </>
        }
      >
        {modal === "submit" ? (
          <Field label="Submission date" hint={`Due date = submission date + client credit period (${inv.client?.paymentTermsDays ?? 30} days)`}>
            <Input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
          </Field>
        ) : (
          <Field label="Reason for cancellation">
            <Textarea value={m.note || ""} onChange={(e) => setM({ ...m, note: e.target.value })} />
          </Field>
        )}
      </Modal>
    </>
  );
}
