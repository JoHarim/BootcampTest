// 사주 RPG — 콘텐츠 데이터 (직업 10종+무격 폴백 · 던전 5종 · 글자 풀 · 성장 곡선). 값은 전부 결정적.
// 의존: ./types 만. 로직은 데이터 생성 헬퍼(순수 함수)까지만 담는다.
import type {
  Dungeon,
  Element,
  JobClass,
  Monster,
  TenGodKey,
} from "./types";

// ── 밸런스 상수 (설계서 3·5장 — 튜닝은 여기서만) ──────────
const SKILL_COOLDOWN = 3; // 전 직업 스킬 쿨다운 (턴)
const HEAL_POWER = 0.35; // 회복형: maxHp × 0.35

const STAGE_COUNT = 5; // 던전당 스테이지 수 (5번째 보스)
const MON_HP_BASE = 40; // 몬스터 hp = 40 + 22×(s-1) + 14×(d-1) (시뮬 튜닝 2026-07-07)
const MON_HP_PER_STAGE = 22;
const MON_HP_PER_DIFF = 14;
const MON_ATK_BASE = 12; // 몬스터 atk = 12 + 5×(s-1) + 4×(d-1) (시뮬 튜닝: 원안 10+4+3은 위협 없음)
const MON_ATK_PER_STAGE = 5;
const MON_ATK_PER_DIFF = 4;
const MON_DEF_BASE = 3; // 몬스터 def = 3 + 2×(s-1)
const MON_DEF_PER_STAGE = 2;
const BOSS_HP_MULT = 1.5; // 보스 보정 (시뮬 튜닝: 보스는 지구전 — 공격보다 체력)
const BOSS_ATK_MULT = 1.1;
const MON_EXP_BASE = 10; // 몬스터 exp = 10 + 6×(s-1) + 6×(d-1) (시뮬 튜닝: 후반 던전 보상 강화)
const MON_EXP_PER_STAGE = 6;
const MON_EXP_PER_DIFF = 6;
const BOSS_EXP_MULT = 2;

const EXP_LEVEL_BASE = 15; // expForLevel(L) = 15 + 10×(L-1) (시뮬 튜닝: 30+20은 레벨이 난이도를 못 따라감)
const EXP_LEVEL_STEP = 10;

// 최대 레벨
export const MAX_LEVEL = 20;

// 극(剋)당하는 쪽: 이 오행 던전에는 값의 오행이 유리하다 (金剋木, 水剋火, 木剋土, 火剋金, 土剋水)
const CONTROLLED_BY: Record<Element, Element> = {
  木: "金",
  火: "水",
  土: "木",
  金: "火",
  水: "土",
};

