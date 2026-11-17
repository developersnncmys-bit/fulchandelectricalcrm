import bcrypt from "bcryptjs";
import { handler, body, bad, must, oid } from "@/lib/api";
import { User } from "@/models";
import { ROLES } from "@/lib/roles";

export const PATCH = handler("users.manage", async ({ req, params, user: me }) => {
  const b = await body(req);
  const u = must(await User.findById(oid(params.id)), "User");
  if (b.name !== undefined) u.name = b.name;
  if (b.email !== undefined) u.email = b.email;
  if (b.phone !== undefined) u.phone = b.phone;
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) throw bad("Invalid role");
    if (String(u._id) === me.id && b.role !== "admin") throw bad("You cannot remove your own admin role");
    u.role = b.role;
  }
  if (b.active !== undefined) {
    if (String(u._id) === me.id && !b.active) throw bad("You cannot deactivate yourself");
    u.active = b.active;
  }
  if (b.password) {
    if (String(b.password).length < 6) throw bad("Password must be at least 6 characters");
    u.passwordHash = await bcrypt.hash(b.password, 10);
  }
  await u.save();
  return { ok: true };
});
