"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Send, Pencil, Trash2, RotateCcw, FilePlus2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { can } from "@/lib/roles";
import { fmtDate, num } from "@/lib/format";
import { Badge, Button, Card, DL, ErrorBox, History, Modal, PageHeader, Spinner, Textarea } from "@/components/ui";
import { DocumentsPanel } from "@/components/documents-panel";
import { WorkEntryForm } from "@/components/work-entry-form";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

export default function WorkEntryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const router = useRouter();
  const toast = useToast();
  const { data: w, loading, error, reload } = useApi<any>(`/api/work-entries/${id}`);
  const [editing, setEditing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string, extra: any = {}) {
    setBusy(action);
    try {
      await api(`/api/work-entries/${id}`, { body: { action, ...extra } });
      toast.success("Updated");
      setRejectOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm("Delete this entry?")) return;
    try {
      await api(`/api/work-entries/${id}`, { method: "DELETE" });
      router.push("/work-entries");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !w) return <Spinner />;
  if (editing)
    return (
      <>
        <PageHeader title={`Edit ${w.entryNo}`} />
        <WorkEntryForm
          initial={w}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      </>
    );

  const canEdit = can(user.role, "work.create") && ["draft", "rejected", "submitted"].includes(w.status);
  const canValidate = can(user.role, "work.validate") && w.status === "submitted";
  const work = w.items.filter((i: any) => i.type === "work");
  const material = w.items.filter((i: any) => i.type === "material");

  return (
    <>
      <PageHeader
        back="/work-entries"
        title={
          <span className="flex items-center gap-3">
            {w.entryNo} <Badge status={w.status} />
          </span>
        }
        subtitle={`${w.site?.name} · ${fmtDate(w.workDate)}`}
        actions={
          <>
            {canEdit && (
              <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {can(user.role, "work.create") && ["draft", "rejected"].includes(w.status) && (
              <>
                <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>
                  Delete
                </Button>
                <Button icon={<Send className="size-4" />} loading={busy === "submit"} onClick={() => act("submit")}>
                  Submit for validation
                </Button>
              </>
            )}
            {canValidate && (
              <>
                <Button variant="danger" icon={<XCircle className="size-4" />} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
                <Button variant="success" icon={<CheckCircle2 className="size-4" />} loading={busy === "validate"} onClick={() => act("validate")}>
                  Validate
                </Button>
              </>
            )}
            {can(user.role, "work.validate") && w.status === "validated" && (
              <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={busy === "reopen"} onClick={() => act("reopen")}>
                Reopen
              </Button>
            )}
            {can(user.role, "po.edit") && w.status === "validated" && (
              <Button icon={<FilePlus2 className="size-4" />} href={`/purchase-orders/new?site=${w.site?._id}&entries=${w._id}`}>
                Create PO
              </Button>
            )}
          </>
        }
      />

      {w.status === "rejected" && w.rejectionReason && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <b>Rejected:</b> {w.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Details">
            <DL
              cols={3}
              items={[
                ["Site", w.site?.name],
                ["Client", w.client?.name],
                ["Work date", fmtDate(w.workDate)],
                ["Recorded by", w.recordedBy],
                ["Entered by", w.createdBy?.name],
                ["Validated by", w.validatedBy ? `${w.validatedBy.name} on ${fmtDate(w.validatedAt)}` : "—"],
                ["Purchase order", w.purchaseOrder ? <Link className="text-brand-600 hover:underline" href={`/purchase-orders/${w.purchaseOrder._id}`}>{w.purchaseOrder.poNumber}</Link> : "—"],
                ["Remarks", w.remarks],
              ]}
            />
          </Card>
          {[
            ["Work completed", work],
            ["Material utilised", material],
          ].map(([t, list]: any) =>
            list.length ? (
              <Card key={t} title={`${t} (${list.length})`} bodyClass="p-0">
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th className="text-right">Qty</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it: any, i: number) => (
                        <tr key={i}>
                          <td className="text-slate-400">{i + 1}</td>
                          <td className="whitespace-normal">{it.description}</td>
                          <td>{it.unit}</td>
                          <td className="num font-medium">{num(it.qty, 3)}</td>
                          <td className="text-slate-500">{it.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null
          )}
        </div>
        <div className="space-y-5">
          <DocumentsPanel refModel="WorkEntry" refId={w._id} category="work" site={w.site?._id} client={w.client?._id} title="Measurement sheets / photos" />
          <Card title="Activity">
            <History items={w.history} />
          </Card>
        </div>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject entry"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === "reject"} onClick={() => act("reject", { note })}>
              Reject
            </Button>
          </>
        }
      >
        <label className="label">Reason (sent back to supervisor)</label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}
