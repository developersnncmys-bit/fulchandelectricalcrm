"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { INDIAN_STATES, financialYear } from "@/lib/format";
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";

function preview(s: any) {
  const d = new Date();
  return (s.invoiceFormat || "{PREFIX}/{FY}/{SEQ}")
    .replace(/\{PREFIX\}/g, s.invoicePrefix || "")
    .replace(/\{FY\}/g, financialYear(d))
    .replace(/\{YYYY\}/g, String(d.getFullYear()))
    .replace(/\{MM\}/g, String(d.getMonth() + 1).padStart(2, "0"))
    .replace(/\{SEQ\}/g, "1".padStart(Number(s.invoiceSeqPadding) || 1, "0"));
}

export default function Settings() {
  const toast = useToast();
  const { data } = useApi<any>("/api/settings");
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  if (!s) return <Spinner />;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  const text = (k: string, label: string, props: any = {}) => (
    <Field label={label} className={props.className}>
      <Input value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...props} className={undefined} />
    </Field>
  );

  async function save() {
    setBusy(true);
    try {
      setS(await api("/api/settings", { method: "PUT", body: s }));
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Company Settings"
        subtitle="Details printed on bills, invoice numbering and tax defaults"
        actions={
          <Button loading={busy} onClick={save}>
            Save settings
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Company profile">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {text("companyName", "Company name", { className: "sm:col-span-2" })}
            {text("tagline", "Tagline", { className: "sm:col-span-2" })}
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={s.address || ""} onChange={(e) => set("address", e.target.value)} />
            </Field>
            {text("city", "City")}
            {text("pincode", "Pincode")}
            <Field label="State (for GST)">
              <Select value={s.stateCode || ""} onChange={(e) => set("stateCode", e.target.value)} options={INDIAN_STATES.map((x) => ({ value: x.code, label: `${x.code} - ${x.name}` }))} />
            </Field>
            {text("gstin", "GSTIN")}
            {text("pan", "PAN")}
            {text("phone", "Phone")}
            {text("email", "Email")}
            {text("authorisedSignatory", "Authorised signatory")}
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Invoice numbering">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {text("invoicePrefix", "Prefix")}
              <Field label="Format" hint="Tokens: {PREFIX} {FY} {YYYY} {MM} {SEQ}">
                <Input value={s.invoiceFormat || ""} onChange={(e) => set("invoiceFormat", e.target.value)} />
              </Field>
              <Field label="Sequence digits">
                <Input type="number" min={1} max={8} value={s.invoiceSeqPadding} onChange={(e) => set("invoiceSeqPadding", Number(e.target.value))} />
              </Field>
              <Field label="Reset sequence">
                <Select
                  value={s.invoiceResetYearly ? "1" : "0"}
                  onChange={(e) => set("invoiceResetYearly", e.target.value === "1")}
                  options={[
                    { value: "1", label: "Every financial year (Apr–Mar)" },
                    { value: "0", label: "Never (continuous)" },
                  ]}
                />
              </Field>
              <div className="rounded-lg bg-brand-50 p-3 text-sm sm:col-span-2">
                Next invoice will look like: <b className="font-mono">{preview(s)}</b>
              </div>
              {text("poPrefix", "PO prefix")}
              {text("workPrefix", "Work entry prefix")}
            </div>
          </Card>
          <Card title="Tax & payment defaults">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Default GST rate (%)">
                <Select value={String(s.defaultGstRate)} onChange={(e) => set("defaultGstRate", Number(e.target.value))} options={[0, 5, 12, 18, 28].map((g) => ({ value: String(g), label: `${g}%` }))} />
              </Field>
              <Field label="Default credit period (days)">
                <Input type="number" value={s.defaultPaymentTerms} onChange={(e) => set("defaultPaymentTerms", Number(e.target.value))} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-brand-600" checked={s.roundOff !== false} onChange={(e) => set("roundOff", e.target.checked)} /> Round off invoice total to nearest rupee
              </label>
            </div>
          </Card>
          <Card title="Bank details (printed on bill)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {text("bankAccountName", "Account name", { className: "sm:col-span-2" })}
              {text("bankName", "Bank")}
              {text("bankBranch", "Branch")}
              {text("bankAccountNo", "Account no.")}
              {text("bankIfsc", "IFSC")}
            </div>
          </Card>
        </div>
        <Card title="Terms & conditions (printed on bill)" className="xl:col-span-2">
          <Textarea rows={5} value={s.invoiceTerms || ""} onChange={(e) => set("invoiceTerms", e.target.value)} />
        </Card>
      </div>
    </>
  );
}
