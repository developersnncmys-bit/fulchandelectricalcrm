import { handler, body, bad } from "@/lib/api";
import { Site, Client } from "@/models";
import { allowedSiteIds } from "@/lib/scope";

export const GET = handler("masters.view", async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("client")) q.client = sp.get("client");
  if (sp.get("status")) q.status = sp.get("status");
  const ids = await allowedSiteIds(user);
  if (ids) q._id = { $in: ids };
  return Site.find(q).populate("client", "name code stateCode").populate("assignedUsers", "name role").sort({ name: 1 }).lean();
});

export const POST = handler("masters.edit", async ({ req }) => {
  const b = await body(req);
  if (!b.name || !b.client) throw bad("Site name and client are required");
  const client = await Client.findById(b.client).lean<any>();
  if (!client) throw bad("Client not found");
  if (!b.stateCode) b.stateCode = client.stateCode;
  return Site.create(b);
});
