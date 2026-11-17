// Builds realistic demo transactions (POs, bills, payments) through the app's API.
// Run after `npm run seed -- --reset` with the server running:
//   node scripts/demo.mjs http://localhost:3456
const BASE = process.argv[2] || "http://localhost:3456";
const PW = "Fulchand@123";
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW }) });
  if (!r.ok) throw new Error("Login failed for " + email);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: { cookie, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path}: ${data.error || res.status}`);
    return data;
  };
}

const RATES = {
  "Supply & laying of 4C x 25 sq.mm Al. armoured cable": 485,
  "Installation of 8-way SPN distribution board": 9800,
  "MCB 32A SP (Legrand)": 265,
  "Point wiring for light points with 1.5 sq.mm FR copper wire": 865,
  "Earthing pit with copper plate (complete)": 14500,
  "LED panel light 18W": 1450,
  "Cable tray 300mm perforated — supply & fixing": 640,
  "Cable lugs & glands (lot)": 18500,
};

// What happens on each site, oldest first
const PLAN = [
  { bill: 1, sub: 125, pay: "full", payAgo: 90, ref: "SKY/WO/2411" },
  { bill: 1, sub: 100, pay: "part", payAgo: 60, ref: "SKY/WO/2433" },
  { bill: 1, sub: 80, pay: "none", ref: "GFD/PO/0912" },
  { bill: 1, sub: 50, pay: "full", payAgo: 15, ref: "CRI/PUR/7781" },
  { bill: 1, sub: 20, pay: "none", ref: "GFD/PO/0947" },
  { bill: 0.6, sub: null, pay: "none", ref: "ORH/WO/118" },
  { bill: 0, ref: "ORH/WO/124" },
  { approve: false },
];

const accounts = await login("accounts@fulchand.in");
const sites = await accounts("/api/sites");
sites.sort((a, b) => String(a.code).localeCompare(String(b.code)));
const counts = { po: 0, inv: 0, pay: 0 };
let k = 0;

for (const site of sites) {
  const pending = await accounts(`/api/work-entries?site=${site._id}&status=validated&noPo=1`);
  if (!pending.length) continue;
  const plan = PLAN[k++] || { bill: 0 };
  const agg = new Map();
  for (const e of pending)
    for (const it of e.items) {
      const key = it.description + "|" + it.unit;
      const cur = agg.get(key);
      if (cur) cur.qty += it.qty;
      else agg.set(key, { type: it.type, description: it.description, unit: it.unit, qty: it.qty, rate: RATES[it.description] || 1000, gstRate: 18 });
    }
  const oldest = pending.map((e) => e.workDate).sort()[0].slice(0, 10);
  const po = await accounts("/api/purchase-orders", {
    body: { site: site._id, poDate: oldest, subject: `Electrical works — ${site.name}`, workEntries: pending.map((e) => e._id), items: [...agg.values()] },
  });
  counts.po++;
  await accounts(`/api/purchase-orders/${po._id}`, { body: { action: "send" } });
  if (plan.approve === false) continue;
  await accounts(`/api/purchase-orders/${po._id}`, { body: { action: "approve", approvalRef: "Signed copy received", clientPoNumber: plan.ref } });
  if (!plan.bill) continue;

  const full = await accounts(`/api/purchase-orders/${po._id}`);
  const invDate = plan.sub ? day(plan.sub + 2) : day(3);
  const inv = await accounts("/api/invoices", {
    body: {
      purchaseOrder: po._id,
      invoiceDate: invDate,
      billType: plan.bill < 1 ? "RA Bill 1" : "Final Bill",
      items: full.items.map((i) => ({ poItemId: i._id, qty: Math.round(i.qty * plan.bill * 100) / 100 })),
    },
  });
  counts.inv++;
  await accounts(`/api/invoices/${inv._id}`, { body: { action: "issue" } });
  if (!plan.sub) continue;
  const sub = await accounts(`/api/invoices/${inv._id}`, { body: { action: "submit", date: day(plan.sub) } });
  if (plan.pay === "none") continue;
  const tds = Math.round(sub.subtotal * 0.02);
  const amount = plan.pay === "full" ? sub.total - tds : Math.round(sub.total * 0.4);
  await accounts("/api/payments", {
    body: { invoice: inv._id, paymentDate: day(plan.payAgo), amount, tds: plan.pay === "full" ? tds : 0, mode: plan.pay === "full" ? "RTGS" : "NEFT", reference: "UTR" + (88120000 + k * 137) },
  });
  counts.pay++;
}
console.log(`Demo data: ${counts.po} POs, ${counts.inv} bills, ${counts.pay} payments`);
