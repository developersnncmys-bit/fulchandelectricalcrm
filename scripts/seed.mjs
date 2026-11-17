// Seeds users, company settings, sample clients, sites and work entries.
// Usage: npm run seed            (keeps existing data, only adds missing users/settings)
//        npm run seed -- --reset (wipes the database first and loads sample data)
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// minimal .env.local loader
for (const f of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fulchand_billing";
const reset = process.argv.includes("--reset");
const PASSWORD = "Fulchand@123";

await mongoose.connect(URI);
const db = mongoose.connection.db;
console.log("Connected:", URI.replace(/\/\/.*@/, "//***@"));

if (reset) {
  for (const c of await db.listCollections().toArray()) await db.collection(c.name).drop();
  console.log("Database cleared");
}

const now = new Date();
const hash = await bcrypt.hash(PASSWORD, 10);
const users = [
  { name: "Admin", email: "admin@fulchand.in", role: "admin" },
  { name: "Rajesh Fulchand", email: "management@fulchand.in", role: "management" },
  { name: "Priya Accounts", email: "accounts@fulchand.in", role: "accounts" },
  { name: "Amit Engineer", email: "engineer@fulchand.in", role: "site_engineer" },
  { name: "Suresh Supervisor", email: "supervisor@fulchand.in", role: "site_supervisor" },
];
const userIds = {};
for (const u of users) {
  const existing = await db.collection("users").findOne({ email: u.email });
  if (existing) {
    userIds[u.role] = existing._id;
    continue;
  }
  const r = await db.collection("users").insertOne({ ...u, passwordHash: hash, active: true, createdAt: now, updatedAt: now });
  userIds[u.role] = r.insertedId;
  console.log(`  + user ${u.email} (${u.role})`);
}

if (!(await db.collection("settings").findOne({ key: "main" }))) {
  await db.collection("settings").insertOne({
    key: "main",
    companyName: "Fulchand and Sons Electrical",
    tagline: "Commercial Electrical Contractor",
    address: "Shop No. 12, Laxmi Industrial Estate, Andheri (E)",
    city: "Mumbai",
    stateCode: "27",
    pincode: "400093",
    phone: "+91 98200 00000",
    email: "accounts@fulchand.in",
    gstin: "27ABCPF1234K1Z5",
    pan: "ABCPF1234K",
    bankName: "HDFC Bank",
    bankAccountName: "Fulchand and Sons Electrical",
    bankAccountNo: "50200012345678",
    bankIfsc: "HDFC0000123",
    bankBranch: "Andheri East",
    invoicePrefix: "FE",
    invoiceFormat: "{PREFIX}/{FY}/{SEQ}",
    invoiceSeqPadding: 4,
    invoiceResetYearly: true,
    poPrefix: "PO",
    workPrefix: "WE",
    defaultGstRate: 18,
    defaultPaymentTerms: 30,
    roundOff: true,
    invoiceTerms:
      "1. Payment to be made within the agreed credit period.\n2. Interest @18% p.a. will be charged on delayed payments.\n3. Subject to Mumbai jurisdiction.",
    authorisedSignatory: "Proprietor",
    createdAt: now,
    updatedAt: now,
  });
  console.log("  + company settings");
}

if (reset) {
  const clients = [
    { name: "Skyline Infra Projects Pvt Ltd", code: "SKY", gstin: "27AAACS1234A1Z1", stateCode: "27", city: "Mumbai", address: "Skyline House, BKC, Bandra (E)", contactPerson: "Mr. Mehta", phone: "9820011111", email: "accounts@skyline.example", paymentTermsDays: 30 },
    { name: "Greenfield Developers LLP", code: "GFD", gstin: "27AAJFG5678B1Z2", stateCode: "27", city: "Pune", address: "Baner Road, Pune", contactPerson: "Ms. Kulkarni", phone: "9820022222", email: "ap@greenfield.example", paymentTermsDays: 45 },
    { name: "Coastal Retail India Ltd", code: "CRI", gstin: "24AAACC9012C1Z3", stateCode: "24", city: "Ahmedabad", address: "SG Highway, Ahmedabad", contactPerson: "Mr. Shah", phone: "9820033333", email: "finance@coastal.example", paymentTermsDays: 60 },
    { name: "Orchid Hospitality Pvt Ltd", code: "ORH", gstin: "27AAACO3456D1Z4", stateCode: "27", city: "Mumbai", address: "Juhu Tara Road, Juhu", contactPerson: "Mr. D'Souza", phone: "9820044444", email: "projects@orchid.example", paymentTermsDays: 30 },
    { name: "Meridian Healthcare Ltd", code: "MHL", gstin: "29AAACM7890E1Z5", stateCode: "29", city: "Bengaluru", address: "Whitefield Main Road, Bengaluru", contactPerson: "Dr. Raman", phone: "9820055555", email: "ap@meridian.example", paymentTermsDays: 45 },
  ];
  const clientIds = [];
  for (const c of clients) {
    const r = await db.collection("clients").insertOne({ ...c, active: true, createdAt: now, updatedAt: now });
    clientIds.push(r.insertedId);
  }
  const sites = [
    { name: "Skyline Tower A — Worli", code: "SKY-WRL", client: clientIds[0], city: "Mumbai", stateCode: "27" },
    { name: "Skyline Business Park — Thane", code: "SKY-THN", client: clientIds[0], city: "Thane", stateCode: "27" },
    { name: "Greenfield Residency — Baner", code: "GFD-BNR", client: clientIds[1], city: "Pune", stateCode: "27" },
    { name: "Coastal Mall — Ahmedabad", code: "CRI-AMD", client: clientIds[2], city: "Ahmedabad", stateCode: "24" },
    { name: "Greenfield IT Park — Hinjewadi", code: "GFD-HJW", client: clientIds[1], city: "Pune", stateCode: "27" },
    { name: "Orchid Hotel — Juhu", code: "ORH-JUH", client: clientIds[3], city: "Mumbai", stateCode: "27" },
    { name: "Orchid Banquets — Andheri", code: "ORH-AND", client: clientIds[3], city: "Mumbai", stateCode: "27" },
    { name: "Meridian Hospital — Whitefield", code: "MHL-WFD", client: clientIds[4], city: "Bengaluru", stateCode: "29" },
  ];
  const siteIds = [];
  for (const s of sites) {
    const r = await db.collection("sites").insertOne({
      ...s,
      assignedUsers: [userIds.site_engineer, userIds.site_supervisor],
      status: "active",
      startDate: new Date(now.getFullYear(), now.getMonth() - 6, 1),
      createdAt: now,
      updatedAt: now,
    });
    siteIds.push(r.insertedId);
  }
  console.log(`  + ${clients.length} clients, ${sites.length} sites`);

  const fy = (d) => {
    const s = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
  };
  const items = [
    [
      { type: "work", description: "Supply & laying of 4C x 25 sq.mm Al. armoured cable", unit: "Mtr", qty: 240 },
      { type: "work", description: "Installation of 8-way SPN distribution board", unit: "Nos", qty: 6 },
      { type: "material", description: "MCB 32A SP (Legrand)", unit: "Nos", qty: 48 },
    ],
    [
      { type: "work", description: "Point wiring for light points with 1.5 sq.mm FR copper wire", unit: "Nos", qty: 180 },
      { type: "work", description: "Earthing pit with copper plate (complete)", unit: "Nos", qty: 4 },
      { type: "material", description: "LED panel light 18W", unit: "Nos", qty: 120 },
    ],
    [
      { type: "work", description: "Cable tray 300mm perforated — supply & fixing", unit: "Mtr", qty: 150 },
      { type: "material", description: "Cable lugs & glands (lot)", unit: "Lot", qty: 1 },
    ],
  ];
  const statuses = ["validated", "validated", "validated", "validated", "validated", "validated", "validated", "validated", "validated", "validated", "submitted", "submitted", "draft", "rejected"];
  let seq = 0;
  for (let i = 0; i < statuses.length; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (statuses.length - i) * 9);
    const st = statuses[i];
    const site = siteIds[i % siteIds.length];
    const s = sites[i % sites.length];
    await db.collection("workentries").insertOne({
      entryNo: `WE/${fy(d)}/${String(++seq).padStart(4, "0")}`,
      site,
      client: s.client,
      workDate: d,
      recordedBy: "Site labour team",
      items: items[i % items.length],
      remarks: "",
      status: st,
      createdBy: userIds.site_supervisor,
      ...(st === "validated" || st === "rejected" ? { validatedBy: userIds.site_engineer, validatedAt: d } : {}),
      ...(st === "rejected" ? { rejectionReason: "Quantities do not match joint measurement" } : {}),
      history: [{ action: "Created & submitted", by: userIds.site_supervisor, byName: "Suresh Supervisor", at: d }],
      createdAt: d,
      updatedAt: d,
    });
  }
  await db.collection("counters").updateOne({ _id: `work:${fy(now)}` }, { $set: { seq } }, { upsert: true });
  console.log(`  + ${statuses.length} work entries`);
}

console.log(`\nDone. Login password for all seeded users: ${PASSWORD}`);
for (const u of users) console.log(`  ${u.role.padEnd(16)} ${u.email}`);
await mongoose.disconnect();
