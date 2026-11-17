import { handler, body, bad } from "@/lib/api";
import { Site } from "@/models";
import { allowedSiteIds } from "@/lib/scope";
import { createWorkEntry } from "@/lib/services";
import { isoDate } from "@/lib/format";
import { can } from "@/lib/roles";

/**
 * Bulk import of already-validated site sheets (parsed from Excel in the browser).
 * rows: [{ siteCode|siteName, date, type, description, unit, qty, remarks, recordedBy }]
 * Rows are grouped into one entry per site + date.
 */
export const POST = handler("work.create", async ({ req, user }) => {
  const { rows, submit, validated } = await body(req);
  if (validated && !can(user.role, "work.validate")) throw bad("Only Site Engineer / Admin can import as validated");
  if (!Array.isArray(rows) || !rows.length) throw bad("No rows to import");

  const sites = await Site.find({}).lean<any[]>();
  const allowed = await allowedSiteIds(user);
  const findSite = (r: any) => {
    const key = String(r.site || r.siteCode || r.siteName || "").trim().toLowerCase();
    return sites.find((s) => (s.code || "").toLowerCase() === key || s.name.toLowerCase() === key);
  };

  const groups = new Map<string, { site: any; date: string; recordedBy?: string; items: any[] }>();
  const errors: string[] = [];
  rows.forEach((r: any, i: number) => {
    const site = findSite(r);
    if (!site) return errors.push(`Row ${i + 2}: site "${r.site || r.siteCode || r.siteName || ""}" not found`);
    if (allowed && !allowed.includes(String(site._id))) return errors.push(`Row ${i + 2}: not assigned to site ${site.name}`);
    const d = r.date ? new Date(r.date) : new Date();
    if (isNaN(d.getTime())) return errors.push(`Row ${i + 2}: invalid date`);
    if (!r.description || !(Number(r.qty) > 0)) return errors.push(`Row ${i + 2}: description and qty required`);
    const key = `${site._id}|${isoDate(d)}`;
    if (!groups.has(key)) groups.set(key, { site, date: isoDate(d), recordedBy: r.recordedBy, items: [] });
    groups.get(key)!.items.push({
      type: String(r.type || "work").toLowerCase().startsWith("m") ? "material" : "work",
      description: String(r.description),
      unit: r.unit || "Nos",
      qty: Number(r.qty),
      remarks: r.remarks,
    });
  });

  if (errors.length) throw bad(errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n…and ${errors.length - 10} more` : ""));

  const created = [];
  for (const g of groups.values()) {
    const e = await createWorkEntry(
      { site: String(g.site._id), workDate: g.date, recordedBy: g.recordedBy, items: g.items, submit, validated, remarks: "Imported from Excel" },
      user
    );
    created.push(e.entryNo);
  }
  return { created: created.length, entries: created };
});
