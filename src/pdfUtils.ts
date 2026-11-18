import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { B1, B2, B2_LABELS, BrandEvalData, EvalSession, RatingVal } from "./constants";
import { LOGO_JS } from "./logos";

export function weekNum(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const y = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

export function calcBrandPct(brand: string, b2: Record<string, BrandEvalData>): number | null {
  const items = b2[brand]?.items || {};
  const keys = B2.filter((k) => items[k] !== undefined);
  if (!keys.length) return null;
  const appl = keys.filter((k) => items[k] !== "NA");
  if (!appl.length) return null;
  return (appl.reduce((s, k) => s + Number(items[k]), 0) / (appl.length * 2)) * 100;
}

export function calcB1(b1: Record<string, RatingVal>): number | null {
  const keys = B1.filter((k) => b1[k] !== undefined);
  if (!keys.length) return null;
  const appl = keys.filter((k) => b1[k] !== "NA");
  if (!appl.length) return null;
  return (appl.reduce((s, k) => s + Number(b1[k]), 0) / (appl.length * 2)) * 100;
}

export function calcB2(selBrands: string[], b2: Record<string, BrandEvalData>): number | null {
  const pcts = selBrands
    .map((b) => calcBrandPct(b, b2))
    .filter((p): p is number => p !== null);
  if (!pcts.length) return null;
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

export function badgeCls(pct: number): string {
  return pct >= 75 ? "g" : pct >= 50 ? "y" : "r";
}

export function buildSessionPDF(
  doc: jsPDF,
  sessionState: {
    asesor: string;
    fecha: string;
    evaluador: string;
    b1: Record<string, RatingVal>;
    b2: Record<string, BrandEvalData>;
    selBrands: string[];
    sigAsesor: string;
    sigEvaluador: string;
  },
  allSessions: EvalSession[]
) {
  const W = 297,
    M = 13,
    CW = W - M * 2;
  const PC: [number, number, number] = [26, 26, 26],
    PD: [number, number, number] = [0, 0, 0],
    GR: [number, number, number] = [100, 100, 100],
    LG: [number, number, number] = [245, 245, 245];
  let y = 0;

  doc.setFillColor(...PC);
  doc.rect(0, 0, W, 24, "F");
  try {
    doc.addImage(LOGO_JS, "PNG", M, 2, 28, 20);
  } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("MALVA Department Store — Evaluación de Asesores", M + 32, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Check-list de Desempeño", M + 32, 17);

  const b1 = calcB1(sessionState.b1);
  const b2 = calcB2(sessionState.selBrands, sessionState.b2);
  const final = b1 !== null && b2 !== null ? (b1 + b2) / 2 : b1 !== null ? b1 : b2;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(W - M - 36, 3, 36, 18, 3, 3, "F");
  doc.setTextColor(...PC);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PUNTAJE", W - M - 18, 9, { align: "center" });
  doc.setFontSize(16);
  doc.text(final !== null ? final.toFixed(0) + "%" : "—", W - M - 18, 18, { align: "center" });

  y = 28;
  const d = new Date(sessionState.fecha + "T12:00:00");
  const fd = d.toLocaleDateString("es-CO", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const allSess = allSessions.filter(
    (s) => s.asesor === sessionState.asesor && s.month === sessionState.fecha.substring(0, 7)
  );
  const wk = weekNum(sessionState.fecha);
  const weekSess = allSess.filter((s) => s.week === wk);
  const weekAvg = weekSess.length
    ? weekSess.reduce((a, b) => a + (b.finalScore || 0), 0) / weekSess.length
    : null;
  const monthAvg = allSess.length
    ? allSess.reduce((a, b) => a + (b.finalScore || 0), 0) / allSess.length
    : null;

  doc.setFillColor(...LG);
  doc.roundedRect(M, y, CW, 20, 2, 2, "F");
  doc.setTextColor(...GR);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Asesor(a): ", M + 3, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PD);
  doc.text(sessionState.asesor, M + 20, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  doc.text("Supervisor(a): ", M + 3, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PD);
  doc.text(sessionState.evaluador, M + 26, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  doc.text(
    "Fecha: " + fd + " · Sem " + wk + " · Marcas: " + sessionState.selBrands.length,
    M + CW * 0.42,
    y + 6
  );
  doc.text(
    "Semana " +
      wk +
      ": " +
      (weekAvg !== null ? weekAvg.toFixed(0) + "%" : "—") +
      "  |  Mes acumulado: " +
      (monthAvg !== null ? monthAvg.toFixed(0) + "%" : "—"),
    M + CW * 0.42,
    y + 12
  );
  doc.text(
    "B1: " +
      (b1 !== null ? b1.toFixed(0) + "%" : "—") +
      "   B2: " +
      (b2 !== null ? b2.toFixed(0) + "%" : "—") +
      "   Final: " +
      (final !== null ? final.toFixed(0) + "%" : "—"),
    M + CW * 0.42,
    y + 18
  );
  y += 24;

  const vl = (v?: RatingVal) =>
    v === undefined ? "—" : v === "NA" ? "NA" : v === "0" ? "0-No cumple" : v === "1" ? "1-Parcial" : "2-Cumple";

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PC);
  doc.text("Bloque 1 — Presentación Personal", M, y + 4);
  y += 7;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Criterio", "Calif.", "Criterio", "Calif.", "Criterio", "Calif."]],
    body: [
      [B1[0], vl(sessionState.b1[B1[0]]), B1[2], vl(sessionState.b1[B1[2]]), B1[4], vl(sessionState.b1[B1[4]])],
      [B1[1], vl(sessionState.b1[B1[1]]), B1[3], vl(sessionState.b1[B1[3]]), B1[5], vl(sessionState.b1[B1[5]])]
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: PC, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LG },
    columnStyles: { 1: { cellWidth: 22 }, 3: { cellWidth: 22 }, 5: { cellWidth: 22 } }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (y > 130) {
    doc.addPage();
    y = 14;
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PC);
  doc.text("Bloque 2 — Marcas Evaluadas", M, y + 4);
  y += 7;

  const body2 = sessionState.selBrands.map((b) => {
    const items = sessionState.b2[b]?.items || {};
    const pct = calcBrandPct(b, sessionState.b2);
    return [
      b,
      ...B2.map((k) => (items[k] !== undefined ? (items[k] === "NA" ? "NA" : items[k]) : "—")),
      pct !== null ? pct.toFixed(0) + "%" : "—",
      sessionState.b2[b]?.obs || ""
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Marca", ...B2_LABELS, "%", "Observaciones"]],
    body: body2,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: PC, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LG },
    columnStyles: { 0: { cellWidth: 34 }, 8: { cellWidth: 11 }, 9: { cellWidth: 11 }, 10: { cellWidth: 28 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index >= 1 && d.column.index <= 7) {
        const v = d.cell.raw;
        if (v === "2") {
          d.cell.styles.fillColor = [209, 250, 229];
          d.cell.styles.textColor = [5, 150, 105];
        } else if (v === "1") {
          d.cell.styles.fillColor = [254, 243, 199];
          d.cell.styles.textColor = [180, 120, 0];
        } else if (v === "0") {
          d.cell.styles.fillColor = [254, 226, 226];
          d.cell.styles.textColor = [185, 28, 28];
        } else if (v === "NA") {
          d.cell.styles.textColor = [150, 150, 150];
        }
      }
    }
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (y > 160) {
    doc.addPage();
    y = 14;
  }
  doc.setDrawColor(...PC);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 5;

  const sw = (CW - 12) / 2,
    sh = 28;
  doc.setFillColor(250, 251, 252);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, sw, sh, 2, 2, "FD");
  doc.roundedRect(M + sw + 12, y, sw, sh, 2, 2, "FD");

  try {
    if (sessionState.sigAsesor) doc.addImage(sessionState.sigAsesor, "PNG", M + 1, y + 1, sw - 2, sh - 2);
  } catch {}
  try {
    if (sessionState.sigEvaluador)
      doc.addImage(sessionState.sigEvaluador, "PNG", M + sw + 13, y + 1, sw - 2, sh - 2);
  } catch {}

  y += sh + 3;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  doc.text("Asesor(a): " + sessionState.asesor, M + sw / 2, y, { align: "center" });
  doc.text("Supervisor(a): " + sessionState.evaluador, M + sw + 12 + sw / 2, y, { align: "center" });
  y += 3;
  doc.setFont("helvetica", "italic");
  doc.text("El asesor certifica haber recibido retroalimentación sobre esta evaluación.", M + sw / 2, y, {
    align: "center"
  });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 2000);
}

export function generateMonthlyReportPDF(
  asesorFilter: string,
  month: string,
  allSessions: EvalSession[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    M = 13,
    CW = W - M * 2;
  const PC: [number, number, number] = [26, 26, 26],
    LG: [number, number, number] = [245, 245, 245];

  let sessions = allSessions.filter((s) => s.month === month);
  if (asesorFilter) sessions = sessions.filter((s) => s.asesor === asesorFilter);

  const [y2, mo] = month.split("-");
  const monthName = new Date(Number(y2), Number(mo) - 1, 1).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric"
  });

  doc.setFillColor(...PC);
  doc.rect(0, 0, W, 22, "F");
  try {
    doc.addImage(LOGO_JS, "PNG", M, 2, 22, 16);
  } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MALVA — Reporte Mensual", M + 26, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    monthName.charAt(0).toUpperCase() + monthName.slice(1) + (asesorFilter ? " · " + asesorFilter : ""),
    M + 26,
    17
  );

  let y = 26;
  const brandData: Record<string, number[]> = {};
  sessions.forEach((s) => {
    if (!s.b2Data) return;
    Object.keys(s.b2Data).forEach((brand) => {
      if (!brandData[brand]) brandData[brand] = [];
      const bItems = s.b2Data[brand]?.items || {};
      const keys = B2.filter((k) => bItems[k] !== undefined);
      const appl = keys.filter((k) => bItems[k] !== "NA");
      if (appl.length) {
        const pct = (appl.reduce((sum, k) => sum + Number(bItems[k]), 0) / (appl.length * 2)) * 100;
        brandData[brand].push(pct);
      }
    });
  });

  const b1Scores = sessions.filter((s) => s.b1Score !== null).map((s) => s.b1Score as number);
  const b1Avg = b1Scores.length ? b1Scores.reduce((a, b) => a + b, 0) / b1Scores.length : null;
  const brandAvgs = Object.keys(brandData).map((b) => {
    const arr = brandData[b];
    return arr.reduce((a, v) => a + v, 0) / arr.length;
  });
  const b2Avg = brandAvgs.length ? brandAvgs.reduce((a, b) => a + b, 0) / brandAvgs.length : null;
  const finalAvg = b1Avg !== null && b2Avg !== null ? (b1Avg + b2Avg) / 2 : b1Avg !== null ? b1Avg : b2Avg;

  doc.setFillColor(...PC);
  doc.roundedRect(M, y, CW, 18, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("Presentación: " + (b1Avg !== null ? b1Avg.toFixed(0) + "%" : "—"), M + 4, y + 7);
  doc.text("Jornada: " + (b2Avg !== null ? b2Avg.toFixed(0) + "%" : "—"), M + 4, y + 13);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(finalAvg !== null ? finalAvg.toFixed(0) + "%" : "—", W - M - 4, y + 13, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("PUNTAJE TOTAL MES", W - M - 4, y + 6, { align: "right" });
  y += 22;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PC);
  doc.text("Detalle por Marca — Mes Acumulado", M, y + 4);
  y += 7;

  const brandRows = Object.keys(brandData)
    .sort()
    .map((brand) => {
      const arr = brandData[brand];
      const avg = arr.reduce((a, v) => a + v, 0) / arr.length;
      return [
        brand,
        arr.length.toString(),
        avg.toFixed(0) + "%",
        avg >= 75 ? "Cumple" : avg >= 50 ? "Parcial" : "No Cumple"
      ];
    });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Marca", "Evaluaciones", "Promedio", "Estado"]],
    body: brandRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: PC, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LG },
    columnStyles: {
      1: { cellWidth: 26, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 28, halign: "center" }
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 3) {
        const v = d.cell.raw;
        if (v === "Cumple") {
          d.cell.styles.fillColor = [209, 250, 229];
          d.cell.styles.textColor = [5, 150, 105];
        } else if (v === "Parcial") {
          d.cell.styles.fillColor = [254, 243, 199];
          d.cell.styles.textColor = [180, 120, 0];
        } else {
          d.cell.styles.fillColor = [254, 226, 226];
          d.cell.styles.textColor = [185, 28, 28];
        }
      }
    }
  });

  const blob = doc.output("blob");
  triggerDownload(blob, `MALVA_Reporte_${month}.pdf`);
}