// ── 직업 10종 (설계서 3장 표 — 격국 십성 → 직업) ──────────
export const JOBS: Record<TenGodKey, JobClass> = {
  비견: {
    id: "warrior",
    tenGod: "비견",
    name: "무사",
    emoji: "⚔️",
    passiveDesc: "홀로 갈고닦은 검 — 공격력 +10%",
    passiveStat: "atk",
    passivePct: 10,
    skill: {
      name: "질풍연격",
      emoji: "🌪️",
      desc: "바람처럼 검을 연달아 휘둘러 지능의 170% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 1.7,
      kind: "damage",
    },
  },
  겁재: {
    id: "gladiator",
    tenGod: "겁재",
    name: "검투사",
    emoji: "🗡️",
    passiveDesc: "빼앗아서라도 이긴다 — 공격력 +15%",
    passiveStat: "atk",
    passivePct: 15,
    skill: {
      name: "건곤일척",
      emoji: "🎲",
      desc: "운명을 걸고 내리치는 도박 일격 — 지능의 220% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 2.2,
      kind: "damage",
    },
  },
  식신: {
    id: "cleric",
    tenGod: "식신",
    name: "성직자",
    emoji: "🕊️",
    passiveDesc: "넉넉한 기운이 몸을 지킨다 — 체력 +15%",
    passiveStat: "hp",
    passivePct: 15,
    skill: {
      name: "감로수",
      emoji: "💧",
      desc: "하늘의 감로를 받아 최대 생명력의 35% 회복",
      cooldown: SKILL_COOLDOWN,
      power: HEAL_POWER,
      kind: "heal",
    },
  },
  상관: {
    id: "onmyoji",
    tenGod: "상관",
    name: "음양사",
    emoji: "📿",
    passiveDesc: "번뜩이는 재기가 술법을 벼린다 — 지능 +15%",
    passiveStat: "int",
    passivePct: 15,
    skill: {
      name: "귀문부적",
      emoji: "🧧",
      desc: "봉인 부적을 날려 지능의 190% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 1.9,
      kind: "damage",
    },
  },
  편재: {
    id: "outlaw",
    tenGod: "편재",
    name: "협객",
    emoji: "🥷",
    passiveDesc: "기회는 바람처럼 잡는다 — 운 +20%",
    passiveStat: "luk",
    passivePct: 20,
    skill: {
      name: "월하야습",
      emoji: "🌙",
      desc: "달빛을 등지고 급습해 지능의 180% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 1.8,
      kind: "damage",
    },
  },
  정재: {
    id: "merchant",
    tenGod: "정재",
    name: "상단주",
    emoji: "💰",
    passiveDesc: "차곡차곡 쌓은 복이 따른다 — 운 +15%",
    passiveStat: "luk",
    passivePct: 15,
    skill: {
      name: "천금난사",
      emoji: "🪙",
      desc: "엽전 다발을 흩뿌려 지능의 160% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 1.6,
      kind: "damage",
    },
  },
  편관: {
    id: "berserker",
    tenGod: "편관",
    name: "광전사",
    emoji: "🪓",
    passiveDesc: "고난이 도끼날을 세운다 — 공격력 +20%",
    passiveStat: "atk",
    passivePct: 20,
    skill: {
      name: "수라난무",
      emoji: "💢",
      desc: "수라처럼 날뛰며 지능의 210% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 2.1,
      kind: "damage",
    },
  },
  정관: {
    id: "guardian",
    tenGod: "정관",
    name: "수호기사",
    emoji: "🛡️",
    passiveDesc: "법도를 지키는 몸은 굳건하다 — 방어력 +20%",
    passiveStat: "def",
    passivePct: 20,
    skill: {
      name: "천벌심판",
      emoji: "⚡",
      desc: "하늘의 법도로 단죄해 지능의 175% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 1.75,
      kind: "damage",
    },
  },
  편인: {
    id: "occultist",
    tenGod: "편인",
    name: "술사",
    emoji: "🔮",
    passiveDesc: "홀로 파고든 비전의 깊이 — 지능 +20%",
    passiveStat: "int",
    passivePct: 20,
    skill: {
      name: "비전폭발",
      emoji: "✨",
      desc: "봉인해둔 비전 기운을 터뜨려 지능의 200% 피해",
      cooldown: SKILL_COOLDOWN,
      power: 2.0,
      kind: "damage",
    },
  },
  정인: {
    id: "sage",
    tenGod: "정인",
    name: "현자",
    emoji: "📜",
    passiveDesc: "배움이 마음을 밝힌다 — 지능 +10%",
    passiveStat: "int",
    passivePct: 10,
    skill: {
      name: "지혜의 빛",
      emoji: "🌟",
      desc: "깨달음의 빛으로 최대 생명력의 35% 회복",
      cooldown: SKILL_COOLDOWN,
      power: HEAL_POWER,
      kind: "heal",
    },
  },
};

// ── 무격(無格) 폴백 직업 (설계서 8장 — 모드 B 월지 공백) ──
// 아직 격이 서지 않은 떠돌이. 월지를 채우는 순간 본기 십성 직업으로 각성한다.
export const UNFORMED_JOB: JobClass = {
  id: "unformed",
  tenGod: null,
  name: "무명객",
  emoji: "🌫️",
  passiveDesc: "정처 없는 발걸음이 몸을 단련한다 — 체력 +10%",
  passiveStat: "hp",
  passivePct: 10,
  skill: {
    name: "무명일섬",
    emoji: "👊",
    desc: "이름 없는 맨손 일격을 내질러 지능의 160% 피해",
    cooldown: SKILL_COOLDOWN,
    power: 1.6,
    kind: "damage",
  },
};

// ── 글자 풀 (설계서 8장 — 모드 B 드랍·장착, 오행 → 간지) ──
// 천간: 오행별 양간·음간 순
export const STEM_POOL: Record<Element, string[]> = {
  木: ["甲", "乙"],
  火: ["丙", "丁"],
  土: ["戊", "己"],
  金: ["庚", "辛"],
  水: ["壬", "癸"],
};

