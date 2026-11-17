"use client";
import { amountInWords, stateName } from "./format";

const money = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d = (x: any) => (x ? new Date(x).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

/** Generates a GST tax invoice PDF. `mode` = "save" downloads, "open" returns blob URL for preview. */
export async function invoicePdf(inv: any, mode: "save" | "open" = "save") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const s = inv.settings || {};
  const c = inv.client || {};
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const navy: [number, number, number] = [15, 23, 51];
  const isDraft = inv.status === "draft";
  const isCancelled = inv.status === "cancelled";

  // Header band
  doc.setFillColor(...navy).rect(0, 0, W, 86, "F");
  doc.setFillColor(251, 191, 36).rect(0, 86, W, 3, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(17).text(s.companyName || "Fulchand and Sons Electrical", M, 34);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(203, 213, 225);
  const addr = [s.address, [s.city, stateName(s.stateCode), s.pincode].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  doc.text(doc.splitTextToSize(addr || s.tagline || "", 330), M, 50);
  doc.text([s.phone && `Ph: ${s.phone}`, s.email].filter(Boolean).join("  |  "), M, 74);
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(15).text(isDraft ? "DRAFT INVOICE" : "TAX INVOICE", W - M, 34, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(203, 213, 225);
  doc.text(`GSTIN: ${s.gstin || "-"}`, W - M, 52, { align: "right" });
  doc.text(`PAN: ${s.pan || "-"}`, W - M, 64, { align: "right" });

  // Meta + bill-to boxes
  doc.setTextColor(15, 23, 42);
  let y = 108;
  const half = (W - M * 2) / 2;
  doc.setDrawColor(226, 232, 240).roundedRect(M, y, half - 6, 100, 4, 4).roundedRect(M + half + 6, y, half - 6, 100, 4, 4);

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(100, 116, 139).text("BILL TO", M + 10, y + 16);
  doc.setTextColor(15, 23, 42).setFontSize(10.5).text(doc.splitTextToSize(c.name || "", half - 26), M + 10, y + 31);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  const cAddr = [c.address, [c.city, c.pincode].filter(Boolean).join(" - ")].filter(Boolean).join(", ");
  doc.text(doc.splitTextToSize(cAddr, half - 26).slice(0, 2), M + 10, y + 45);
  doc.text(`GSTIN: ${c.gstin || "Unregistered"}`, M + 10, y + 72);
  doc.text(`State: ${stateName(c.stateCode)} (${c.stateCode || "-"})`, M + 10, y + 85);

  const meta: [string, string][] = [
    ["Invoice No.", inv.invoiceNo || inv.draftRef || "-"],
    ["Invoice Date", d(inv.invoiceDate)],
    ["Bill Type", inv.billType || "Tax Invoice"],
    ["PO Ref.", inv.purchaseOrder ? `${inv.purchaseOrder.clientPoNumber || inv.purchaseOrder.poNumber}${inv.purchaseOrder.poDate ? " dt. " + d(inv.purchaseOrder.poDate) : ""}` : "-"],
    ["Site", inv.site ? inv.site.name : "-"],
    ["Place of Supply", `${stateName(c.stateCode)} (${c.stateCode || "-"})`],
  ];
  meta.forEach(([k, v], i) => {
    const yy = y + 16 + i * 14;
    doc.setFont("helvetica", "normal").setTextColor(100, 116, 139).text(k, M + half + 16, yy);
    doc.setFont("helvetica", "bold").setTextColor(15, 23, 42).text(doc.splitTextToSize(String(v), half - 110)[0], M + half + 96, yy);
  });

  // Items table
  y += 116;
  const inter = inv.interState;
  const head = ["#", "Description", "HSN/SAC", "Qty", "Unit", "Rate", "GST %", "Amount"];
  const body = inv.items.map((it: any, i: number) => [
    i + 1,
    it.description,
    it.hsn || "",
    (Number(it.qty) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 }),
    it.unit || "",
    money(it.rate),
    `${it.gstRate}%`,
    money(it.amount),
  ]);
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 5, lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 45, 137], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 52 },
      3: { cellWidth: 44, halign: "right" },
      4: { cellWidth: 36 },
      5: { cellWidth: 62, halign: "right" },
      6: { cellWidth: 38, halign: "center" },
      7: { cellWidth: 72, halign: "right" },
    },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Totals block
  const rows: [string, string][] = [["Taxable Value", money(inv.subtotal)]];
  if (inter) rows.push(["IGST", money(inv.igst)]);
  else rows.push(["CGST", money(inv.cgst)], ["SGST", money(inv.sgst)]);
  if (inv.roundOff) rows.push(["Round Off", money(inv.roundOff)]);
  const boxW = 220;
  const bx = W - M - boxW;
  if (y + rows.length * 16 + 120 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    y = 40;
  }
  rows.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(71, 85, 105).text(k, bx + 8, y + 12 + i * 16);
    doc.setTextColor(15, 23, 42).text(v, W - M - 8, y + 12 + i * 16, { align: "right" });
  });
  const ty = y + rows.length * 16 + 4;
  doc.setFillColor(...navy).roundedRect(bx, ty, boxW, 24, 3, 3, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(10.5).text("GRAND TOTAL", bx + 8, ty + 16);
  doc.text(`Rs. ${money(inv.total)}`, W - M - 8, ty + 16, { align: "right" });

  // Amount in words + tax summary (left side)
  doc.setTextColor(100, 116, 139).setFont("helvetica", "bold").setFontSize(8).text("AMOUNT IN WORDS", M, y + 12);
  doc.setTextColor(15, 23, 42).setFont("helvetica", "normal").setFontSize(9);
  doc.text(doc.splitTextToSize(amountInWords(inv.total), bx - M - 16), M, y + 26);
  doc.setTextColor(100, 116, 139).setFont("helvetica", "bold").setFontSize(8).text("TAX SUMMARY", M, y + 58);
  doc.setTextColor(15, 23, 42).setFont("helvetica", "normal").setFontSize(8.5);
  doc.text(inter ? `IGST: Rs. ${money(inv.igst)}` : `CGST: Rs. ${money(inv.cgst)}   SGST: Rs. ${money(inv.sgst)}`, M, y + 71);
  doc.text(`Total Tax: Rs. ${money(inv.taxTotal)}`, M, y + 84);

  // Bank + terms + signature
  y = Math.max(ty + 44, y + 100);
  if (y + 130 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    y = 40;
  }
  doc.setDrawColor(226, 232, 240).line(M, y, W - M, y);
  y += 16;
  doc.setTextColor(100, 116, 139).setFont("helvetica", "bold").setFontSize(8).text("BANK DETAILS", M, y);
  doc.setTextColor(15, 23, 42).setFont("helvetica", "normal").setFontSize(8.5);
  [
    `A/c Name: ${s.bankAccountName || s.companyName || "-"}`,
    `Bank: ${s.bankName || "-"}${s.bankBranch ? ", " + s.bankBranch : ""}`,
    `A/c No: ${s.bankAccountNo || "-"}`,
    `IFSC: ${s.bankIfsc || "-"}`,
  ].forEach((t, i) => doc.text(t, M, y + 14 + i * 12));

  doc.setTextColor(100, 116, 139).setFont("helvetica", "bold").setFontSize(8).text("TERMS & CONDITIONS", M + 230, y);
  doc.setTextColor(51, 65, 85).setFont("helvetica", "normal").setFontSize(7.5);
  doc.text(doc.splitTextToSize(s.invoiceTerms || "", 170).slice(0, 7), M + 230, y + 14);

  doc.setTextColor(15, 23, 42).setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(`For ${s.companyName || "Fulchand and Sons Electrical"}`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal").text(s.authorisedSignatory || "Authorised Signatory", W - M, y + 62, { align: "right" });
  doc.setDrawColor(148, 163, 184).line(W - M - 140, y + 50, W - M, y + 50);

  // Footer & watermark
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setFontSize(7).setTextColor(148, 163, 184).text("This is a computer generated invoice.", M, H - 18);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 18, { align: "right" });
    if (isDraft || isCancelled) {
      doc.setTextColor(239, 68, 68).setFontSize(70).setFont("helvetica", "bold");
      (doc as any).saveGraphicsState?.();
      (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.12 }));
      doc.text(isDraft ? "DRAFT" : "CANCELLED", W / 2, H / 2, { align: "center", angle: 30 });
      (doc as any).restoreGraphicsState?.();
    }
  }

  const name = `${(inv.invoiceNo || inv.draftRef || "invoice").replace(/[\\/]/g, "-")}.pdf`;
  if (mode === "save") doc.save(name);
  else window.open(URL.createObjectURL(doc.output("blob")), "_blank");
}
