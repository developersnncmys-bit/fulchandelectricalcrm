import { handler, body } from "@/lib/api";
import { Settings } from "@/models";
import { getSettings, previewInvoiceNumber } from "@/lib/numbering";

export const GET = handler(null, async () => {
  const s = await getSettings();
  return { ...s, invoicePreview: previewInvoiceNumber(s) };
});

export const PUT = handler("settings.manage", async ({ req }) => {
  const b = await body(req);
  delete b._id;
  delete b.key;
  delete b.invoicePreview;
  const s = await Settings.findOneAndUpdate({ key: "main" }, b, { new: true, upsert: true, runValidators: true }).lean<any>();
  return { ...s, invoicePreview: previewInvoiceNumber(s) };
});
