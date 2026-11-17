"use client";
import { useApi } from "@/lib/client";
import { Select } from "./ui";

export function useClients() {
  return useApi<any[]>("/api/clients").data || [];
}
export function useSites(client?: string) {
  return useApi<any[]>(`/api/sites${client ? `?client=${client}` : ""}`).data || [];
}
export function useSettings() {
  return useApi<any>("/api/settings").data;
}

/** Filter bar shared by reports, dashboard, lists */
export function FilterBar({
  value,
  onChange,
  dates = true,
  sites = true,
}: {
  value: { from?: string; to?: string; client?: string; site?: string };
  onChange: (v: any) => void;
  dates?: boolean;
  sites?: boolean;
}) {
  const clients = useClients();
  const siteList = useSites(value.client);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-full sm:w-52">
        <Select
          value={value.client || ""}
          onChange={(e) => onChange({ ...value, client: e.target.value, site: "" })}
          placeholder="All clients"
          options={clients.map((c) => ({ value: c._id, label: c.name }))}
        />
      </div>
      {sites && (
        <div className="w-full sm:w-52">
          <Select value={value.site || ""} onChange={(e) => onChange({ ...value, site: e.target.value })} placeholder="All sites" options={siteList.map((s) => ({ value: s._id, label: s.name }))} />
        </div>
      )}
      {dates && (
        <>
          <input type="date" className="input w-[calc(50%-4px)] sm:w-40" value={value.from || ""} onChange={(e) => onChange({ ...value, from: e.target.value })} title="From date" />
          <input type="date" className="input w-[calc(50%-4px)] sm:w-40" value={value.to || ""} onChange={(e) => onChange({ ...value, to: e.target.value })} title="To date" />
        </>
      )}
      {(value.client || value.site || value.from || value.to) && (
        <button className="px-2 py-2 text-sm text-brand-600 hover:underline" onClick={() => onChange({})}>
          Clear
        </button>
      )}
    </div>
  );
}
