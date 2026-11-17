"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Search } from "lucide-react";
import { exportExcel, exportPdf, type Col } from "@/lib/export";
import { fmtDate, inr, num } from "@/lib/format";
import { Button, Empty, cx } from "./ui";

export type Column<T = any> = Col<T> & {
  render?: (row: T) => React.ReactNode;
  className?: string;
  hideOnExport?: boolean;
};

function display(c: Column, r: any) {
  if (c.render) return c.render(r);
  const v = c.value ? c.value(r) : r[c.key];
  if (c.type === "money") return inr(v);
  if (c.type === "date") return fmtDate(v);
  if (c.type === "number") return num(v);
  return v === "" || v === undefined || v === null ? <span className="text-slate-300">—</span> : v;
}

const PAGE = 25;

export function DataTable<T = any>({
  columns,
  rows,
  title,
  subtitle,
  search = true,
  exportable = true,
  onRowClick,
  emptyText,
  toolbar,
}: {
  columns: Column<T>[];
  rows: T[];
  title?: string;
  subtitle?: string;
  search?: boolean;
  exportable?: boolean;
  onRowClick?: (r: T) => void;
  emptyText?: string;
  toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.value ? c.value(r) : (r as any)[c.key];
        return v !== undefined && v !== null && String(v).toLowerCase().includes(s);
      })
    );
  }, [rows, q, columns]);

  useEffect(() => setPage(0), [q, rows]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const exportCols = columns.filter((c) => !c.hideOnExport);
  const hasTotals = columns.some((c) => c.total);
  const totals = (c: Column) => filtered.reduce((a, r) => a + (Number(c.value ? c.value(r) : (r as any)[c.key]) || 0), 0);
  const isNum = (c: Column) => c.type === "money" || c.type === "number";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
      {(search || exportable || toolbar) && (
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {search && (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
            {toolbar}
          </div>
          {exportable && filtered.length > 0 && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="text-emerald-600" />} onClick={() => exportExcel(title || "Report", exportCols, filtered, undefined, subtitle)}>
                Excel
              </Button>
              <Button variant="secondary" size="sm" icon={<FileText className="text-red-600" />} onClick={() => exportPdf(title || "Report", exportCols, filtered, undefined, subtitle)}>
                PDF
              </Button>
            </div>
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty title={emptyText || (q ? "No matching records" : "No records found")}>{q ? "Try a different search term." : undefined}</Empty>
      ) : (
        <>
          <div className="max-h-[68vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={cx(isNum(c) && "text-right", c.className)}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r: any, i) => (
                  <tr key={r._id || i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? "cursor-pointer" : undefined}>
                    {columns.map((c, ci) => (
                      <td key={c.key} className={cx(isNum(c) && "num", ci === 0 && "font-medium text-slate-900", c.className)}>
                        {display(c, r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {hasTotals && (
                <tfoot>
                  <tr>
                    {columns.map((c, i) => (
                      <td key={c.key} className={cx(isNum(c) && "num")}>
                        {c.total ? (c.type === "money" ? inr(totals(c)) : num(totals(c))) : i === 0 ? "Total" : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-[12.5px] text-slate-500">
            <span>
              Showing <b className="font-medium text-slate-700">{page * PAGE + 1}</b>–<b className="font-medium text-slate-700">{Math.min(filtered.length, (page + 1) * PAGE)}</b> of{" "}
              <b className="font-medium text-slate-700">{filtered.length}</b>
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md p-1.5 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page">
                  <ChevronLeft className="size-4" />
                </button>
                <span className="px-2">
                  Page {page + 1} of {pages}
                </span>
                <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-md p-1.5 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40" aria-label="Next page">
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
