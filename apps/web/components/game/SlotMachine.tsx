"use client";

// 슬롯머신 부스 — 캐비닛(마퀴 전구·릴 창 3개(심볼 3개씩 보임)·페이라인·오른쪽 레버).
// 결과는 rules.drawSpin() 이 먼저 정하고, 릴은 그 결과를 향해 감속한다.
import { useEffect, useRef, useState } from "react";
import {
  PAIR_MULT,
  REEL_STRIP,
  SLOT_BETS,
  SYMBOL_ICON,
  TRIPLE_MULT,
  drawSpin,
  type SlotSymbol,
  type SpinOutcome,
} from "../../lib/game/rules";
import { burstConfetti, sfx } from "./juice";

interface Props {
  coins: number;
  locked: boolean;
  onPlay: (bet: number) => boolean; // 부모가 코인·기회 차감
  onWin: (win: number) => void; // 정산 (0 포함)
  onDone: () => void; // 연출 종료 — 부모가 잠금 해제 + 판정
}

const CELL = 62; // 심볼 한 칸 높이(px)
const WINDOW_H = CELL * 3; // 릴 창에 심볼 3개가 보인다 (가운데가 페이라인)
const STRIP_LEN = REEL_STRIP.length;
const DURATIONS = [1300, 2100, 3100];
const EXTRA_TURNS = [3, 4, 5];

