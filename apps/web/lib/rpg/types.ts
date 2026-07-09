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
// v2: 모드 B(수집)에서 글자가 비어 있을 수 있어 슬롯 단위 nullable.
// 모드 A는 년·월·일 전부 채움(시각 미입력이면 time 이 {null,null}). day.gan 은 두 모드 모두 항상 존재.
export interface PillarSlot {
  gan: string | null; // 천간 한자 1글자 (예: 甲) | 빈 슬롯
  zhi: string | null; // 지지 한자 1글자 (예: 子) | 빈 슬롯
}

export interface FourPillars {
  year: PillarSlot;
  month: PillarSlot;
  day: PillarSlot;
  time: PillarSlot;
}

// 모드 B 장착 슬롯 7개 (일간은 캐릭터 정체성이라 SaveData.dayGan 에 고정, 여기 없음)
export interface LetterSlots {
  yearGan: string | null;
  yearZhi: string | null;
  monthGan: string | null;
  monthZhi: string | null;
  dayZhi: string | null;
  timeGan: string | null;
  timeZhi: string | null;
}

export type TenGodKey =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

// 십성 5그룹 (시너지 집계 단위): 비겁=비견·겁재 / 식상=식신·상관 / 재성=편재·정재 / 관성=편관·정관 / 인성=편인·정인
export type TenGodGroup = "비겁" | "식상" | "재성" | "관성" | "인성";

// 시너지 정의 (content.ts SYNERGIES 데이터 — battle·UI 가 같은 소스를 소비한다)
export interface SynergyDef {
  name: string; // 예: "형제의 기세"
  emoji: string;
  unit: number; // 개수당 수치 (비겁·식상·관성 = %, 재성 = %p, 인성 = maxHp %)
  descUnit: string; // UI 문구 틀 — 예: "기본공격 피해 +{u}%×{n}"
}

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
  tenGod: TenGodKey | null; // 격국 판정 키 (월지 본기 vs 일간의 십성). null = 무격(모드 B 월지 공백)
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
  tenGodCounts: Record<TenGodGroup, number>; // 십성 시너지 집계 — 일간 제외 천간 3 + 지지 본기 4, 빈 슬롯 미집계 (설계서 9장)
  sinsals: SinsalKey[]; // 발동 중 신살 (설계서 10장 판정 — 중복 없음, 판정 순서 고정: 도화·역마·화개·천을귀인)
}

// 운의 흐름 (설계서 11장, PRD 5-8) — 대운·세운·월운·일운의 천간 오행이 대응 스탯을 가산
export type FlowKind = "대운" | "세운" | "월운" | "일운";

export interface FlowBuff {
  kind: FlowKind;
  ganzhiKo: string; // 예: "병오"
  ganzhiHanja: string; // 예: "丙午"
  element: Element; // 그 운 천간의 오행
  statKey: StatKey; // 가산 받는 스탯
  bonusPct: number; // 대운 20 / 세운 10 / 월운 5 / 일운 15
  label: string; // 예: "28~37세 경오(庚午) 대운" / "올해 병오(丙午)년" / "오늘 갑신(甲申)일"
}

// ── 신살 (설계서 10장, PRD 5-5) ───────────────────────
export type SinsalKey = "도화" | "역마" | "화개" | "천을귀인";

export interface SinsalDef {
  key: SinsalKey;
  name: string; // 예: "도화살"
  emoji: string;
  desc: string; // 효과 한 줄 (수치 포함)
  // 효과 파라미터 — 해당 신살만 사용 (content.ts SINSALS 데이터가 단일 소스)
  dropBonusPct?: number; // 도화: 글자 드랍 +1개 확률 %
  expBonusPct?: number; // 도화: 경험치 보너스 %
  strikePower?: number; // 역마: 선제 일격 = atk × 이 배율
  cooldownCut?: number; // 화개: 스킬 쿨다운 감소 (턴)
  reviveHpPct?: number; // 천을귀인: 부활 시 maxHp %
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
  kind: "player-hit" | "foe-hit" | "skill" | "heal" | "crit" | "info" | "win" | "lose" | "sinsal";
  text: string; // 로그 한 줄 (예: "⚔️ 불도깨비에게 24 피해! (상성 유리 ×1.5)")
  amount?: number;
}

export interface BattleState {
  turn: number; // 1부터
  player: Combatant;
  foe: Combatant;
  job: JobClass;
  skillCooldown: number; // 0이면 사용 가능
  skillCooldownMax: number; // 스킬 사용 후 재설정값 (화개 신살이 job.skill.cooldown 에서 감산)
  flows: FlowBuff[]; // 운의 흐름 (initBattle 에서 반영 완료 — 표시용 보관)
  synergy: Record<TenGodGroup, number>; // 십성 시너지 집계 (initBattle 에서 Character.tenGodCounts 복사)
  sinsals: SinsalKey[]; // 발동 중 신살 (initBattle 에서 Character.sinsals 복사)
  reviveUsed: boolean; // 천을귀인 부활 사용 여부 (전투당 1회)
  seed: number; // 결정적 난수 상태 (스텝마다 갱신)
  over: boolean;
  won: boolean;
}

