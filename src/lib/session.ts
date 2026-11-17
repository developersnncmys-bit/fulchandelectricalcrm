import "server-only";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "./jwt";
import { DEMO, DEMO_COOKIE } from "./demo-config";
import demoData from "./demo-data.json";

export async function getSession() {
  const store = await cookies();
  if (DEMO) {
    const email = decodeURIComponent(store.get(DEMO_COOKIE)?.value || "");
    const u = (demoData as any).lists.users.find((x: any) => x.email === email);
    return u ? { id: u._id, name: u.name, email: u.email, role: u.role } : null;
  }
  return verifySession(store.get(COOKIE_NAME)?.value);
}
