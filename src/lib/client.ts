"use client";
import { useCallback, useEffect, useState } from "react";

export async function api<T = any>(url: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const res = await fetch(url, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? (isForm ? opts.body : JSON.stringify(opts.body)) : undefined,
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if ((opts.method || (opts.body ? "POST" : "GET")) !== "GET") invalidateCache();
  return data as T;
}

// In-memory stale-while-revalidate cache: revisiting a page shows the last data
// instantly while fresh data loads in the background.
const cache = new Map<string, any>();
const inflight = new Map<string, Promise<any>>();

function fetchShared<T>(url: string): Promise<T> {
  let p = inflight.get(url);
  if (!p) {
    p = api<T>(url).finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

/** Any write should call this so lists don't show stale rows. */
export function invalidateCache() {
  cache.clear();
}

/** Data fetching hook with cache + reload. Pass null url to skip. */
export function useApi<T = any>(url: string | null) {
  const [data, setData] = useState<T | undefined>(() => (url ? cache.get(url) : undefined));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url && !cache.has(url));

  const load = useCallback(async () => {
    if (!url) return;
    if (cache.has(url)) setData(cache.get(url));
    else setLoading(true);
    setError(null);
    try {
      const d = await fetchShared<T>(url);
      cache.set(url, d);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function qs(params: Record<string, string | undefined | null | boolean>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
