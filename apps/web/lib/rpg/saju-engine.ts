// 사주 RPG 엔진 — 생일 → 사주 4주 → 오행 점수 → 능력치·직업(격국)을 만드는 순수 함수 모음.
// lunar-javascript(외부 라이브러리)는 rpg 모듈 중 이 파일에서만 import 한다 (플래너 lib/saju.ts 패턴).
// 수치·공식은 docs/plan/rpg-design.md 1·2·3·8장을 따른다. 플래너와 결합하지 않도록 표는 자체 보유.
import pkg from "lunar-javascript";

import { JOBS, UNFORMED_JOB } from "./content";
import type {
  Character,
  DailyFortune,
  Element,
  ElementScore,
  FourPillars,
  LetterSlots,
  StatKey,
  Stats,
  TenGodKey,
} from "./types";

const { Solar } = pkg;

// ── 밸런스 상수 (설계서 1·2·4장 — 여기 숫자만 바꿔 튜닝) ──────────
const WEIGHT_MONTH_ZHI = 3; // 월지
const WEIGHT_DAY_GAN = 2; // 일간
const WEIGHT_DAY_ZHI = 2; // 일지
const WEIGHT_OTHER_GAN = 1; // 그 외 천간
const WEIGHT_OTHER_ZHI = 1.5; // 그 외 지지
const WEIGHT_HIDDEN = 0.5; // 지장간 각 글자
const PRODUCE_BONUS = 0.3; // 상생 — 자기 점수의 30%를 생하는 오행에 가산
const CONTROL_PENALTY = 0.2; // 상극 — 자기 점수의 20%를 극하는 오행에서 감산
const STAT_BASE = 16; // 능력치 바닥값
const STAT_SCALE = 6; // 시주 포함(8자) 계수
const STAT_SCALE_NO_TIME = 7.5; // 시주 제외(6자) 계수 — 총 가중치 비율 ≈ 4:5 보정
const GROWTH_PER_LEVEL = 0.1; // 레벨당 전 스탯 +10% (시뮬 튜닝: 8%는 약체 사주가 보스 벽을 못 넘음)
const DAILY_BONUS_PCT = 15; // 오늘의 기운 스탯 보너스 %
const MULT_ADVANTAGE = 1.5; // 내 속성이 상대를 극함
const MULT_DISADVANTAGE = 0.7; // 상대 속성이 나를 극함
const MULT_NEUTRAL = 1.0;
// 종합 전투력 가중치: power = hp×2 + atk×3 + def×2 + int×3 + luk×1
const POWER_WEIGHT: Record<StatKey, number> = { hp: 2, atk: 3, def: 2, int: 3, luk: 1 };

// ── 간지 표 (자체 보유 — 플래너 lib/saju.ts 와 결합 금지) ────────
// 천간 한자 → 한글
const STEM_KO: Record<string, string> = {
  甲: "갑",
  乙: "을",
  丙: "병",
  丁: "정",
  戊: "무",
  己: "기",
  庚: "경",
  辛: "신",
  壬: "임",
  癸: "계",
};

// 지지 한자 → 한글
const BRANCH_KO: Record<string, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
};

// 천간 → 오행
const STEM_ELEMENT: Record<string, Element> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

// 지지 → 오행 (子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水)
const BRANCH_ELEMENT: Record<string, Element> = {
  子: "水",
  丑: "土",
  寅: "木",
  卯: "木",
  辰: "土",
  巳: "火",
  午: "火",
  未: "土",
  申: "金",
  酉: "金",
  戌: "土",
  亥: "水",
};

// 천간 → 음양 (양 true / 음 false)
const STEM_YANG: Record<string, boolean> = {
  甲: true,
  丙: true,
  戊: true,
  庚: true,
  壬: true,
  乙: false,
  丁: false,
  己: false,
  辛: false,
  癸: false,
};