// 지지: 土는 사고(四庫)라 네 글자 — 드랍에서 土가 자연히 흔해진다
export const BRANCH_POOL: Record<Element, string[]> = {
  木: ["寅", "卯"],
  火: ["巳", "午"],
  土: ["丑", "辰", "未", "戌"],
  金: ["申", "酉"],
  水: ["子", "亥"],
};

// ── 던전 생성 헬퍼 (설계서 5장 공식 — 전부 결정적) ────────
// 스테이지 s(1~5)·난이도 d(1~5)로 몬스터 스탯 산출. 마지막 스테이지는 보스 보정.
function makeMonster(
  dungeonId: string,
  d: number,
  s: number,
  name: string,
  emoji: string,
  element: Element,
): Monster {
  const isBoss = s === STAGE_COUNT;
  let hp = MON_HP_BASE + MON_HP_PER_STAGE * (s - 1) + MON_HP_PER_DIFF * (d - 1);
  let atk =
    MON_ATK_BASE + MON_ATK_PER_STAGE * (s - 1) + MON_ATK_PER_DIFF * (d - 1);
  const def = MON_DEF_BASE + MON_DEF_PER_STAGE * (s - 1);
  let exp =
    MON_EXP_BASE + MON_EXP_PER_STAGE * (s - 1) + MON_EXP_PER_DIFF * (d - 1);
  if (isBoss) {
    hp = Math.round(hp * BOSS_HP_MULT);
    atk = Math.round(atk * BOSS_ATK_MULT);
    exp = exp * BOSS_EXP_MULT;
  }
  return { id: `${dungeonId}-${s}`, name, emoji, element, hp, atk, def, exp, isBoss };
}

// 던전 1개 조립 — mons 는 [이름, 이모지] 5쌍 (마지막이 보스)
function makeDungeon(
  id: string,
  d: number,
  name: string,
  emoji: string,
  element: Element,
  flavor: string,
  mons: [string, string][],
): Dungeon {
  return {
    id,
    name,
    emoji,
    element,
    desc: `${flavor} — ${CONTROLLED_BY[element]} 기운이 유리해요`,
    stages: mons.map(([mName, mEmoji], i) =>
      makeMonster(id, d, i + 1, mName, mEmoji, element),
    ),
  };
}

// ── 던전 5종 (난이도 d=1~5 순, 오행별) ────────────────────
export const DUNGEONS: Dungeon[] = [
  makeDungeon("wood", 1, "청림", "🌲", "木", "천년 고목이 우거진 요괴의 숲", [
    ["풀잎 정령", "🍃"],
    ["가시덩굴 도깨비", "🌿"],
    ["목각 병정", "🪵"],
    ["천년 지네", "🐛"],
    ["청림 산군", "🐯"],
  ]),
  makeDungeon("fire", 2, "화염굴", "🌋", "火", "불길이 굽이치는 지하 화굴", [
    ["불씨 도깨비", "🔥"],
    ["화염 박쥐", "🦇"],
    ["불수레 악귀", "👹"],
    ["용암 이무기", "🐍"],
    ["화염굴 주작", "🦅"],
  ]),
  makeDungeon("earth", 3, "황토평원", "🏜️", "土", "흙바람 몰아치는 메마른 벌판", [
    ["달걀귀신", "🥚"],
    ["황토 두꺼비", "🐸"],
    ["돌무더기 정령", "🪨"],
    ["황야의 강시", "🧟"],
    ["황토평원 황룡", "🐲"],
  ]),
  makeDungeon("metal", 4, "백철광산", "⛰️", "金", "쇳소리 울리는 폐광 갱도", [
    ["쇠붙이 도깨비", "🔩"],
    ["백철 갑충", "🪲"],
    ["떠도는 검귀", "🗡️"],
    ["무쇠 야차", "👺"],
    ["백철광산 백호", "🐅"],
  ]),
  makeDungeon("water", 5, "현무담", "🌊", "水", "안개 짙게 깔린 깊은 못", [
    ["물방울 정령", "💧"],
    ["안개 물귀신", "👻"],
    ["물안개 구미호", "🦊"],
    ["심연 이무기", "🐉"],
    ["현무담 현무", "🐢"],
  ]),
];

// ── 성장 곡선 ─────────────────────────────────────────────
// 레벨 L에서 다음 레벨까지 필요한 경험치
export function expForLevel(level: number): number {
  return EXP_LEVEL_BASE + EXP_LEVEL_STEP * (level - 1);
}
