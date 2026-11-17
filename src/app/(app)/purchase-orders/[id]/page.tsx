"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, XCircle, Pencil, Trash2, Receipt, Lock, RotateCcw } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { can } from "@/lib/roles";
import { fmtDate, inr, num, today, round2 } from "@/lib/format";
import { Badge, Button, Card, DL, ErrorBox, Field, History, Input, Modal, PageHeader, Spinner, Textarea } from "@/components/ui";
import { TotalsBox } from "@/components/line-items";
import { DocumentsPanel } from "@/components/documents-panel";
import { POForm } from "@/components/po-form";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

export default function PODetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const toast = useToast();
  const { data: po, loading, error, reload } = useApi<any>(`/api/purchase-orders/${id}`);
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<null | "approve" | "reject" | "send">(null);
  const [m, setM] = useState<any>({ date: today() });
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string, extra: any = {}) {
    setBusy(action);
    try {
      await api(`/api/purchase-orders/${id}`, { body: { action, ...extra } });
      toast.success("PO updated");
      setModal(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm("Delete this PO? Linked work entries will return to 'validated'.")) return;
    try {
      await api(`/api/purchase-orders/${id}`, { method: "DELETE" });
      router.push("/purchase-orders");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !po) return <Spinner />;
  if (editing)
    return (
      <>
        <PageHeader title={`Edit ${po.poNumber}`} />
        <POForm
          initial={po}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      </>
    );

  const edit = can(user.role, "po.edit");
  const status = can(user.role, "po.status");
  const unbilled = round2((po.subtotal || 0) - (po.billedAmount || 0));
  const pct = po.subtotal ? Math.min(100, Math.round(((po.billedAmount || 0) / po.subtotal) * 100)) : 0;

  return (
    <>
      <PageHeader
        back="/purchase-orders"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {po.poNumber} <Badge status={po.status} />
          </span>
        }
        subtitle={`${po.client?.name} · ${po.site?.name}`}
        actions={
          <>
            {edit && ["draft", "rejected", "sent"].includes(po.status) && (
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {edit && ["draft", "rejected"].includes(po.status) && (
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>
                Delete
              </Button>
            )}
            {status && ["draft", "rejected"].includes(po.status) && (
              <Button variant="secondary" icon={<Send className="size-4" />} onClick={() => setModal("send")}>
                Mark sent to client
              </Button>
            )}
            {status && po.status === "sent" && (
              <Button variant="danger" icon={<XCircle className="size-4" />} onClick={() => setModal("reject")}>
                Client rejected
              </Button>
            )}
            {status && ["draft", "sent"].includes(po.status) && (
              <Button variant="success" icon={<CheckCircle2 className="size-4" />} onClick={() => setModal("approve")}>
                Record approval
              </Button>
            )}
            {status && po.status === "approved" && (
              <>
                <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={busy === "reopen"} onClick={() => confirm("Reopen PO for changes? It will need re-approval.") && act("reopen")}>
                  Reopen
                </Button>
                <Button variant="secondary" icon={<Lock className="size-4" />} loading={busy === "close"} onClick={() => confirm("Close this PO? No further bills can be raised.") && act("close")}>
                  Close
                </Button>
              </>
            )}
            {can(user.role, "invoice.edit") && po.status === "approved" && unbilled > 0.5 && (
              <Button icon={<Receipt className="size-4" />} href={`/invoices/new?po=${po._id}`}>
                Generate Bill
              </Button>
            )}
          </>
        }
      />

      {po.status === "rejected" && po.rejectionReason && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <b>Rejected by client:</b> {po.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="PO details">
            <DL
              cols={3}
              items={[
                ["Client", po.client?.name],
                ["Site", po.site?.name],
                ["PO date", fmtDate(po.poDate)],
                ["Client PO no.", po.clientPoNumber],
                ["Sent to client", fmtDate(po.sentAt)],
                ["Approved on", fmtDate(po.approvedAt)],
                ["Approval ref.", po.approvalRef],
                ["Tax type", po.interState ? "IGST (inter-state)" : "CGST + SGST"],
                ["Created by", po.createdBy?.name],
              ]}
            />
            {po.subject && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{po.subject}</p>}
          </Card>

          <Card title="Line items" bodyClass="p-0">
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
                    <th className="text-right">Billed Qty</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((it: any, i: number) => (
                    <tr key={it._id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="min-w-[220px] whitespace-normal">{it.description}</td>
                      <td>{it.hsn}</td>
                      <td className="num">{num(it.qty, 3)}</td>
                      <td>{it.unit}</td>
                      <td className="num">{inr(it.rate)}</td>
                      <td className="num">{it.gstRate}%</td>
                      <td className="num font-medium">{inr(it.amount)}</td>
                      <td className="num">{num(it.billedQty, 3)}</td>
                      <td className={`num font-medium ${it.qty - it.billedQty > 0 ? "text-amber-700" : "text-emerald-700"}`}>{num(round2(it.qty - (it.billedQty || 0)), 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end p-4">
              <TotalsBox t={po} interState={po.interState} />
            </div>
          </Card>

          <Card title={`Bills against this PO (${po.invoices?.length || 0})`} bodyClass="p-0">
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>
                  Billed {inr(po.billedAmount)} of {inr(po.subtotal)} (taxable)
                </span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#3b3f48]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {!po.invoices?.length ? (
              <p className="p-5 text-sm text-slate-500">No bills yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Outstanding</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.invoices.map((i: any) => (
                      <tr key={i._id} className="cursor-pointer" onClick={() => router.push(`/invoices/${i._id}`)}>
                        <td className="font-medium text-brand-700">{i.invoiceNo || i.draftRef}</td>
                        <td>{fmtDate(i.invoiceDate)}</td>
                        <td>{i.billType}</td>
                        <td className="num">{inr(i.total)}</td>
                        <td className="num">{inr(i.outstanding)}</td>
                        <td className="space-x-1">
                          <Badge status={i.status} />
                          {i.status !== "draft" && i.status !== "cancelled" && <Badge status={i.paymentStatus} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <DocumentsPanel refModel="PurchaseOrder" refId={po._id} category="po" client={po.client?._id} site={po.site?._id} title="PO documents / client sign-off" />
          {po.workEntries?.length > 0 && (
            <Card title="Linked work entries">
              <ul className="space-y-2 text-sm">
                {po.workEntries.map((w: any) => (
                  <li key={w._id}>
                    <Link href={`/work-entries/${w._id}`} className="font-medium text-brand-700 hover:underline">
                      {w.entryNo}
                    </Link>{" "}
                    <span className="text-slate-500">· {fmtDate(w.workDate)} · {w.items.length} items</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Activity">
            <History items={po.history} />
          </Card>
        </div>
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        size="sm"
        title={modal === "approve" ? "Record client approval" : modal === "reject" ? "Client rejected PO" : "Mark PO as sent"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              variant={modal === "reject" ? "danger" : modal === "approve" ? "success" : "primary"}
              loading={!!busy}
              onClick={() => act(modal!, modal === "approve" ? { date: m.date, approvalRef: m.approvalRef, clientPoNumber: m.clientPoNumber } : { date: m.date, note: m.note })}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Date">
            <Input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
          </Field>
          {modal === "approve" && (
            <>
              <Field label="Client PO number" hint="Optional — if client issued a PO number on approval">
                <Input value={m.clientPoNumber ?? po.clientPoNumber ?? ""} onChange={(e) => setM({ ...m, clientPoNumber: e.target.value })} />
              </Field>
              <Field label="Approval reference" hint="Email / letter ref., approver name">
                <Input value={m.approvalRef || ""} onChange={(e) => setM({ ...m, approvalRef: e.target.value })} />
              </Field>
              <p className="text-xs text-slate-500">Tip: upload the signed PO copy in the documents panel.</p>
            </>
          )}
          {modal !== "approve" && (
            <Field label={modal === "reject" ? "Reason" : "Note"}>
              <Textarea value={m.note || ""} onChange={(e) => setM({ ...m, note: e.target.value })} />
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}
