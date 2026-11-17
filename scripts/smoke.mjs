// End-to-end workflow test against a running server (after `npm run seed -- --reset`).
// Usage: node scripts/smoke.mjs [baseUrl]
const BASE = process.argv[2] || "http://localhost:3000";
const PW = "Fulchand@123";
let failures = 0;

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW }) });
  if (!r.ok) throw new Error(`login ${email} failed: ${r.status} ${await r.text()}`);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: { cookie, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
}
const ok = (r) => r.status >= 200 && r.status < 300;

const admin = await login("admin@fulchand.in");
const accounts = await login("accounts@fulchand.in");
const engineer = await login("engineer@fulchand.in");
const supervisor = await login("supervisor@fulchand.in");
const mgmt = await login("management@fulchand.in");

// --- RBAC
check("supervisor cannot view invoices", (await supervisor("/api/invoices")).status === 403);
check("management cannot create PO", (await mgmt("/api/purchase-orders", { body: {} })).status === 403);
check("accounts cannot manage users", (await accounts("/api/users", { body: {} })).status === 403);
check("unauthenticated is 401", (await fetch(`${BASE}/api/invoices`)).status === 401);

// --- Site work
const sites = (await supervisor("/api/sites")).data;
check("supervisor sees assigned sites", Array.isArray(sites) && sites.length === 4);
const site = sites.find((s) => s.code === "SKY-WRL");
const we = await supervisor("/api/work-entries", {
  body: {
    site: site._id,
    workDate: new Date().toISOString().slice(0, 10),
    recordedBy: "Smoke test",
    submit: true,
    items: [
      { type: "work", description: "Supply & laying of 4C x 25 sq.mm Al. armoured cable", unit: "Mtr", qty: 60 },
      { type: "work", description: "DB installation (smoke)", unit: "Nos", qty: 2 },
    ],
  },
});
check("supervisor creates & submits work entry", ok(we) && we.data.status === "submitted", we.data.error);
check("supervisor cannot validate", (await supervisor(`/api/work-entries/${we.data._id}`, { body: { action: "validate" } })).status >= 400);
const val = await engineer(`/api/work-entries/${we.data._id}`, { body: { action: "validate" } });
check("engineer validates", ok(val) && val.data.status === "validated", val.data.error);

// --- PO
const pending = (await accounts(`/api/work-entries?site=${site._id}&status=validated&noPo=1`)).data;
check("validated entries available for PO", pending.length >= 1, `${pending.length} entries`);
const ids = pending.map((e) => e._id);
const agg = new Map();
for (const e of pending) for (const it of e.items) {
  const k = it.description + "|" + it.unit;
  agg.set(k, { description: it.description, unit: it.unit, qty: (agg.get(k)?.qty || 0) + it.qty, rate: 0, gstRate: 18, hsn: "9954" });
}
const items = [...agg.values()].map((i, n) => ({ ...i, rate: [450, 3200, 180, 95][n % 4] }));
const po = await accounts("/api/purchase-orders", { body: { site: site._id, poDate: new Date().toISOString().slice(0, 10), subject: "Smoke test PO", workEntries: ids, items } });
check("accounts creates PO", ok(po) && po.data.poNumber, po.data.error);
const expectedSub = Math.round(items.reduce((a, i) => a + i.qty * i.rate, 0) * 100) / 100;
check("PO subtotal computed", po.data.subtotal === expectedSub, `${po.data.subtotal} vs ${expectedSub}`);
check("intra-state → CGST+SGST", po.data.cgst > 0 && po.data.sgst > 0 && po.data.igst === 0);
check("PO total rounded", Number.isInteger(po.data.total), String(po.data.total));
const weAfter = (await accounts(`/api/work-entries/${we.data._id}`)).data;
check("work entry linked to PO", weAfter.status === "po_created");
check("cannot bill unapproved PO", (await accounts("/api/invoices", { body: { purchaseOrder: po.data._id, invoiceDate: "2026-11-17", items: [] } })).status === 400);
check("send PO", ok(await accounts(`/api/purchase-orders/${po.data._id}`, { body: { action: "send" } })));
const appr = await mgmt(`/api/purchase-orders/${po.data._id}`, { body: { action: "approve", approvalRef: "Email 17-Nov", clientPoNumber: "SKY/PO/7781" } });
check("management records approval", ok(appr) && appr.data.status === "approved", appr.data.error);

