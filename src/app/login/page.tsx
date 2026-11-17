"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ClipboardList, FileCheck2, Receipt, Wallet, ShieldCheck, LineChart, Calculator, HardHat, UserCog, ArrowRight } from "lucide-react";
import { homeFor, type Role } from "@/lib/roles";
import { BrandName, Logo } from "@/components/ui";
import { DEMO as DEMO_MODE } from "@/lib/demo-config";
import { demoSignIn } from "@/lib/demo";

const PW = "Fulchand@123";
const DEMO = [
  { email: "admin@fulchand.in", role: "Admin", note: "Full access", icon: ShieldCheck, tone: "bg-[#fbf2eb] text-[#b8571a]" },
  { email: "management@fulchand.in", role: "Management", note: "Dashboard & reports", icon: LineChart, tone: "bg-[#edf2fc] text-[#2457c5]" },
  { email: "accounts@fulchand.in", role: "Accounts", note: "POs, bills & payments", icon: Calculator, tone: "bg-[#eaf6ef] text-[#1a7f4b]" },
  { email: "engineer@fulchand.in", role: "Site Engineer", note: "Validates site work", icon: HardHat, tone: "bg-[#fbf4e2] text-[#94620a]" },
  { email: "supervisor@fulchand.in", role: "Site Supervisor", note: "Records site work", icon: UserCog, tone: "bg-[#f3effb] text-[#6a3fbf]" },
];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(em: string, pw: string) {
    setLoading(em);
    setError("");
    try {
      if (DEMO_MODE) {
        const user = demoSignIn(em, pw);
        router.replace(homeFor(user.role as Role));
        router.refresh();
        return;
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") && next !== "/" ? next : homeFor(data.user.role as Role));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(email, password);
        }}
        className="space-y-3.5"
      >
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-[12.5px] leading-relaxed text-red-700">{error}</p>}
        <div>
          <label className="label">Email</label>
          <input className="input h-[40px]" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input h-[40px]" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button disabled={!!loading} className="flex h-[40px] w-full items-center justify-center gap-2 rounded-md bg-slate-900 text-[13.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {loading === email && <Loader2 className="size-4 animate-spin" />} Sign in
        </button>
      </form>

      <div className="mt-7">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Or try a demo account</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={!!loading}
              onClick={() => {
                setEmail(d.email);
                setPassword(PW);
                signIn(d.email, PW);
              }}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-[#fcfbf9] disabled:opacity-60"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-md ${d.tone}`}>
                <d.icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-slate-900">{d.role}</span>
                <span className="block truncate text-[12px] text-slate-500">
                  {d.note} · {d.email}
                </span>
              </span>
              {loading === d.email ? (
                <Loader2 className="size-4 animate-spin text-slate-400" />
              ) : (
                <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              )}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[12px] text-slate-500">
          One click signs you in · password <span className="font-semibold text-slate-700">{PW}</span>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  const steps = [
    { icon: ClipboardList, t: "Site work & material capture" },
    { icon: FileCheck2, t: "PO creation & approval tracking" },
    { icon: Receipt, t: "Automated GST bills in PDF" },
    { icon: Wallet, t: "Payments, outstanding & ageing" },
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-[#0b1229] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[#2547ea]/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-[#fbbf24]/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo size={42} light />
          <div>
            <p className="text-lg font-bold">Fulchand and Sons Electrical</p>
            <p className="text-sm text-[#8d96ad]">Commercial Electrical Contractor</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight tracking-[-0.02em]">
            Billing & Receivables,
            <br />
            <span className="text-[#fbbf24]">from site to settlement.</span>
          </h1>
          <ul className="mt-8 space-y-3">
            {steps.map((s) => (
              <li key={s.t} className="flex items-center gap-3 text-[#c9d0e0]">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                  <s.icon className="size-4 text-[#fbbf24]" />
                </span>
                {s.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#6b7590]">© {new Date().getFullYear()} Fulchand and Sons Electrical</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <BrandName />
          </div>
          <h2 className="text-[24px] font-bold tracking-[-0.02em] text-slate-900">Sign in</h2>
          <p className="mb-6 mt-1 text-[13.5px] text-slate-500">Use the account given by your administrator.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
