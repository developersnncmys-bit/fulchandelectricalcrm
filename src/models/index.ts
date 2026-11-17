import mongoose, { Schema, model, models, type Model } from "mongoose";
import { ROLES } from "@/lib/roles";

const { ObjectId } = Schema.Types;
const opts = { timestamps: true };

// Untyped schema factory: avoids mongoose deep type inference (which blows up tsc memory).
function S(def: Record<string, any>, options?: Record<string, any>): Schema {
  return new (Schema as any)(def, options);
}

type AnyModel = Model<any>;
function m(name: string, schema: Schema): AnyModel {
  return (models[name] || (model as any)(name, schema)) as AnyModel;
}

/* ---------------- Users ---------------- */
const UserSchema = S(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: String,
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  opts
);
export const User = m("User", UserSchema);

/* ---------------- Settings (singleton) ---------------- */
const SettingsSchema = S(
  {
    key: { type: String, default: "main", unique: true },
    companyName: { type: String, default: "Fulchand and Sons Electrical" },
    tagline: { type: String, default: "Commercial Electrical Contractor" },
    address: String,
    city: String,
    stateCode: { type: String, default: "27" },
    pincode: String,
    phone: String,
    email: String,
    gstin: String,
    pan: String,
    bankName: String,
    bankAccountName: String,
    bankAccountNo: String,
    bankIfsc: String,
    bankBranch: String,
    invoicePrefix: { type: String, default: "FE" },
    invoiceFormat: { type: String, default: "{PREFIX}/{FY}/{SEQ}" },
    invoiceSeqPadding: { type: Number, default: 4 },
    invoiceResetYearly: { type: Boolean, default: true },
    poPrefix: { type: String, default: "PO" },
    workPrefix: { type: String, default: "WE" },
    defaultGstRate: { type: Number, default: 18 },
    defaultPaymentTerms: { type: Number, default: 30 },
    roundOff: { type: Boolean, default: true },
    invoiceTerms: {
      type: String,
      default:
        "1. Payment to be made within the agreed credit period.\n2. Interest @18% p.a. will be charged on delayed payments.\n3. Subject to local jurisdiction.",
    },
    authorisedSignatory: { type: String, default: "Proprietor" },
  },
  opts
);
export const Settings = m("Settings", SettingsSchema);

/* ---------------- Counters ---------------- */
const CounterSchema = S({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = m("Counter", CounterSchema);

/* ---------------- Clients ---------------- */
const ClientSchema = S(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: String,
    address: String,
    city: String,
    stateCode: { type: String, default: "27" },
    pincode: String,
    contactPerson: String,
    phone: String,
    email: String,
    paymentTermsDays: { type: Number, default: 30 },
    active: { type: Boolean, default: true },
  },
  opts
);
export const Client = m("Client", ClientSchema);

/* ---------------- Sites ---------------- */
const SiteSchema = S(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    client: { type: ObjectId, ref: "Client", required: true },
    address: String,
    city: String,
    stateCode: String,
    assignedUsers: [{ type: ObjectId, ref: "User" }],
    startDate: Date,
    status: { type: String, enum: ["active", "completed", "on_hold"], default: "active" },
  },
  opts
);
export const Site = m("Site", SiteSchema);

/* ---------------- Site work & material entries ---------------- */
const WorkItemSchema = S(
  {
    type: { type: String, enum: ["work", "material"], default: "work" },
    description: { type: String, required: true },
    unit: { type: String, default: "Nos" },
    qty: { type: Number, required: true, min: 0 },
    remarks: String,
  },
  { _id: false }
);

const HistorySchema = S(
  { action: String, by: { type: ObjectId, ref: "User" }, byName: String, at: { type: Date, default: Date.now }, note: String },
  { _id: false }
);

const WorkEntrySchema = S(
  {
    entryNo: { type: String, unique: true },
    site: { type: ObjectId, ref: "Site", required: true },
    client: { type: ObjectId, ref: "Client", required: true },
    workDate: { type: Date, required: true },
    recordedBy: String, // name of labour/supervisor who recorded on site
    items: { type: [WorkItemSchema], validate: [(v: unknown[]) => v.length > 0, "At least one item is required"] },
    remarks: String,
    status: { type: String, enum: ["draft", "submitted", "validated", "rejected", "po_created"], default: "draft" },
    purchaseOrder: { type: ObjectId, ref: "PurchaseOrder" },
    createdBy: { type: ObjectId, ref: "User" },
    validatedBy: { type: ObjectId, ref: "User" },
    validatedAt: Date,
    rejectionReason: String,
    history: [HistorySchema],
  },
  opts
);
export const WorkEntry = m("WorkEntry", WorkEntrySchema);

