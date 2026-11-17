import { handler, must, oid } from "@/lib/api";
import { DocumentFile } from "@/models";
import { gridBucket } from "@/lib/db";
import { allowedSiteIds } from "@/lib/scope";
import { ApiError } from "@/lib/api";

/** Stream the file. ?download=1 forces attachment, otherwise inline (PDF/images preview in browser). */
export const GET = handler("documents.view", async ({ req, params, user }) => {
  const doc = must(await DocumentFile.findById(oid(params.id)).lean<any>(), "Document");
  const ids = await allowedSiteIds(user);
  if (ids && !(doc.site && ids.includes(String(doc.site))) && String(doc.uploadedBy) !== user.id) throw new ApiError(403, "Not allowed");

  const stream = gridBucket().openDownloadStream(doc.fileId);
  const web = new ReadableStream({
    start(controller) {
      stream.on("data", (c: Buffer) => controller.enqueue(new Uint8Array(c)));
      stream.on("end", () => controller.close());
      stream.on("error", (e) => controller.error(e));
    },
  });
  const disp = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(web, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `${disp}; filename="${encodeURIComponent(doc.fileName || "file")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});

export const DELETE = handler("documents.delete", async ({ params }) => {
  const doc = must(await DocumentFile.findById(oid(params.id)), "Document");
  try {
    await gridBucket().delete(doc.fileId);
  } catch {
    /* file chunk already missing */
  }
  await doc.deleteOne();
  return { ok: true };
});
