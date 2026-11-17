"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { can } from "@/lib/roles";
import { INDIAN_STATES, stateName } from "@/lib/format";
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { useUser } from "@/components/shell";
import { useToast } from "@/components/toast";

const blank = { name: "", code: "", gstin: "", pan: "", address: "", city: "", stateCode: "27", pincode: "", contactPerson: "", phone: "", email: "", paymentTermsDays: 30, active: true };

export default function Clients() {
  const user = useUser();
  const toast = useToast();
  const { data, loading, reload } = useApi<any[]>("/api/clients");
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can(user.role, "masters.edit");

  async function save() {
    setBusy(true);
    try {
      if (edit._id) await api(`/api/clients/${edit._id}`, { method: "PATCH", body: edit });
      else await api("/api/clients", { body: edit });
      toast.success("Client saved");
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
        title="Clients"
        subtitle="Companies you bill. GST state decides CGST/SGST vs IGST."
        actions={
          canEdit && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEdit({ ...blank })}>
              Add Client
            </Button>
          )
        }
      />
      {loading && !data ? (
        <Spinner />
      ) : (
        <DataTable
          title="Clients"
          rows={data || []}
          onRowClick={canEdit ? (r) => setEdit({ ...r }) : undefined}
          columns={[
            { key: "name", label: "Client", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: "code", label: "Code" },
            { key: "gstin", label: "GSTIN" },
            { key: "state", label: "State", value: (r) => stateName(r.stateCode) },
            { key: "contactPerson", label: "Contact" },
            { key: "phone", label: "Phone" },
            { key: "paymentTermsDays", label: "Credit days", type: "number" },
            { key: "active", label: "Status", value: (r) => (r.active ? "Active" : "Inactive"), render: (r) => <Badge status={r.active ? "active" : "inactive"} /> },
            ...(canEdit ? [{ key: "edit", label: "", hideOnExport: true, render: () => <Pencil className="size-4 text-slate-400" /> }] : []),
          ]}
        />
      )}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?._id ? "Edit client" : "Add client"}
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
            <Field label="Client name" required className="sm:col-span-2">
              <Input value={edit.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Short code">
              <Input value={edit.code || ""} onChange={(e) => set("code", e.target.value)} />
            </Field>
            <Field label="GSTIN">
              <Input
                value={edit.gstin || ""}
                maxLength={15}
                onChange={(e) => {
                  const g = e.target.value.toUpperCase();
                  setEdit({ ...edit, gstin: g, ...(g.length >= 2 && INDIAN_STATES.some((s) => s.code === g.slice(0, 2)) ? { stateCode: g.slice(0, 2) } : {}) });
                }}
              />
            </Field>
            <Field label="State (place of supply)">
              <Select value={edit.stateCode || ""} onChange={(e) => set("stateCode", e.target.value)} options={INDIAN_STATES.map((s) => ({ value: s.code, label: `${s.code} - ${s.name}` }))} />
            </Field>
            <Field label="PAN">
              <Input value={edit.pan || ""} onChange={(e) => set("pan", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={edit.address || ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={edit.city || ""} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Pincode">
              <Input value={edit.pincode || ""} onChange={(e) => set("pincode", e.target.value)} />
            </Field>
            <Field label="Contact person">
              <Input value={edit.contactPerson || ""} onChange={(e) => set("contactPerson", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={edit.phone || ""} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={edit.email || ""} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Payment terms (days)" hint="Due date = submission date + these days">
              <Input type="number" min={0} value={edit.paymentTermsDays} onChange={(e) => set("paymentTermsDays", Number(e.target.value))} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={edit.active} onChange={(e) => set("active", e.target.checked)} /> Active
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
