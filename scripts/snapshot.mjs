// Captures every API response the UI needs into src/lib/demo-data.json,
// so the UI can run with no backend (demo mode).
// Usage: start the app with a seeded database, then: node scripts/snapshot.mjs http://localhost:3456
import fs from "fs";
const BASE = process.argv[2] || "http://localhost:3456";
const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@fulchand.in", password: "Fulchand@123" }) });
const cookie = r.headers.get("set-cookie").split(";")[0];
const get = async (p) => (await fetch(BASE + p, { headers: { cookie } })).json();

const out = { lists: {}, details: {}, dashboard: null, reports: {} };
for (const k of ["clients", "sites", "users", "work-entries", "purchase-orders", "invoices", "payments", "documents"]) {
  out.lists[k] = await get(`/api/${k}`);
  if (["work-entries", "purchase-orders", "invoices"].includes(k))
    for (const row of out.lists[k]) out.details[`${k}/${row._id}`] = await get(`/api/${k}/${row._id}`);
}
out.settings = await get("/api/settings");
out.dashboard = await get("/api/dashboard");
for (const t of ["client-summary", "site-summary", "po-register", "invoice-register", "payments", "outstanding", "ageing-summary"]) out.reports[t] = await get(`/api/reports?type=${t}`);
fs.writeFileSync("src/lib/demo-data.json", JSON.stringify(out));
console.log("Saved", Object.keys(out.details).length, "detail records,", (fs.statSync("src/lib/demo-data.json").size / 1024).toFixed(0), "KB");
