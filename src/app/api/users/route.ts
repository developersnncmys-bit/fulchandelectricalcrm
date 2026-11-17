import bcrypt from "bcryptjs";
import { handler, body, bad } from "@/lib/api";
import { User } from "@/models";
import { ROLES } from "@/lib/roles";

// List users (any logged-in user can list for assignment pickers; admin sees all fields)
export const GET = handler(null, async ({ req }) => {
  const role = req.nextUrl.searchParams.get("role");
  const q: any = {};
  if (role) q.role = { $in: role.split(",") };
  return User.find(q).sort({ name: 1 }).lean();
});

export const POST = handler("users.manage", async ({ req }) => {
  const b = await body(req);
  if (!b.name || !b.email || !b.password) throw bad("Name, email and password are required");
  if (!ROLES.includes(b.role)) throw bad("Invalid role");
  if (String(b.password).length < 6) throw bad("Password must be at least 6 characters");
  const user = await User.create({
    name: b.name,
    email: b.email,
    phone: b.phone,
    role: b.role,
    active: b.active ?? true,
    passwordHash: await bcrypt.hash(b.password, 10),
  });
  const { passwordHash: _p, ...rest } = user.toObject();
  void _p;
  return rest;
});
