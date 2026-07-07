// 럭키런 — 런 상태 머신 (순수 함수만, 화면·저장 없음)

import {
  MIN_PLAY_COST,
  PLAYS_PER_ROUND,
  START_COINS,
  bankBonusPerPlay,
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
  };
}

export function canAfford(run: ActiveRun, cost: number): boolean {
  return run.playsLeft > 0 && run.coins >= cost;
}

// 플레이 1회 지불: 코인 차감 + 기회 1 소모
export function payForPlay(run: ActiveRun, cost: number): ActiveRun {
  return { ...run, coins: run.coins - cost, playsLeft: run.playsLeft - 1, savedAt: Date.now() };
}

// 당첨금 지급
export function addWin(run: ActiveRun, win: number): ActiveRun {
  return { ...run, coins: run.coins + win, savedAt: Date.now() };
}

export type RunJudgment =
  | "playing" // 계속 진행
  | "clear" // 기회 소진 & 목표 달성 → 라운드 클리어
  | "gameover-target" // 기회 소진 & 목표 미달
  | "gameover-broke"; // 기회는 남았는데 최저 플레이 비용도 없음 (목표 미달)

// 한 플레이가 정산된 뒤 호출
export function judge(run: ActiveRun): RunJudgment {
  const reached = run.coins >= run.target;
  if (run.playsLeft <= 0) return reached ? "clear" : "gameover-target";
  if (!reached && run.coins < MIN_PLAY_COST) return "gameover-broke";
  return "playing";
}

// 목표 조기 달성 시 마감 버튼 활성 여부
export function canBank(run: ActiveRun): boolean {
  return run.playsLeft > 0 && run.coins >= run.target;
}

// 라운드 마감(뱅킹) 시 보너스 코인
export function bankBonus(run: ActiveRun): number {
  return run.playsLeft * bankBonusPerPlay(run.round);
}

// 다음 라운드로 (banked = 마감 버튼으로 왔으면 보너스 포함)
export function nextRound(run: ActiveRun, banked: boolean): ActiveRun {
  const bonus = banked ? bankBonus(run) : 0;
  const round = run.round + 1;
  return {
    ...run,
    coins: run.coins + bonus,
    round,
    target: targetForRound(round),
    playsLeft: PLAYS_PER_ROUND,
    savedAt: Date.now(),
  };
}
