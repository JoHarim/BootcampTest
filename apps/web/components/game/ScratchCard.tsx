"use client";

// 스크래치 카드 — 금박 캔버스를 긁으면(45% 이상) 아래 내용이 드러난다.
// 포인터 이벤트(마우스·터치 공용). SSR 안전: 캔버스 그리기는 useEffect 에서.
import { useEffect, useRef, useState } from "react";
import { sfx } from "./juice";

interface Props {
  children: React.ReactNode;
  onRevealed: () => void; // 45% 이상 긁힌 순간 1회 호출
  height?: number;
}

const REVEAL_RATIO = 0.45;
const BRUSH = 26;

export default function ScratchCard({ children, onRevealed, height = 170 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scratching = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const moveCount = useRef(0);
  const revealedRef = useRef(false);
  const lastSfx = useRef(0);
  const [gone, setGone] = useState(false);

  // 금박 커버 그리기 (마운트 시 1회)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (canvas === null || wrap === null) return;
    const cssW = wrap.clientWidth;
    const cssH = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const g = canvas.getContext("2d");
    if (g === null) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grad = g.createLinearGradient(0, 0, cssW, cssH);
    grad.addColorStop(0, "#caa64b");
    grad.addColorStop(0.45, "#f0d98c");
    grad.addColorStop(0.55, "#e3c268");
    grad.addColorStop(1, "#b98f35");
    g.fillStyle = grad;
    g.fillRect(0, 0, cssW, cssH);
    g.strokeStyle = "rgba(255,255,255,0.28)";
    g.lineWidth = 1;
    for (let x = -cssH; x < cssW; x += 14) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + cssH, cssH);
      g.stroke();
    }
    g.fillStyle = "#6b5215";
    g.font = "700 15px Inter, sans-serif";
    g.textAlign = "center";
    g.fillText("여기를 박박 긁으세요", cssW / 2, cssH / 2 - 8);
    g.font = "500 12px Inter, sans-serif";
    g.fillStyle = "#7d6320";
    g.fillText("절반쯤 긁으면 자동 공개", cssW / 2, cssH / 2 + 14);
  }, [height]);

  function clearedRatio(canvas: HTMLCanvasElement): number {
    const g = canvas.getContext("2d");
    if (g === null) return 0;
    const step = 8;
    const { width, height: h } = canvas;
    const data = g.getImageData(0, 0, width, h).data;
    let cleared = 0;
    let total = 0;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < width; x += step) {
        total += 1;
        if (data[(y * width + x) * 4 + 3] === 0) cleared += 1;
      }
    }
    return total === 0 ? 0 : cleared / total;
  }

  function reveal() {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setGone(true);
    onRevealed();
  }

  function scratchTo(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (canvas === null || revealedRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const g = canvas.getContext("2d");
    if (g === null) return;
    g.globalCompositeOperation = "destination-out";
    // 커버 빗금이 남긴 반투명 strokeStyle 그대로면 한 획에 25%만 지워진다 — 불투명 강제
    g.strokeStyle = "#000";
    g.globalAlpha = 1;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = BRUSH * 2;
    g.beginPath();
    const prev = lastPoint.current;
    if (prev !== null) {
      g.moveTo(prev.x, prev.y);
    } else {
      g.moveTo(x, y);
    }
    g.lineTo(x, y);
    g.stroke();
    lastPoint.current = { x, y };

    const now = performance.now();
    if (now - lastSfx.current > 70) {
      sfx.scratch();
      lastSfx.current = now;
    }
    moveCount.current += 1;
    if (moveCount.current % 8 === 0 && clearedRatio(canvas) >= REVEAL_RATIO) reveal();
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    scratching.current = true;
    lastPoint.current = null;
    scratchTo(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!scratching.current) return;
    scratchTo(e.clientX, e.clientY);
  }
  function endScratch() {
    scratching.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (canvas !== null && !revealedRef.current && clearedRatio(canvas) >= REVEAL_RATIO) reveal();
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ minHeight: height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
      <canvas
        ref={canvasRef}
        data-testid="scratch-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScratch}
        onPointerLeave={endScratch}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: "crosshair",
          opacity: gone ? 0 : 1,
          transition: "opacity 0.45s ease",
          pointerEvents: gone ? "none" : "auto",
        }}
      />
    </div>
  );
}
