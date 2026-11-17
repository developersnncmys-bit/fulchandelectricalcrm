"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { can, ROLE_LABELS } from "@/lib/roles";
import { isoDate } from "@/lib/format";
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { useClients } from "@/components/lookups";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

export default function Sites() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload } = useApi<any[]>("/api/sites");
  const clients = useClients();
  const canEdit = can(user.role, "masters.edit");
  const { data: fieldUsers } = useApi<any[]>(canEdit ? "/api/users?role=site_engineer,site_supervisor" : null);
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const body = { ...edit, client: edit.client?._id || edit.client, assignedUsers: (edit.assignedUsers || []).map((u: any) => u._id || u) };
      if (edit._id) await api(`/api/sites/${edit._id}`, { method: "PATCH", body });
      else await api("/api/sites", { body });
      toast.success("Site saved");
      setEdit(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  const assigned: string[] = (edit?.assignedUsers || []).map((u: any) => u._id || u);

  return (
    <>
      <PageHeader
        title="Sites"
        subtitle="Project sites per client. Site engineers & supervisors only see sites they are assigned to."
        actions={
          canEdit && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEdit({ name: "", code: "", client: "", status: "active", assignedUsers: [] })}>
              Add Site
            </Button>
          )
        }
      />
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Sites"
          rows={data || []}
          onRowClick={canEdit ? (r) => setEdit({ ...r, startDate: isoDate(r.startDate) }) : undefined}
          columns={[
            { key: "name", label: "Site", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: "code", label: "Code" },
            { key: "client", label: "Client", value: (r) => r.client?.name },
            { key: "city", label: "City" },
            { key: "team", label: "Assigned team", value: (r) => (r.assignedUsers || []).map((u: any) => u.name).join(", ") },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            ...(canEdit ? [{ key: "edit", label: "", hideOnExport: true, render: () => <Pencil className="size-4 text-slate-400" /> }] : []),
          ]}
        />
      )}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? "Edit site" : "Add site"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Site name" required className="sm:col-span-2">
              <Input value={edit.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Client" required>
              <Select value={edit.client?._id || edit.client || ""} onChange={(e) => set("client", e.target.value)} placeholder="Select client" options={clients.map((c) => ({ value: c._id, label: c.name }))} />
            </Field>
            <Field label="Site code" hint="Used in Excel imports">
              <Input value={edit.code || ""} onChange={(e) => set("code", e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={edit.address || ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={edit.city || ""} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Start date">
              <Input type="date" value={edit.startDate || ""} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="Status">
              <Select
                value={edit.status}
                onChange={(e) => set("status", e.target.value)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "on_hold", label: "On hold" },
                  { value: "completed", label: "Completed" },
                ]}
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="label">Assigned site engineers / supervisors</p>
              <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {(fieldUsers || []).map((u) => (
                  <label key={u._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={assigned.includes(u._id)}
                      onChange={(e) => set("assignedUsers", e.target.checked ? [...assigned, u._id] : assigned.filter((x) => x !== u._id))}
                    />
                    {u.name} <span className="text-xs text-slate-400">({ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]})</span>
                  </label>
                ))}
                {!fieldUsers?.length && <p className="px-2 py-1 text-sm text-slate-500">No site users yet. Create them under Users & Roles.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
