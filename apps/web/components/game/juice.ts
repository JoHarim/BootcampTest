// 럭키런 도파민 담당 — Web Audio 합성 효과음 + 캔버스 컨페티. 외부 에셋 0 (정적 export 그대로).
// 오디오는 반드시 사용자 제스처(클릭) 후에만 시작 — 브라우저 자동재생 정책.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
}

export function ensureAudio() {
  if (typeof window === "undefined") return;
  if (ctx === null) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC === undefined) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

interface ToneOpts {
  freq: number;
  endFreq?: number;
  dur: number; // 초
  type?: OscillatorType;
  gain?: number;
  at?: number; // 지연(초)
}

function tone({ freq, endFreq, dur, type = "sine", gain = 0.12, at = 0 }: ToneOpts) {
  if (ctx === null || muted) return;
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, gain: number, filterFreq: number, at = 0) {
  if (ctx === null || muted) return;
  const t0 = ctx.currentTime + at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  blip() {
    tone({ freq: 620, endFreq: 880, dur: 0.07, type: "square", gain: 0.06 });
  },
  // 레버 당김: 철컥(래칫) + 스프링
  lever() {
    noise(0.05, 0.1, 900);
    tone({ freq: 140, dur: 0.1, type: "triangle", gain: 0.14 });
    tone({ freq: 90, endFreq: 260, dur: 0.22, type: "triangle", gain: 0.07, at: 0.08 });
  },
  scratch() {
    noise(0.05, 0.05, 2400);
  },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.12, at: i * 0.08 }));
  },
  lose() {
    tone({ freq: 220, endFreq: 110, dur: 0.35, type: "sawtooth", gain: 0.07 });
  },
  tick() {
    tone({ freq: 1250, dur: 0.025, type: "square", gain: 0.025 });
  },
  reelStop() {
    tone({ freq: 190, dur: 0.09, type: "triangle", gain: 0.14 });
    noise(0.06, 0.06, 700);
  },
  coin() {
    tone({ freq: 988, dur: 0.07, type: "square", gain: 0.07 });
    tone({ freq: 1319, dur: 0.18, type: "square", gain: 0.07, at: 0.07 });
  },
  countTick() {
    tone({ freq: 1600, dur: 0.018, type: "square", gain: 0.02 });
  },
  // 미스터 핀 계약 체결 — 금전등록기 '차-칭'을 반음 낮게, 끝을 벤드다운 (달콤한데 뒷맛이 찜찜)
  loanDeal() {
    tone({ freq: 262, dur: 0.09, type: "square", gain: 0.08 });
    tone({ freq: 196, endFreq: 175, dur: 0.28, type: "square", gain: 0.08, at: 0.1 });
    noise(0.08, 0.05, 3000, 0.05);
  },
  // 빚 청산 — 당첨음보다 한 옥타브 낮은 해방 아르페지오 + 동전 샤워
  repay() {
    [262, 330, 392, 523].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, type: "triangle", gain: 0.11, at: i * 0.08 }),
    );
    noise(0.25, 0.04, 5000, 0.3);
  },
  roundClear() {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.14, type: "triangle", gain: 0.1, at: i * 0.09 }));
    tone({ freq: 1047, dur: 0.5, type: "triangle", gain: 0.1, at: 0.3 });
  },
  jackpot() {
    const run = [523, 659, 784, 1047, 1319, 1568];
    run.forEach((f, i) => tone({ freq: f, dur: 0.12, type: "square", gain: 0.09, at: i * 0.07 }));
    [1047, 1319, 1568].forEach((f) => tone({ freq: f, dur: 0.9, type: "triangle", gain: 0.06, at: 0.45 }));
  },
};

// ── 컨페티 ───────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  life: number;
}

// 웜 카지노 팔레트: 골드·레드·크림·틸
const COLORS = ["#f5c542", "#e8a55a", "#d64541", "#faf3e0", "#5db8a6", "#ffdd87"];

let confettiCanvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let rafId: number | null = null;

function getCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (confettiCanvas !== null && document.body.contains(confettiCanvas)) return confettiCanvas;
  const c = document.createElement("canvas");
  c.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  document.body.appendChild(c);
  confettiCanvas = c;
  return c;
}

function loop() {
  const c = confettiCanvas;
  if (c === null) return;
  const g = c.getContext("2d");
  if (g === null) return;
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== window.innerWidth * dpr) {
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 30);
  for (const p of particles) {
    p.vy += 0.18;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.globalAlpha = Math.min(1, p.life / 30);
    g.fillStyle = p.color;
    g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    g.restore();
  }
  if (particles.length > 0) {
    rafId = requestAnimationFrame(loop);
  } else {
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    rafId = null;
  }
}

// (xRatio, yRatio) = 화면 비율 좌표 (0~1)
export function burstConfetti(count = 80, xRatio = 0.5, yRatio = 0.35) {
  const c = getCanvas();
  if (c === null) return;
  const cx = window.innerWidth * xRatio;
  const cy = window.innerHeight * yRatio;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 90 + Math.random() * 60,
    });
  }
  if (rafId === null) rafId = requestAnimationFrame(loop);
}
