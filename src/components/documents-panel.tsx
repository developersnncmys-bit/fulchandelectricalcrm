"use client";
import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload, Download } from "lucide-react";
import { api, useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { useToast } from "./toast";
import { useUser } from "./shell";
import { Button, Card } from "./ui";

export function fileSize(n: number) {
  if (n > 1048576) return (n / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(n / 1024)) + " KB";
}

export function FileIcon({ mime }: { mime?: string }) {
  if (mime?.startsWith("image/")) return <ImageIcon className="size-4 text-violet-500" />;
  if (mime?.includes("pdf")) return <FileText className="size-4 text-red-500" />;
  return <Paperclip className="size-4 text-slate-500" />;
}

/** Attachments card bound to a record (PO, invoice, work entry, payment). */
export function DocumentsPanel({
  refModel,
  refId,
  category,
  client,
  site,
  title = "Documents",
}: {
  refModel: string;
  refId: string;
  category: string;
  client?: string;
  site?: string;
  title?: string;
}) {
  const user = useUser();
  const toast = useToast();
  const { data, reload } = useApi<any[]>(`/api/documents${qs({ refModel, refId })}`);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", f.name);
        fd.append("category", category);
        fd.append("refModel", refModel);
        fd.append("refId", refId);
        if (client) fd.append("client", client);
        if (site) fd.append("site", site);
        await api("/api/documents", { body: fd });
      }
      toast.success("Uploaded");
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Card
      title={title}
      actions={
        can(user.role, "documents.upload") && (
          <>
            <input ref={input} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.doc,.docx,.csv" />
            <Button size="sm" variant="secondary" icon={<Upload className="size-4" />} loading={busy} onClick={() => input.current?.click()}>
              Upload
            </Button>
          </>
        )
      }
    >
      {!data?.length ? (
        <p className="text-sm text-slate-500">No documents attached. Upload signed PO copies, measurement sheets, photos, etc.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((d) => (
            <li key={d._id} className="flex items-center gap-3 py-2">
              <FileIcon mime={d.mimeType} />
              <a href={`/api/documents/${d._id}`} target="_blank" className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:underline">
                {d.title}
              </a>
              <span className="hidden text-xs text-slate-400 sm:inline">
                {fileSize(d.size)} · {fmtDate(d.createdAt)}
              </span>
              <a href={`/api/documents/${d._id}?download=1`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Download">
                <Download className="size-4" />
              </a>
              {can(user.role, "documents.delete") && (
                <button onClick={() => remove(d._id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