export function generateHistoryPDF(asesor: string, allSessions: EvalSession[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210,
    M = 13,
    CW = W - M * 2;
  const PC: [number, number, number] = [26, 26, 26],
    GR: [number, number, number] = [100, 100, 100],
    LG: [number, number, number] = [245, 245, 245];

  const sessions = allSessions
    .filter((s) => s.asesor === asesor)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const scores = sessions.map((s) => s.finalScore || 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const best = scores.length ? Math.max(...scores) : 0;

  doc.setFillColor(...PC);
  doc.rect(0, 0, W, 24, "F");
  try {
    doc.addImage(LOGO_JS, "PNG", M, 2, 22, 16);
  } catch {}
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MALVA — Historial de Asesor", M + 26, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(asesor, M + 26, 17);

  let y = 28;
  doc.setFillColor(...LG);
  doc.roundedRect(M, y, CW, 18, 2, 2, "F");
  doc.setTextColor(...PC);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Promedio: " + avg.toFixed(0) + "%", M + 4, y + 7);
  doc.text("Mejor: " + best.toFixed(0) + "%", M + CW / 3, y + 7);
  doc.text("Evaluaciones: " + sessions.length, M + (CW * 2) / 3, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  const trend = scores.length >= 2 ? scores[0] - scores[scores.length - 1] : null;
  doc.text(
    "Tendencia general: " +
      (trend === null ? "—" : trend > 0 ? "▲ Mejorando" : trend < 0 ? "▼ Bajando" : "→ Estable"),
    M + 4,
    y + 14
  );
  y += 22;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PC);
  doc.text("Detalle de Sesiones", M, y + 4);
  y += 7;

  const rows = sessions.map((s) => {
    const d = new Date(s.fecha + "T12:00:00");
    const fd = d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
    return [
      fd,
      "Sem " + s.week,
      s.b1Score !== null ? s.b1Score.toFixed(0) + "%" : "—",
      s.b2Score !== null ? s.b2Score.toFixed(0) + "%" : "—",
      s.finalScore !== null ? s.finalScore.toFixed(0) + "%" : "—",
      (s.selBrands?.length || 0) + " marcas"
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Fecha", "Semana", "Presentación", "Jornada", "Final", "Marcas"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PC, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: LG },
    columnStyles: { 4: { fontStyle: "bold" } }
  });

  const blob = doc.output("blob");
  triggerDownload(blob, `MALVA_Historial_${asesor.replace(/\s+/g, "_")}.pdf`);
}
