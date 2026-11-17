import { handler, body, bad } from "@/lib/api";
import { Client } from "@/models";

export const GET = handler("masters.view", async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  const q: any = {};
  if (sp.get("active") === "1") q.active = true;
  return Client.find(q).sort({ name: 1 }).lean();
});

export const POST = handler("masters.edit", async ({ req }) => {
  const b = await body(req);
  if (!b.name) throw bad("Client name is required");
  return Client.create(b);
});