export default function SlotMachine({ coins, locked, onPlay, onWin, onDone }: Props) {
  const [bet, setBet] = useState(SLOT_BETS[0]);
  const [positions, setPositions] = useState<[number, number, number]>([0, 4, 8]);
  const [spinning, setSpinning] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<{ outcome: SpinOutcome; win: number } | null>(null);
  const [leverPulled, setLeverPulled] = useState(false);
  const rafRef = useRef<number | null>(null);
  const failsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (failsafeRef.current !== null) clearTimeout(failsafeRef.current);
    };
  }, []);

  function targetIndexOn(symbol: SlotSymbol): number {
    const candidates: number[] = [];
    REEL_STRIP.forEach((s, i) => {
      if (s === symbol) candidates.push(i);
    });
    return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
  }

  // 레버/버튼 공용 스핀 트리거
  function spin() {
    if (spinning || locked) return;
    if (!onPlay(bet)) return;
    const outcome = drawSpin();
    const win = Math.round(bet * outcome.multiplier);
    setLastOutcome(null);
    setSpinning(true);
    setLeverPulled(true);
    sfx.lever();
    setTimeout(() => setLeverPulled(false), 450);

    const starts = positions.map((p) => ((p % STRIP_LEN) + STRIP_LEN) % STRIP_LEN) as [
      number,
      number,
      number,
    ];
    const targets = outcome.symbols.map((sym, i) => {
      const idx = targetIndexOn(sym);
      const forward = (idx - starts[i] + STRIP_LEN) % STRIP_LEN;
      return starts[i] + EXTRA_TURNS[i] * STRIP_LEN + forward;
    }) as [number, number, number];

    const t0 = performance.now();
    const stopped = [false, false, false];

    function frame(now: number) {
      const next: [number, number, number] = [...starts] as [number, number, number];
      let allDone = true;
      for (let i = 0; i < 3; i++) {
        const t = Math.min(1, (now - t0) / DURATIONS[i]);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        next[i] = starts[i] + (targets[i] - starts[i]) * eased;
        if (t < 1) {
          allDone = false;
        } else if (!stopped[i]) {
          stopped[i] = true;
          next[i] = targets[i];
          sfx.reelStop();
        }
      }
      if (!allDone && now - lastTickRef.current > 90) {
        sfx.tick();
        lastTickRef.current = now;
      }
      setPositions(next);
      if (!allDone) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        if (failsafeRef.current !== null) {
          clearTimeout(failsafeRef.current);
          failsafeRef.current = null;
        }
        settle(outcome, win);
      }
    }
    rafRef.current = requestAnimationFrame(frame);
    // 페일세이프: 탭이 백그라운드면 rAF가 얼어 릴이 영원히 안 멈춘다 — 시간이 지나면 강제 정산
    failsafeRef.current = setTimeout(() => {
      failsafeRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setPositions(targets);
        settle(outcome, win);
      }
    }, DURATIONS[2] + 500);
  }

  function settle(outcome: SpinOutcome, win: number) {
    setLastOutcome({ outcome, win });
    setSpinning(false);
    onWin(win);
    const isJackpot = outcome.kind === "triple" && outcome.symbols[0] === "seven";
    if (win > 0) {
      if (isJackpot) {
        sfx.jackpot();
        burstConfetti(170, 0.5, 0.35);
        setTimeout(() => burstConfetti(120, 0.25, 0.45), 350);
        setTimeout(() => burstConfetti(120, 0.75, 0.45), 700);
      } else if (outcome.kind === "triple") {
        sfx.win();
        burstConfetti(90, 0.5, 0.4);
        setTimeout(() => sfx.coin(), 250);
      } else {
        sfx.coin();
        burstConfetti(28, 0.5, 0.45);
      }
    } else {
      sfx.lose();
    }
    // 결과를 잠깐 보여준 뒤 판정으로 (잭팟은 여운 길게)
    setTimeout(() => onDone(), isJackpot ? 1400 : 700);
  }

  const isJackpot =
    lastOutcome !== null &&
    lastOutcome.outcome.kind === "triple" &&
    lastOutcome.outcome.symbols[0] === "seven";

  function renderReel(pos: number, key: number) {
    const offset = ((pos % STRIP_LEN) + STRIP_LEN) % STRIP_LEN;
    const strip = [...REEL_STRIP, ...REEL_STRIP, ...REEL_STRIP];
    return (
      <div key={key} style={st.reelWindow} className={isJackpot ? "reel-glow" : undefined}>
        <div
          style={{
            transform: `translateY(${-(offset + STRIP_LEN) * CELL + (WINDOW_H - CELL) / 2}px)`,
            willChange: "transform",
          }}
        >
          {strip.map((s, i) => (
            <div key={i} style={st.reelCell}>
              {SYMBOL_ICON[s]}
            </div>
          ))}
        </div>
        {/* 위아래 그늘 — 릴 원통 느낌 */}
        <div style={st.reelShadeTop} />
        <div style={st.reelShadeBottom} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={st.cabinetWrap} className={isJackpot ? "shake" : undefined}>
        {/* 마퀴 (전구 아치) */}
        <div style={st.marquee}>
          <div style={st.bulbRow}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={spinning ? "bulb blink" : "bulb"} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <div style={st.marqueeText}>{isJackpot ? "JACKPOT!!!" : "LUCKY RUN"}</div>
        </div>

        <div style={st.body}>
          <div style={st.reelPanel}>
            <div style={st.reelRow}>
              {positions.map((p, i) => renderReel(p, i))}
              <div style={st.payline} />
            </div>
          </div>

          {/* 결과 표시창 */}
          <div style={st.readout} data-testid="slot-readout">
            {spinning ? (
              <span style={{ color: "#b8a58f" }}>돌아가는 중…</span>
            ) : lastOutcome === null ? (
              <span style={{ color: "#b8a58f" }}>베팅을 고르고 레버를 당기세요</span>
            ) : lastOutcome.win > 0 ? (
              <span style={{ color: "#f5c542", fontWeight: 800 }}>
                {lastOutcome.outcome.kind === "triple"
                  ? isJackpot
                    ? "잭팟!!! "
                    : "트리플! "
                  : "페어! "}
                +{lastOutcome.win.toLocaleString()}코인
              </span>
            ) : (
              <span style={{ color: "#b8a58f" }}>
                {lastOutcome.outcome.symbols[0] === "seven" && lastOutcome.outcome.symbols[1] === "seven"
                  ? "아깝다!! 7이 두 개였는데…"
                  : "꽝… 릴은 돌수록 뜨거워진다"}
              </span>
            )}
          </div>

          {/* 베팅 + 스핀 */}
          <div style={st.betRow}>
            {SLOT_BETS.map((b) => {
              const disabled = spinning || locked || coins < b;
              return (
                <button
                  key={b}
                  type="button"
                  className={`chip${bet === b ? " chip-on" : ""}`}
                  data-testid={`bet-${b}`}
                  disabled={disabled}
                  onClick={() => {
                    setBet(b);
                    sfx.blip();
                  }}
                >
                  🪙{b}
                </button>
              );
            })}
            <button
              type="button"
              className="btn-gold"
              data-testid="spin-btn"
              disabled={spinning || locked || coins < bet}
              onClick={spin}
              style={{ marginLeft: 6 }}
            >
              {spinning ? "돌아가는 중…" : `스핀 (🪙${bet})`}
            </button>
          </div>
          <div style={st.payTable}>
            페어 x{PAIR_MULT} · 🍒x{TRIPLE_MULT.cherry} · 🍋x{TRIPLE_MULT.lemon} · ⭐x{TRIPLE_MULT.star} · 💎x{TRIPLE_MULT.gem} · 7️⃣x{TRIPLE_MULT.seven}
          </div>
        </div>

        {/* 레버 (오른쪽) */}
        <button
          type="button"
          aria-label="레버 당기기"
          data-testid="lever"
          disabled={spinning || locked || coins < bet}
          onClick={spin}
          style={st.leverZone}
        >
          <span style={st.leverTrack} />
          <span
            style={{
              ...st.leverStick,
              transform: leverPulled ? "translateY(58px) scaleY(0.55)" : "translateY(0) scaleY(1)",
            }}
          />
          <span
            style={{
              ...st.leverKnob,
              transform: leverPulled ? "translateY(96px)" : "translateY(0)",
            }}
          />
        </button>
      </div>
    </div>
  );
}

