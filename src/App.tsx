import React, { useState, useEffect, useRef, useMemo } from "react";
import jsPDF from "jspdf";
import {
  ASESORES,
  B1,
  B2,
  B2_LABELS,
  BrandEvalData,
  EvalSession,
  RatingVal
} from "./constants";
import { HD_LOGO, LOGO_JS } from "./logos";
import {
  fetchSessionsFromFirebase,
  saveSessionToFirebase,
  deleteSessionFromFirebase
} from "./firebase";
import {
  weekNum,
  calcB1,
  calcB2,
  calcBrandPct,
  badgeCls,
  buildSessionPDF,
  triggerDownload,
  generateMonthlyReportPDF,
  generateHistoryPDF
} from "./pdfUtils";
import { SignaturePad, SignaturePadHandle } from "./SignaturePad";
import { HistoryChart } from "./HistoryChart";

type ScreenId = "home" | "select" | "eval" | "report" | "view" | "hist-list" | "hist";
type SyncState = "syncing" | "ok" | "error";

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [syncState, setSyncState] = useState<SyncState>("syncing");
  const [sessions, setSessions] = useState<EvalSession[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("malva_sessions") || "[]");
    } catch {
      return [];
    }
  });

  // Home form state
  const [evaluador, setEvaluador] = useState("JENNY DAO");
  const [asesorSel, setAsesorSel] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);

  // Active Evaluation Session State
  const [curAsesor, setCurAsesor] = useState("");
  const [curFecha, setCurFecha] = useState("");
  const [curEvaluador, setCurEvaluador] = useState("");
  const [selBrands, setSelBrands] = useState<string[]>([]);
  const [b1Data, setB1Data] = useState<Record<string, RatingVal>>({});
  const [b2Data, setB2Data] = useState<Record<string, BrandEvalData>>({});
  const [openBrandIdxs, setOpenBrandIdxs] = useState<Record<number, boolean>>({});

  // Search filters
  const [selSearch, setSelSearch] = useState("");
  const [evalSearch, setEvalSearch] = useState("");
  const [viewSearch, setViewSearch] = useState("");

  // View saved session state
  const [viewSess, setViewSess] = useState<EvalSession | null>(null);
  const [openViewBrands, setOpenViewBrands] = useState<Record<number, boolean>>({});

  // Report filters
  const [repAsesor, setRepAsesor] = useState("");
  const [repMes, setRepMes] = useState("");

  // History filters & selection
  const [histMesFilter, setHistMesFilter] = useState("");
  const [currentHistAsesor, setCurrentHistAsesor] = useState("");

  // Confirm delete modal
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // Signature refs
  const sigAsesorRef = useRef<SignaturePadHandle | null>(null);
  const sigEvalRef = useRef<SignaturePadHandle | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  useEffect(() => {
    let mounted = true;
    setSyncState("syncing");
    fetchSessionsFromFirebase().then(({ sessions: loaded, synced }) => {
      if (!mounted) return;
      setSessions(loaded);
      setSyncState(synced ? "ok" : "error");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const changeScreen = (next: ScreenId) => {
    setScreen(next);
    window.scrollTo(0, 0);
  };

  const volverInicio = () => {
    changeScreen("home");
  };

  // Start brand selection
  const goSelect = () => {
    if (!asesorSel) {
      showToast("⚠️ Selecciona un asesor.");
      return;
    }
    if (!fecha) {
      showToast("⚠️ Indica la fecha.");
      return;
    }
    if (!evaluador.trim()) {
      showToast("⚠️ Indica el supervisor.");
      return;
    }
    setCurAsesor(asesorSel);
    setCurFecha(fecha);
    setCurEvaluador(evaluador.trim());
    setSelBrands([]);
    setB1Data({});
    setB2Data({});
    setSelSearch("");
    changeScreen("select");
  };

  const toggleSelBrand = (brand: string) => {
    setSelBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const selAll = () => {
    setSelBrands([...(ASESORES[curAsesor] || [])]);
  };

  const selNone = () => {
    setSelBrands([]);
  };

  const goEval = () => {
    if (!selBrands.length) {
      showToast("⚠️ Selecciona al menos una marca.");
      return;
    }
    const initialB2: Record<string, BrandEvalData> = {};
    selBrands.forEach((b) => {
      initialB2[b] = { items: {}, obs: "" };
    });
    setB2Data(initialB2);
    setB1Data({});
    setOpenBrandIdxs({});
    setEvalSearch("");
    changeScreen("eval");
  };

  const handleToggleB1 = (key: string, val: RatingVal) => {
    setB1Data((prev) => {
      const next = { ...prev };
      if (next[key] === val) delete next[key];
      else next[key] = val;
      return next;
    });
  };

  const handleToggleB2 = (brand: string, key: string, val: RatingVal) => {
    setB2Data((prev) => {
      const curBrand = prev[brand] || { items: {}, obs: "" };
      const nextItems = { ...curBrand.items };
      if (nextItems[key] === val) delete nextItems[key];
      else nextItems[key] = val;
      return {
        ...prev,
        [brand]: { ...curBrand, items: nextItems }
      };
    });
  };

  const handleObsChange = (brand: string, obs: string) => {
    setB2Data((prev) => ({
      ...prev,
      [brand]: { ...(prev[brand] || { items: {}, obs: "" }), obs }
    }));
  };

  const b1Score = useMemo(() => calcB1(b1Data), [b1Data]);
  const b2Score = useMemo(() => calcB2(selBrands, b2Data), [selBrands, b2Data]);
  const finalScore = useMemo(
    () =>
      b1Score !== null && b2Score !== null
        ? (b1Score + b2Score) / 2
        : b1Score !== null
        ? b1Score
        : b2Score,
    [b1Score, b2Score]
  );

  const b1EvalCount = useMemo(
    () => B1.filter((k) => b1Data[k] !== undefined).length,
    [b1Data]
  );
  const b2EvalCount = useMemo(
    () => selBrands.filter((b) => Object.keys(b2Data[b]?.items || {}).length > 0).length,
    [selBrands, b2Data]
  );

  // Summary bar calculations for current evaluation
  const evalSummary = useMemo(() => {
    if (!curAsesor || !curFecha) return null;
    const asesorSessions = sessions.filter((s) => s.asesor === curAsesor);
    const currentWeek = weekNum(curFecha);
    const currentMonth = curFecha.substring(0, 7);
    const weekSess = asesorSessions.filter(
      (s) => s.week === currentWeek && s.month === currentMonth
    );
    const monthSess = asesorSessions.filter((s) => s.month === currentMonth);
    const weekAvg = weekSess.length
      ? weekSess.reduce((a, b) => a + (b.finalScore || 0), 0) / weekSess.length
      : null;
    const monthAvg = monthSess.length
      ? monthSess.reduce((a, b) => a + (b.finalScore || 0), 0) / monthSess.length
      : null;
    const d = new Date(curFecha + "T12:00:00");
    const mesNombre = d.toLocaleDateString("es-CO", { month: "long" });
    return {
      currentWeek,
      weekText: weekSess.length
        ? `${weekAvg!.toFixed(0)}% (${weekSess.length} ses.)`
        : "Sin sesiones previas",
      monthText: monthSess.length ? `${monthAvg!.toFixed(0)}% · ${mesNombre}` : "Sin datos"
    };
  }, [curAsesor, curFecha, sessions]);

  const guardarSesion = async () => {
    const sigAsesor = sigAsesorRef.current?.capture() || "";
    const sigEvaluador = sigEvalRef.current?.capture() || "";
    const newSession: EvalSession = {
      id: Date.now(),
      asesor: curAsesor,
      fecha: curFecha,
      evaluador: curEvaluador,
      b1Score,
      b2Score,
      finalScore,
      b1Data: { ...b1Data },
      b2Data: Object.fromEntries(
        selBrands.map((b) => [
          b,
          { items: { ...(b2Data[b]?.items || {}) }, obs: b2Data[b]?.obs || "" }
        ])
      ),
      selBrands: [...selBrands],
      week: weekNum(curFecha),
      month: curFecha.substring(0, 7),
      sigAsesor,
      sigEvaluador
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem("malva_sessions", JSON.stringify(updated));

    setSyncState("syncing");
    const synced = await saveSessionToFirebase(newSession);
    setSyncState(synced ? "ok" : "error");
    if (synced) {
      localStorage.setItem("malva_sessions", JSON.stringify(updated));
    }
    showToast(synced ? "✅ Guardada y sincronizada" : "⚠️ Guardada localmente (sin conexión)");
    setTimeout(() => {
      volverInicio();
    }, 1300);
  };

  const handleExportPDF = (savedSess: EvalSession | null) => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const stateToExport = savedSess
        ? {
            asesor: savedSess.asesor,
            fecha: savedSess.fecha,
            evaluador: savedSess.evaluador,
            b1: savedSess.b1Data || {},
            b2: savedSess.b2Data || {},
            selBrands: savedSess.selBrands || [],
            sigAsesor: savedSess.sigAsesor || "",
            sigEvaluador: savedSess.sigEvaluador || ""
          }
        : {
            asesor: curAsesor,
            fecha: curFecha,
            evaluador: curEvaluador,
            b1: b1Data,
            b2: b2Data,
            selBrands,
            sigAsesor: sigAsesorRef.current?.capture() || "",
            sigEvaluador: sigEvalRef.current?.capture() || ""
          };
      buildSessionPDF(doc, stateToExport, sessions);
      const blob = doc.output("blob");
      triggerDownload(
        blob,
        `MALVA_Eval_${stateToExport.asesor.replace(/\s+/g, "_")}_${stateToExport.fecha}.pdf`
      );
    } catch (e: unknown) {
      showToast("Error PDF: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleCompartirWA = async (savedSess: EvalSession | null) => {
    const stateToShare = savedSess
      ? {
          asesor: savedSess.asesor,
          fecha: savedSess.fecha,
          evaluador: savedSess.evaluador,
          b1: savedSess.b1Data || {},
          b2: savedSess.b2Data || {},
          selBrands: savedSess.selBrands || [],
          sigAsesor: savedSess.sigAsesor || "",
          sigEvaluador: savedSess.sigEvaluador || ""
        }
      : {
          asesor: curAsesor,
          fecha: curFecha,
          evaluador: curEvaluador,
          b1: b1Data,
          b2: b2Data,
          selBrands,
          sigAsesor: sigAsesorRef.current?.capture() || "",
          sigEvaluador: sigEvalRef.current?.capture() || ""
        };

    const b1 = calcB1(stateToShare.b1);
    const b2 = calcB2(stateToShare.selBrands, stateToShare.b2);
    const final = b1 !== null && b2 !== null ? (b1 + b2) / 2 : b1 !== null ? b1 : b2;
    const finalStr = final !== null ? final.toFixed(0) + "%" : "—";
    const d = new Date(stateToShare.fecha + "T12:00:00");
    const fd = d.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const marcasEv = stateToShare.selBrands.filter(
      (b) => Object.keys(stateToShare.b2[b]?.items || {}).length > 0
    );

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      buildSessionPDF(doc, stateToShare, sessions);
      const blob = doc.output("blob");
      const file = new File(
        [blob],
        `MALVA_Eval_${stateToShare.asesor.replace(/\s+/g, "_")}_${stateToShare.fecha}.pdf`,
        { type: "application/pdf" }
      );
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Evaluación MALVA — " + stateToShare.asesor,
          text: `Evaluación MALVA · ${stateToShare.asesor} · ${fd}\nPuntaje: ${finalStr}`
        });
        return;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
    }

    const text =
      "🏪 *MALVA Department Store*\n📋 *Evaluación de Asesor*\n\n👤 Asesor: *" +
      stateToShare.asesor +
      "*\n📅 Fecha: " +
      fd +
      " · Sem " +
      weekNum(stateToShare.fecha) +
      "\n👮 Supervisor: " +
      stateToShare.evaluador +
      "\n\n📊 *Resultados:*\n🧍 Presentación: " +
      (b1 !== null ? b1.toFixed(0) + "%" : "—") +
      "\n📦 Jornada (" +
      marcasEv.length +
      " marcas): " +
      (b2 !== null ? b2.toFixed(0) + "%" : "—") +
      "\n⭐ *Puntaje Final: " +
      finalStr +
      "*\n\n_Evaluación generada en MALVA Check-list_";

    const a = document.createElement("a");
    a.href = "https://wa.me/?text=" + encodeURIComponent(text);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const viewSavedSession = (sess: EvalSession) => {
    setViewSess(sess);
    setOpenViewBrands({});
    setViewSearch("");
    changeScreen("view");
  };

  const goReport = () => {
    const meses = [...new Set(sessions.map((s) => s.month))].sort().reverse();
    setRepAsesor("");
    setRepMes(meses[0] || new Date().toISOString().substring(0, 7));
    changeScreen("report");
  };

  const goHistorial = () => {
    setHistMesFilter("");
    changeScreen("hist-list");
  };

  const openHist = (asesor: string) => {
    setCurrentHistAsesor(asesor);
    changeScreen("hist");
  };

  const executeDeleteSession = async (id: number) => {
    const target = sessions.find((s) => s.id === id);
    setConfirmDeleteId(null);
    if (!target) return;

    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    localStorage.setItem("malva_sessions", JSON.stringify(updated));

    setSyncState("syncing");
    const ok = await deleteSessionFromFirebase(target);
    setSyncState(ok ? "ok" : "error");
    showToast("🗑 Evaluación eliminada");

    if (screen === "hist") {
      const remaining = updated.filter((s) => s.asesor === currentHistAsesor);
      if (!remaining.length) {
        volverInicio();
      }
    }
  };

  // Current month preview on Home
  const currentMonthPreview = useMemo(() => {
    const month = new Date().toISOString().substring(0, 7);
    const byA: Record<string, EvalSession[]> = {};
    sessions
      .filter((s) => s.month === month)
      .forEach((s) => {
        if (!byA[s.asesor]) byA[s.asesor] = [];
        byA[s.asesor].push(s);
      });
    return Object.keys(byA)
      .sort()
      .map((a) => {
        const arr = byA[a];
        const avg = arr.reduce((sum, x) => sum + (x.finalScore || 0), 0) / arr.length;
        return { asesor: a, count: arr.length, avg };
      });
  }, [sessions]);

  // Report data
  const reportData = useMemo(() => {
    let filtered = sessions.filter((s) => s.month === repMes);
    if (repAsesor) filtered = filtered.filter((s) => s.asesor === repAsesor);
    if (!filtered.length) return null;

    const byWeek: Record<number, EvalSession[]> = {};
    filtered.forEach((s) => {
      if (!byWeek[s.week]) byWeek[s.week] = [];
      byWeek[s.week].push(s);
    });

    const brandData: Record<string, number[]> = {};
    filtered.forEach((s) => {
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

    const b1Scores = filtered.filter((s) => s.b1Score !== null).map((s) => s.b1Score as number);
    const b1Avg = b1Scores.length ? b1Scores.reduce((a, b) => a + b, 0) / b1Scores.length : null;
    const brandAvgs = Object.keys(brandData).map((b) => {
      const arr = brandData[b];
      return arr.reduce((a, v) => a + v, 0) / arr.length;
    });
    const b2Avg = brandAvgs.length ? brandAvgs.reduce((a, b) => a + b, 0) / brandAvgs.length : null;
    const finalAvg =
      b1Avg !== null && b2Avg !== null ? (b1Avg + b2Avg) / 2 : b1Avg !== null ? b1Avg : b2Avg;

    return {
      byWeek,
      brandData,
      b1Avg,
      b2Avg,
      finalAvg
    };
  }, [sessions, repMes, repAsesor]);

  // Historial list data
  const histListGroups = useMemo(() => {
    let filtered = sessions;
    if (histMesFilter) filtered = filtered.filter((s) => s.month === histMesFilter);
    const byA: Record<string, { nombre: string; evals: EvalSession[] }> = {};
    filtered.forEach((s) => {
      const key = s.asesor.trim().toLowerCase();
      if (!byA[key]) byA[key] = { nombre: s.asesor.trim(), evals: [] };
      byA[key].evals.push(s);
    });
    return Object.values(byA)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((item) => {
        const evals = [...item.evals].sort((a, b) => b.fecha.localeCompare(a.fecha));
        const scores = evals.map((e) => e.finalScore || 0);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const trend = scores.length >= 2 ? scores[0] - scores[1] : null;
        const lastDate = new Date(evals[0].fecha + "T12:00:00").toLocaleDateString("es-CO", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
        return {
          nombre: item.nombre,
          count: evals.length,
          avg,
          trend,
          lastDate
        };
      });
  }, [sessions, histMesFilter]);

  // Single Asesor History
  const singleAsesorHist = useMemo(() => {
    const list = sessions
      .filter((s) => s.asesor === currentHistAsesor)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!list.length) return null;
    const scores = list.map((s) => s.finalScore || 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = Math.max(...scores);
    const trend = scores.length >= 2 ? scores[0] - scores[1] : null;
    return { list, avg, best, trend };
  }, [sessions, currentHistAsesor]);

  const availableMonths = useMemo(
    () => [...new Set(sessions.map((s) => s.month))].sort().reverse(),
    [sessions]
  );

  const availableAsesoresInSessions = useMemo(
    () => [...new Set(sessions.map((s) => s.asesor))].sort(),
    [sessions]
  );

  const formatMonthLabel = (m: string) => {
    const [y2, mo] = m.split("-");
    const name = new Date(Number(y2), Number(mo) - 1, 1).toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric"
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <div>
      {/* HEADER */}
      <div className="hd">
        <div className="hd-inner">
          <img className="hd-logo" src={HD_LOGO} alt="MALVA" />
          <div className="hd-info">
            <h1>
              Evaluación de Asesores{" "}
              <span
                className="sync-dot"
                style={{
                  background:
                    syncState === "ok"
                      ? "#10B981"
                      : syncState === "error"
                      ? "#EF4444"
                      : "#F59E0B"
                }}
                title={
                  syncState === "ok"
                    ? "Firebase OK"
                    : syncState === "error"
                    ? "Sin conexión"
                    : "Sincronizando..."
                }
              />
            </h1>
            <p>MALVA Department Store</p>
          </div>
          {["eval", "select", "view"].includes(screen) && (
            <button className="hd-back" onClick={volverInicio}>
              ← Cambiar
              <br />
              asesor
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY BAR (shown during eval) */}
      {screen === "eval" && evalSummary && (
        <div className="sum-bar">
          <div className="sum-pill week">
            📅 <span>Semana {evalSummary.currentWeek}</span>:{" "}
            <strong>{evalSummary.weekText}</strong>
          </div>
          <div className="sum-pill month">
            📊 Mes acumulado: <strong>{evalSummary.monthText}</strong>
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "var(--TXL)",
              flex: 1,
              textAlign: "right"
            }}
          >
            {curAsesor}
          </div>
        </div>
      )}

      {/* ══ HOME ══ */}
      {screen === "home" && (
        <div className="main">
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <img src={LOGO_JS} style={{ height: "80px", width: "auto", margin: "0 auto" }} alt="MALVA" />
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "3px",
                color: "var(--TXL)",
                marginTop: "4px",
                textTransform: "uppercase"
              }}
            >
              Department Store
            </div>
          </div>

          <div className="card">
            <div className="ct">⚙️ Nueva Sesión</div>
            <div className="fl">
              <label>Supervisor(a)</label>
              <input
                type="text"
                value={evaluador}
                onChange={(e) => setEvaluador(e.target.value)}
              />
            </div>
            <div className="row2">
              <div className="fl">
                <label>Asesor(a)</label>
                <select value={asesorSel} onChange={(e) => setAsesorSel(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {Object.keys(ASESORES)
                    .sort()
                    .map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                </select>
              </div>
              <div className="fl">
                <label>Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>
            <button className="btn btn-p" onClick={goSelect}>
              Seleccionar Marcas →
            </button>
          </div>

          {sessions.length > 0 && (
            <div className="card">
              <div className="ct">📊 Resumen del Mes Actual</div>
              <div>
                {currentMonthPreview.length > 0 ? (
                  currentMonthPreview.map((item) => (
                    <div key={item.asesor} className="rep-row">
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{item.asesor}</div>
                        <div className="rep-week">{item.count} sesión(es) este mes</div>
                      </div>
                      <span
                        className={`badge ${badgeCls(item.avg)}`}
                        style={{ fontSize: "14px", padding: "4px 10px" }}
                      >
                        {item.avg.toFixed(0)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty">Sin evaluaciones este mes.</div>
                )}
              </div>
              <button
                className="btn btn-rep"
                onClick={goReport}
                style={{ marginTop: "8px" }}
              >
                Ver Reporte Completo →
              </button>
            </div>
          )}

          <div className="card">
            <div className="ct">📋 Historial</div>
            <button
              className="btn btn-p"
              onClick={goHistorial}
              style={{ marginBottom: 0 }}
            >
              Ver Historial de Asesores →
            </button>
          </div>
        </div>
      )}

      {/* ══ SELECT BRANDS ══ */}
      {screen === "select" && (
        <div className="main">
          <div className="card">
            <div className="ct">🏪 Marcas a Visitar Hoy</div>
            <p style={{ fontSize: "12px", color: "var(--TXL)", marginBottom: "10px" }}>
              Solo se evaluarán las marcas seleccionadas.
            </p>
            <div className="sel-bar">
              <span>{selBrands.length} seleccionadas</span>
              <div>
                <button type="button" onClick={selAll}>
                  Todas
                </button>
                <button type="button" onClick={selNone} style={{ marginLeft: "6px" }}>
                  Ninguna
                </button>
              </div>
            </div>
            <div className="srch">
              <span className="srch-ico">🔍</span>
              <input
                type="text"
                placeholder="Buscar marca…"
                value={selSearch}
                onChange={(e) => setSelSearch(e.target.value)}
              />
            </div>
            <div>
              {(ASESORES[curAsesor] || []).map((b) => {
                if (selSearch && !b.toLowerCase().includes(selSearch.toLowerCase())) {
                  return null;
                }
                const isSelected = selBrands.includes(b);
                return (
                  <div
                    key={b}
                    className={`chk-item ${isSelected ? "sel" : ""}`}
                    onClick={() => toggleSelBrand(b)}
                  >
                    <div className="chk-box">{isSelected ? "✓" : ""}</div>
                    <span className="chk-name">{b}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button className="btn btn-p" onClick={goEval}>
            Iniciar Evaluación →
          </button>
        </div>
      )}

      {/* ══ EVAL ══ */}
      {screen === "eval" && (
        <div>
          <div className="sb">
            <div className="sbi">
              <div className="v">{b1Score !== null ? b1Score.toFixed(0) + "%" : "—"}</div>
              <div className="l">Presentación</div>
            </div>
            <div className="sbi">
              <div className="v">{b2Score !== null ? b2Score.toFixed(0) + "%" : "—"}</div>
              <div className="l">Jornada</div>
            </div>
            <div className="sbi fin">
              <div className="v">{finalScore !== null ? finalScore.toFixed(0) + "%" : "—"}</div>
              <div className="l">⭐ Final</div>
            </div>
          </div>

          <div className="main">
            <div className="card">
              <div className="ct">👤 Sesión</div>
              <div className="ig">
                <div>
                  <div className="ik">Asesor(a)</div>
                  <div className="iv">{curAsesor}</div>
                </div>
                <div>
                  <div className="ik">Supervisor(a)</div>
                  <div className="iv">{curEvaluador}</div>
                </div>
                <div className="full">
                  <div className="ik">Fecha · Semana {weekNum(curFecha)}</div>
                  <div className="iv">
                    {new Date(curFecha + "T12:00:00").toLocaleDateString("es-CO", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </div>
                </div>
                <div className="full">
                  <div className="ik">Marcas seleccionadas</div>
                  <div className="iv">{selBrands.length} marcas</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="ct">
                🧍 Bloque 1 — Presentación Personal{" "}
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: "10px",
                    color: "var(--TXL)",
                    marginLeft: "4px"
                  }}
                >
                  (50%)
                </span>
              </div>
              <div className="legend">
                <div className="leg-item">
                  <div className="leg-dot" style={{ background: "var(--R)" }} />
                  0=No cumple
                </div>
                <div className="leg-item">
                  <div className="leg-dot" style={{ background: "var(--Y)" }} />
                  1=Parcial
                </div>
                <div className="leg-item">
                  <div className="leg-dot" style={{ background: "var(--G)" }} />
                  2=Total
                </div>
                <div className="leg-item">
                  <div className="leg-dot" style={{ background: "var(--GR)" }} />
                  NA
                </div>
              </div>
              <div className="prog">
                <span>
                  {b1EvalCount} / {B1.length}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {b1Score !== null ? b1Score.toFixed(0) + "%" : ""}
                </span>
              </div>
              <div className="prog-bar">
                <div
                  className="prog-fill"
                  style={{ width: `${(b1EvalCount / B1.length) * 100}%` }}
                />
              </div>
              <div>
                {B1.map((item) => {
                  const curVal = b1Data[item];
                  return (
                    <div key={item} className="er">
                      <span className="el">{item}</span>
                      <div className="tg">
                        {(["0", "1", "2", "NA"] as RatingVal[]).map((v) => {
                          const activeCls =
                            curVal === v ? (v === "NA" ? "ana" : `a${v}`) : "";
                          return (
                            <button
                              key={v}
                              type="button"
                              className={`tb ${activeCls}`}
                              onClick={() => handleToggleB1(item, v)}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="ct">
                📦 Bloque 2 — Marcas{" "}
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: "10px",
                    color: "var(--TXL)",
                    marginLeft: "4px"
                  }}
                >
                  (50%)
                </span>
              </div>
              <div className="prog">
                <span>
                  {b2EvalCount} / {selBrands.length} marcas
                </span>
                <span style={{ fontWeight: 700 }}>
                  {b2Score !== null ? b2Score.toFixed(0) + "%" : ""}
                </span>
              </div>
              <div className="prog-bar">
                <div
                  className="prog-fill"
                  style={{
                    width: `${selBrands.length ? (b2EvalCount / selBrands.length) * 100 : 0}%`
                  }}
                />
              </div>
              <div className="srch">
                <span className="srch-ico">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar marca…"
                  value={evalSearch}
                  onChange={(e) => setEvalSearch(e.target.value)}
                />
              </div>
              <div>
                {selBrands.map((brand, idx) => {
                  if (evalSearch && !brand.toLowerCase().includes(evalSearch.toLowerCase())) {
                    return null;
                  }
                  const bItems = b2Data[brand]?.items || {};
                  const touched = Object.keys(bItems).length > 0;
                  const pct = calcBrandPct(brand, b2Data);
                  const isOpen = !!openBrandIdxs[idx];

                  return (
                    <div key={brand} className={`bi ${touched ? "touched" : ""}`}>
                      <div
                        className="bh"
                        onClick={() =>
                          setOpenBrandIdxs((prev) => ({ ...prev, [idx]: !prev[idx] }))
                        }
                      >
                        <span className="bn">{brand}</span>
                        <div className="bb">
                          {pct !== null && (
                            <span className={`badge ${badgeCls(pct)}`}>
                              {pct.toFixed(0)}%
                            </span>
                          )}
                          <span className={`chev ${isOpen ? "op" : ""}`}>▼</span>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="bd">
                          {B2.map((item, ki) => {
                            const curVal = bItems[item];
                            return (
                              <div key={item} className="er">
                                <span className="el">{B2_LABELS[ki]}</span>
                                <div className="tg">
                                  {(["0", "1", "2", "NA"] as RatingVal[]).map((v) => {
                                    const activeCls =
                                      curVal === v ? (v === "NA" ? "ana" : `a${v}`) : "";
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        className={`tb ${activeCls}`}
                                        onClick={() => handleToggleB2(brand, item, v)}
                                      >
                                        {v}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div style={{ marginTop: "8px" }}>
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "var(--TXL)",
                                textTransform: "uppercase",
                                letterSpacing: "0.4px",
                                marginBottom: "3px"
                              }}
                            >
                              Observaciones
                            </div>
                            <div className="fl" style={{ marginBottom: 0 }}>
                              <textarea
                                placeholder="Observaciones…"
                                value={b2Data[brand]?.obs || ""}
                                onChange={(e) => handleObsChange(brand, e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="ct">✍️ Firmas</div>
              <div className="sig-grid">
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                    Asesor(a): <span style={{ color: "var(--P)" }}>{curAsesor}</span>
                  </div>
                  <SignaturePad ref={sigAsesorRef} />
                  <div className="sig-legend">Certifica haber recibido retroalimentación.</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                    Supervisor(a): <span style={{ color: "var(--P)" }}>{curEvaluador}</span>
                  </div>
                  <SignaturePad ref={sigEvalRef} />
                  <div className="sig-legend">Supervisor confirma la evaluación.</div>
                </div>
              </div>
            </div>

            <button className="btn btn-p" onClick={guardarSesion}>
              💾 Guardar Evaluación
            </button>
            <button className="btn btn-pdf" onClick={() => handleExportPDF(null)}>
              📄 Exportar PDF
            </button>
            <button className="btn btn-wa" onClick={() => handleCompartirWA(null)}>
              💬 Enviar por WhatsApp
            </button>
            <button className="btn btn-s" onClick={volverInicio}>
              ↩ Volver sin guardar
            </button>
            <div style={{ height: "20px" }} />
          </div>
        </div>
      )}

      {/* ══ VIEW PAST SESSION ══ */}
      {screen === "view" && viewSess && (
        <div className="main" style={{ paddingTop: "14px" }}>
          <div className="card">
            <div className="ct">👁️ Evaluación Guardada</div>
            {(() => {
              const d = new Date(viewSess.fecha + "T12:00:00");
              const fd = d.toLocaleDateString("es-CO", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              });
              const fs =
                viewSess.finalScore !== null ? viewSess.finalScore.toFixed(0) + "%" : "—";
              const cls = badgeCls(viewSess.finalScore || 0);
              const allSess = sessions.filter(
                (s) => s.asesor === viewSess.asesor && s.month === viewSess.month
              );
              const weekSess = allSess.filter((s) => s.week === viewSess.week);
              const weekAvg = weekSess.length
                ? weekSess.reduce((a, b) => a + (b.finalScore || 0), 0) / weekSess.length
                : null;
              const monthAvg = allSess.length
                ? allSess.reduce((a, b) => a + (b.finalScore || 0), 0) / allSess.length
                : null;
              const mesNombre = d.toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric"
              });

              return (
                <>
                  <div className="ig">
                    <div>
                      <div className="ik">Asesor(a)</div>
                      <div className="iv">{viewSess.asesor}</div>
                    </div>
                    <div>
                      <div className="ik">Supervisor(a)</div>
                      <div className="iv">{viewSess.evaluador}</div>
                    </div>
                    <div className="full">
                      <div className="ik">Fecha · Semana {viewSess.week}</div>
                      <div className="iv">{fd}</div>
                    </div>
                    <div>
                      <div className="ik">B1 Presentación</div>
                      <div className="iv">
                        {viewSess.b1Score !== null ? viewSess.b1Score.toFixed(0) + "%" : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="ik">B2 Jornada</div>
                      <div className="iv">
                        {viewSess.b2Score !== null ? viewSess.b2Score.toFixed(0) + "%" : "—"}
                      </div>
                    </div>
                    <div className="full" style={{ marginTop: "4px" }}>
                      <div
                        style={{
                          background: "#1A1A1A",
                          color: "#fff",
                          borderRadius: "8px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span style={{ fontSize: "12px", opacity: 0.8 }}>
                          Puntaje esta sesión
                        </span>
                        <span
                          className={`badge ${cls}`}
                          style={{ fontSize: "16px", padding: "4px 12px" }}
                        >
                          {fs}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      marginTop: "8px"
                    }}
                  >
                    <div
                      style={{
                        background: "var(--PLT)",
                        border: "1px solid #1A1A1A",
                        borderRadius: "8px",
                        padding: "10px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "var(--TXL)" }}>
                        Semana {viewSess.week} ({weekSess.length} ses.)
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 800 }}>
                        {weekAvg !== null ? weekAvg.toFixed(0) + "%" : "—"}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "var(--GL)",
                        border: "1px solid #059669",
                        borderRadius: "8px",
                        padding: "10px",
                        textAlign: "center"
                      }}
                    >
                      <div style={{ fontSize: "10px", color: "#059669" }}>
                        Mes · {mesNombre}
                      </div>
                      <div
                        style={{ fontSize: "20px", fontWeight: 800, color: "#059669" }}
                      >
                        {monthAvg !== null ? monthAvg.toFixed(0) + "%" : "—"}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="card">
            <div className="ct">🧍 Bloque 1 — Presentación Personal</div>
            <div>
              {B1.map((item) => {
                const v = viewSess.b1Data?.[item];
                const lbl =
                  v === undefined
                    ? "—"
                    : v === "NA"
                    ? "NA"
                    : v === "0"
                    ? "No cumple"
                    : v === "1"
                    ? "Parcial"
                    : "Cumple";
                const cls =
                  v === "0"
                    ? "v0"
                    : v === "1"
                    ? "v1"
                    : v === "2"
                    ? "v2"
                    : v === "NA"
                    ? "vna"
                    : "vnd";
                return (
                  <div key={item} className="view-item">
                    <span>{item}</span>
                    <span className={`view-val ${cls}`}>{lbl}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="ct">📦 Bloque 2 — Marcas Evaluadas</div>
            <div className="srch">
              <span className="srch-ico">🔍</span>
              <input
                type="text"
                placeholder="Buscar marca…"
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
              />
            </div>
            <div>
              {(viewSess.selBrands || []).map((brand, i) => {
                if (viewSearch && !brand.toLowerCase().includes(viewSearch.toLowerCase())) {
                  return null;
                }
                const bData = viewSess.b2Data?.[brand] || { items: {}, obs: "" };
                const items = bData.items || {};
                const appl = B2.filter((k) => items[k] !== undefined && items[k] !== "NA");
                const pct = appl.length
                  ? (appl.reduce((s, k) => s + Number(items[k]), 0) / (appl.length * 2)) * 100
                  : null;
                const isOpen = !!openViewBrands[i];

                return (
                  <div key={brand} className="view-brand">
                    <div
                      className="view-brand-hd"
                      onClick={() =>
                        setOpenViewBrands((prev) => ({ ...prev, [i]: !prev[i] }))
                      }
                    >
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>{brand}</span>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {pct !== null && (
                          <span className={`badge ${badgeCls(pct)}`}>
                            {pct.toFixed(0)}%
                          </span>
                        )}
                        <span style={{ fontSize: "10px", color: "var(--TXL)" }}>▼</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="view-brand-bd">
                        {B2.map((item, ki) => {
                          const v = items[item];
                          const lbl = v === undefined ? "—" : v === "NA" ? "NA" : v;
                          const cls =
                            v === "0"
                              ? "v0"
                              : v === "1"
                              ? "v1"
                              : v === "2"
                              ? "v2"
                              : v === "NA"
                              ? "vna"
                              : "vnd";
                          return (
                            <div key={item} className="view-item">
                              <span>{B2_LABELS[ki]}</span>
                              <span className={`view-val ${cls}`}>{lbl}</span>
                            </div>
                          );
                        })}
                        {bData.obs && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--TXL)",
                              marginTop: "6px",
                              fontStyle: "italic"
                            }}
                          >
                            📝 {bData.obs}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="ct">✍️ Firmas</div>
            <div className="sig-grid">
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                  Asesor(a)
                </div>
                <div className="sig-view">
                  {viewSess.sigAsesor ? (
                    <img src={viewSess.sigAsesor} alt="Firma Asesor" />
                  ) : (
                    <span className="sig-empty">Sin firma registrada</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                  Supervisor(a)
                </div>
                <div className="sig-view">
                  {viewSess.sigEvaluador ? (
                    <img src={viewSess.sigEvaluador} alt="Firma Supervisor" />
                  ) : (
                    <span className="sig-empty">Sin firma registrada</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button className="btn btn-pdf" onClick={() => handleExportPDF(viewSess)}>
            📄 Exportar PDF
          </button>
          <button className="btn btn-wa" onClick={() => handleCompartirWA(viewSess)}>
            💬 Enviar por WhatsApp
          </button>
          <button className="btn btn-s" onClick={volverInicio}>
            ↩ Volver
          </button>
          <div style={{ height: "20px" }} />
        </div>
      )}

      {/* ══ REPORT ══ */}
      {screen === "report" && (
        <div className="main" style={{ paddingTop: "14px" }}>
          <div className="card">
            <div className="ct">📊 Reporte Mensual</div>
            <div className="row2" style={{ marginBottom: "12px" }}>
              <div className="fl">
                <label>Asesor(a)</label>
                <select
                  value={repAsesor}
                  onChange={(e) => setRepAsesor(e.target.value)}
                >
                  <option value="">— Todos —</option>
                  {availableAsesoresInSessions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fl">
                <label>Mes</label>
                <select value={repMes} onChange={(e) => setRepMes(e.target.value)}>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!reportData ? (
              <div className="empty">Sin datos.</div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--TXL)",
                    marginBottom: "6px"
                  }}
                >
                  Sesiones por Semana
                </div>
                {Object.keys(reportData.byWeek)
                  .sort((a, b) => Number(a) - Number(b))
                  .map((wKey) => {
                    const ws = reportData.byWeek[Number(wKey)];
                    const wavg =
                      ws.reduce((s, x) => s + (x.finalScore || 0), 0) / ws.length;
                    const marcas = [
                      ...new Set(ws.flatMap((s) => s.selBrands || []))
                    ];
                    return (
                      <div key={wKey} className="rep-row">
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700 }}>
                            Semana {wKey}
                          </div>
                          <div className="rep-week">
                            {ws.length} sesión(es) · {marcas.length} marcas revisadas
                          </div>
                        </div>
                        <span
                          className={`badge ${badgeCls(wavg)}`}
                          style={{ fontSize: "14px", padding: "4px 10px" }}
                        >
                          {wavg.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}

                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--TXL)",
                    margin: "10px 0 6px"
                  }}
                >
                  Promedio por Marca
                </div>
                {Object.keys(reportData.brandData)
                  .sort()
                  .map((brand) => {
                    const arr = reportData.brandData[brand];
                    const avg = arr.reduce((a, v) => a + v, 0) / arr.length;
                    return (
                      <div
                        key={brand}
                        className="rep-row"
                        style={{ padding: "7px 12px" }}
                      >
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 600 }}>
                            {brand}
                          </div>
                          <div className="rep-week">{arr.length} evaluación(es)</div>
                        </div>
                        <span className={`badge ${badgeCls(avg)}`}>
                          {avg.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}

                <div className="rep-total">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      marginBottom: "8px"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "10px", opacity: 0.8 }}>
                        Presentación
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 800 }}>
                        {reportData.b1Avg !== null
                          ? reportData.b1Avg.toFixed(0) + "%"
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", opacity: 0.8 }}>Jornada</div>
                      <div style={{ fontSize: "22px", fontWeight: 800 }}>
                        {reportData.b2Avg !== null
                          ? reportData.b2Avg.toFixed(0) + "%"
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          opacity: 0.9
                        }}
                      >
                        TOTAL MES
                      </div>
                      <div
                        style={{
                          fontSize: "28px",
                          fontWeight: 800,
                          color: "#E8C878"
                        }}
                      >
                        {reportData.finalAvg !== null
                          ? reportData.finalAvg.toFixed(0) + "%"
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "11px", opacity: 0.75 }}>
                    Marcas evaluadas en el mes:{" "}
                    {Object.keys(reportData.brandData).length}
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn btn-pdf"
              onClick={() => {
                try {
                  generateMonthlyReportPDF(repAsesor, repMes, sessions);
                } catch (e: unknown) {
                  showToast("Error PDF: " + (e instanceof Error ? e.message : String(e)));
                }
              }}
              style={{ marginTop: "10px" }}
            >
              📄 Exportar PDF
            </button>
            <button className="btn btn-s" onClick={volverInicio}>
              ↩ Volver
            </button>
          </div>
        </div>
      )}

      {/* ══ HISTORIAL LIST SCREEN ══ */}
      {screen === "hist-list" && (
        <div className="main" style={{ paddingTop: "14px" }}>
          <div className="card">
            <div className="ct">📋 Historial de Asesores</div>
            <div className="fl" style={{ marginBottom: "12px" }}>
              <label>Filtrar por Mes</label>
              <select
                value={histMesFilter}
                onChange={(e) => setHistMesFilter(e.target.value)}
              >
                <option value="">— Todos los meses —</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {histListGroups.length === 0 ? (
                <div className="empty">Sin evaluaciones para este período.</div>
              ) : (
                histListGroups.map((item) => {
                  const tStr =
                    item.trend === null
                      ? "Primera evaluación"
                      : item.trend > 0
                      ? "▲ +" + Math.abs(item.trend).toFixed(0) + "%"
                      : item.trend < 0
                      ? "▼ -" + Math.abs(item.trend).toFixed(0) + "%"
                      : "→ Sin cambio";
                  const tCls =
                    item.trend === null
                      ? ""
                      : item.trend > 0
                      ? "trend-up"
                      : item.trend < 0
                      ? "trend-dn"
                      : "trend-eq";

                  return (
                    <div
                      key={item.nombre}
                      className="hist-asesor-card"
                      onClick={() => openHist(item.nombre)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <div className="ha-name">{item.nombre}</div>
                          <div className="ha-meta">
                            {item.count} sesión{item.count > 1 ? "es" : ""} · Última:{" "}
                            {item.lastDate}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                          }}
                        >
                          <span
                            className={`badge ${badgeCls(item.avg)}`}
                            style={{ fontSize: "14px", padding: "4px 10px" }}
                          >
                            {item.avg.toFixed(0)}%
                          </span>
                          <span
                            style={{
                              fontSize: "20px",
                              color: "#999",
                              fontWeight: 300
                            }}
                          >
                            ›
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          marginTop: "6px",
                          paddingTop: "6px",
                          borderTop: "1px solid var(--BG)"
                        }}
                      >
                        <span className={tCls}>{tStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button className="btn btn-s" onClick={volverInicio}>
            ↩ Volver
          </button>
          <div style={{ height: "20px" }} />
        </div>
      )}

      {/* ══ HISTORY DETAIL SCREEN ══ */}
      {screen === "hist" && (
        <div className="main" style={{ paddingTop: "14px" }}>
          <div className="card">
            <div className="ct">📈 {currentHistAsesor}</div>
            {!singleAsesorHist ? (
              <div className="empty">Sin evaluaciones.</div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-box">
                    <div className="sv">{singleAsesorHist.avg.toFixed(0)}%</div>
                    <div className="sl">Promedio</div>
                  </div>
                  <div className="stat-box">
                    <div className="sv" style={{ color: "#10B981" }}>
                      {singleAsesorHist.best.toFixed(0)}%
                    </div>
                    <div className="sl">Mejor</div>
                  </div>
                  <div className="stat-box">
                    <div
                      className={`sv ${
                        singleAsesorHist.trend === null
                          ? ""
                          : singleAsesorHist.trend > 0
                          ? "trend-up"
                          : singleAsesorHist.trend < 0
                          ? "trend-dn"
                          : "trend-eq"
                      }`}
                    >
                      {singleAsesorHist.trend === null
                        ? "Primera eval"
                        : singleAsesorHist.trend > 0
                        ? "▲ +" + singleAsesorHist.trend.toFixed(1) + "%"
                        : singleAsesorHist.trend < 0
                        ? "▼ " + singleAsesorHist.trend.toFixed(1) + "%"
                        : "→ Igual"}
                    </div>
                    <div className="sl">Tendencia</div>
                  </div>
                </div>

                <HistoryChart sessions={singleAsesorHist.list} />

                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "var(--TXL)",
                    marginBottom: "8px"
                  }}
                >
                  Todas las sesiones
                </div>
                <div>
                  {singleAsesorHist.list.map((s) => {
                    const d = new Date(s.fecha + "T12:00:00");
                    const fd = d.toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    const sc = s.finalScore !== null ? s.finalScore.toFixed(0) + "%" : "—";
                    const cls = badgeCls(s.finalScore || 0);
                    const sig = s.sigAsesor ? "✍️ " : "";
                    const b1 = s.b1Score !== null ? s.b1Score.toFixed(0) + "%" : "—";
                    const b2 = s.b2Score !== null ? s.b2Score.toFixed(0) + "%" : "—";

                    return (
                      <div
                        key={s.id}
                        className="tl-card"
                        onClick={() => viewSavedSession(s)}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600 }}>
                            {sig}
                            {fd} · Sem {s.week}
                          </div>
                          <div className="tl-date">
                            Presentación: {b1} · Jornada: {b2} ·{" "}
                            {s.selBrands?.length || 0} marcas
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center"
                          }}
                        >
                          <span
                            className={`badge ${cls}`}
                            style={{ fontSize: "14px", padding: "4px 10px" }}
                          >
                            {sc}
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ fontSize: "11px", padding: "4px 7px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(s);
                            }}
                          >
                            📄
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            style={{ fontSize: "11px", padding: "4px 7px" }}
                            title="Eliminar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(s.id);
                            }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            className="btn btn-pdf"
            onClick={() => {
              try {
                generateHistoryPDF(currentHistAsesor, sessions);
              } catch (e: unknown) {
                showToast("Error PDF: " + (e instanceof Error ? e.message : String(e)));
              }
            }}
          >
            📄 Exportar Historial PDF
          </button>
          <button className="btn btn-s" onClick={goHistorial}>
            ↩ Volver al Historial
          </button>
          <div style={{ height: "20px" }} />
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
              ¿Eliminar esta evaluación?
            </div>
            <p style={{ fontSize: "12px", color: "var(--TXL)", marginBottom: "16px" }}>
              Esta acción eliminará el registro tanto local como en la nube.
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-s"
                style={{ marginBottom: 0 }}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-pdf"
                style={{ marginBottom: 0 }}
                onClick={() => executeDeleteSession(confirmDeleteId)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div className={`toast ${toastVisible ? "show" : ""}`}>{toastMsg}</div>
    </div>
  );
}