// 지장간 (본기 먼저 — 격국 판정은 월지 본기[0] 사용)
const HIDDEN_STEMS: Record<string, string[]> = {
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
};

// 생(生): 木→火→土→金→水→木
const PRODUCES: Record<Element, Element> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

// 극(剋): 木剋土, 土剋水, 水剋火, 火剋金, 金剋木
const CONTROLS: Record<Element, Element> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

// 순회용 오행 목록
const ELEMENTS: Element[] = ["木", "火", "土", "金", "水"];

// 오행 → 능력치 키 (木=체력 / 火=공격 / 土=운 / 金=방어 / 水=지능)
const ELEMENT_STAT: Record<Element, StatKey> = {
  木: "hp",
  火: "atk",
  土: "luk",
  金: "def",
  水: "int",
};

// 능력치 키 → 표시 이름 (일운 desc 문구용)
const STAT_KO: Record<StatKey, string> = {
  hp: "체력",
  atk: "공격력",
  def: "방어력",
  int: "지능",
  luk: "운",
};

// 오행 → 표시 색 (설계서 7장 팔레트)
const ELEMENT_COLOR: Record<Element, string> = {
  木: "#5db8a6",
  火: "#c64545",
  土: "#d4a017",
  金: "#8e8b82",
  水: "#141413",
};

// 오행 → 한글
const ELEMENT_KO: Record<Element, string> = {
  木: "목",
  火: "화",
  土: "토",
  金: "금",
  水: "수",
};

// ── 내부 헬퍼 ─────────────────────────────────────────

// '甲子' 같은 간지 2글자 → 채워진 PillarSlot (모르는 글자면 throw)
// 반환 타입을 non-null 로 좁혀 두면 일간(day.gan) 추출 시 null 검사가 필요 없다.
function toPillar(ganzhi: string): { gan: string; zhi: string } {
  const gan = ganzhi[0];
  const zhi = ganzhi[1];
  if (STEM_ELEMENT[gan] === undefined || BRANCH_ELEMENT[zhi] === undefined) {
    throw new Error("사주 글자를 인식하지 못했습니다.");
  }
  return { gan, zhi };
}

// 일간 기준 상대 천간의 십성 판정 — 플래너 lib/saju.ts 의 tenGod 와 동일 규칙(오행 생극 + 음양 동/이)
function tenGodOf(dayGan: string, otherGan: string): TenGodKey {
  const me = STEM_ELEMENT[dayGan];
  const other = STEM_ELEMENT[otherGan];
  const sameYinYang = STEM_YANG[dayGan] === STEM_YANG[otherGan];

  if (me === other) {
    // 같은 오행(비겁): 음양 같으면 비견, 다르면 겁재
    return sameYinYang ? "비견" : "겁재";
  }
  if (PRODUCES[me] === other) {
    // 내가 생하는 오행(식상)
    return sameYinYang ? "식신" : "상관";
  }
  if (CONTROLS[me] === other) {
    // 내가 극하는 오행(재성)
    return sameYinYang ? "편재" : "정재";
  }
  if (CONTROLS[other] === me) {
    // 나를 극하는 오행(관성)
    return sameYinYang ? "편관" : "정관";
  }
  // 나를 생하는 오행(인성)
  return sameYinYang ? "편인" : "정인";
}

