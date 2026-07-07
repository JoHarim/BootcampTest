// 럭키런 — 저장 어댑터. 게임 코드는 localStorage 를 직접 만지지 않고 반드시 이 파일을 거친다.
// 스팀판(Electron/Tauri)에서는 이 파일만 파일 저장/Steam Cloud 구현으로 갈아끼운다 (docs/plan/05-db.md).

export interface BestRecord {
  bestRound: number;
  bestCoins: number;
  totalRuns: number;
}

// 미스터 핀 대출 상태 — 반드시 luckyrun:run 안에 함께 저장(코인과 빚이 따로 놀면 세이브 스컴 구멍)
export interface LoanState {
  principal: number; // 원금
  perPlay: number; // 기회당 이자 (대출 시점에 고정)
  accrued: number; // 누적 이자
}

export interface ActiveRun {
  coins: number;
  round: number;
  target: number;
  playsLeft: number;
  booth: "scratch" | "slot";
  savedAt: number;
  loan: LoanState | null;
  loanUsedThisRound: boolean; // 라운드당 신규 대출 1회 제한
}

export interface Settings {
  soundOn: boolean;
}

const KEY_BEST = "luckyrun:best";
const KEY_RUN = "luckyrun:run";
const KEY_SETTINGS = "luckyrun:settings";

// 읽기 공통 — 파싱 실패·형식 불일치면 null (없는 것으로 취급, 에러 화면 금지)
function read<T>(key: string, validate: (v: unknown) => v is T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// 쓰기 공통 — 실패해도 게임은 계속 (콘솔 경고만)
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[luckyrun] 저장 실패: ${key}`, e);
  }
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 무시
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isBest(v: unknown): v is BestRecord {
  return (
    isRecord(v) &&
    typeof v.bestRound === "number" &&
    typeof v.bestCoins === "number" &&
    typeof v.totalRuns === "number"
  );
}

function isLoan(v: unknown): v is LoanState {
  return (
    isRecord(v) &&
    typeof v.principal === "number" &&
    typeof v.perPlay === "number" &&
    typeof v.accrued === "number" &&
    v.principal > 0 &&
    v.accrued >= 0
  );
}

// 대출 필드는 나중에 추가된 옵션 — 구버전 저장 런(필드 없음)을 유효로 인정해야 런이 증발하지 않는다
function isRun(v: unknown): v is ActiveRun {
  return (
    isRecord(v) &&
    typeof v.coins === "number" &&
    typeof v.round === "number" &&
    typeof v.target === "number" &&
    typeof v.playsLeft === "number" &&
    (v.booth === "scratch" || v.booth === "slot") &&
    typeof v.savedAt === "number" &&
    v.coins >= 0 &&
    v.round >= 1 &&
    v.playsLeft >= 0 &&
    (v.loan === undefined || v.loan === null || isLoan(v.loan)) &&
    (v.loanUsedThisRound === undefined || typeof v.loanUsedThisRound === "boolean")
  );
}

// 구버전 저장 런을 현재 형태로 채워서 반환 (마이그레이션)
function normalizeRun(run: ActiveRun): ActiveRun {
  return {
    ...run,
    loan: run.loan ?? null,
    loanUsedThisRound: run.loanUsedThisRound ?? false,
  };
}

function isSettings(v: unknown): v is Settings {
  return isRecord(v) && typeof v.soundOn === "boolean";
}

export const saveStore = {
  loadBest: () => read(KEY_BEST, isBest),
  saveBest: (b: BestRecord) => write(KEY_BEST, b),
  clearBest: () => remove(KEY_BEST),

  loadRun: () => {
    const run = read(KEY_RUN, isRun);
    return run === null ? null : normalizeRun(run);
  },
  saveRun: (r: ActiveRun) => write(KEY_RUN, r),
  clearRun: () => remove(KEY_RUN),

  loadSettings: () => read(KEY_SETTINGS, isSettings),
  saveSettings: (s: Settings) => write(KEY_SETTINGS, s),
};
