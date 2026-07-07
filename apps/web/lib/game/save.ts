// 럭키런 — 저장 어댑터. 게임 코드는 localStorage 를 직접 만지지 않고 반드시 이 파일을 거친다.
// 스팀판(Electron/Tauri)에서는 이 파일만 파일 저장/Steam Cloud 구현으로 갈아끼운다 (docs/plan/05-db.md).

export interface BestRecord {
  bestRound: number;
  bestCoins: number;
  totalRuns: number;
}

export interface ActiveRun {
  coins: number;
  round: number;
  target: number;
  playsLeft: number;
  booth: "scratch" | "slot";
  savedAt: number;
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
    v.playsLeft >= 0
  );
}

function isSettings(v: unknown): v is Settings {
  return isRecord(v) && typeof v.soundOn === "boolean";
}

export const saveStore = {
  loadBest: () => read(KEY_BEST, isBest),
  saveBest: (b: BestRecord) => write(KEY_BEST, b),
  clearBest: () => remove(KEY_BEST),

  loadRun: () => read(KEY_RUN, isRun),
  saveRun: (r: ActiveRun) => write(KEY_RUN, r),
  clearRun: () => remove(KEY_RUN),

  loadSettings: () => read(KEY_SETTINGS, isSettings),
  saveSettings: (s: Settings) => write(KEY_SETTINGS, s),
};