// 사주 글자 오행 점수 — 자리별 가중치 합산 후 생극 보정 (설계서 1장)
// v2: 빈 슬롯(null)은 0 기여로 건너뛴다 — 모드 A 시각 미입력(time {null,null})과 모드 B 미장착 슬롯 공용.
// 지장간은 채워진 지지만 기여한다. 자리별 가중치·생극 보정은 v1 과 동일.
function computeElements(p: FourPillars): ElementScore {
  const base: ElementScore = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  // 천간 한 글자 가산 — null 이면 0 기여
  const addGan = (gan: string | null, weight: number): void => {
    if (gan !== null) {
      base[STEM_ELEMENT[gan]] += weight;
    }
  };
  // 지지 한 글자 가산 + 그 지지의 지장간(숨은 천간 각 ×0.5) — null 이면 0 기여
  const addZhi = (zhi: string | null, weight: number): void => {
    if (zhi !== null) {
      base[BRANCH_ELEMENT[zhi]] += weight;
      for (const hidden of HIDDEN_STEMS[zhi]) {
        base[STEM_ELEMENT[hidden]] += WEIGHT_HIDDEN;
      }
    }
  };

  // 천간: 일간 ×2, 그 외 ×1
  addGan(p.day.gan, WEIGHT_DAY_GAN);
  addGan(p.year.gan, WEIGHT_OTHER_GAN);
  addGan(p.month.gan, WEIGHT_OTHER_GAN);
  addGan(p.time.gan, WEIGHT_OTHER_GAN);

  // 지지: 월지 ×3, 일지 ×2, 그 외 ×1.5 (지장간 포함)
  addZhi(p.month.zhi, WEIGHT_MONTH_ZHI);
  addZhi(p.day.zhi, WEIGHT_DAY_ZHI);
  addZhi(p.year.zhi, WEIGHT_OTHER_ZHI);
  addZhi(p.time.zhi, WEIGHT_OTHER_ZHI);

  // 생극 보정: 원점수 스냅샷 기준으로 상생 30% 가산·상극 20% 감산을 동시 적용
  const result: ElementScore = { ...base };
  for (const e of ELEMENTS) {
    result[PRODUCES[e]] += base[e] * PRODUCE_BONUS;
    result[CONTROLS[e]] -= base[e] * CONTROL_PENALTY;
  }

  // 음수는 0 클램프, 소수 1자리 반올림
  for (const e of ELEMENTS) {
    const clamped = result[e] < 0 ? 0 : result[e];
    result[e] = Math.round(clamped * 10) / 10;
  }
  return result;
}

// 오행 점수 → 능력치 (설계서 2장): stat = round(16 + score × 계수)
// 계수: 모드 A 시주 포함 ×6 / 시주 제외 ×7.5, 모드 B 는 항상 ×6 (설계서 8장)
function toStats(elements: ElementScore, scale: number): Stats {
  return {
    hp: Math.round(STAT_BASE + elements["木"] * scale),
    atk: Math.round(STAT_BASE + elements["火"] * scale),
    def: Math.round(STAT_BASE + elements["金"] * scale),
    int: Math.round(STAT_BASE + elements["水"] * scale),
    luk: Math.round(STAT_BASE + elements["土"] * scale),
  };
}

// 종합 전투력 (설계서 2장): power = hp×2 + atk×3 + def×2 + int×3 + luk×1
function toPower(stats: Stats): number {
  return Math.round(
    stats.hp * POWER_WEIGHT.hp +
      stats.atk * POWER_WEIGHT.atk +
      stats.def * POWER_WEIGHT.def +
      stats.int * POWER_WEIGHT.int +
      stats.luk * POWER_WEIGHT.luk,
  );
}

// ── 공개 API (types.ts 계약) ──────────────────────────

