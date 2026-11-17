"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload, Download } from "lucide-react";
import { api, useApi, qs } from "@/lib/client";
import { can } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { readExcel, downloadWorkTemplate } from "@/lib/export";
import { Badge, Button, Modal, PageHeader, Spinner, Tabs, Select } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { useUser } from "@/components/shell";
import { useSites } from "@/components/lookups";
import { useToast } from "@/components/toast";

const TABS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Awaiting Validation" },
  { value: "validated", label: "Validated" },
  { value: "rejected", label: "Rejected" },
  { value: "po_created", label: "In PO" },
];

function WorkEntries() {
  const user = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get("status") || "");
  const [site, setSite] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const sites = useSites();
  const { data: all, loading, reload } = useApi<any[]>(`/api/work-entries${qs({ site })}`);
  const data = all && (status ? all.filter((r) => r.status === status) : all);
  const tabs = TABS.map((t) => ({ ...t, count: all ? (t.value ? all.filter((r) => r.status === t.value).length : all.length) : undefined }));

  return (
    <>
      <PageHeader
        title="Site Work & Material Entries"
        subtitle="Work completed and material used at sites, validated by the Site Engineer"
        actions={
          can(user.role, "work.create") && (
            <>
              <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>
                Import Excel
              </Button>
              <Button href="/work-entries/new" icon={<Plus className="size-4" />}>
                New Entry
              </Button>
            </>
          )
        }
      />
      <Tabs tabs={tabs} value={status} onChange={setStatus} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Work Entries"
          rows={data || []}
          onRowClick={(r: any) => router.push(`/work-entries/${r._id}`)}
          toolbar={
            <div className="w-full sm:w-56">
              <Select value={site} onChange={(e) => setSite(e.target.value)} placeholder="All sites" options={sites.map((s) => ({ value: s._id, label: s.name }))} />
            </div>
          }
          columns={[
            { key: "entryNo", label: "Entry No", render: (r) => <span className="font-medium text-brand-700">{r.entryNo}</span> },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "workDate", label: "Date", type: "date" },
            { key: "site", label: "Site", value: (r) => r.site?.name },
            { key: "client", label: "Client", value: (r) => r.client?.name },
            { key: "items", label: "Items", type: "number", value: (r) => r.items?.length },
            { key: "createdBy", label: "Entered By", value: (r) => r.createdBy?.name || r.recordedBy },
            { key: "validatedBy", label: "Validated By", value: (r) => r.validatedBy?.name || "" },
          ]}
        />
      )}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={reload} canValidate={can(user.role, "work.validate")} />
    </>
  );
}

function ImportModal({ open, onClose, onDone, canValidate }: { open: boolean; onClose: () => void; onDone: () => void; canValidate: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [mode, setMode] = useState<"draft" | "submit" | "validated">(canValidate ? "validated" : "submit");
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    try {
      const raw = await readExcel(file);
      setRows(
        raw.map((r) => ({
          site: r.site ?? r.sitecode ?? r.sitename,
          date: r.date instanceof Date ? r.date.toISOString() : r.date,
          type: r.type,
          description: r.description ?? r.item ?? r.work,
          unit: r.unit,
          qty: r.qty ?? r.quantity,
          remarks: r.remarks,
          recordedBy: r.recordedby,
        }))
      );
    } catch (e: any) {
      toast.error("Could not read file: " + e.message);
    }
  }

  async function submit() {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const r = await api("/api/work-entries/import", { body: { rows, submit: mode === "submit", validated: mode === "validated" } });
      toast.success(`${r.created} work entr${r.created === 1 ? "y" : "ies"} created`);
      setRows(null);
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
      title="Import site work / material sheet"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!rows?.length}>
            Import {rows?.length ? `${rows.length} rows` : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Upload the Excel sheet maintained at site. Columns: <b>Site</b> (code or name), <b>Date</b>, <b>Type</b> (Work/Material), <b>Description</b>, <b>Unit</b>, <b>Qty</b>, Remarks, RecordedBy.
          Rows are grouped into one entry per site per date.
        </p>
        <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={downloadWorkTemplate}>
          Download template
        </Button>
        <input type="file" accept=".xlsx" className="input" onChange={(e) => pick(e.target.files?.[0])} />
        <div>
          <label className="label">Import as</label>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            options={[
              ...(canValidate ? [{ value: "validated", label: "Already validated by Site Engineer (ready for PO)" }] : []),
              { value: "submit", label: "Submitted — awaiting Site Engineer validation" },
              { value: "draft", label: "Draft" },
            ]}
          />
        </div>
        {rows && (
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    <td>{r.site}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.type}</td>
                    <td className="max-w-[260px] truncate">{r.description}</td>
                    <td>{r.unit}</td>
                    <td className="num">{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <WorkEntries />
    </Suspense>
  );
}
