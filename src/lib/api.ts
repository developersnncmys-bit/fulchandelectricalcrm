import "server-only";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "./db";
import { getSession } from "./session";
import { can, type Permission } from "./roles";
import type { SessionUser } from "./jwt";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const bad = (msg: string) => new ApiError(400, msg);
export const notFound = (what = "Record") => new ApiError(404, `${what} not found`);

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (args: { req: NextRequest; user: SessionUser; params: Record<string, string> }) => Promise<unknown>;

/** Wrap a route handler with auth, permission check, DB connection and error handling. */
export function handler(perm: Permission | null, fn: Handler) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      const user = await getSession();
      if (!user) throw new ApiError(401, "Not authenticated");
      if (perm && !can(user.role, perm)) throw new ApiError(403, "You do not have permission for this action");
      await dbConnect();
      const params = ctx?.params ? await ctx.params : {};
      const result = await fn({ req, user, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e: any) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof mongoose.Error.ValidationError) {
        return NextResponse.json({ error: Object.values(e.errors).map((x) => x.message).join(", ") }, { status: 400 });
      }
      if (e?.code === 11000) {
        return NextResponse.json({ error: `Duplicate value: ${Object.keys(e.keyValue || {}).join(", ")}` }, { status: 409 });
      }
      console.error(e);
      return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
    }
  };
}

export async function body<T = any>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw bad("Invalid JSON body");
  }
}

export function oid(id: string | undefined | null) {
  if (!id || !mongoose.isValidObjectId(id)) throw bad("Invalid id");
  return new mongoose.Types.ObjectId(id);
}

export function must<T>(v: T, what?: string): NonNullable<T> {
  if (v === null || v === undefined) throw notFound(what);
  return v as NonNullable<T>;
}
