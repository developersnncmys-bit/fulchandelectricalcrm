"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ChevronDown } from "lucide-react";
import { homeFor, type Role } from "@/lib/roles";
import { BrandName, Logo } from "@/components/ui";

const DEMO = [
  ["admin@fulchand.in", "Admin"],
  ["management@fulchand.in", "Management"],
  ["accounts@fulchand.in", "Accounts"],
  ["engineer@fulchand.in", "Site Engineer"],
  ["supervisor@fulchand.in", "Site Supervisor"],
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") && next !== "/" ? next : homeFor(data.user.role as Role));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-3.5">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
        <div>
          <label className="label">Email</label>
          <input className="input h-[38px]" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input h-[38px]" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button disabled={loading} className="flex h-[38px] w-full items-center justify-center gap-2 rounded-md bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {loading && <Loader2 className="size-4 animate-spin" />} Sign in
        </button>
      </form>
      <div className="mt-5 border-t border-slate-100 pt-3.5">
        <button type="button" onClick={() => setDemo((d) => !d)} className="flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
          Demo logins <ChevronDown className={`size-3.5 transition ${demo ? "rotate-180" : ""}`} />
        </button>
        {demo && (
          <div className="mt-2.5 grid gap-0.5">
            {DEMO.map(([e, r]) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmail(e);
                  setPassword("Fulchand@123");
                }}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{e}</span>
                <span className="ml-auto text-[12px] text-slate-500">{r}</span>
              </button>
            ))}
            <p className="px-2 pt-1 text-[12px] text-slate-500">Password for all: Fulchand@123</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[392px] rounded-[10px] border border-slate-200 bg-white px-[30px] pb-7 pt-8">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo />
          <BrandName />
        </div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">Sign in</h2>
        <p className="mb-5 mt-1 text-[13px] text-slate-500">Billing and receivables for Fulchand and Sons Electrical.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-5 text-center text-[11.5px] text-slate-400">© {new Date().getFullYear()} Fulchand and Sons Electrical</p>
    </div>
  );
}
