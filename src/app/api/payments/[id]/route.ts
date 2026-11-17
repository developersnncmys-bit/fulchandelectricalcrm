import { handler, must, oid } from "@/lib/api";
import { Payment, Invoice } from "@/models";
import { recalcInvoicePayments } from "@/lib/services";

export const DELETE = handler("payment.edit", async ({ params, user }) => {
  const p = must(await Payment.findById(oid(params.id)), "Payment");
  const invId = p.invoice;
  await p.deleteOne();
  await Invoice.updateOne(
    { _id: invId },
    { $push: { history: { action: `Payment of ₹${p.amount} deleted`, by: user.id, byName: user.name, at: new Date() } } }
  );
  await recalcInvoicePayments(invId);
  return { ok: true };
});