const GOLD = "#f5c542";

const st: Record<string, React.CSSProperties> = {
  cabinetWrap: { position: "relative", width: "min(420px, 100%)", paddingRight: 56 },
  marquee: {
    background: "linear-gradient(180deg, #3b3667, #262347)",
    border: "3px solid " + GOLD,
    borderBottom: "none",
    borderRadius: "70px 70px 0 0",
    padding: "12px 16px 8px",
    textAlign: "center",
  },
  bulbRow: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 6 },
  marqueeText: {
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: 3,
    color: GOLD,
    textShadow: "0 0 14px rgba(245,197,66,0.6)",
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  body: {
    background: "linear-gradient(180deg, #33305e 0%, #232043 55%, #1a1833 100%)",
    border: "3px solid " + GOLD,
    borderRadius: "0 0 22px 22px",
    padding: "14px 14px 16px",
    boxShadow: "0 14px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  reelPanel: {
    background: "#141224",
    border: "2px solid #4a4580",
    borderRadius: 12,
    padding: 10,
  },
  reelRow: { display: "flex", gap: 8, justifyContent: "center", position: "relative" },
  reelWindow: {
    width: 88,
    height: WINDOW_H,
    overflow: "hidden",
    background: "linear-gradient(180deg, #efe9da, #fdf9ee 30%, #fdf9ee 70%, #e7e0cf)",
    borderRadius: 8,
    border: "2px solid #6b5215",
    position: "relative",
  },
  reelCell: {
    height: CELL,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 38,
    lineHeight: 1,
    filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))",
  },
  reelShadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: CELL * 0.9,
    background: "linear-gradient(180deg, rgba(20,18,36,0.55), rgba(20,18,36,0))",
    pointerEvents: "none",
  },
  reelShadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: CELL * 0.9,
    background: "linear-gradient(0deg, rgba(20,18,36,0.55), rgba(20,18,36,0))",
    pointerEvents: "none",
  },
  payline: {
    position: "absolute",
    left: -4,
    right: -4,
    top: "50%",
    height: 3,
    marginTop: -1.5,
    background: "linear-gradient(90deg, transparent, rgba(214,69,65,0.9), transparent)",
    boxShadow: "0 0 8px rgba(214,69,65,0.7)",
    pointerEvents: "none",
  },
  readout: { textAlign: "center", marginTop: 12, fontSize: 15, minHeight: 22 },
  betRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    flexWrap: "wrap",
  },
  payTable: { textAlign: "center", marginTop: 10, fontSize: 12, color: "#8f89b8" },
  leverZone: {
    position: "absolute",
    right: 0,
    top: 90,
    width: 52,
    height: 190,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  leverTrack: {
    position: "absolute",
    left: 18,
    top: 60,
    width: 16,
    height: 90,
    background: "linear-gradient(180deg, #3b3667, #1a1833)",
    border: "2px solid " + GOLD,
    borderRadius: 10,
  },
  leverStick: {
    position: "absolute",
    left: 23,
    top: 26,
    width: 7,
    height: 80,
    background: "linear-gradient(90deg, #c8c8d4, #8f8fa0)",
    borderRadius: 4,
    transformOrigin: "bottom center",
    transition: "transform 0.22s cubic-bezier(0.4, 2, 0.6, 1)",
  },
  leverKnob: {
    position: "absolute",
    left: 8,
    top: 2,
    width: 36,
    height: 36,
    background: "radial-gradient(circle at 35% 30%, #ff8a7a, #d64541 60%, #9c2c28)",
    borderRadius: 999,
    boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
    transition: "transform 0.22s cubic-bezier(0.4, 2, 0.6, 1)",
  },
};
