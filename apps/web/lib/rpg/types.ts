// 사주 RPG — 공용 타입 계약 (모든 rpg 모듈은 이 파일의 정의만 바라본다)
// 의존 방향: types ← content ← saju-engine ← battle ← app/rpg/page.tsx
// 이 파일은 타입/인터페이스만 담는다. 값·로직 금지.

// ── 오행 ──────────────────────────────────────────────
export type Element = "木" | "火" | "土" | "金" | "水";

// 오행 → 능력치 매핑 (PRD 5-1 승계): 木=체력 / 火=공격 / 土=운 / 金=방어 / 水=지능
export type StatKey = "hp" | "atk" | "def" | "int" | "luk";

export type ElementScore = Record<Element, number>;

export interface Stats {
  hp: number; // 木 — 최대 생명력 배수
  atk: number; // 火 — 물리 공격
  def: number; // 金 — 피해 감소
  int: number; // 水 — 스킬 위력
  luk: number; // 土 — 치명타·보상 보정
}

// ── 사주 ──────────────────────────────────────────────
export interface Pillar {
  gan: string; // 천간 한자 1글자 (예: 甲)
  zhi: string; // 지지 한자 1글자 (예: 子)
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  time: Pillar | null; // 태어난 시각 모르면 null (시주 제외 계산)
}

export type TenGodKey =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

// ── 직업(격국) ────────────────────────────────────────
export interface SkillDef {
  name: string;
  emoji: string;
  desc: string; // 한 줄 설명 (수치 포함)
  cooldown: number; // 재사용 대기 턴 수 (예: 3)
  power: number; // 데미지형: int × power / 회복형: maxHp × power(0~1)
  kind: "damage" | "heal";
}

export interface JobClass {
  id: string; // 영문 슬러그 (예: "guardian")
  tenGod: TenGodKey; // 격국 판정 키 (월지 본기 vs 일간의 십성)
  name: string; // 예: "수호기사"
  emoji: string;
  passiveDesc: string; // 패시브 한 줄 (수치 포함)
  passiveStat: StatKey; // 패시브가 올려주는 스탯
  passivePct: number; // 그 스탯 +% (예: 15)
  skill: SkillDef;
}

// ── 캐릭터 ────────────────────────────────────────────
export interface Character {
  birthDate: string; // 'YYYY-MM-DD'
  birthTime: string; // 'HH:MM' | ''
  pillars: FourPillars;
  dayMaster: string; // 일간 한자 (예: 庚)
  dayElement: Element; // 일간 오행 = 내 공격 속성
  elements: ElementScore; // 가중치·생극 보정 후 최종 오행 점수 (소수 1자리 반올림)
  stats: Stats; // 레벨 1 기준 (패시브 반영 전)
  job: JobClass;
  power: number; // 종합 전투력 (공개 화면 연출용, 정수)
}

// 오늘의 기운 (일운) — PRD 5-8의 MVP 축소판
export interface DailyFortune {
  ganzhiKo: string; // 예: "임오"
  ganzhiHanja: string; // 예: "壬午"
  element: Element; // 오늘 일진 천간의 오행
  statKey: StatKey; // 오늘 +% 받는 스탯
  bonusPct: number; // 예: 15
  desc: string; // 예: "오늘은 火 기운 — 공격력 +15%"
}

// ── 콘텐츠 ────────────────────────────────────────────
export interface Monster {
  id: string;
  name: string;
  emoji: string;
  element: Element;
  hp: number;
  atk: number;
  def: number;
  exp: number; // 처치 시 경험치
  isBoss: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  emoji: string;
  element: Element; // 던전 주 속성 (몬스터 대부분 이 속성)
  desc: string; // 한 줄 (예: "화 속성 — 水 기운이 유리해요")
  stages: Monster[]; // 스테이지당 몬스터 1마리, 길이 5, 마지막은 isBoss=true
}

// ── 전투 ──────────────────────────────────────────────
export interface Combatant {
  name: string;
  emoji: string;
  element: Element;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  int: number;
  luk: number;
}

export type BattleCommand = "attack" | "skill";

export interface BattleEvent {
  kind: "player-hit" | "foe-hit" | "skill" | "heal" | "crit" | "info" | "win" | "lose";
  text: string; // 로그 한 줄 (예: "⚔️ 불도깨비에게 24 피해! (상성 유리 ×1.5)")
  amount?: number;
}

export interface BattleState {
  turn: number; // 1부터
  player: Combatant;
  foe: Combatant;
  job: JobClass;
  skillCooldown: number; // 0이면 사용 가능
  fortune: DailyFortune | null;
  seed: number; // 결정적 난수 상태 (스텝마다 갱신)
  over: boolean;
  won: boolean;
}

// ── 저장 ──────────────────────────────────────────────
// localStorage 키: "sajuweb:rpg"
export interface SaveData {
  birthDate: string;
  birthTime: string;
  level: number;
  exp: number;
  clearedStages: Record<string, number>; // 던전 id → 클리어한 최고 스테이지 (1~5)
}

// ── 모듈별 필수 export 계약 ───────────────────────────
// content.ts:
//   export const JOBS: Record<TenGodKey, JobClass>
//   export const DUNGEONS: Dungeon[]            // 오행별 5개
//   export function expForLevel(level: number): number   // 다음 레벨까지 필요 경험치
//   export const MAX_LEVEL: number
// saju-engine.ts:
//   export function createCharacter(birthDate: string, birthTime: string): Character  // 실패 시 throw
//   export function getDailyFortune(c: Character, today: Date): DailyFortune
//   export function statsAtLevel(base: Stats, level: number): Stats  // 레벨 성장 반영 (패시브 포함 전)
//   export function elementMultiplier(attacker: Element, defender: Element): number  // 극함 1.5 / 극당함 0.7 / 그 외 1.0
//   export function elementColor(e: Element): string  // 오행 → 표시 색 (DESIGN.md 팔레트)
//   export function elementKo(e: Element): string     // 木→목 …
// battle.ts:
//   export function initBattle(c: Character, level: number, m: Monster, f: DailyFortune | null, seed: number): BattleState
//   export function stepBattle(s: BattleState, cmd: BattleCommand): { state: BattleState; events: BattleEvent[] }
//     — 순수 함수(인자 불변), 플레이어 행동 → 생존 시 몬스터 반격 1회까지가 한 스텝
