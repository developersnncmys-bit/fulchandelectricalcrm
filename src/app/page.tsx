import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const user = await getSession();
  redirect(user ? homeFor(user.role) : "/login");
}
