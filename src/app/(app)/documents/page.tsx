"use client";
import { useState } from "react";
import Link from "next/link";
import { Upload, Download, Trash2 } from "lucide-react";
import { api, useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { Button, Field, Input, Modal, PageHeader, Select, Spinner, Tabs } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { FileIcon, fileSize } from "@/components/documents-panel";
import { FilterBar, useClients, useSites } from "@/components/lookups";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

const CATS = [
  { value: "", label: "All" },
  { value: "po", label: "PO" },
  { value: "invoice", label: "Bills" },
  { value: "work", label: "Site work" },
  { value: "payment", label: "Payment" },
  { value: "client", label: "Client" },
  { value: "other", label: "Other" },
];
const REF_LINK: Record<string, string> = { PurchaseOrder: "/purchase-orders/", Invoice: "/invoices/", WorkEntry: "/work-entries/" };

export default function Documents() {
  const user = useUser();
  const toast = useToast();
  const [cat, setCat] = useState("");
  const [f, setF] = useState<any>({});
  const [open, setOpen] = useState(false);
  const { data, loading, reload } = useApi<any[]>(`/api/documents${qs({ category: cat, client: f.client, site: f.site })}`);

  async function remove(id: string) {
    if (!confirm("Delete this document permanently?")) return;
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Document Repository"
        subtitle="Centralised storage of POs, bills, measurement sheets and supporting documents"
        actions={
          can(user.role, "documents.upload") && (
            <Button icon={<Upload className="size-4" />} onClick={() => setOpen(true)}>
              Upload
            </Button>
          )
        }
      />
      <Tabs tabs={CATS} value={cat} onChange={setCat} />
      <div className="mb-3">
        <FilterBar value={f} onChange={setF} dates={false} />
      </div>
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Documents"
          exportable={false}
          rows={data || []}
          columns={[
            {
              key: "title",
              label: "Document",
              render: (d) => (
                <a href={`/api/documents/${d._id}`} target="_blank" className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
                  <FileIcon mime={d.mimeType} /> {d.title}
                </a>
              ),
            },
            { key: "category", label: "Category", value: (d) => CATS.find((c) => c.value === d.category)?.label },
            { key: "client", label: "Client", value: (d) => d.client?.name || "" },
            { key: "site", label: "Site", value: (d) => d.site?.name || "" },
            {
              key: "ref",
              label: "Linked to",
              value: (d) => d.refModel || "",
              render: (d) => (d.refModel && REF_LINK[d.refModel] ? <Link className="text-brand-600 hover:underline" href={REF_LINK[d.refModel] + d.refId}>{d.refModel.replace(/([A-Z])/g, " $1").trim()}</Link> : "—"),
            },
            { key: "size", label: "Size", value: (d) => fileSize(d.size) },
            { key: "uploadedByName", label: "Uploaded by" },
            { key: "createdAt", label: "Date", type: "date" },
            {
              key: "actions",
              label: "",
              render: (d) => (
                <div className="flex justify-end gap-1">
                  <a href={`/api/documents/${d._id}?download=1`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Download">
                    <Download className="size-4" />
                  </a>
                  {can(user.role, "documents.delete") && (
                    <button onClick={() => remove(d._id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      <UploadModal open={open} onClose={() => setOpen(false)} onDone={reload} />
    </>
  );
}

function UploadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const clients = useClients();
  const [f, setF] = useState<any>({ category: "other" });
  const sites = useSites(f.client);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!file) return toast.error("Choose a file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const k of ["title", "category", "client", "site"]) if (f[k]) fd.append(k, f[k]);
      await api("/api/documents", { body: fd });
      toast.success("Uploaded");
      setFile(null);
      setF({ category: "other" });
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
      title="Upload document"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Upload
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="File (max 15 MB)" required className="sm:col-span-2">
          <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
        <Field label="Title" className="sm:col-span-2">
          <Input value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={file?.name || "Defaults to file name"} />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={CATS.filter((c) => c.value)} />
        </Field>
        <Field label="Client">
          <Select value={f.client || ""} onChange={(e) => setF({ ...f, client: e.target.value, site: "" })} placeholder="—" options={clients.map((c) => ({ value: c._id, label: c.name }))} />
        </Field>
        <Field label="Site" className="sm:col-span-2">
          <Select value={f.site || ""} onChange={(e) => setF({ ...f, site: e.target.value })} placeholder="—" options={sites.map((s) => ({ value: s._id, label: s.name }))} />
        </Field>
      </div>
    </Modal>
  );
}