// --- Invoice (partial RA bill)
const fullPo = (await accounts(`/api/purchase-orders/${po.data._id}`)).data;
const line0 = fullPo.items[0];
const over = await accounts("/api/invoices", { body: { purchaseOrder: po.data._id, invoiceDate: new Date().toISOString().slice(0, 10), items: [{ poItemId: line0._id, qty: line0.qty + 1 }] } });
check("over-billing rejected", over.status === 400, over.data.error);
const half = Math.round((line0.qty / 2) * 100) / 100;
const inv = await accounts("/api/invoices", {
  body: { purchaseOrder: po.data._id, invoiceDate: new Date().toISOString().slice(0, 10), billType: "RA Bill 1", items: fullPo.items.map((i, n) => ({ poItemId: i._id, qty: n === 0 ? half : i.qty })) },
});
check("draft bill generated", ok(inv) && inv.data.status === "draft" && !inv.data.invoiceNo, inv.data.error);
const poAfter = (await accounts(`/api/purchase-orders/${po.data._id}`)).data;
check("PO billed qty updated", poAfter.items[0].billedQty === half, `${poAfter.items[0].billedQty}`);
const issued = await accounts(`/api/invoices/${inv.data._id}`, { body: { action: "issue" } });
check("invoice issued with number", ok(issued) && /^FE\/\d{4}-\d{2}\/\d{4}$/.test(issued.data.invoiceNo || ""), issued.data.invoiceNo || issued.data.error);
const sub = await accounts(`/api/invoices/${inv.data._id}`, { body: { action: "submit", date: new Date().toISOString().slice(0, 10) } });
check("invoice submitted with due date", ok(sub) && sub.data.dueDate, sub.data.error);
const total = sub.data.total;

// --- Payments
const tooMuch = await accounts("/api/payments", { body: { invoice: inv.data._id, paymentDate: "2026-11-17", amount: total + 100 } });
check("over-payment rejected", tooMuch.status === 400);
const tds = Math.round(sub.data.subtotal * 0.02);
const p1 = await accounts("/api/payments", { body: { invoice: inv.data._id, paymentDate: new Date().toISOString().slice(0, 10), amount: 10000, tds, mode: "NEFT", reference: "UTR123" } });
check("partial payment recorded", ok(p1), p1.data.error);
let invNow = (await accounts(`/api/invoices/${inv.data._id}`)).data;
check("status partial & outstanding correct", invNow.paymentStatus === "partial" && Math.abs(invNow.outstanding - (total - 10000 - tds)) < 0.01, `${invNow.paymentStatus} ${invNow.outstanding}`);
const p2 = await accounts("/api/payments", { body: { invoice: inv.data._id, paymentDate: new Date().toISOString().slice(0, 10), amount: invNow.outstanding, mode: "RTGS" } });
check("final payment recorded", ok(p2), p2.data.error);
invNow = (await accounts(`/api/invoices/${inv.data._id}`)).data;
check("invoice fully paid", invNow.paymentStatus === "paid" && invNow.outstanding === 0);

// --- Second bill for remaining (left unpaid -> outstanding)
const inv2 = await accounts("/api/invoices", { body: { purchaseOrder: po.data._id, invoiceDate: new Date().toISOString().slice(0, 10), billType: "Final Bill", items: [{ poItemId: line0._id, qty: line0.qty - half }] } });
check("final bill for balance qty", ok(inv2), inv2.data.error);
await accounts(`/api/invoices/${inv2.data._id}`, { body: { action: "issue" } });
const inv2s = await accounts(`/api/invoices/${inv2.data._id}`, { body: { action: "submit", date: "2026-08-01" } });
check("second invoice number sequential", inv2s.data.invoiceNo?.endsWith("0002"), inv2s.data.invoiceNo);

// --- Dashboard & reports
const dash = await mgmt("/api/dashboard");
check("dashboard loads", ok(dash) && dash.data.kpis.totalBilling > 0, JSON.stringify(dash.data.kpis || dash.data));
check("overdue detected", dash.data.kpis.overdueOutstanding > 0, String(dash.data.kpis.overdueOutstanding));
for (const t of ["client-summary", "site-summary", "po-register", "invoice-register", "payments", "outstanding", "ageing-summary"]) {
  const r = await mgmt(`/api/reports?type=${t}`);
  check(`report ${t}`, ok(r) && Array.isArray(r.data) && r.data.length > 0, `${r.data.length ?? r.data.error} rows`);
}

// --- Documents upload
const fd = new FormData();
fd.append("file", new Blob(["%PDF-1.4 smoke test"], { type: "application/pdf" }), "signed-po.pdf");
fd.append("category", "po");
fd.append("refModel", "PurchaseOrder");
fd.append("refId", po.data._id);
const cookie = (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "accounts@fulchand.in", password: PW }) })).headers.get("set-cookie").split(";")[0];
const up = await fetch(`${BASE}/api/documents`, { method: "POST", headers: { cookie }, body: fd });
const doc = await up.json();
check("document uploaded", up.ok && doc._id, doc.error);
const dl = await fetch(`${BASE}/api/documents/${doc._id}`, { headers: { cookie } });
check("document downloads", dl.ok && (await dl.text()).includes("smoke test"));

// --- Pages render
for (const p of ["/dashboard", "/work-entries", "/purchase-orders", `/purchase-orders/${po.data._id}`, "/invoices", `/invoices/${inv.data._id}`, "/invoices/new", "/payments", "/outstanding", "/reports", "/documents", "/clients", "/sites", "/users", "/settings"]) {
  const r = await fetch(BASE + p, { headers: { cookie: (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@fulchand.in", password: PW }) })).headers.get("set-cookie")).split(";")[0] }, redirect: "manual" });
  check(`page ${p}`, r.status === 200, String(r.status));
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
