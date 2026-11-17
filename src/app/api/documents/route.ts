import { Readable } from "stream";
import { handler, bad } from "@/lib/api";
import { DocumentFile, Site } from "@/models";
import { gridBucket } from "@/lib/db";
import { allowedSiteIds, assertSiteAccess } from "@/lib/scope";

const MAX_BYTES = 15 * 1024 * 1024;

export const GET = handler("documents.view", async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  for (const f of ["category", "client", "site", "refModel", "refId"]) if (sp.get(f)) q[f] = sp.get(f);
  if (sp.get("q")) q.title = { $regex: sp.get("q")!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const ids = await allowedSiteIds(user);
  if (ids) q.$or = [{ site: { $in: ids } }, { uploadedBy: user.id }];
  return DocumentFile.find(q).populate("client", "name").populate("site", "name").sort({ createdAt: -1 }).limit(1000).lean();
});

export const POST = handler("documents.upload", async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw bad("Please choose a file");
  if (file.size > MAX_BYTES) throw bad("File is larger than 15 MB");

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  let client = str("client");
  const site = str("site");
  if (site) {
    await assertSiteAccess(user, site);
    if (!client) client = String((await Site.findById(site).lean<any>())?.client || "") || undefined;
  }

  const bucket = gridBucket();
  const buf = Buffer.from(await file.arrayBuffer());
  const upload = bucket.openUploadStream(file.name, { metadata: { contentType: file.type, uploadedBy: user.id } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buf).pipe(upload).on("finish", () => resolve()).on("error", reject);
  });

  return DocumentFile.create({
    title: str("title") || file.name,
    category: str("category") || "other",
    fileId: upload.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    client,
    site,
    refModel: str("refModel"),
    refId: str("refId"),
    uploadedBy: user.id,
    uploadedByName: user.name,
  });
});