// ── 저장 ──────────────────────────────────────────────
// localStorage 키: "sajuweb:rpg" — v2. 구버전(mode 필드 없음)은 mode "A" 로 마이그레이션해 읽는다.
export interface SaveData {
  mode: "A" | "B"; // A = 내 사주 / B = 사주 수집
  birthDate: string; // 모드 A 전용 (B 는 "")
  birthTime: string; // 모드 A 전용 (B 는 "")
  gender: "M" | "F" | ""; // 모드 A 대운 계산용 (선택 — "" 이면 대운 미표시). v2 저장 마이그레이션 기본 ""
  dayGan: string; // 모드 B 전용 — 선택한 일간 한자 (A 는 "")
  slots: LetterSlots | null; // 모드 B 전용 장착 상태 (A 는 null)
  inventory: string[]; // 모드 B 전용 — 획득 글자(한자 1글자씩, 중복 허용) (A 는 [])
  level: number;
  exp: number;
  clearedStages: Record<string, number>; // 던전 id → 클리어한 최고 스테이지 (1~5)
}

// ── 모듈별 필수 export 계약 (v2 — 모드 B 추가분 포함) ──
// content.ts:
//   export const JOBS: Record<TenGodKey, JobClass>
//   export const UNFORMED_JOB: JobClass          // 모드 B 월지 공백 폴백 — 무명객(無格)
//   export const DUNGEONS: Dungeon[]             // 오행별 5개
//   export const STEM_POOL: Record<Element, string[]>    // 오행 → 천간 글자 풀
//   export const BRANCH_POOL: Record<Element, string[]>  // 오행 → 지지 글자 풀
//   export const SYNERGIES: Record<TenGodGroup, SynergyDef>  // 십성 시너지 데이터 (수치·이름 단일 소스, 설계서 9장)
//   export const SINSALS: Record<SinsalKey, SinsalDef>       // 신살 데이터 (효과 파라미터 단일 소스, 설계서 10장)
//   export function expForLevel(level: number): number   // 다음 레벨까지 필요 경험치
//   export const MAX_LEVEL: number
// saju-engine.ts:
//   export function createCharacter(birthDate: string, birthTime: string): Character  // 모드 A. 실패 시 throw
//   export function createCharacterFromSlots(dayGan: string, slots: LetterSlots): Character  // 모드 B. 빈 슬롯 0 기여, 스케일 ×6 고정, 월지 없으면 UNFORMED_JOB
//   (두 생성 함수 모두 tenGodCounts 와 sinsals 를 채운다)
//   export function isStem(letter: string): boolean   // 천간이면 true, 지지면 false (미인식은 throw)
//   export function getFortuneFlow(c: Character, today: Date, gender: "M" | "F" | ""): FlowBuff[]
//     — 일운(15)+월운(5)+세운(10) 항상, 대운(20)은 모드 A(birthDate 있음)+성별 있을 때만 (상운 전이면 생략)
//     — 반환 순서 고정: 대운·세운·월운·일운. getDailyFortune/DailyFortune 은 v3 에서 제거됨
//   export function statsAtLevel(base: Stats, level: number): Stats  // 레벨 성장 반영 (패시브 포함 전)
//   export function elementMultiplier(attacker: Element, defender: Element): number  // 극함 1.5 / 극당함 0.7 / 그 외 1.0
//   export function elementColor(e: Element): string  // 오행 → 표시 색 (DESIGN.md 팔레트)
//   export function elementKo(e: Element): string     // 木→목 …
//   export function letterElement(letter: string): Element  // 천간/지지 글자 → 오행 (미인식은 throw)
// battle.ts:
//   export function initBattle(c: Character, level: number, m: Monster, flows: FlowBuff[], seed: number): BattleState
//     — flows 의 statKey 별 bonusPct 를 스탯에 곱연산(기존 applyPct 체인), 화개면 skillCooldownMax 감산
//   export function stepBattle(s: BattleState, cmd: BattleCommand): { state: BattleState; events: BattleEvent[] }
//     — 순수 함수(인자 불변), 플레이어 행동 → 생존 시 몬스터 반격 1회까지가 한 스텝
//     — 역마: turn 1 첫 행동 전 선제 일격(atk×배율, 변동·치명 없음, kind "sinsal")
//     — 천을귀인: 치명상 시 1회 부활(maxHp×%, kind "sinsal") — 부활 턴은 패배 아님
//   export function rollLetterDrop(dungeonElement: Element, isBoss: boolean, seed: number, dropBonusPct?: number): { letters: string[]; seed: number }
//     — 승리 보상: 일반 1글자·보스 2글자, 70% 던전 오행 풀 / 30% 전체 랜덤 (시드 LCG)
//     — dropBonusPct(도화)만큼의 확률로 +1글자
