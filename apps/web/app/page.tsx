"use client";

// 럭키런 — 메인 게임. 흐름: S1 타이틀 → S2 게임장(스크래치/슬롯 부스) → S3 결과.
// 규칙·확률은 lib/game/rules.ts, 상태 전이는 lib/game/run.ts, 저장은 lib/game/save.ts(어댑터)만 사용.
// SSR 안전: 저장소 읽기는 마운트 후. 마운트 확정 전에는 중립 로딩 뷰.
import { useEffect, useRef, useState } from "react";
import ScratchBooth from "../components/game/ScratchBooth";
import SlotMachine from "../components/game/SlotMachine";
import { burstConfetti, ensureAudio, setMuted, sfx } from "../components/game/juice";
import { PLAYS_PER_ROUND, targetForRound } from "../lib/game/rules";
import {
  addWin,
  bankBonus,
  canAfford,
  canBank,
  judge,
  newRun,
  nextRound,
  payForPlay,
} from "../lib/game/run";
import { saveStore, type ActiveRun, type BestRecord } from "../lib/game/save";

type Phase = "loading" | "title" | "game" | "result";

interface ClearInfo {
  fromRound: number;
  banked: boolean;
  bonus: number;
}

interface RunResult {
  round: number;
  coins: number;
  reason: "target" | "broke";
  isNewBest: boolean;
}

