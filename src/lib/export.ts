"use client";
// Client-side Excel / PDF exports for any tabular report.

export interface Col<T = any> {
  key: string;
  label: string;
  type?: "text" | "money" | "number" | "date";
  value?: (row: T) => any;
  total?: boolean;
}

function cellValue(c: Col, r: any) {
  const v = c.value ? c.value(r) : r[c.key];
  if (c.type === "date") return v ? new Date(v) : null;
  if (c.type === "money" || c.type === "number") return Number(v) || 0;
  return v ?? "";
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function exportExcel(title: string, cols: Col[], rows: any[], filename?: string, subtitle?: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Fulchand Electrical";
  const ws = wb.addWorksheet(title.slice(0, 30).replace(/[\\/*?:[\]]/g, "-"));

  ws.addRow([title]).font = { bold: true, size: 14 };
  if (subtitle) ws.addRow([subtitle]).font = { italic: true, color: { argb: "FF64748B" } };
  ws.addRow([]);
  const head = ws.addRow(cols.map((c) => c.label));
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2D89" } };
    cell.alignment = { vertical: "middle" };
  });
  for (const r of rows) ws.addRow(cols.map((c) => cellValue(c, r)));
  if (cols.some((c) => c.total)) {
    const tr = ws.addRow(cols.map((c, i) => (c.total ? rows.reduce((a, r) => a + (Number(cellValue(c, r)) || 0), 0) : i === 0 ? "TOTAL" : "")));
    tr.font = { bold: true };
  }
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(45, Math.max(c.label.length + 2, c.type === "money" ? 15 : c.type === "date" ? 12 : 14));
    if (c.type === "money") col.numFmt = "#,##,##0.00";
    if (c.type === "date") col.numFmt = "dd-mmm-yyyy";
  });
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), (filename || title) + ".xlsx");
}

const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export async function exportPdf(title: string, cols: Col[], rows: any[], filename?: string, subtitle?: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: cols.length > 7 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  doc.setFontSize(14).setFont("helvetica", "bold").text(title, 40, 40);
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(100);
  doc.text(`Fulchand Electrical · ${subtitle ? subtitle + " · " : ""}Generated ${new Date().toLocaleString("en-IN")}`, 40, 56);
  doc.setTextColor(0);

  const fmt = (c: Col, r: any) => {
    const v = cellValue(c, r);
    if (c.type === "money") return fmtMoney(v);
    if (c.type === "date") return fmtD(v);
    if (c.type === "number") return String(v);
    return String(v ?? "");
  };
  const foot = cols.some((c) => c.total)
    ? [cols.map((c, i) => (c.total ? fmtMoney(rows.reduce((a, r) => a + (Number(cellValue(c, r)) || 0), 0)) : i === 0 ? "TOTAL" : ""))]
    : undefined;

  autoTable(doc, {
    startY: 70,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => fmt(c, r))),
    foot,
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [30, 45, 137] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    columnStyles: Object.fromEntries(cols.map((c, i) => [i, c.type === "money" || c.type === "number" ? { halign: "right" } : {}])),
    margin: { left: 40, right: 40 },
  });
  doc.save((filename || title) + ".pdf");
}

/** Parse the first worksheet of an .xlsx into objects using header row (row 1). */
export async function readExcel(file: File): Promise<Record<string, any>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  });
  const out: Record<string, any>[] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const o: Record<string, any> = {};
    row.eachCell((cell, col) => {
      const h = headers[col];
      if (!h) return;
      let v: any = cell.value;
      if (v && typeof v === "object" && "result" in v) v = (v as any).result;
      if (v && typeof v === "object" && "text" in v) v = (v as any).text;
      o[h] = v;
    });
    if (Object.keys(o).length) out.push(o);
  });
  return out;
}

export async function downloadWorkTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Work Entries");
  ws.addRow(["Site", "Date", "Type", "Description", "Unit", "Qty", "Remarks", "RecordedBy"]).font = { bold: true };
  ws.addRow(["SKY-WRL", new Date(), "Work", "Supply & laying of 4C x 25 sq.mm cable", "Mtr", 120, "", "Site team"]);
  ws.addRow(["SKY-WRL", new Date(), "Material", "MCB 32A SP", "Nos", 24, "", "Site team"]);
  ws.columns.forEach((c, i) => (c.width = [14, 12, 10, 50, 8, 8, 20, 16][i]));
  ws.getColumn(2).numFmt = "dd-mmm-yyyy";
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf]), "work-entry-template.xlsx");
}
