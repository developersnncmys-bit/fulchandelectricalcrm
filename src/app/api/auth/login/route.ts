import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { User } from "@/models";
import { COOKIE_NAME, signSession } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    await dbConnect();
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+passwordHash");
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    user.lastLoginAt = new Date();
    await user.save();
    const session = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    const token = await signSession(session);
    const res = NextResponse.json({ user: session });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Login failed" }, { status: 500 });
  }
}
