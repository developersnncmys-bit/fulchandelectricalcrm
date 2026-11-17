"use client";
// Browser-side stand-in for the API when running in demo mode.
import data from "./demo-data.json";
import { DEMO_COOKIE, DEMO_PASSWORD } from "./demo-config";

const D: any = data;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const idOf = (v: any) => (v && typeof v === "object" ? v._id : v);
const DATE_FIELDS = ["workDate", "poDate", "invoiceDate", "paymentDate", "createdAt"];
const ID_KEYS = ["client", "site", "invoice", "purchaseOrder", "refId", "refModel", "category", "role"];

export function demoUsers(): any[] {
  return D.lists.users;
}

export function demoSignIn(email: string, password: string) {
  const u = demoUsers().find((x) => x.email === email.trim().toLowerCase());
  if (!u || password !== DEMO_PASSWORD) throw new Error("Invalid email or password");
  document.cookie = `${DEMO_COOKIE}=${encodeURIComponent(u.email)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  return { id: u._id, name: u.name, email: u.email, role: u.role };
}

function filterList(rows: any[], p: URLSearchParams) {
  return rows.filter((r) => {
    for (const [k, v] of p.entries()) {
      if (!v) continue;
      if (k === "status") {
        if (!v.split(",").includes(r.status)) return false;
      } else if (k === "paymentStatus") {
        if (r.paymentStatus !== v) return false;
      } else if (k === "outstanding") {
        if (!(["issued", "submitted"].includes(r.status) && r.outstanding > 0.5)) return false;
      } else if (k === "noPo") {
        if (r.purchaseOrder) return false;
      } else if (k === "from" || k === "to") {
        const f = DATE_FIELDS.find((x) => r[x]);
        if (!f) continue;
        const d = String(r[f]).slice(0, 10);
        if (k === "from" ? d < v : d > v) return false;
      } else if (ID_KEYS.includes(k)) {
        if (String(idOf(r[k])) !== v) return false;
      }
    }
    return true;
  });
}

export async function demoApi(url: string, method: string): Promise<any> {
  const u = new URL(url, "http://demo");
  const path = u.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  if (path === "auth/logout") {
    document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`;
    return {};
  }
  if (method !== "GET") throw new Error("This is a demo version — changes are not saved.");
  if (path === "settings") return clone(D.settings);
  if (path === "dashboard") return clone(D.dashboard);
  if (path === "reports") return clone(D.reports[u.searchParams.get("type") || ""] || []);
  const [list, id] = path.split("/");
  if (id) {
    const hit = D.details[`${list}/${id}`] || (D.lists[list] || []).find((r: any) => r._id === id);
    if (!hit) throw new Error("Record not found");
    return clone(hit);
  }
  if (D.lists[list]) return clone(filterList(D.lists[list], u.searchParams));
  return [];
}
