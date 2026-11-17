// Edge-compatible JWT helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const COOKIE_NAME = "fe_session";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");
}

export async function signSession(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.id as string, name: payload.name as string, email: payload.email as string, role: payload.role as Role };
  } catch {
    return null;
  }
}
