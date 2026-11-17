"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ClipboardList, FileCheck2, Receipt, Wallet, Clock4, BarChart3, FolderOpen,
  Building2, MapPin, Users, Settings, LogOut, Menu, X, Plus, ChevronDown, ChevronRight,
} from "lucide-react";
import { can, ROLE_LABELS, type Permission } from "@/lib/roles";
import { financialYear } from "@/lib/format";
import type { SessionUser } from "@/lib/jwt";
import { cx, Logo, BrandName } from "./ui";
import { api } from "@/lib/client";

const SessionCtx = createContext<SessionUser | null>(null);
export const useUser = () => useContext(SessionCtx)!;

type NavItem = { href: string; label: string; icon: any; perm: Permission };
const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" }] },
  {
    section: "Billing workflow",
    items: [
      { href: "/work-entries", label: "Site Work & Material", icon: ClipboardList, perm: "work.view" },
      { href: "/purchase-orders", label: "Purchase Orders", icon: FileCheck2, perm: "po.view" },
      { href: "/invoices", label: "Bills / Invoices", icon: Receipt, perm: "invoice.view" },
      { href: "/payments", label: "Payments", icon: Wallet, perm: "payment.view" },
      { href: "/outstanding", label: "Outstanding", icon: Clock4, perm: "payment.view" },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports.view" },
      { href: "/documents", label: "Documents", icon: FolderOpen, perm: "documents.view" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/clients", label: "Clients", icon: Building2, perm: "masters.view" },
      { href: "/sites", label: "Sites", icon: MapPin, perm: "masters.view" },
      { href: "/users", label: "Users & Roles", icon: Users, perm: "users.manage" },
      { href: "/settings", label: "Company Settings", icon: Settings, perm: "settings.manage" },
    ],
  },
];
const ALL_ITEMS = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.section })));

const QUICK: { href: string; label: string; perm: Permission }[] = [
  { href: "/work-entries/new", label: "Site work entry", perm: "work.create" },
  { href: "/purchase-orders/new", label: "Purchase order", perm: "po.edit" },
  { href: "/invoices/new", label: "Bill / invoice", perm: "invoice.edit" },
  { href: "/payments?record=1", label: "Payment receipt", perm: "payment.edit" },
];

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function Dropdown({ trigger, children, align = "right" }: { trigger: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={cx("absolute top-full z-40 mt-2 min-w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white p-[5px] shadow-pop", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  // Warm up the main sections so switching tabs is instant
  useEffect(() => {
    ALL_ITEMS.filter((i) => can(user.role, i.perm)).forEach((i) => router.prefetch(i.href));
  }, [router, user.role]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const current = ALL_ITEMS.find((i) => path === i.href || path.startsWith(i.href + "/"));
  const sub = current && path !== current.href ? (path.endsWith("/new") ? "New" : "Details") : null;
  const quick = QUICK.filter((q) => can(user.role, q.perm));

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2.5 pb-4 pt-1">
      {NAV.map((s) => {
        const items = s.items.filter((i) => can(user.role, i.perm));
        if (!items.length) return null;
        return (
          <div key={s.section}>
            <p className="px-2.5 pb-[5px] pt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6b7590]">{s.section}</p>
            <ul className="space-y-px">
              {items.map((i) => {
                const active = path === i.href || path.startsWith(i.href + "/");
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className={cx(
                        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition",
                        active ? "bg-white/[0.09] font-semibold text-white" : "font-medium text-[#a7b0c6] hover:bg-white/[0.05] hover:text-white"
                      )}
                    >
                      {active && <span className="absolute -left-2.5 inset-y-2 w-[3px] rounded-r-sm bg-[#fbbf24]" />}
                      <i.icon className={cx("size-[17px] shrink-0", active ? "text-[#fbbf24]" : "text-[#6b7590] group-hover:text-[#c9d0e0]")} />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex h-[60px] items-center gap-2.5 border-b border-white/[0.06] px-[18px]">
      <Logo light />
      <BrandName dark />
    </Link>
  );

  const sidebarFooter = (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9e3da] text-[11.5px] font-bold text-[#5b4a36]">{initials(user.name)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
          <p className="truncate text-[11.5px] text-[#6b7590]">{ROLE_LABELS[user.role]}</p>
        </div>
        <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-[#6b7590] transition hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <SessionCtx.Provider value={user}>
      <div className="min-h-dvh lg:pl-[232px]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col bg-[#0b1229] lg:flex">
          {brand}
          {nav}
          {sidebarFooter}
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/35" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-[260px] max-w-[85vw] flex-col bg-[#0b1229] shadow-2xl">
              <div className="flex items-center justify-between pr-3">
                {brand}
                <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-[#a7b0c6] hover:bg-white/10" aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
              {sidebarFooter}
            </aside>
          </div>
        )}

        {/* Top bar */}
        <header className="no-print sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-7">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="hidden text-slate-400 sm:inline">{current?.section || "Home"}</span>
            <ChevronRight className="hidden size-3.5 text-slate-300 sm:block" />
            {current ? (
              <Link href={current.href} className={cx("truncate font-medium", sub ? "text-slate-500 hover:text-slate-800" : "text-slate-900")}>
                {current.label}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">Fulchand Electrical</span>
            )}
            {sub && (
              <>
                <ChevronRight className="size-3.5 text-slate-300" />
                <span className="font-medium text-slate-900">{sub}</span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 md:inline-flex">
              <span className="size-1.5 rounded-full bg-[#1a7f4b]" /> FY {financialYear()}
            </span>
            {quick.length > 0 && (
              <Dropdown
                trigger={() => (
                  <button className="inline-flex h-[34px] items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[13px] font-semibold text-white transition hover:bg-slate-800">
                    <Plus className="size-4" /> <span className="hidden sm:inline">New</span>
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Create new</p>
                    {quick.map((q) => (
                      <Link key={q.href} href={q.href} onClick={close} className="block rounded-[5px] px-2.5 py-[7px] text-[13px] text-slate-700 hover:bg-[#f7f6f3] hover:text-slate-900">
                        {q.label}
                      </Link>
                    ))}
                  </>
                )}
              </Dropdown>
            )}
            <Dropdown
              trigger={(o) => (
                <button className={cx("flex items-center gap-2 rounded-full py-[3px] pl-[3px] pr-2 transition hover:bg-[#f7f6f3]", o && "bg-slate-100")}>
                  <span className="grid size-[30px] place-items-center rounded-full bg-[#e9e3da] text-[11.5px] font-bold text-[#5b4a36]">{initials(user.name)}</span>
                  <span className="hidden text-left leading-tight md:block">
                    <span className="block text-[12.5px] font-medium text-slate-800">{user.name}</span>
                    <span className="block text-[11px] text-slate-500">{ROLE_LABELS[user.role]}</span>
                  </span>
                  <ChevronDown className="hidden size-3.5 text-slate-400 md:block" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-[12px] text-slate-500">{user.email}</p>
                  </div>
                  {can(user.role, "settings.manage") && (
                    <Link href="/settings" onClick={close} className="flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                      <Settings className="size-4 text-slate-400" /> Company settings
                    </Link>
                  )}
                  <button onClick={logout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </>
              )}
            </Dropdown>
          </div>
        </header>

        <main className="max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-7 lg:pt-[26px]">{children}</main>
      </div>
    </SessionCtx.Provider>
  );
}