// birthDate 'YYYY-MM-DD', birthTime 'HH:MM'|'' → 캐릭터 생성 (모드 A). 입력이 이상하면 throw.
// birthTime 이 '' 이면 정오 더미로 계산하되 pillars.time = {null, null} (시주는 점수에서 완전 제외).
export function createCharacter(birthDate: string, birthTime: string): Character {
  // 생년월일 파싱 (플래너와 동일 패턴)
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (dateMatch === null) {
    throw new Error("생년월일 형식이 올바르지 않습니다.");
  }
  const by = Number(dateMatch[1]);
  const bm = Number(dateMatch[2]);
  const bd = Number(dateMatch[3]);
  if (by < 1900 || by > 2100) {
    throw new Error("1900~2100년 사이의 생년월일만 지원합니다.");
  }
  // 실존 날짜 검증 (2월 30일 등) — Date 왕복으로 확인
  const probe = new Date(by, bm - 1, bd);
  if (probe.getFullYear() !== by || probe.getMonth() !== bm - 1 || probe.getDate() !== bd) {
    throw new Error("존재하지 않는 날짜입니다.");
  }

  // 시각 파싱 (비어 있으면 null → 정오 더미)
  let hour: number | null = null;
  let minute = 0;
  if (birthTime !== "") {
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(birthTime);
    if (timeMatch === null) {
      throw new Error("태어난 시각 형식이 올바르지 않습니다.");
    }
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    if (hour > 23 || minute > 59) {
      throw new Error("태어난 시각이 올바르지 않습니다.");
    }
  }

  // Solar → Lunar → EightChar 로 년/월/일/시 4주 추출
  const useHour = hour === null ? 12 : hour;
  const eightChar = Solar.fromYmdHms(by, bm, bd, useHour, minute, 0)
    .getLunar()
    .getEightChar();

  const monthPillar = toPillar(eightChar.getMonth());
  const dayPillar = toPillar(eightChar.getDay());
  const pillars: FourPillars = {
    year: toPillar(eightChar.getYear()),
    month: monthPillar,
    day: dayPillar,
    time: hour === null ? { gan: null, zhi: null } : toPillar(eightChar.getTime()),
  };

  const dayMaster = dayPillar.gan;
  const dayElement = STEM_ELEMENT[dayMaster];

  // 오행 점수 → 능력치 → 전투력 (시주 유무 판정은 time.gan — v2 에서 time 은 항상 슬롯 객체)
  const elements = computeElements(pillars);
  const stats = toStats(elements, pillars.time.gan !== null ? STAT_SCALE : STAT_SCALE_NO_TIME);
  const power = toPower(stats);

  // 격국(직업): 월지 본기(지장간 첫 글자) vs 일간의 십성 → JOBS 매핑
  const monthMain = HIDDEN_STEMS[monthPillar.zhi][0];
  const job = JOBS[tenGodOf(dayMaster, monthMain)];

  return {
    birthDate,
    birthTime,
    pillars,
    dayMaster,
    dayElement,
    elements,
    stats,
    job,
    power,
  };
}

// 일간 + 장착 슬롯 7개 → 캐릭터 생성 (모드 B, 설계서 8장). dayGan 이 천간이 아니면 throw.
// 점수는 모드 A 와 같은 computeElements(빈 슬롯 0 기여), 스탯 계수는 항상 ×6 —
// 7슬롯을 다 채우면 모드 A 8자와 수학적으로 동일해진다.
export function createCharacterFromSlots(dayGan: string, slots: LetterSlots): Character {
  if (STEM_ELEMENT[dayGan] === undefined) {
    throw new Error("일간 글자를 인식하지 못했습니다.");
  }
  // 슬롯 자리 검증: 간 자리엔 천간만, 지 자리엔 지지만 (깨진 저장 데이터 방어)
  for (const gan of [slots.yearGan, slots.monthGan, slots.timeGan]) {
    if (gan !== null && STEM_ELEMENT[gan] === undefined) {
      throw new Error("천간 슬롯 글자를 인식하지 못했습니다.");
    }
  }
  for (const zhi of [slots.yearZhi, slots.monthZhi, slots.dayZhi, slots.timeZhi]) {
    if (zhi !== null && BRANCH_ELEMENT[zhi] === undefined) {
      throw new Error("지지 슬롯 글자를 인식하지 못했습니다.");
    }
  }

  const pillars: FourPillars = {
    year: { gan: slots.yearGan, zhi: slots.yearZhi },
    month: { gan: slots.monthGan, zhi: slots.monthZhi },
    day: { gan: dayGan, zhi: slots.dayZhi },
    time: { gan: slots.timeGan, zhi: slots.timeZhi },
  };

  // 오행 점수 → 능력치 → 전투력 (계수는 슬롯 수와 무관하게 ×6 고정)
  const elements = computeElements(pillars);
  const stats = toStats(elements, STAT_SCALE);
  const power = toPower(stats);

  // 격국(직업): 월지가 있으면 본기 십성 → JOBS, 비어 있으면 무명객(無格) 폴백 — 월지 장착이 각성 마일스톤
  const job =
    slots.monthZhi !== null ? JOBS[tenGodOf(dayGan, HIDDEN_STEMS[slots.monthZhi][0])] : UNFORMED_JOB;

  return {
    birthDate: "",
    birthTime: "",
    pillars,
    dayMaster: dayGan,
    dayElement: STEM_ELEMENT[dayGan],
    elements,
    stats,
    job,
    power,
  };
}

