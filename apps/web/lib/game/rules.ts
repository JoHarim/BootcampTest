// 럭키런 — 게임 규칙·확률표. 전부 순수 데이터/계산 (화면 없음). 수치는 밸런스 조정 가능.

export const GAME_NAME = "럭키런";
export const START_COINS = 500;
export const PLAYS_PER_ROUND = 10;
export const MIN_PLAY_COST = 50; // 이보다 코인이 적으면 아무것도 못 산다 = 파산

const FIRST_TARGET = 800;
const TARGET_GROWTH = 1.6;

// 라운드 목표 코인: 800 → 1300 → 2050 → … (50 단위 반올림)
export function targetForRound(round: number): number {
  let t = FIRST_TARGET;
  for (let i = 1; i < round; i++) t *= TARGET_GROWTH;
  return Math.round(t / 50) * 50;
}

// 라운드 마감(뱅킹) 시 남은 기회 1개당 보너스 코인 — 라운드에 비례
export function bankBonusPerPlay(round: number): number {
  return 25 * round;
}

// ── 공용: 가중치 추첨 ────────────────────────────────────
interface Weighted<T> {
  value: T;
  weight: number;
}

function drawWeighted<T>(table: Weighted<T>[]): T {
  const total = table.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const c of table) {
    roll -= c.weight;
    if (roll <= 0) return c.value;
  }
  return table[table.length - 1].value;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 스크래치 복권 ─────────────────────────────────────────
// 6칸을 긁어서 같은 금액이 3개면 그 금액 당첨. 결과(당첨금)를 먼저 뽑고 칸을 그에 맞게 깐다.
export type TicketTierId = "bronze" | "silver" | "gold";

export interface TicketTier {
  id: TicketTierId;
  name: string;
  cost: number;
  // weight 합 100. amount 0 = 꽝. EV 약 0.96~0.98.
  prizes: Weighted<number>[];
}

export const TICKET_TIERS: TicketTier[] = [
  {
    id: "bronze",
    name: "동 티켓",
    cost: 50,
    prizes: [
      { value: 0, weight: 58 },
      { value: 50, weight: 24 },
      { value: 100, weight: 11 },
      { value: 250, weight: 6 },
      { value: 1000, weight: 1 },
    ],
  },
  {
    id: "silver",
    name: "은 티켓",
    cost: 150,
    prizes: [
      { value: 0, weight: 58 },
      { value: 150, weight: 24 },
      { value: 300, weight: 11 },
      { value: 750, weight: 6 },
      { value: 3000, weight: 1 },
    ],
  },
  {
    id: "gold",
    name: "금 티켓",
    cost: 400,
    prizes: [
      { value: 0, weight: 58 },
      { value: 400, weight: 24 },
      { value: 800, weight: 11 },
      { value: 2000, weight: 6 },
      { value: 8888, weight: 1 },
    ],
  },
];

export interface TicketResult {
  prize: number; // 0 = 꽝
  cells: number[]; // 6칸에 적힌 금액 (당첨이면 prize 가 정확히 3번, 꽝이면 어떤 금액도 3번 미만)
}

export function drawTicket(tier: TicketTier): TicketResult {
  const prize = drawWeighted(tier.prizes);
  const amounts = tier.prizes.filter((p) => p.value > 0).map((p) => p.value);
  let cells: number[];
  if (prize > 0) {
    // 당첨: prize 3개 + 나머지 금액 중 하나가 2개, 또 하나가 1개 (아깝게 보이는 배치)
    const others = shuffle(amounts.filter((a) => a !== prize));
    cells = [prize, prize, prize, others[0], others[0], others[1]];
  } else {
    // 꽝: 서로 다른 금액 3종을 2개씩 — 전부 "한 끗 차이"로 보인다
    const picked = shuffle(amounts).slice(0, 3);
    cells = [picked[0], picked[0], picked[1], picked[1], picked[2], picked[2]];
  }
  return { prize, cells: shuffle(cells) };
}

// ── 슬롯머신 ─────────────────────────────────────────────
export type SlotSymbol = "cherry" | "lemon" | "star" | "gem" | "seven";

export const SLOT_BETS = [50, 150, 400];

export const SYMBOL_ICON: Record<SlotSymbol, string> = {
  cherry: "🍒",
  lemon: "🍋",
  star: "⭐",
  gem: "💎",
  seven: "7️⃣",
};

// 릴에 감긴 심볼 띠 (연출용 — 확률은 아래 결과표가 정한다)
export const REEL_STRIP: SlotSymbol[] = [
  "cherry", "lemon", "star", "cherry", "gem", "lemon",
  "seven", "cherry", "lemon", "star", "gem", "lemon",
];

// 베팅 배수. 트리플 = 같은 심볼 3개, 페어 = 2개.
export const TRIPLE_MULT: Record<SlotSymbol, number> = {
  cherry: 2,
  lemon: 4,
  star: 6,
  gem: 12,
  seven: 50,
};
export const PAIR_MULT = 1.2;

export interface SpinOutcome {
  symbols: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number; // 베팅 대비 배수 (0 = 꽝)
  kind: "triple" | "pair" | "miss";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tripleOutcome(s: SlotSymbol): SpinOutcome {
  return { symbols: [s, s, s], multiplier: TRIPLE_MULT[s], kind: "triple" };
}

function pairOutcome(): SpinOutcome {
  const s = pick<SlotSymbol>(["cherry", "lemon", "star"]);
  const others: SlotSymbol[] = (["cherry", "lemon", "star", "gem", "seven"] as SlotSymbol[]).filter(
    (x) => x !== s,
  );
  const o = pick(others);
  const layouts: [SlotSymbol, SlotSymbol, SlotSymbol][] = [
    [s, s, o],
    [o, s, s],
    [s, o, s],
  ];
  return { symbols: pick(layouts), multiplier: PAIR_MULT, kind: "pair" };
}

function missOutcome(): SpinOutcome {
  // 꽝의 30%는 니어미스(7-7-X) — 도파민의 정수
  if (Math.random() < 0.3) {
    const spoiler = pick<SlotSymbol>(["cherry", "lemon", "star", "gem"]);
    return { symbols: ["seven", "seven", spoiler], multiplier: 0, kind: "miss" };
  }
  const a = pick(REEL_STRIP);
  let b = pick(REEL_STRIP);
  let c = pick(REEL_STRIP);
  if (b === a) b = a === "cherry" ? "lemon" : "cherry";
  if (c === a || c === b) c = a !== "star" && b !== "star" ? "star" : "gem";
  return { symbols: [a, b, c], multiplier: 0, kind: "miss" };
}

// 결과표 (weight 합 10000, EV 약 0.96 — 히트율 약 34%)
const SPIN_TABLE: Weighted<() => SpinOutcome>[] = [
  { value: () => tripleOutcome("seven"), weight: 35 },
  { value: () => tripleOutcome("gem"), weight: 120 },
  { value: () => tripleOutcome("star"), weight: 200 },
  { value: () => tripleOutcome("lemon"), weight: 350 },
  { value: () => tripleOutcome("cherry"), weight: 700 },
  { value: pairOutcome, weight: 2000 },
  { value: missOutcome, weight: 6595 },
];

export function drawSpin(): SpinOutcome {
  return drawWeighted(SPIN_TABLE)();
}
