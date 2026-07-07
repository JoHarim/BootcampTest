// 럭키런 — 런 상태 머신 (순수 함수만, 화면·저장 없음)
//
// 판정 이원화 불변식 (사채 시스템의 건전성 전제 — 바꾸지 말 것):
//   목표 달성(judge의 reached)·마감 버튼(canBank) = 순자산(netWorth = 코인 - 빚) 기준
//   파산(broke)·구매 가능(canAfford)             = 총 코인 기준
// 순자산까지 파산 기준으로 쓰면 대출(코인+빚 동시 증가, 순자산 불변)을 받는 순간 즉사하고,
// 목표 판정이 코인 기준으로 남으면 마지막 기회 대출로 공짜 클리어가 된다.

import {
  MIN_PLAY_COST,
  PLAYS_PER_ROUND,
  START_COINS,
  bankBonusPerPlay,
  loanAmountFor,
  loanInterestPerPlay,
  targetForRound,
} from "./rules";
import type { ActiveRun } from "./save";

export function newRun(): ActiveRun {
  return {
    coins: START_COINS,
    round: 1,
    target: targetForRound(1),
    playsLeft: PLAYS_PER_ROUND,
    booth: "scratch",
    savedAt: Date.now(),
    loan: null,
    loanUsedThisRound: false,
  };
}

// ── 빚 계산 (단일 헬퍼 — judge/canBank 는 반드시 이것만 쓴다) ──
export function debtTotal(run: ActiveRun): number {
  return run.loan === null ? 0 : run.loan.principal + run.loan.accrued;
}

export function netWorth(run: ActiveRun): number {
  return run.coins - debtTotal(run);
}

export function canAfford(run: ActiveRun, cost: number): boolean {
  return run.playsLeft > 0 && run.coins >= cost;
}

// 플레이 1회 지불: 코인 차감 + 기회 1 소모 + (빚 있으면) 이자 1틱
export function payForPlay(run: ActiveRun, cost: number): ActiveRun {
  const loan =
    run.loan === null ? null : { ...run.loan, accrued: run.loan.accrued + run.loan.perPlay };
  return {
    ...run,
    coins: run.coins - cost,
    playsLeft: run.playsLeft - 1,
    loan,
    savedAt: Date.now(),
  };
}

// 당첨금 지급
export function addWin(run: ActiveRun, win: number): ActiveRun {
  return { ...run, coins: run.coins + win, savedAt: Date.now() };
}

// ── 대출 ─────────────────────────────────────────────
export function canTakeLoan(run: ActiveRun): boolean {
  return (
    run.loan === null &&
    !run.loanUsedThisRound &&
    run.playsLeft >= 1 &&
    netWorth(run) < run.target // 목표 달성 상태의 대출은 무의미 — 원천 차단
  );
}

export function loanOffer(run: ActiveRun): { amount: number; perPlay: number } {
  const amount = loanAmountFor(run.target, run.playsLeft);
  return { amount, perPlay: loanInterestPerPlay(amount) };
}

export function takeLoan(run: ActiveRun): ActiveRun {
  const { amount, perPlay } = loanOffer(run);
  return {
    ...run,
    coins: run.coins + amount,
    loan: { principal: amount, perPlay, accrued: 0 },
    loanUsedThisRound: true,
    savedAt: Date.now(),
  };
}

// 수동 조기 상환 — 원금+누적이자 전액 일시불만 (부분 상환은 이자 증발 악용 구멍)
// 상환으로 파산 상태(코인<50)를 만드는 것은 UI에서 canRepay 로 차단한다.
export function canRepay(run: ActiveRun): boolean {
  if (run.loan === null) return false;
  const after = run.coins - debtTotal(run);
  return after >= MIN_PLAY_COST || after >= run.target;
}

export function repayLoan(run: ActiveRun): ActiveRun {
  if (run.loan === null) return run;
  return { ...run, coins: run.coins - debtTotal(run), loan: null, savedAt: Date.now() };
}

// ── 판정 ─────────────────────────────────────────────
export type RunJudgment =
  | "playing" // 계속 진행
  | "clear" // 기회 소진 & 목표 달성(순자산) → 라운드 클리어
  | "broke-rescue" // 플레이 불능이지만 대출 가능 → 구제 모달 (라운드당 1회, 거절 = 게임오버)
  | "gameover-target" // 기회 소진 & 목표 미달
  | "gameover-broke"; // 플레이 불능 & 대출도 불가

// 한 플레이가 정산된 뒤 호출
export function judge(run: ActiveRun): RunJudgment {
  const reached = netWorth(run) >= run.target;
  if (run.playsLeft <= 0) return reached ? "clear" : "gameover-target";
  if (!reached && run.coins < MIN_PLAY_COST) {
    return canTakeLoan(run) ? "broke-rescue" : "gameover-broke";
  }
  return "playing";
}

// 목표 조기 달성 시 마감 버튼 활성 여부 (순자산 기준 — 빚 낀 마감 보너스 차익 차단)
export function canBank(run: ActiveRun): boolean {
  return run.playsLeft > 0 && netWorth(run) >= run.target;
}

// 라운드 마감(뱅킹) 시 보너스 코인
export function bankBonus(run: ActiveRun): number {
  return run.playsLeft * bankBonusPerPlay(run.round);
}

// 다음 라운드로 — 정산 순서 고정: ① 순자산 판정(호출 전에 끝남) ② 보너스 지급 ③ 빚 자동 전액 상환.
// 순자산 ≥ 목표 ≥ 800 > 0 이므로 코인 ≥ 빚 — 상환 후 음수 코인은 발생 불가(불변식).
// 빚은 어떤 경로(클리어·마감)로도 다음 라운드로 넘어가지 않는다.
export function nextRound(run: ActiveRun, banked: boolean): ActiveRun {
  const bonus = banked ? bankBonus(run) : 0;
  const round = run.round + 1;
  return {
    ...run,
    coins: run.coins + bonus - debtTotal(run),
    loan: null,
    loanUsedThisRound: false,
    round,
    target: targetForRound(round),
    playsLeft: PLAYS_PER_ROUND,
    savedAt: Date.now(),
  };
}
