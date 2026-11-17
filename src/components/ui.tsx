"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Loader2, X, Inbox, ChevronRight } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/* ---------------- Button ---------------- */
type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900/20",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-[#f7f6f3] hover:ring-slate-300 hover:text-slate-900 focus-visible:ring-slate-900/15",
  danger: "bg-white text-[#b42318] ring-1 ring-inset ring-[#f1cbc6] hover:bg-[#fcefed] focus-visible:ring-red-500/30",
  success: "bg-[#1a7f4b] text-white hover:bg-[#156a3e] focus-visible:ring-emerald-500/30",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  href,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
  href?: string;
}) {
  const cls = cx(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-[34px] px-[13px] text-[13px]",
    BTN[variant],
    className
  );
  const inner = (
    <>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {inner}
    </button>
  );
}

/* ---------------- Form fields ---------------- */
export function Field({ label, children, className, hint, required }: { label: string; children: React.ReactNode; className?: string; hint?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("input", props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx("input", props.className)} />;
}
export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={cx("input pr-8", props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------------- Layout ---------------- */
export function Card({
  children,
  className,
  title,
  description,
  actions,
  bodyClass,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className={cx("overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 min-h-[50px] border-b border-slate-100 px-[18px] py-3">
          <div>
            <h2 className="text-[14px] font-bold tracking-[-0.01em] text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-[12.5px] text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(bodyClass ?? "px-[18px] py-4")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-[18px] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-500 transition hover:text-slate-900">
            <ChevronRight className="size-3.5 rotate-180" /> Back to list
          </Link>
        )}
        <h1 className="text-[21px] font-bold leading-tight tracking-[-0.025em] text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-slate-500">
      <Loader2 className="size-4 animate-spin text-brand-600" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>;
}

export function Empty({ title = "Nothing here yet", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-slate-100">
        <Inbox className="size-5 text-slate-400" />
      </div>
      <p className="mt-1 text-[13.5px] font-medium text-slate-700">{title}</p>
      {children && <div className="text-[13px] text-slate-500">{children}</div>}
    </div>
  );
}

/* ---------------- Status badge ---------------- */
type Tone = "slate" | "blue" | "green" | "red" | "amber" | "violet" | "indigo" | "orange";
const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-[#edf2fc] text-[#2457c5]",
  green: "bg-[#eaf6ef] text-[#1a7f4b]",
  red: "bg-[#fcefed] text-[#b42318]",
  amber: "bg-[#fbf4e2] text-[#94620a]",
  violet: "bg-[#f3effb] text-[#6a3fbf]",
  indigo: "bg-[#edf2fc] text-[#2457c5]",
  orange: "bg-brand-50 text-brand-700",
};
const STATUS: Record<string, [Tone, string]> = {
  draft: ["slate", "Draft"],
  submitted: ["blue", "Submitted"],
  validated: ["green", "Validated"],
  rejected: ["red", "Rejected"],
  po_created: ["violet", "In PO"],
  sent: ["amber", "Awaiting approval"],
  approved: ["green", "Approved"],
  closed: ["slate", "Closed"],
  issued: ["indigo", "Issued"],
  cancelled: ["red", "Cancelled"],
  unpaid: ["orange", "Unpaid"],
  partial: ["amber", "Part paid"],
  paid: ["green", "Paid"],
  overdue: ["red", "Overdue"],
  active: ["green", "Active"],
  inactive: ["slate", "Inactive"],
  completed: ["slate", "Completed"],
  on_hold: ["amber", "On hold"],
};

export function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  const [tone, label] = STATUS[status] || ["slate", status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")];
  return (
    <span className={cx("inline-block whitespace-nowrap rounded px-[7px] text-[12px] font-semibold leading-[19px]", TONES[tone])}>
      {children ?? label}
    </span>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cx("flex max-h-[92vh] w-full flex-col rounded-t-[10px] bg-white shadow-pop sm:rounded-[10px]", w)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-[16.5px] font-bold tracking-[-0.02em] text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- KPI tile ---------------- */
export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "brand" | "green" | "amber" | "red" | "slate" | "violet";
  href?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
    violet: "bg-violet-50 text-violet-600",
  };
  const body = (
    <div className={cx("group h-full rounded-lg border border-slate-200 bg-white px-[18px] pb-3.5 pt-[15px] transition", href && "hover:bg-[#fcfbf9]")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] font-medium text-slate-500">{label}</p>
        {icon && <div className={cx("grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", tones[tone])}>{icon}</div>}
      </div>
      <p className="mt-0.5 truncate text-[22px] font-bold tracking-[-0.03em] tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-1 truncate text-[12px] text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ---------------- Tabs (underline) ---------------- */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 border-b border-slate-200">
      <nav className="-mb-px flex gap-5 overflow-x-auto">
        {tabs.map((t) => {
          const active = value === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onChange(t.value)}
              className={cx(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-semibold transition",
                active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              {t.label}
              {t.count !== undefined && <span className={cx("rounded px-[5px] text-[11.5px] font-semibold tabular-nums", active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500")}>{t.count}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- Detail list ---------------- */
export function DL({ items, cols = 2 }: { items: [string, React.ReactNode][]; cols?: 2 | 3 | 4 }) {
  const c = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-4", c)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] font-medium text-slate-500">{k}</dt>
          <dd className="mt-0.5 break-words text-[13.5px] font-semibold text-slate-900">{v || <span className="text-slate-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="-mx-5 overflow-x-auto">{children}</div>;
}

/** Status history timeline */
export function History({ items }: { items: { action: string; byName?: string; at: string; note?: string }[] }) {
  if (!items?.length) return <p className="text-[13px] text-slate-500">No activity yet.</p>;
  const list = [...items].reverse();
  return (
    <ol className="relative">
      {list.map((h, i) => (
        <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
          {i < list.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
          <span className={cx("relative mt-1 size-[11px] shrink-0 rounded-full border-2 bg-white", i === 0 ? "border-brand-500" : "border-slate-300")} />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium text-slate-800">{h.action}</p>
            <p className="text-[12px] text-slate-500">
              {h.byName || "System"} · {new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[12px] text-slate-600">{h.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Brand mark (same as the reference design) */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#17191e" />
      <path d="M10.5 8h11.5v4.2h-7.1v3.3h6.1v4.1h-6.1V24h-4.4z" fill="#fff" />
      <rect x="19.2" y="19.6" width="4.4" height="4.4" rx="1.1" fill="#b8571a" />
    </svg>
  );
}

export function BrandName({ dark }: { dark?: boolean }) {
  return (
    <div className="leading-tight">
      <p className={cx("text-[15px] font-extrabold tracking-[-0.02em]", dark ? "text-white" : "text-slate-900")}>Fulchand</p>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Electrical</p>
    </div>
  );
}