// 글자 분류 — 천간이면 true, 지지면 false, 미인식은 throw (모드 B 장착 자리 판별용)
export function isStem(letter: string): boolean {
  if (STEM_ELEMENT[letter] !== undefined) {
    return true;
  }
  if (BRANCH_ELEMENT[letter] !== undefined) {
    return false;
  }
  throw new Error("사주 글자를 인식하지 못했습니다.");
}

// 천간/지지 글자 → 오행, 미인식은 throw (드랍 글자 색·필터 표시용)
export function letterElement(letter: string): Element {
  const stemElement = STEM_ELEMENT[letter];
  if (stemElement !== undefined) {
    return stemElement;
  }
  const branchElement = BRANCH_ELEMENT[letter];
  if (branchElement !== undefined) {
    return branchElement;
  }
  throw new Error("사주 글자를 인식하지 못했습니다.");
}

// 오늘의 기운(일운) — 오늘 일진 천간의 오행에 해당하는 스탯 +15% (설계서 4장)
// c 는 계약 시그니처 유지용 — 일운은 캐릭터와 무관하게 오늘 일진만으로 결정된다.
export function getDailyFortune(c: Character, today: Date): DailyFortune {
  const lunar = Solar.fromYmd(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  ).getLunar();
  const gan: string = lunar.getDayGan();
  const zhi: string = lunar.getDayZhi();
  if (STEM_KO[gan] === undefined || BRANCH_KO[zhi] === undefined) {
    throw new Error("오늘 일진을 인식하지 못했습니다.");
  }

  const element = STEM_ELEMENT[gan];
  const statKey = ELEMENT_STAT[element];
  return {
    ganzhiKo: `${STEM_KO[gan]}${BRANCH_KO[zhi]}`,
    ganzhiHanja: `${gan}${zhi}`,
    element,
    statKey,
    bonusPct: DAILY_BONUS_PCT,
    desc: `오늘은 ${element} 기운 — ${STAT_KO[statKey]} +${DAILY_BONUS_PCT}%`,
  };
}

// 레벨 성장 반영 능력치: 모든 스탯 round(base × (1 + 0.08×(L-1))) — 패시브 반영 전
export function statsAtLevel(base: Stats, level: number): Stats {
  const mult = 1 + GROWTH_PER_LEVEL * (level - 1);
  return {
    hp: Math.round(base.hp * mult),
    atk: Math.round(base.atk * mult),
    def: Math.round(base.def * mult),
    int: Math.round(base.int * mult),
    luk: Math.round(base.luk * mult),
  };
}

// 오행 상성 배율: 내가 극하면 1.5 / 나를 극하면 0.7 / 그 외 1.0
export function elementMultiplier(attacker: Element, defender: Element): number {
  if (CONTROLS[attacker] === defender) {
    return MULT_ADVANTAGE;
  }
  if (CONTROLS[defender] === attacker) {
    return MULT_DISADVANTAGE;
  }
  return MULT_NEUTRAL;
}

// 오행 → 표시 색
export function elementColor(e: Element): string {
  return ELEMENT_COLOR[e];
}

// 오행 → 한글 (木→목 …)
export function elementKo(e: Element): string {
  return ELEMENT_KO[e];
}
