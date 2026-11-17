import { handler, body, bad, must, oid } from "@/lib/api";
import { WorkEntry } from "@/models";
import { assertSiteAccess } from "@/lib/scope";
import { can } from "@/lib/roles";

async function load(id: string) {
  return must(await WorkEntry.findById(oid(id)), "Work entry");
}

export const GET = handler("work.view", async ({ params, user }) => {
  const w = must(
    await WorkEntry.findById(oid(params.id))
      .populate("site", "name code address")
      .populate("client", "name")
      .populate("createdBy", "name")
      .populate("validatedBy", "name")
      .populate("purchaseOrder", "poNumber status")
      .lean<any>(),
    "Work entry"
  );
  await assertSiteAccess(user, String(w.site._id));
  return w;
});

export const PATCH = handler("work.create", async ({ req, params, user }) => {
  const w = await load(params.id);
  await assertSiteAccess(user, String(w.site));
  if (!["draft", "rejected", "submitted"].includes(w.status)) throw bad("Validated entries cannot be edited");
  const b = await body(req);
  if (b.workDate) w.workDate = new Date(b.workDate);
  if (b.recordedBy !== undefined) w.recordedBy = b.recordedBy;
  if (b.remarks !== undefined) w.remarks = b.remarks;
  if (b.items) {
    const items = b.items.filter((i: any) => i.description && Number(i.qty) > 0);
    if (!items.length) throw bad("Add at least one item");
    w.items = items;
  }
  w.history.push({ action: "Edited", by: user.id, byName: user.name });
  await w.save();
  return w;
});

export const DELETE = handler("work.create", async ({ params, user }) => {
  const w = await load(params.id);
  await assertSiteAccess(user, String(w.site));
  if (!["draft", "rejected"].includes(w.status) && user.role !== "admin") throw bad("Only draft or rejected entries can be deleted");
  if (w.purchaseOrder) throw bad("Entry is linked to a PO");
  await w.deleteOne();
  return { ok: true };
});

/** Workflow actions: submit | validate | reject | reopen */
export const POST = handler("work.view", async ({ req, params, user }) => {
  const { action, note } = await body(req);
  const w = await load(params.id);
  await assertSiteAccess(user, String(w.site));
  const log = (a: string) => w.history.push({ action: a, by: user.id, byName: user.name, note });

  switch (action) {
    case "submit":
      if (!can(user.role, "work.create")) throw bad("Not allowed");
      if (!["draft", "rejected"].includes(w.status)) throw bad("Only draft/rejected entries can be submitted");
      w.status = "submitted";
      log("Submitted for validation");
      break;
    case "validate":
      if (!can(user.role, "work.validate")) throw bad("Only Site Engineer / Admin can validate");
      if (w.status !== "submitted") throw bad("Only submitted entries can be validated");
      w.status = "validated";
      w.validatedBy = user.id as any;
      w.validatedAt = new Date();
      w.rejectionReason = undefined;
      log("Validated");
      break;
    case "reject":
      if (!can(user.role, "work.validate")) throw bad("Only Site Engineer / Admin can reject");
      if (w.status !== "submitted") throw bad("Only submitted entries can be rejected");
      if (!note) throw bad("Please give a reason for rejection");
      w.status = "rejected";
      w.rejectionReason = note;
      log("Rejected");
      break;
    case "reopen":
      if (!can(user.role, "work.validate")) throw bad("Not allowed");
      if (w.status !== "validated") throw bad("Only validated entries (not yet in a PO) can be reopened");
      w.status = "submitted";
      w.validatedBy = undefined;
      w.validatedAt = undefined;
      log("Reopened");
      break;
    default:
      throw bad("Unknown action");
  }
  await w.save();
  return w;
});
