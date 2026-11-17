import "server-only";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "./jwt";

export async function getSession() {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}
