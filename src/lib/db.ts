import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fulchand_billing";

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { _mongoose?: Cached };
const cached: Cached = g._mongoose || (g._mongoose = { conn: null, promise: null });

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!process.env.MONGODB_URI && process.env.VERCEL) {
    throw new Error("Database not configured: add MONGODB_URI (MongoDB Atlas) in Vercel → Settings → Environment Variables, then redeploy.");
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 8000 });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw new Error("Cannot reach the database. Check MONGODB_URI and allow access from anywhere (0.0.0.0/0) in MongoDB Atlas → Network Access. (" + (e as Error).message + ")");
  }
  return cached.conn;
}

export function gridBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "files" });
}
