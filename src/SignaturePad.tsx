import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface SignaturePadHandle {
  capture: () => string;
  clear: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cv.parentElement) return;
    cv.width = cv.parentElement.offsetWidth || 280;
    cv.height = 120;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = cv.getBoundingClientRect();
      const sx = cv.width / r.width;
      const sy = cv.height / r.height;
      const src = "touches" in e ? e.touches[0] : e;
      return {
        x: (src.clientX - r.left) * sx,
        y: (src.clientY - r.top) * sy
      };
    };

    const onStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const onEnd = () => {
      drawingRef.current = false;
    };

    cv.addEventListener("mousedown", onStart);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("mouseup", onEnd);
    cv.addEventListener("mouseleave", onEnd);
    cv.addEventListener("touchstart", onStart, { passive: false });
    cv.addEventListener("touchmove", onMove, { passive: false });
    cv.addEventListener("touchend", onEnd);

    return () => {
      cv.removeEventListener("mousedown", onStart);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("mouseup", onEnd);
      cv.removeEventListener("mouseleave", onEnd);
      cv.removeEventListener("touchstart", onStart);
      cv.removeEventListener("touchmove", onMove);
      cv.removeEventListener("touchend", onEnd);
    };
  }, []);

  const clear = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  };

  useImperativeHandle(ref, () => ({
    clear,
    capture: () => {
      try {
        const cv = canvasRef.current;
        if (!cv) return "";
        const ctx = cv.getContext("2d");
        if (!ctx) return "";
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const hasInk = Array.from(data).some((v, i) => i % 4 === 3 && v > 10);
        return hasInk ? cv.toDataURL("image/png") : "";
      } catch {
        return "";
      }
    }
  }));

  return (
    <div className="sig-wrap">
      <canvas ref={canvasRef} className="sc" />
      <button type="button" className="sig-clear" onClick={clear}>
        ✕
      </button>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";
