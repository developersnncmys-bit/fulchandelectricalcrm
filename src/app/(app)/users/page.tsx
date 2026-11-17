"use client";
import { useState } from "react";
import { Plus, Pencil, ShieldCheck } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { ROLES, ROLE_LABELS, PERMISSIONS, type Role } from "@/lib/roles";
import { fmtDate } from "@/lib/format";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/components/toast";

const PERM_GROUPS: [string, string][] = [
  ["dashboard.view", "Dashboard"],
  ["work.create", "Enter site work"],
  ["work.validate", "Validate site work"],
  ["po.edit", "Create / edit POs"],
  ["po.status", "Track PO approval"],
  ["invoice.edit", "Generate bills"],
  ["payment.edit", "Record payments"],
  ["reports.view", "Reports"],
  ["masters.edit", "Clients & sites"],
  ["users.manage", "Users"],
  ["settings.manage", "Settings"],
];

export default function Users() {
  const toast = useToast();
  const { data, loading, reload } = useApi<any[]>("/api/users");
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (edit._id) await api(`/api/users/${edit._id}`, { method: "PATCH", body: edit });
      else await api("/api/users", { body: edit });
      toast.success("User saved");
      setEdit(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k: string, v: any) => setEdit({ ...edit, [k]: v });

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle="Role-based access for Admin, Management, Accounts, Site Engineer and Site Supervisor"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEdit({ name: "", email: "", phone: "", role: "accounts", password: "", active: true })}>
            Add User
          </Button>
        }
      />
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Users"
          rows={data || []}
          onRowClick={(r) => setEdit({ ...r, password: "" })}
          columns={[
            { key: "name", label: "Name", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "role", label: "Role", value: (r) => ROLE_LABELS[r.role as Role] },
            { key: "lastLoginAt", label: "Last login", type: "date" },
            { key: "active", label: "Status", value: (r) => (r.active ? "Active" : "Disabled"), render: (r) => <Badge status={r.active ? "active" : "inactive"}>{r.active ? "Active" : "Disabled"}</Badge> },
            { key: "edit", label: "", hideOnExport: true, render: () => <Pencil className="size-4 text-slate-400" /> },
          ]}
        />
      )}

      <Card title="Role permissions matrix" className="mt-5" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Capability</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERM_GROUPS.map(([p, label]) => (
                <tr key={p}>
                  <td>{label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="text-center">
                      {(PERMISSIONS as any)[p].includes(r) ? <ShieldCheck className="mx-auto size-4 text-emerald-600" /> : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? "Edit user" : "Add user"}
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
            <Field label="Full name" required className="sm:col-span-2">
              <Input value={edit.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Email (login)" required>
              <Input type="email" value={edit.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Role" required>
              <Select value={edit.role} onChange={(e) => set("role", e.target.value)} options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
            </Field>
            <Field label={edit._id ? "New password" : "Password"} required={!edit._id} hint={edit._id ? "Leave blank to keep current" : "Min 6 characters"}>
              <Input type="password" value={edit.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={edit.active} onChange={(e) => set("active", e.target.checked)} /> Active (can sign in)
            </label>
            {edit._id && <p className="text-xs text-slate-400 sm:col-span-2">Created {fmtDate(edit.createdAt)}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