/* ---------------- Purchase Orders ---------------- */
const POItemSchema = S({
  description: { type: String, required: true },
  hsn: String,
  unit: { type: String, default: "Nos" },
  qty: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 18 },
  amount: Number,
  billedQty: { type: Number, default: 0 },
});

const PurchaseOrderSchema = S(
  {
    poNumber: { type: String, unique: true }, // internal reference
    clientPoNumber: String, // PO number issued/acknowledged by the client
    client: { type: ObjectId, ref: "Client", required: true },
    site: { type: ObjectId, ref: "Site", required: true },
    poDate: { type: Date, required: true },
    subject: String,
    workEntries: [{ type: ObjectId, ref: "WorkEntry" }],
    items: [POItemSchema],
    interState: { type: Boolean, default: false },
    subtotal: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    taxTotal: Number,
    roundOff: Number,
    total: Number,
    billedAmount: { type: Number, default: 0 }, // taxable value billed so far
    status: { type: String, enum: ["draft", "sent", "approved", "rejected", "closed"], default: "draft" },
    sentAt: Date,
    approvedAt: Date,
    approvalRef: String,
    rejectionReason: String,
    notes: String,
    createdBy: { type: ObjectId, ref: "User" },
    history: [HistorySchema],
  },
  opts
);
export const PurchaseOrder = m("PurchaseOrder", PurchaseOrderSchema);

/* ---------------- Invoices ---------------- */
const InvoiceItemSchema = S(
  {
    poItemId: ObjectId,
    description: { type: String, required: true },
    hsn: String,
    unit: String,
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 18 },
    amount: Number,
  },
  { _id: false }
);

const InvoiceSchema = S(
  {
    invoiceNo: { type: String, unique: true, sparse: true }, // assigned when issued
    draftRef: String,
    purchaseOrder: { type: ObjectId, ref: "PurchaseOrder" },
    client: { type: ObjectId, ref: "Client", required: true },
    site: { type: ObjectId, ref: "Site" },
    invoiceDate: { type: Date, required: true },
    billType: { type: String, default: "Tax Invoice" }, // e.g. RA Bill 1, Final Bill
    items: [InvoiceItemSchema],
    interState: { type: Boolean, default: false },
    subtotal: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    taxTotal: Number,
    roundOff: Number,
    total: { type: Number, default: 0 },
    amountReceived: { type: Number, default: 0 },
    tdsDeducted: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "issued", "submitted", "cancelled"], default: "draft" },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
    issuedAt: Date,
    submittedAt: Date,
    dueDate: Date,
    paidAt: Date,
    notes: String,
    createdBy: { type: ObjectId, ref: "User" },
    history: [HistorySchema],
  },
  opts
);
export const Invoice = m("Invoice", InvoiceSchema);

/* ---------------- Payments ---------------- */
const PaymentSchema = S(
  {
    invoice: { type: ObjectId, ref: "Invoice", required: true },
    client: { type: ObjectId, ref: "Client", required: true },
    site: { type: ObjectId, ref: "Site" },
    paymentDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 }, // amount actually received
    tds: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    mode: { type: String, enum: ["NEFT", "RTGS", "IMPS", "Cheque", "UPI", "Cash", "Other"], default: "NEFT" },
    reference: String,
    notes: String,
    createdBy: { type: ObjectId, ref: "User" },
  },
  opts
);
export const Payment = m("Payment", PaymentSchema);

/* ---------------- Documents (GridFS backed) ---------------- */
const DocumentSchema = S(
  {
    title: { type: String, required: true },
    category: { type: String, enum: ["po", "invoice", "work", "payment", "client", "other"], default: "other" },
    fileId: { type: ObjectId, required: true },
    fileName: String,
    mimeType: String,
    size: Number,
    client: { type: ObjectId, ref: "Client" },
    site: { type: ObjectId, ref: "Site" },
    refModel: { type: String, enum: ["WorkEntry", "PurchaseOrder", "Invoice", "Payment", null] },
    refId: ObjectId,
    uploadedBy: { type: ObjectId, ref: "User" },
    uploadedByName: String,
  },
  opts
);
export const DocumentFile = m("DocumentFile", DocumentSchema);

export { mongoose };