export default function LuckyRun() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [best, setBest] = useState<BestRecord | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [locked, setLocked] = useState(false); // 연출(긁기·스핀) 중 잠금
  const [clearInfo, setClearInfo] = useState<ClearInfo | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [confirmNewRun, setConfirmNewRun] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const runRef = useRef<ActiveRun | null>(null);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // 마운트: 저장소 읽기 (하이드레이션 불일치 방지)
  useEffect(() => {
    setBest(saveStore.loadBest());
    setRun(saveStore.loadRun());
    const settings = saveStore.loadSettings();
    const on = settings === null ? true : settings.soundOn;
    setSoundOn(on);
    setMuted(!on);
    setPhase("title");
  }, []);

  function persistRun(next: ActiveRun | null) {
    setRun(next);
    runRef.current = next;
    if (next === null) saveStore.clearRun();
    else saveStore.saveRun(next);
  }

  // ── S1 동작 ──────────────────────────────────────────
  function startNewRun() {
    if (run !== null && phase === "title" && !confirmNewRun) {
      setConfirmNewRun(true);
      return;
    }
    ensureAudio();
    sfx.blip();
    setConfirmNewRun(false);
    setClearInfo(null);
    setResult(null);
    setLocked(false);
    persistRun(newRun());
    setPhase("game");
  }

  function continueRun() {
    ensureAudio();
    sfx.blip();
    setLocked(false);
    setPhase("game");
  }

  function resetBest() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    saveStore.clearBest();
    setBest(null);
    setConfirmReset(false);
    sfx.blip();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setMuted(!next);
    saveStore.saveSettings({ soundOn: next });
    if (next) {
      ensureAudio();
      sfx.blip();
    }
  }

  // ── S2: 부스 공용 훅 ──────────────────────────────────
  // 플레이 1회 시작 — 코인·기회 차감. 성공하면 연출 잠금.
  function handlePlay(cost: number): boolean {
    const cur = runRef.current;
    if (cur === null || locked || clearInfo !== null) return false;
    if (!canAfford(cur, cost)) return false;
    ensureAudio();
    setLocked(true);
    persistRun(payForPlay(cur, cost));
    return true;
  }

  // 당첨금 정산 (0 포함)
  function handleWin(win: number) {
    const cur = runRef.current;
    if (cur === null) return;
    persistRun(addWin(cur, win));
  }

  // 연출 종료 — 잠금 해제 후 판정
  function handleDone() {
    setLocked(false);
    const cur = runRef.current;
    if (cur === null) return;
    const verdict = judge(cur);
    if (verdict === "clear") openClear(false);
    else if (verdict === "gameover-target") finishRun("target");
    else if (verdict === "gameover-broke") finishRun("broke");
  }

  function openClear(banked: boolean) {
    const cur = runRef.current;
    if (cur === null) return;
    setClearInfo({ fromRound: cur.round, banked, bonus: banked ? bankBonus(cur) : 0 });
    sfx.roundClear();
    burstConfetti(100, 0.5, 0.3);
  }

  function bankRound() {
    const cur = runRef.current;
    if (cur === null || locked || !canBank(cur)) return;
    openClear(true);
  }

  function proceedNextRound() {
    const cur = runRef.current;
    if (cur === null || clearInfo === null) return;
    sfx.blip();
    persistRun(nextRound(cur, clearInfo.banked));
    setClearInfo(null);
  }

  function finishRun(reason: "target" | "broke") {
    const cur = runRef.current;
    if (cur === null) return;
    const prev = best;
    const isNewBest =
      prev === null ||
      cur.round > prev.bestRound ||
      (cur.round === prev.bestRound && cur.coins > prev.bestCoins);
    const nextBest: BestRecord = {
      bestRound: prev === null ? cur.round : Math.max(prev.bestRound, cur.round),
      bestCoins: prev === null ? cur.coins : Math.max(prev.bestCoins, cur.coins),
      totalRuns: (prev === null ? 0 : prev.totalRuns) + 1,
    };
    saveStore.saveBest(nextBest);
    setBest(nextBest);
    setResult({ round: cur.round, coins: cur.coins, reason, isNewBest });
    persistRun(null);
    setPhase("result");
    if (isNewBest) {
      setTimeout(() => {
        sfx.win();
        burstConfetti(120, 0.5, 0.3);
      }, 400);
    } else {
      sfx.lose();
    }
  }

  function switchBooth(booth: "scratch" | "slot") {
    const cur = runRef.current;
    if (cur === null || cur.booth === booth || locked) return;
    sfx.blip();
    persistRun({ ...cur, booth });
  }

  // ── 렌더 ─────────────────────────────────────────────
  return (
    <main style={st.main}>
      <style>{gameCss}</style>

      {/* 우상단 소리 토글 (전 화면 공통) */}
      <button type="button" onClick={toggleSound} style={st.muteBtn} aria-label="소리 켜기/끄기">
        {soundOn ? "🔊" : "🔇"}
      </button>

      {phase === "loading" ? <p style={{ color: "#b8a58f" }}>불러오는 중…</p> : null}

      {phase === "title" ? (
        <section style={st.titleWrap} data-testid="title-view">
          <div style={st.logoDeco}>🎰</div>
          <h1 style={st.logo}>LUCKY RUN</h1>
          <p style={st.logoKo}>럭키런 — 긁고, 돌리고, 살아남아라</p>

          <div style={st.titleBtns}>
            {run !== null ? (
              <button type="button" className="btn-gold btn-big" data-testid="continue-btn" onClick={continueRun}>
                이어하기 — 라운드 {run.round} · 🪙{run.coins.toLocaleString()}
              </button>
            ) : null}
            {confirmNewRun ? (
              <div style={st.confirmBox} className="pop-in" data-testid="confirm-newrun">
                <p style={{ margin: "0 0 10px" }}>진행 중인 런을 버리고 새로 시작할까요?</p>
                <button type="button" className="btn-gold" onClick={startNewRun} data-testid="confirm-newrun-yes">
                  네, 새로 시작
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmNewRun(false)} style={{ marginLeft: 8 }}>
                  취소
                </button>
              </div>
            ) : (
              <button type="button" className={run === null ? "btn-gold btn-big" : "btn-ghost"} data-testid="newrun-btn" onClick={startNewRun}>
                새 런 시작
              </button>
            )}
          </div>

          {best !== null ? (
            <div style={st.bestBox} data-testid="best-box">
              최고 기록 — 라운드 <strong>{best.bestRound}</strong> · 🪙
              <strong>{best.bestCoins.toLocaleString()}</strong> · {best.totalRuns}런
              {confirmReset ? (
                <span style={{ marginLeft: 10 }} className="pop-in">
                  정말 지울까요?{" "}
                  <button type="button" className="link-btn" onClick={resetBest} data-testid="confirm-reset-yes">
                    네, 삭제
                  </button>{" "}
                  <button type="button" className="link-btn" onClick={() => setConfirmReset(false)}>
                    취소
                  </button>
                </span>
              ) : (
                <button type="button" className="link-btn" onClick={resetBest} style={{ marginLeft: 10 }} data-testid="reset-btn">
                  기록 초기화
                </button>
              )}
            </div>
          ) : null}

          <p style={st.notice}>본 게임의 코인은 가상 재화로 현금 교환·환전이 불가능합니다</p>
          <p style={{ marginTop: 4 }}>
            <a href="/saju" style={st.subLink}>완료작 보기: 사주 플래너 →</a>
          </p>
        </section>
      ) : null}

      {phase === "game" && run !== null ? (
        <section style={st.gameWrap} data-testid="game-view">
          {/* HUD */}
          <div style={st.hud} data-testid="hud">
            <div style={st.hudCoins}>
              🪙 <CoinCounter value={run.coins} />
            </div>
            <div style={st.hudCenter}>
              <div style={st.hudRound}>ROUND {run.round}</div>
              <div style={st.targetBarWrap}>
                <div
                  style={{
                    ...st.targetBarFill,
                    width: `${Math.min(100, (run.coins / run.target) * 100)}%`,
                    background: run.coins >= run.target ? "#5db872" : "#f5c542",
                  }}
                />
                <span style={st.targetLabel}>
                  목표 🪙{run.target.toLocaleString()} {run.coins >= run.target ? "달성!" : ""}
                </span>
              </div>
              <div style={st.playsRow} data-testid="plays-row">
                {Array.from({ length: PLAYS_PER_ROUND }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      ...st.playDot,
                      background: i < run.playsLeft ? "#f5c542" : "#4a3f33",
                    }}
                  />
                ))}
                <span style={st.playsLabel}>기회 {run.playsLeft}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {canBank(run) && !locked ? (
                <button type="button" className="btn-gold" data-testid="bank-btn" onClick={bankRound}>
                  라운드 마감 (+{bankBonus(run).toLocaleString()})
                </button>
              ) : null}
            </div>
          </div>

          {/* 부스 탭 */}
          <div style={st.tabRow}>
            <button
              type="button"
              className={`tab${run.booth === "scratch" ? " tab-on" : ""}`}
              data-testid="tab-scratch"
              onClick={() => switchBooth("scratch")}
            >
              🎟️ 스크래치
            </button>
            <button
              type="button"
              className={`tab${run.booth === "slot" ? " tab-on" : ""}`}
              data-testid="tab-slot"
              onClick={() => switchBooth("slot")}
            >
              🎰 슬롯머신
            </button>
          </div>

          <div style={st.boothArea}>
            {run.booth === "scratch" ? (
              <ScratchBooth coins={run.coins} locked={locked || clearInfo !== null} onPlay={handlePlay} onWin={handleWin} onDone={handleDone} />
            ) : (
              <SlotMachine coins={run.coins} locked={locked || clearInfo !== null} onPlay={handlePlay} onWin={handleWin} onDone={handleDone} />
            )}
          </div>

          {/* 라운드 클리어 팝업 */}
          {clearInfo !== null ? (
            <div style={st.overlay}>
              <div style={st.popup} className="pop-in" data-testid="clear-popup">
                <div style={{ fontSize: 42 }}>🏆</div>
                <h2 style={st.popupTitle}>ROUND {clearInfo.fromRound} CLEAR!</h2>
                {clearInfo.banked ? (
                  <p style={st.popupLine}>
                    안전 마감 보너스 <strong style={{ color: "#f5c542" }}>+{clearInfo.bonus.toLocaleString()}</strong> 코인
                  </p>
                ) : (
                  <p style={st.popupLine}>기회를 전부 불태우고 살아남았다!</p>
                )}
                <p style={st.popupLine}>
                  다음 목표 — 🪙{targetForRound(clearInfo.fromRound + 1).toLocaleString()} · 기회 {PLAYS_PER_ROUND}회 리셋
                </p>
                <button type="button" className="btn-gold btn-big" data-testid="next-round-btn" onClick={proceedNextRound}>
                  라운드 {clearInfo.fromRound + 1} 시작 →
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {phase === "result" && result !== null ? (
        <section style={st.titleWrap} data-testid="result-view">
          <div style={{ fontSize: 48 }}>{result.isNewBest ? "🏆" : "💸"}</div>
          <h1 style={{ ...st.logo, fontSize: 40 }}>게임 오버</h1>
          <p style={st.logoKo}>
            {result.reason === "broke" ? "파산 — 티켓 한 장 살 코인이 없다" : "목표 미달 — 코인이 목표에 닿지 못했다"}
          </p>

          <div style={st.resultGrid} data-testid="result-grid">
            <div style={st.resultCell}>
              <div style={st.resultNum}>라운드 {result.round}</div>
              <div style={st.resultLabel}>도달</div>
            </div>
            <div style={st.resultCell}>
              <div style={st.resultNum}>🪙{result.coins.toLocaleString()}</div>
              <div style={st.resultLabel}>최종 코인</div>
            </div>
          </div>
          {result.isNewBest ? (
            <p style={{ color: "#f5c542", fontWeight: 800, fontSize: 18, margin: "12px 0 0" }} className="pop-in">
              신기록!
            </p>
          ) : null}
          {best !== null ? (
            <p style={{ color: "#b8a58f", fontSize: 14, marginTop: 10 }}>
              최고 기록 — 라운드 {best.bestRound} · 🪙{best.bestCoins.toLocaleString()} · {best.totalRuns}런
            </p>
          ) : null}

          <div style={{ ...st.titleBtns, marginTop: 22 }}>
            <button type="button" className="btn-gold btn-big" data-testid="result-newrun-btn" onClick={startNewRun}>
              한 판 더
            </button>
            <button
              type="button"
              className="btn-ghost"
              data-testid="to-title-btn"
              onClick={() => {
                sfx.blip();
                setPhase("title");
              }}
            >
              타이틀로
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

// 숫자가 촤르륵 올라가는 코인 카운터
function CoinCounter({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = shownRef.current;
    const diff = value - from;
    if (diff === 0) return;
    const dur = 600;
    const t0 = performance.now();
    let lastTick = 0;
    function frame(now: number) {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(from + diff * eased);
      shownRef.current = cur;
      setShown(cur);
      if (now - lastTick > 70 && t < 1) {
        sfx.countTick();
        lastTick = now;
      }
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return <strong data-testid="coin-count">{shown.toLocaleString()}</strong>;
}

// ── 스타일 (웜 카지노 카툰: 다크레드 배경 + 골드) ─────────────
const SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const GOLD = "#f5c542";

const st: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    fontFamily: SANS,
    color: "#f7ecd7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "36px 16px 60px",
    position: "relative",
    background:
      "radial-gradient(600px 300px at 15% 8%, rgba(214,110,60,0.25), transparent 70%)," +
      "radial-gradient(500px 320px at 85% 18%, rgba(214,69,65,0.2), transparent 70%)," +
      "radial-gradient(700px 500px at 50% 110%, rgba(120,30,25,0.5), transparent 70%)," +
      "linear-gradient(180deg, #3a120f 0%, #2a0d0b 60%, #200908 100%)",
  },
  muteBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    fontSize: 18,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(245,197,66,0.4)",
    borderRadius: 999,
    width: 40,
    height: 40,
    cursor: "pointer",
    zIndex: 20,
  },
  // S1 / S3
  titleWrap: { textAlign: "center", maxWidth: 560, width: "100%", paddingTop: 40 },
  logoDeco: { fontSize: 54, marginBottom: 6 },
  logo: {
    fontFamily: SERIF,
    fontSize: 56,
    fontWeight: 700,
    letterSpacing: 6,
    color: GOLD,
    textShadow: "0 0 24px rgba(245,197,66,0.35), 0 3px 0 #8a6400",
    margin: "0 0 8px",
  },
  logoKo: { color: "#d9c9ae", fontSize: 16, margin: "0 0 28px" },
  titleBtns: { display: "flex", flexDirection: "column", gap: 12, alignItems: "center" },
  confirmBox: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(245,197,66,0.4)",
    borderRadius: 12,
    padding: "14px 18px",
    fontSize: 14,
  },
  bestBox: {
    marginTop: 24,
    fontSize: 14,
    color: "#d9c9ae",
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(245,197,66,0.25)",
    borderRadius: 999,
    padding: "8px 18px",
    display: "inline-block",
  },
  notice: { marginTop: 30, fontSize: 12, color: "#8f7a63" },
  subLink: { fontSize: 12, color: "#8f7a63", textDecoration: "none" },
  // S2
  gameWrap: { width: "100%", maxWidth: 980 },
  hud: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(245,197,66,0.35)",
    borderRadius: 16,
    padding: "12px 18px",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  hudCoins: { fontSize: 20, fontWeight: 700, color: GOLD, whiteSpace: "nowrap" },
  hudCenter: { flex: 1, minWidth: 220 },
  hudRound: { fontSize: 12, letterSpacing: 2, color: "#d9c9ae", fontWeight: 700, marginBottom: 4 },
  targetBarWrap: {
    position: "relative",
    height: 22,
    background: "#1c0f0d",
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid rgba(245,197,66,0.25)",
  },
  targetBarFill: { position: "absolute", inset: 0, width: "0%", transition: "width 0.5s ease" },
  targetLabel: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#2a0d0b",
    mixBlendMode: "normal",
    textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  },
  playsRow: { display: "flex", alignItems: "center", gap: 4, marginTop: 6 },
  playDot: { width: 9, height: 9, borderRadius: 999, display: "inline-block", transition: "background 0.3s" },
  playsLabel: { fontSize: 12, color: "#b8a58f", marginLeft: 6 },
  tabRow: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 },
  boothArea: {
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(245,197,66,0.2)",
    borderRadius: 18,
    padding: "20px 16px 24px",
    minHeight: 380,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,5,4,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  popup: {
    background: "linear-gradient(180deg, #3a2c17, #241a0d)",
    border: "2px solid " + GOLD,
    borderRadius: 20,
    padding: "26px 34px 30px",
    textAlign: "center",
    maxWidth: 420,
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  popupTitle: { fontFamily: SERIF, color: GOLD, fontSize: 30, margin: "8px 0 12px", letterSpacing: 2 },
  popupLine: { color: "#e7d9bd", fontSize: 15, margin: "6px 0" },
  resultGrid: { display: "flex", gap: 12, justifyContent: "center", marginTop: 20 },
  resultCell: {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(245,197,66,0.3)",
    borderRadius: 14,
    padding: "16px 26px",
  },
  resultNum: { fontSize: 22, fontWeight: 800, color: "#f7ecd7" },
  resultLabel: { fontSize: 12, color: "#b8a58f", marginTop: 4 },
};

const gameCss = `
  body { margin: 0; background: #2a0d0b; }

  .btn-gold {
    font-family: ${SANS};
    font-size: 14px; font-weight: 800;
    color: #3a2703;
    background: linear-gradient(180deg, #ffdd87, ${GOLD} 55%, #d9a621);
    border: none; border-radius: 999px;
    padding: 12px 22px; cursor: pointer;
    box-shadow: 0 3px 0 #8a6400, 0 6px 14px rgba(0,0,0,0.35);
    transition: transform 0.1s, box-shadow 0.1s, filter 0.15s;
  }
  .btn-gold:hover:not(:disabled) { filter: brightness(1.06); }
  .btn-gold:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #8a6400; }
  .btn-gold:disabled { filter: grayscale(0.7) brightness(0.7); cursor: default; }
  .btn-big { font-size: 16px; padding: 15px 34px; }

  .btn-ghost {
    font-family: ${SANS};
    font-size: 14px; font-weight: 600;
    color: #d9c9ae; background: transparent;
    border: 1px solid rgba(245,197,66,0.45); border-radius: 999px;
    padding: 11px 22px; cursor: pointer;
    transition: background 0.15s;
  }
  .btn-ghost:hover { background: rgba(245,197,66,0.12); }

  .link-btn {
    font-family: ${SANS}; font-size: 12px;
    color: #b8a58f; background: none; border: none;
    text-decoration: underline; cursor: pointer; padding: 0;
  }

  .tab {
    font-family: ${SANS};
    font-size: 15px; font-weight: 700;
    color: #b8a58f; background: rgba(0,0,0,0.3);
    border: 1px solid rgba(245,197,66,0.25);
    border-radius: 12px 12px 0 0;
    padding: 11px 26px; cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .tab:hover { color: #f7ecd7; }
  .tab.tab-on {
    color: #3a2703;
    background: linear-gradient(180deg, #ffdd87, ${GOLD});
    border-color: ${GOLD};
  }

  .chip {
    font-family: ${SANS};
    font-size: 13px; font-weight: 800;
    color: #f7ecd7; background: #1c1936;
    border: 2px solid #4a4580; border-radius: 999px;
    width: 62px; height: 40px; cursor: pointer;
    transition: border-color 0.15s, transform 0.1s;
  }
  .chip:hover:not(:disabled) { transform: translateY(-1px); }
  .chip.chip-on { border-color: ${GOLD}; color: ${GOLD}; box-shadow: 0 0 10px rgba(245,197,66,0.35); }
  .chip:disabled { opacity: 0.45; cursor: default; }

  .tier-card {
    font-family: ${SANS};
    display: flex; flex-direction: column; align-items: center;
    background: linear-gradient(180deg, #33305e, #232043);
    border: 2px solid #4a4580; border-radius: 16px;
    padding: 16px 18px; width: 128px; cursor: pointer;
    transition: transform 0.12s, border-color 0.15s, box-shadow 0.15s;
  }
  .tier-card:hover:not(:disabled) { transform: translateY(-3px); border-color: ${GOLD}; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
  .tier-card:disabled { opacity: 0.5; cursor: default; }

  .bulb {
    width: 10px; height: 10px; border-radius: 999px;
    background: #7d6320; display: inline-block;
    box-shadow: inset 0 0 2px rgba(0,0,0,0.4);
  }
  .bulb.blink { animation: bulbBlink 0.45s infinite alternate; }
  @keyframes bulbBlink {
    from { background: #7d6320; box-shadow: none; }
    to { background: ${GOLD}; box-shadow: 0 0 10px ${GOLD}; }
  }

  .pop-in { animation: popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  @keyframes popIn {
    from { opacity: 0; transform: scale(0.92) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .shake { animation: shake 0.5s ease-in-out 2; }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px) rotate(-0.5deg); }
    40% { transform: translateX(6px) rotate(0.5deg); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  .reel-glow { box-shadow: 0 0 18px rgba(245,197,66,0.7), inset 0 0 12px rgba(245,197,66,0.3); }
`;
