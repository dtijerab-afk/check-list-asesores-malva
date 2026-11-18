import React, { useEffect, useRef } from "react";
import { EvalSession } from "./constants";

export const HistoryChart: React.FC<{ sessions: EvalSession[] }> = ({ sessions }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cv.parentElement || !sessions.length) return;
    const parent = cv.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(220, parent.offsetWidth - 24);
    const cssH = 200;
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = cssW * dpr;
    cv.height = cssH * dpr;

    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const W = cssW,
      H = cssH;
    const pad = { top: 20, right: 16, bottom: 36, left: 36 };
    const dw = W - pad.left - pad.right,
      dh = H - pad.top - pad.bottom;

    const data = sessions.slice().reverse();
    const scores = data.map((s) => s.finalScore || 0);
    const n = scores.length;

    ctx.fillStyle = "rgba(16,185,129,.12)";
    ctx.fillRect(pad.left, pad.top, dw, dh * 0.25);
    ctx.fillStyle = "rgba(245,158,11,.10)";
    ctx.fillRect(pad.left, pad.top + dh * 0.25, dw, dh * 0.25);
    ctx.fillStyle = "rgba(239,68,68,.10)";
    ctx.fillRect(pad.left, pad.top + dh * 0.5, dw, dh * 0.5);

    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(16,185,129,.6)";
    ctx.fillText("EXCELENTE", pad.left + 4, pad.top + 10);
    ctx.fillStyle = "rgba(180,120,0,.5)";
    ctx.fillText("ACEPTABLE", pad.left + 4, pad.top + dh * 0.25 + 10);
    ctx.fillStyle = "rgba(200,50,50,.5)";
    ctx.fillText("CRÍTICO", pad.left + 4, pad.top + dh * 0.5 + 10);

    [100, 75, 50, 25, 0].forEach((v) => {
      const gy = pad.top + dh * (1 - v / 100);
      ctx.beginPath();
      ctx.strokeStyle = v % 25 === 0 ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.06)";
      ctx.lineWidth = v === 75 || v === 50 ? 1 : 0.5;
      ctx.setLineDash(v === 100 || v === 0 ? [] : [4, 4]);
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(W - pad.right, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#888";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(v + "%", pad.left - 4, gy + 3);
    });

    ctx.fillStyle = "#999";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    data.forEach((s, i) => {
      const x = n === 1 ? pad.left + dw / 2 : pad.left + i * (dw / (n - 1));
      const d = new Date(s.fecha + "T12:00:00");
      const lbl = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      ctx.fillText(lbl, x, H - pad.bottom + 14);
    });

    if (n < 2) {
      const x = pad.left + dw / 2,
        y = pad.top + dh * (1 - scores[0] / 100);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#1A1A1A";
      ctx.fill();
      ctx.fillStyle = "#1A1A1A";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(scores[0].toFixed(0) + "%", x, y - 10);
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    scores.forEach((v, i) => {
      const x = pad.left + i * (dw / (n - 1)),
        y = pad.top + dh * (1 - v / 100);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.beginPath();
    scores.forEach((v, i) => {
      const x = pad.left + i * (dw / (n - 1)),
        y = pad.top + dh * (1 - v / 100);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + dw, pad.top + dh);
    ctx.lineTo(pad.left, pad.top + dh);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + dh);
    grad.addColorStop(0, "rgba(26,26,26,.15)");
    grad.addColorStop(1, "rgba(26,26,26,.01)");
    ctx.fillStyle = grad;
    ctx.fill();

    scores.forEach((v, i) => {
      const x = pad.left + i * (dw / (n - 1)),
        y = pad.top + dh * (1 - v / 100);
      const dotColor = v >= 75 ? "#10B981" : v >= 50 ? "#F59E0B" : "#EF4444";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1A1A1A";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(v.toFixed(0) + "%", x, y - 12);
    });
  }, [sessions]);

  return (
    <div className="chart-wrap">
      <div className="chart-title">Puntaje por sesión</div>
      <canvas ref={canvasRef} style={{ width: "100%", height: "200px" }} />
    </div>
  );
};
