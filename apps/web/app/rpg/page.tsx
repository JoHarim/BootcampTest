"use client";

// 사주 RPG — 단일 페이지 + 뷰 상태머신 (loading→create→reveal→home→dungeon→battle→result).
// 플래너 app/page.tsx 패턴 승계: 인라인 styles 객체 + <style> 블록, localStorage는 마운트 후 try/catch.
import { useEffect, useRef, useState } from "react";
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  Character,
  Dungeon,
  Element,
  FlowBuff,
  LetterSlots,
  PillarSlot,
  SaveData,
  SinsalKey,
  StatKey,
  SynergyDef,
  TenGodGroup,
} from "../../lib/rpg/types";
import { DUNGEONS, MAX_LEVEL, SINSALS, SYNERGIES, expForLevel } from "../../lib/rpg/content";
import {
  createCharacter,
  createCharacterFromSlots,
  elementColor,
  elementKo,
  elementMultiplier,
  getFortuneFlow,
  isStem,
} from "../../lib/rpg/saju-engine";
import { initBattle, rollLetterDrop, stepBattle } from "../../lib/rpg/battle";

// ── 저장 키 · UI 상수 (튜닝은 여기서) ─────────────────────
const RPG_KEY = "sajuweb:rpg"; // RPG 진행 저장
const PROFILE_KEY = "sajuweb:profile"; // 플래너 생일 (불러오기 보조 버튼용)
const AUTO_STEP_MS = 800; // 자동 전투 스텝 간격
const LOG_LINES = 6; // 전투 로그 표시 줄 수
const RESULT_DELAY_MS = 900; // 종료 로그를 보여준 뒤 결과 화면 전환까지
const STAGE_COUNT = 5; // 던전당 스테이지 수
const SEED_MOD = 2147483647; // 전투 시드 초기값 범위 (LCG 2^31-1, Math.random 금지)

// DESIGN.md 폰트 스택 (라이선스 폰트 대체: 세리프=Georgia, 산세=Inter 계열) — 플래너와 동일
const SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// 한자 1글자 → 오행 (8자 카드 테두리색용 표 데이터 — 로직은 saju-engine 담당)
const GAN_ELEMENT: Record<string, Element> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const ZHI_ELEMENT: Record<string, Element> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

// 천간 10글자 (모드 B 일간 선택 그리드 순서) + 한글 음 (표시용)
const STEMS: string[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const STEM_KO_UI: Record<string, string> = {
  甲: "갑", 乙: "을", 丙: "병", 丁: "정", 戊: "무",
  己: "기", 庚: "경", 辛: "신", 壬: "임", 癸: "계",
};
// 지지 12글자 (글자 주머니 칩 정렬용)
const BRANCHES: string[] = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 모드 B 장착 슬롯 7종 — 순회·파싱·종류(천간/지지) 검증용 표 데이터
const SLOT_KEYS: (keyof LetterSlots)[] = [
  "yearGan", "yearZhi", "monthGan", "monthZhi", "dayZhi", "timeGan", "timeZhi",
];
const SLOT_IS_STEM: Record<keyof LetterSlots, boolean> = {
  yearGan: true, yearZhi: false, monthGan: true, monthZhi: false,
  dayZhi: false, timeGan: true, timeZhi: false,
};
// 사주판 4열 구성 — gan 이 null 인 열은 일간 고정 칸 (교체 불가)
const BOARD_COLS: { label: string; gan: keyof LetterSlots | null; zhi: keyof LetterSlots }[] = [
  { label: "연주", gan: "yearGan", zhi: "yearZhi" },
  { label: "월주", gan: "monthGan", zhi: "monthZhi" },
  { label: "일주", gan: null, zhi: "dayZhi" },
  { label: "시주", gan: "timeGan", zhi: "timeZhi" },
];

// 모드 B 시작 상태 — 일간 제외 7칸 전부 공백
function emptySlots(): LetterSlots {
  return {
    yearGan: null, yearZhi: null, monthGan: null, monthZhi: null,
    dayZhi: null, timeGan: null, timeZhi: null,
  };
}

// 저장 손상 방어 — slots 값은 문자열|null 만 수용 (그 외 타입은 빈 슬롯으로)
function parseSlots(raw: unknown): LetterSlots {
  const slots = emptySlots();
  if (typeof raw !== "object" || raw === null) {
    return slots;
  }
  const src = raw as Record<string, unknown>;
  for (const key of SLOT_KEYS) {
    const v = src[key];
    if (typeof v === "string") {
      slots[key] = v;
    }
  }
  return slots;
}

// 저장 손상 방어 — inventory 는 문자열 배열만 수용 (문자열 아닌 원소는 버림)
function parseInventory(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string") {
      out.push(v);
    }
  }
  return out;
}

// 한자 1글자 → 오행 (칩·슬롯 표시용 — 미인식 글자는 undefined 로 두고 호출부에서 폴백)
function letterEl(ch: string): Element | undefined {
  return GAN_ELEMENT[ch] ?? ZHI_ELEMENT[ch];
}

// 오행 표시 순서(상생 순) + 오행 → 담당 스탯 한글
const ELEMENT_ORDER: Element[] = ["木", "火", "土", "金", "水"];
const ELEMENT_STAT_KO: Record<Element, string> = {
  木: "체력", 火: "공격", 土: "운", 金: "방어", 水: "지능",
};
// 스탯 키 → 한글 (운의 흐름 카드·전투 버프 라인 표기용)
const STAT_KO: Record<StatKey, string> = {
  hp: "체력", atk: "공격", def: "방어", int: "지능", luk: "운",
};

// 모드 A 성별 선택지 — 대운 계산 전용, "" 은 선택 안 함 (설계서 11장)
const GENDERS: { value: "M" | "F" | ""; label: string }[] = [
  { value: "M", label: "남" },
  { value: "F", label: "여" },
  { value: "", label: "선택 안 함" },
];

// 십성 5그룹 표시 순서 (시너지 카드·전투 컴팩트 표기 공용 — 설계서 9장 표 순)
const TEN_GOD_GROUPS: TenGodGroup[] = ["비겁", "식상", "재성", "관성", "인성"];

// 시너지 문구 — descUnit 의 {u}→개수당 수치, {n}→개수 치환 (예: "기본공격 피해 +6%×2")
function synergyDescText(def: SynergyDef, n: number): string {
  return def.descUnit.replace("{u}", String(def.unit)).replace("{n}", String(n));
}

// 시너지 합계 강조 — descUnit 의 "×{n}" 앞 수치 조각만 떼어 unit×n 합산값으로 변환 (예: "+{u}%×{n}" → "+12%")
function synergyTotalText(def: SynergyDef, n: number): string {
  const head = def.descUnit.split("×{n}")[0];
  const tokens = head.split(" ");
  return tokens[tokens.length - 1].replace("{u}", String(def.unit * n));
}

// BattleEvent.kind → 로그 색 (먹빛 카드 위 가독 톤)
const LOG_COLOR: Record<BattleEvent["kind"], string> = {
  "player-hit": "#faf9f5",
  "foe-hit": "#e08b8b",
  skill: "#e0937a",
  heal: "#5db872",
  crit: "#e8a55a",
  info: "#a09d96",
  win: "#5db8a6",
  lose: "#e08b8b",
  sinsal: "#e8a55a", // 금색 — 부활·선제 일격의 반짝임
};

type View = "loading" | "create" | "reveal" | "home" | "dungeon" | "battle" | "result";

// 플래너 저장 프로필 (sajuweb:profile)
interface PlannerProfile {
  birthDate: string; // 'YYYY-MM-DD'
  birthTime: string; // 'HH:MM' | ''
}

// 전투 결과 화면용 요약
interface ResultInfo {
  won: boolean;
  expGained: number; // 도화 보정 반영 후 값
  levelsGained: number;
  levelAfter: number;
  letters: string[]; // 모드 B 승리 보상 글자 (모드 A·패배는 빈 배열)
  dohwaBonus: boolean; // 도화 신살 경험치 보정 적용 여부 (결과 캡션용)
}

export default function RpgPage() {
  // 최초에는 loading — 마운트 후 localStorage를 읽어 create/home을 정한다(하이드레이션 불일치 방지).
  const [view, setView] = useState<View>("loading");
  const [character, setCharacter] = useState<Character | null>(null);
  const [save, setSave] = useState<SaveData | null>(null);
  const [flows, setFlows] = useState<FlowBuff[]>([]); // 운의 흐름 (대운·세운·월운·일운)
  const [plannerProfile, setPlannerProfile] = useState<PlannerProfile | null>(null);
  const [dungeon, setDungeon] = useState<Dungeon | null>(null);
  const [stageIdx, setStageIdx] = useState<number>(0);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [log, setLog] = useState<BattleEvent[]>([]);
  const [pendingSkill, setPendingSkill] = useState<boolean>(false);
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [battleKey, setBattleKey] = useState<number>(0); // 전투 재시작마다 +1 → 인터벌 effect 재가동

  // 인터벌 콜백에서 최신 전투 상태·예약 커맨드를 보게 하는 ref
  const battleRef = useRef<BattleState | null>(null);
  const cmdRef = useRef<BattleCommand>("attack");
  const finishTimerRef = useRef<number | null>(null);

  // 마운트 후 저장 데이터 복원 — 손상·계산 실패 시 새로 시작(create)
  useEffect(() => {
    // 플래너 생일 (있으면 create 뷰에 불러오기 버튼 노출)
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      if (raw !== null) {
        const p = JSON.parse(raw) as Partial<PlannerProfile>;
        if (typeof p.birthDate === "string" && p.birthDate !== "" && typeof p.birthTime === "string") {
          setPlannerProfile({ birthDate: p.birthDate, birthTime: p.birthTime });
        }
      }
    } catch {
      // 못 읽으면 버튼만 안 보일 뿐 — 무시
    }

    // RPG 진행 저장 — v3. 구버전은 mode "A"·gender ""·dayGan ""·slots null·inventory [] 로 보정해 읽는다.
    let loaded: SaveData | null = null;
    try {
      const raw = window.localStorage.getItem(RPG_KEY);
      if (raw !== null) {
        const p = JSON.parse(raw) as Partial<SaveData>;
        if (
          typeof p.level === "number" && typeof p.exp === "number" &&
          typeof p.clearedStages === "object" && p.clearedStages !== null
        ) {
          // clearedStages는 숫자 값만 골라 복원 (손상 값 방어)
          const cleared: Record<string, number> = {};
          const rawCleared = p.clearedStages as Record<string, unknown>;
          for (const key of Object.keys(rawCleared)) {
            if (typeof rawCleared[key] === "number") {
              cleared[key] = rawCleared[key] as number;
            }
          }
          const mode: "A" | "B" = p.mode === "B" ? "B" : "A";
          if (mode === "B") {
            if (typeof p.dayGan === "string" && p.dayGan !== "") {
              loaded = {
                mode: "B",
                birthDate: "",
                birthTime: "",
                gender: "", // 모드 B 는 생일이 없어 대운 미적용 — 성별 불필요
                dayGan: p.dayGan,
                slots: parseSlots(p.slots),
                inventory: parseInventory(p.inventory),
                level: p.level,
                exp: p.exp,
                clearedStages: cleared,
              };
            }
          } else if (
            typeof p.birthDate === "string" && p.birthDate !== "" &&
            typeof p.birthTime === "string"
          ) {
            loaded = {
              mode: "A",
              birthDate: p.birthDate,
              birthTime: p.birthTime,
              // v2 저장(성별 없음)은 기본 "" — 대운만 안 보일 뿐 진행도는 그대로
              gender: p.gender === "M" || p.gender === "F" ? p.gender : "",
              dayGan: "",
              slots: null,
              inventory: [],
              level: p.level,
              exp: p.exp,
              clearedStages: cleared,
            };
          }
        }
      }
    } catch {
      loaded = null;
    }

    if (loaded === null) {
      setView("create");
      return;
    }
    try {
      // 저장 모드에 맞춰 캐릭터 재구성 — A 는 생일에서, B 는 일간+장착 슬롯에서
      const c =
        loaded.mode === "B" && loaded.slots !== null
          ? createCharacterFromSlots(loaded.dayGan, loaded.slots)
          : createCharacter(loaded.birthDate, loaded.birthTime);
      setCharacter(c);
      setSave(loaded);
      setFlows(getFortuneFlow(c, new Date(), loaded.gender));
      setView("home");
    } catch {
      setView("create"); // 저장은 있지만 계산 실패 → 재입력
      return;
    }
    // 구버전(mode·gender 없음) 저장도 읽은 즉시 v3 형태로 다시 쓴다 — 이후 저장은 항상 v3
    try {
      window.localStorage.setItem(RPG_KEY, JSON.stringify(loaded));
    } catch {
      // 못 써도 다음 저장 시점에 v3 로 통일된다 — 무시
    }
  }, []);

  // create 제출(모드 A) → 캐릭터 생성 + 저장. 실패 시 에러 문구 반환(성공은 "").
  function handleCreate(birthDate: string, birthTime: string, gender: "M" | "F" | ""): string {
    let c: Character;
    try {
      c = createCharacter(birthDate, birthTime);
    } catch {
      return "사주를 계산하지 못했어요. 생년월일을 확인해주세요";
    }
    // 같은 모드 A·같은 생일이면 진행도 유지(성별만 바꿔도 gender 만 갱신), 다르면 새 캐릭터로 재생성
    const next: SaveData =
      save !== null && save.mode === "A" && save.birthDate === birthDate && save.birthTime === birthTime
        ? { ...save, gender }
        : {
            mode: "A",
            birthDate,
            birthTime,
            gender,
            dayGan: "",
            slots: null,
            inventory: [],
            level: 1,
            exp: 0,
            clearedStages: {},
          };
    try {
      window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
    } catch {
      return "저장에 실패했어요. 다시 눌러주세요";
    }
    setCharacter(c);
    setSave(next);
    setFlows(getFortuneFlow(c, new Date(), gender));
    setResult(null);
    setView("reveal");
    return "";
  }

  // create 제출(모드 B) → 고른 일간으로 즉시 캐릭터 생성. 저장 슬롯은 1개 — 모드 B 선택은 항상 새 캐릭터.
  function handleCreateB(dayGan: string): string {
    const slots = emptySlots();
    let c: Character;
    try {
      c = createCharacterFromSlots(dayGan, slots);
    } catch {
      return "캐릭터를 만들지 못했어요. 다시 시도해주세요";
    }
    const next: SaveData = {
      mode: "B",
      birthDate: "",
      birthTime: "",
      gender: "", // 모드 B 는 대운 미적용
      dayGan,
      slots,
      inventory: [],
      level: 1,
      exp: 0,
      clearedStages: {},
    };
    try {
      window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
    } catch {
      return "저장에 실패했어요. 다시 눌러주세요";
    }
    setCharacter(c);
    setSave(next);
    setFlows(getFortuneFlow(c, new Date(), ""));
    setResult(null);
    setView("reveal");
    return "";
  }

  // 모드 B 장착·교체 — 인벤 글자 하나를 슬롯에 넣고 캐릭터 즉시 재계산(레벨·경험치·클리어 유지, 저장)
  function handleEquip(slotKey: keyof LetterSlots, letter: string) {
    if (save === null || save.mode !== "B" || save.slots === null) return;
    // 종류 검증 — 천간 글자는 간 자리, 지지 글자는 지 자리에만
    let stem: boolean;
    try {
      stem = isStem(letter);
    } catch {
      return; // 미인식 글자 — 무시
    }
    if (stem !== SLOT_IS_STEM[slotKey]) return;
    const inventory = [...save.inventory];
    const idx = inventory.indexOf(letter);
    if (idx === -1) return; // 인벤에 없는 글자 — 무시
    inventory.splice(idx, 1);
    const prev = save.slots[slotKey];
    if (prev !== null) {
      inventory.push(prev); // 교체 — 기존 글자는 인벤 복귀
    }
    const slots: LetterSlots = { ...save.slots, [slotKey]: letter };
    let c: Character;
    try {
      c = createCharacterFromSlots(save.dayGan, slots);
    } catch {
      return; // 재계산 실패 — 장착 자체를 취소 (원상 유지)
    }
    const next: SaveData = { ...save, slots, inventory };
    try {
      window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 이번 세션 진행은 유지
    }
    setSave(next);
    setCharacter(c);
    setFlows(getFortuneFlow(c, new Date(), next.gender)); // 재계산 경로도 흐름 갱신
  }

  // 전투 시작 — 시드는 현재 시각 기반(결정적 LCG의 초기값일 뿐, Math.random 아님)
  function startBattle(d: Dungeon, idx: number) {
    if (character === null || save === null) return;
    if (idx < 0 || idx >= d.stages.length) return;
    const m = d.stages[idx];
    const seed = Date.now() % SEED_MOD;
    const st = initBattle(character, save.level, m, flows, seed);
    battleRef.current = st;
    cmdRef.current = "attack";
    setBattle(st);
    setLog([{ kind: "info", text: `${m.emoji} ${m.name}${m.isBoss ? "(보스)" : ""}이(가) 나타났다!` }]);
    setPendingSkill(false);
    setResult(null);
    setDungeon(d);
    setStageIdx(idx);
    setBattleKey((k) => k + 1);
    setView("battle");
  }

  // 전투 종료 처리 — 승리면 경험치·레벨업·클리어 기록(모드 B는 글자 드랍까지) 반영 후 저장, 잠시 뒤 result로
  function finishBattle(finalState: BattleState) {
    let info: ResultInfo = {
      won: finalState.won,
      expGained: 0,
      levelsGained: 0,
      levelAfter: save !== null ? save.level : 1,
      letters: [],
      dohwaBonus: false,
    };
    if (finalState.won && save !== null && dungeon !== null) {
      const m = dungeon.stages[stageIdx];
      // 도화 신살 — 경험치·드랍 보정 (수치는 SINSALS 단일 소스, 설계서 10장)
      const hasDohwa = finalState.sinsals.indexOf("도화") !== -1;
      const expGained = hasDohwa
        ? Math.round(m.exp * (1 + (SINSALS.도화.expBonusPct ?? 0) / 100))
        : m.exp;
      let level = save.level;
      let exp = save.exp + expGained;
      let ups = 0;
      while (level < MAX_LEVEL && exp >= expForLevel(level)) {
        exp -= expForLevel(level);
        level += 1;
        ups += 1;
      }
      const cleared: Record<string, number> = { ...save.clearedStages };
      const prevBest = cleared[dungeon.id] ?? 0;
      if (stageIdx + 1 > prevBest) {
        cleared[dungeon.id] = stageIdx + 1;
      }
      // 모드 B 승리 보상 — 전투 종료 시점 시드를 이어받아 글자 드랍(일반 1·보스 2, 도화는 +1개 확률)
      let inventory = save.inventory;
      let letters: string[] = [];
      if (save.mode === "B") {
        letters = rollLetterDrop(
          dungeon.element,
          m.isBoss,
          finalState.seed,
          hasDohwa ? SINSALS.도화.dropBonusPct : 0,
        ).letters;
        inventory = [...save.inventory, ...letters];
      }
      const next: SaveData = { ...save, level, exp, clearedStages: cleared, inventory };
      try {
        window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 이번 세션 진행은 유지
      }
      setSave(next);
      info = { won: true, expGained, levelsGained: ups, levelAfter: level, letters, dohwaBonus: hasDohwa };
    }
    setResult(info);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = null;
      setView("result");
    }, RESULT_DELAY_MS);
  }

  // 자동 전투 — 800ms마다 attack 스텝, 스킬 버튼이 다음 스텝을 skill로 예약. 정리 필수.
  useEffect(() => {
    if (view !== "battle") return;
    const id = window.setInterval(() => {
      const cur = battleRef.current;
      if (cur === null || cur.over) return;
      const cmd = cmdRef.current;
      cmdRef.current = "attack";
      setPendingSkill(false);
      const { state, events } = stepBattle(cur, cmd);
      battleRef.current = state;
      setBattle(state);
      setLog((prev) => [...prev, ...events].slice(-LOG_LINES));
      if (state.over) {
        window.clearInterval(id); // 종료 즉시 인터벌 정리
        finishBattle(state);
      }
    }, AUTO_STEP_MS);
    return () => {
      window.clearInterval(id);
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
    // battleKey: 같은 battle 뷰에서 재도전해도 인터벌을 새로 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, battleKey]);

  return (
    <main style={styles.main}>
      {/* DESIGN.md(Anthropic Claude) — 코랄 버튼 press 다크닝 + 인풋 포커스 코랄 링 (플래너와 동일 패턴) */}
      <style>{designCss}</style>
      <div style={styles.shell}>
        {view === "loading" ? (
          <div style={styles.card}>
            <p style={styles.mutedText}>불러오는 중…</p>
          </div>
        ) : null}

        {view === "create" ? (
          <CreateView
            planner={plannerProfile}
            initialMode={save !== null ? save.mode : "A"}
            initialGender={save !== null && save.mode === "A" ? save.gender : ""}
            onSubmit={handleCreate}
            onSubmitB={handleCreateB}
          />
        ) : null}

        {view === "reveal" && character !== null && save !== null ? (
          <RevealView c={character} mode={save.mode} onStart={() => setView("home")} />
        ) : null}

        {view === "home" && character !== null && save !== null ? (
          <HomeView
            c={character}
            save={save}
            flows={flows}
            onDungeon={(d) => {
              setDungeon(d);
              setView("dungeon");
            }}
            onReveal={() => setView("reveal")}
            onRecreate={() => setView("create")}
            onEquip={handleEquip}
          />
        ) : null}

        {view === "dungeon" && character !== null && save !== null && dungeon !== null ? (
          <DungeonView
            c={character}
            save={save}
            d={dungeon}
            onEnter={(idx) => startBattle(dungeon, idx)}
            onBack={() => setView("home")}
          />
        ) : null}

        {view === "battle" && battle !== null && dungeon !== null ? (
          <BattleView
            b={battle}
            d={dungeon}
            stageIdx={stageIdx}
            log={log}
            pendingSkill={pendingSkill}
            onSkill={() => {
              cmdRef.current = "skill";
              setPendingSkill(true);
            }}
          />
        ) : null}

        {view === "result" && character !== null && dungeon !== null && result !== null ? (
          <ResultView
            c={character}
            d={dungeon}
            stageIdx={stageIdx}
            r={result}
            onNextStage={() => startBattle(dungeon, stageIdx + 1)}
            onRetry={() => startBattle(dungeon, stageIdx)}
            onDungeon={() => setView("dungeon")}
            onHome={() => setView("home")}
          />
        ) : null}
      </div>
    </main>
  );
}

// ── create: 모드 선택 (A 생년월일 입력 / B 일간 10택) ─────
function CreateView({
  planner,
  initialMode,
  initialGender,
  onSubmit,
  onSubmitB,
}: {
  planner: PlannerProfile | null;
  initialMode: "A" | "B";
  initialGender: "M" | "F" | "";
  onSubmit: (birthDate: string, birthTime: string, gender: "M" | "F" | "") => string;
  onSubmitB: (dayGan: string) => string;
}) {
  const [mode, setMode] = useState<"A" | "B">(initialMode);
  const [birthDate, setBirthDate] = useState<string>("");
  const [birthTime, setBirthTime] = useState<string>("");
  const [gender, setGender] = useState<"M" | "F" | "">(initialGender);
  const [error, setError] = useState<string>("");

  function handleStart() {
    setError("");

    // 잘못된 입력: 생년월일 비면 안내 (플래너와 동일 톤)
    if (birthDate === "") {
      setError("생년월일을 입력해주세요");
      return;
    }

    // 미래 날짜·없는 날이면 안내 (오늘까지 허용)
    const parsed = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      setError("올바른 생년월일을 입력해주세요");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed.getTime() > today.getTime()) {
      setError("올바른 생년월일을 입력해주세요");
      return;
    }

    const failMsg = onSubmit(birthDate, birthTime, gender);
    if (failMsg !== "") {
      setError(failMsg);
    }
  }

  return (
    <div style={styles.card}>
      <p style={styles.caption}>SAJU RPG</p>
      <h1 style={styles.title}>캐릭터 만들기</h1>

      {/* 모드 선택 2카드 — 저장 슬롯은 1개라 모드 전환 = 새 캐릭터 */}
      <div style={styles.modeGrid}>
        <button
          type="button"
          className={mode === "A" ? "rpg-mode-btn on" : "rpg-mode-btn"}
          onClick={() => {
            setMode("A");
            setError("");
          }}
        >
          <span style={styles.modeEmoji}>🔮</span>
          <span style={styles.modeName}>내 사주로 시작</span>
          <span style={styles.modeDesc}>생년월일이 곧 능력치</span>
        </button>
        <button
          type="button"
          className={mode === "B" ? "rpg-mode-btn on" : "rpg-mode-btn"}
          onClick={() => {
            setMode("B");
            setError("");
          }}
        >
          <span style={styles.modeEmoji}>🎴</span>
          <span style={styles.modeName}>사주 수집</span>
          <span style={styles.modeDesc}>일간 하나로 시작해 여덟 글자를 모아라</span>
        </button>
      </div>
      <p style={styles.mutedText}>저장 슬롯은 하나 — 모드를 바꾸면 새 캐릭터가 됩니다</p>

      {mode === "A" ? (
        <>
          <p style={styles.bodyText}>
            생년월일이 곧 능력치가 됩니다. 오행 상성을 골라가며 던전 5종을 정복해보세요.
          </p>

          <label style={styles.label}>
            생년월일 (필수)
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="rpg-input"
            />
          </label>

          <label style={styles.label}>
            태어난 시각 (선택 · 모르면 비워두세요)
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              className="rpg-input"
            />
          </label>

          {/* 성별 3택 — 대운 계산 전용 (설계서 11장), 기본 선택 안 함 */}
          <div style={styles.label}>
            성별 (선택)
            <div style={styles.genderGrid}>
              {GENDERS.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  className={gender === g.value ? "rpg-gender-btn on" : "rpg-gender-btn"}
                  onClick={() => setGender(g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p style={styles.genderNote}>대운 계산에만 써요 — 안 골라도 됩니다</p>
          </div>

          {planner !== null ? (
            <button
              type="button"
              className="rpg-btn secondary"
              onClick={() => {
                setBirthDate(planner.birthDate);
                setBirthTime(planner.birthTime);
                setError("");
              }}
            >
              플래너에 저장된 생일 불러오기
            </button>
          ) : null}

          {error !== "" ? <p style={styles.error}>{error}</p> : null}

          <button type="button" onClick={handleStart} className="rpg-btn">
            캐릭터 생성
          </button>
        </>
      ) : (
        <>
          <p style={styles.bodyText}>
            나의 근본이 될 일간을 하나 고르면 바로 시작합니다. 던전에서 글자를 모아 나머지 일곱
            자리를 채워보세요.
          </p>

          {/* 일간 10택 그리드 — 선택 즉시 캐릭터 생성 */}
          <div style={styles.stemGrid}>
            {STEMS.map((st) => {
              const el = GAN_ELEMENT[st];
              return (
                <button
                  key={st}
                  type="button"
                  className="rpg-stem-btn"
                  style={{ border: `2px solid ${elementColor(el)}` }}
                  onClick={() => {
                    const failMsg = onSubmitB(st);
                    if (failMsg !== "") {
                      setError(failMsg);
                    }
                  }}
                >
                  <span style={styles.stemChar}>{st}</span>
                  <span style={{ ...styles.stemKo, color: elementColor(el) }}>
                    {STEM_KO_UI[st]}
                  </span>
                </button>
              );
            })}
          </div>

          {error !== "" ? <p style={styles.error}>{error}</p> : null}
        </>
      )}
    </div>
  );
}

// ── reveal: 사주 8자 + 오행 바 + 직업 + 시너지·신살 + 전투력 ────────────
function RevealView({
  c,
  mode,
  onStart,
}: {
  c: Character;
  mode: "A" | "B";
  onStart: () => void;
}) {
  const cols: { label: string; slot: PillarSlot }[] = [
    { label: "연주", slot: c.pillars.year },
    { label: "월주", slot: c.pillars.month },
    { label: "일주", slot: c.pillars.day },
    { label: "시주", slot: c.pillars.time },
  ];
  const maxScore = Math.max(...ELEMENT_ORDER.map((e) => c.elements[e]), 1);

  return (
    <div style={styles.card}>
      <p style={styles.caption}>캐릭터 각성</p>
      <h1 style={styles.title}>당신의 사주 여덟 글자</h1>

      {/* 4주 8자 카드 — 글자별 오행색 테두리, 빈 슬롯(모드 A 시주 미입력·모드 B 미장착)은 ? 카드 */}
      <div style={styles.pillarGrid}>
        {cols.map((col) => (
          <div key={col.label} style={styles.pillarCol}>
            <span style={styles.pillarLabel}>{col.label}</span>
            {col.slot.gan !== null ? (
              <Glyph ch={col.slot.gan} el={GAN_ELEMENT[col.slot.gan] ?? c.dayElement} />
            ) : (
              <div style={styles.glyphEmpty}>?</div>
            )}
            {col.slot.zhi !== null ? (
              <Glyph ch={col.slot.zhi} el={ZHI_ELEMENT[col.slot.zhi] ?? c.dayElement} />
            ) : (
              <div style={styles.glyphEmpty}>?</div>
            )}
          </div>
        ))}
      </div>
      <p style={styles.mutedText}>
        일간 <strong>{c.dayMaster}</strong> — {elementKo(c.dayElement)}({c.dayElement}) 속성으로 공격합니다
      </p>

      {/* 오행 점수 가로 바 5개 */}
      <div style={styles.sectionGap}>
        {ELEMENT_ORDER.map((e) => (
          <div key={e} style={styles.barRow}>
            <span style={styles.barLabel}>
              {elementKo(e)} {e}
              <span style={styles.barStat}> · {ELEMENT_STAT_KO[e]}</span>
            </span>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${(c.elements[e] / maxScore) * 100}%`,
                  background: elementColor(e),
                }}
              />
            </div>
            <span style={styles.barValue}>{c.elements[e]}</span>
          </div>
        ))}
      </div>

      {/* 직업 카드 */}
      <div style={styles.jobCard}>
        <span style={styles.jobEmoji}>{c.job.emoji}</span>
        <div>
          <p style={styles.jobName}>{c.job.name}</p>
          <p style={styles.jobDesc}>패시브 — {c.job.passiveDesc}</p>
          <p style={styles.jobDesc}>
            {c.job.skill.emoji} {c.job.skill.name} — {c.job.skill.desc}
          </p>
        </div>
      </div>

      {/* 모드 B 무명객(無格) — 각성 조건 한 줄 안내 */}
      {c.job.tenGod === null ? (
        <p style={styles.hintText}>💡 월지를 채우면 격국이 각성합니다</p>
      ) : null}

      {/* 십성 시너지 — 여덟 글자 구성이 깨어난 결 (설계서 9장) */}
      <div style={styles.sectionGap}>
        <SynergyCard counts={c.tenGodCounts} />
      </div>

      {/* 신살 — 지지 조합이 깨운 별 (설계서 10장). 모드 A 는 0개면 카드 숨김 */}
      {c.sinsals.length > 0 || mode === "B" ? (
        <div style={styles.sectionGap}>
          <SinsalCard sinsals={c.sinsals} />
        </div>
      ) : null}

      {/* 전투력 — 세리프 히어로 */}
      <p style={styles.caption}>종합 전투력</p>
      <p style={styles.powerHero}>{c.power}</p>

      <button type="button" onClick={onStart} className="rpg-btn">
        모험 시작
      </button>
    </div>
  );
}

// 한자 1글자 카드 (오행색 테두리)
function Glyph({ ch, el }: { ch: string; el: Element }) {
  return (
    <div style={styles.glyphCard(elementColor(el))}>
      <span style={styles.glyphChar}>{ch}</span>
      <span style={{ ...styles.glyphEl, color: elementColor(el) }}>{elementKo(el)}</span>
    </div>
  );
}

// ── 십성 시너지 카드 (reveal·home 공용) — n>0 그룹만, 수치·이름은 SYNERGIES 단일 소스 ──
// 전부 0이면 모드 B 초기 상태뿐(모드 A는 최소 5글자 집계라 항상 1그룹 이상) → 수집 안내 문구.
function SynergyCard({ counts }: { counts: Record<TenGodGroup, number> }) {
  const active = TEN_GOD_GROUPS.filter((g) => counts[g] > 0);
  return (
    <>
      <p style={styles.caption}>십성 시너지</p>
      {active.length > 0 ? (
        active.map((g) => {
          const def = SYNERGIES[g];
          const n = counts[g];
          return (
            <div key={g} style={styles.synergyRow}>
              <span style={styles.synergyEmoji}>{def.emoji}</span>
              <span style={{ flex: 1 }}>
                <span style={styles.synergyName}>
                  {def.name} <span style={styles.synergyCount}>×{n}</span>
                </span>
                <span style={styles.synergyDesc}>{synergyDescText(def, n)}</span>
              </span>
              <span style={styles.synergyTotal}>{synergyTotalText(def, n)}</span>
            </div>
          );
        })
      ) : (
        <p style={{ ...styles.mutedText, margin: "8px 0 0" }}>
          글자를 모으면 십성의 결이 깨어납니다
        </p>
      )}
    </>
  );
}

// ── 신살 카드 (reveal·home 공용) — 뱃지(이모지+이름)+효과, 데이터는 SINSALS 단일 소스 ──
// 0개 처리: 모드 B 는 수집 안내 한 줄, 모드 A 는 호출부에서 카드째 숨긴다 (설계서 10장).
function SinsalCard({ sinsals }: { sinsals: SinsalKey[] }) {
  return (
    <>
      <p style={styles.caption}>신살</p>
      {sinsals.length > 0 ? (
        sinsals.map((k) => {
          const def = SINSALS[k];
          return (
            <div key={k} style={styles.sinsalRow}>
              <span style={styles.sinsalBadge}>
                {def.emoji} {def.name}
              </span>
              <span style={styles.sinsalDesc}>{def.desc}</span>
            </div>
          );
        })
      ) : (
        <p style={{ ...styles.mutedText, margin: "8px 0 0" }}>
          지지 조합이 맞으면 신살이 깨어납니다
        </p>
      )}
    </>
  );
}

// ── home: 허브 (요약·[모드 B]사주판·글자 주머니·시너지·신살·운의 흐름·던전 입장·면책) ──────────
function HomeView({
  c,
  save,
  flows,
  onDungeon,
  onReveal,
  onRecreate,
  onEquip,
}: {
  c: Character;
  save: SaveData;
  flows: FlowBuff[];
  onDungeon: (d: Dungeon) => void;
  onReveal: () => void;
  onRecreate: () => void;
  onEquip: (slotKey: keyof LetterSlots, letter: string) => void;
}) {
  // 모드 B 장착 흐름: 칩 탭(선택) → 같은 종류(천간/지지) 슬롯 하이라이트 → 슬롯 탭(장착). 칩 재탭 = 취소.
  const [selLetter, setSelLetter] = useState<string | null>(null);

  const maxed = save.level >= MAX_LEVEL;
  const need = expForLevel(save.level);
  const expPct = maxed ? 100 : Math.min((save.exp / need) * 100, 100);

  const slots = save.slots;
  const selIsStem = selLetter !== null ? isStem(selLetter) : false;
  // 글자 주머니 — 글자별 개수 집계 (표시는 천간→지지 정순, 미인식 글자는 숨김)
  const counts = new Map<string, number>();
  if (save.mode === "B") {
    for (const ch of save.inventory) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  const chipLetters = [...STEMS, ...BRANCHES].filter((ch) => counts.has(ch));
  const complete = slots !== null && SLOT_KEYS.every((k) => slots[k] !== null);

  // 사주판 슬롯 1칸 — 채워진 칸은 오행색 테두리, 빈 칸은 ?, 하이라이트 시 탭하면 장착(교체)
  function renderSlot(slotKey: keyof LetterSlots) {
    if (slots === null) return null;
    const letter = slots[slotKey];
    const targetable = selLetter !== null && selIsStem === SLOT_IS_STEM[slotKey];
    const el = letter !== null ? letterEl(letter) ?? c.dayElement : null;
    let borderColor = "#e6dfd8";
    let borderStyle = "dashed";
    if (letter !== null && el !== null) {
      borderColor = elementColor(el);
      borderStyle = "solid";
    }
    if (targetable) {
      borderColor = "#cc785c";
    }
    return (
      <button
        type="button"
        className={targetable ? "rpg-slot-btn target" : "rpg-slot-btn"}
        disabled={!targetable}
        style={{ border: `2px ${borderStyle} ${borderColor}` }}
        onClick={() => {
          if (selLetter !== null) {
            onEquip(slotKey, selLetter);
            setSelLetter(null);
          }
        }}
      >
        {letter !== null && el !== null ? (
          <>
            <span style={styles.slotChar}>{letter}</span>
            {targetable ? (
              <span style={styles.slotHint}>여기에 장착</span>
            ) : (
              <span style={{ ...styles.slotEl, color: elementColor(el) }}>{elementKo(el)}</span>
            )}
          </>
        ) : (
          <>
            <span style={styles.slotEmptyChar}>?</span>
            {targetable ? (
              <span style={styles.slotHint}>여기에 장착</span>
            ) : (
              <span style={{ ...styles.slotEl, color: "#c9c4bb" }}>비어 있음</span>
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <>
      {/* 캐릭터 요약 */}
      <div style={styles.card}>
        <div style={styles.summaryRow}>
          <span style={styles.summaryEmoji}>{c.job.emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={styles.summaryName}>
              Lv.{save.level} {c.job.name}
            </p>
            <div style={styles.expTrack}>
              <div style={{ ...styles.expFill, width: `${expPct}%` }} />
            </div>
            <p style={styles.expText}>{maxed ? "경험치 MAX" : `경험치 ${save.exp}/${need}`}</p>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <p style={styles.caption}>전투력</p>
            <p style={styles.powerSmall}>{c.power}</p>
          </div>
        </div>
      </div>

      {/* [모드 B] 사주판 — 4주×(천간/지지) 8칸, 일간은 고정 칸 + 글자 주머니 */}
      {save.mode === "B" && slots !== null ? (
        <div style={styles.card}>
          <div style={styles.boardHead}>
            <p style={{ ...styles.caption, margin: 0 }}>사주판</p>
            {complete ? <span style={styles.completeBadge}>✦ 팔자 완성</span> : null}
          </div>
          <div style={styles.pillarGrid}>
            {BOARD_COLS.map((col) => (
              <div key={col.label} style={styles.pillarCol}>
                <span style={styles.pillarLabel}>{col.label}</span>
                {col.gan !== null ? (
                  renderSlot(col.gan)
                ) : (
                  <div
                    style={{
                      ...styles.dayGanCell,
                      border: `2px solid ${elementColor(c.dayElement)}`,
                      background: `${elementColor(c.dayElement)}14`,
                    }}
                  >
                    <span style={styles.slotChar}>{c.dayMaster}</span>
                    <span style={{ ...styles.slotEl, color: elementColor(c.dayElement) }}>
                      일간
                    </span>
                  </div>
                )}
                {renderSlot(col.zhi)}
              </div>
            ))}
          </div>
          {selLetter !== null ? (
            <p style={{ ...styles.mutedText, color: "#cc785c" }}>
              {selLetter} 글자를 넣을 {selIsStem ? "천간" : "지지"} 자리를 탭하세요 — 칩을 다시
              누르면 취소
            </p>
          ) : null}

          <p style={{ ...styles.caption, margin: "12px 0 0" }}>글자 주머니</p>
          {chipLetters.length > 0 ? (
            <div style={styles.chipRow}>
              {chipLetters.map((ch) => {
                const el = letterEl(ch) ?? c.dayElement;
                const on = selLetter === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    className={on ? "rpg-chip-btn on" : "rpg-chip-btn"}
                    style={{ border: `2px solid ${elementColor(el)}` }}
                    onClick={() => setSelLetter(on ? null : ch)}
                  >
                    <span style={styles.chipChar}>{ch}</span>
                    <span style={styles.chipCount}>×{counts.get(ch) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p style={{ ...styles.mutedText, margin: "8px 0 0" }}>
              아직 모은 글자가 없어요 — 던전에서 승리하면 글자를 얻어요
            </p>
          )}
        </div>
      ) : null}

      {/* 십성 시너지 — 모드 B는 장착·교체 시 createCharacterFromSlots 재계산으로 실시간 갱신 */}
      <div style={styles.card}>
        <SynergyCard counts={c.tenGodCounts} />
      </div>

      {/* 신살 — 모드 B는 지지 장착·교체로 깨어나고 사라진다. 모드 A 는 0개면 카드 숨김 */}
      {c.sinsals.length > 0 || save.mode === "B" ? (
        <div style={styles.card}>
          <SinsalCard sinsals={c.sinsals} />
        </div>
      ) : null}

      {/* 운의 흐름 — 대운·세운·월운·일운 순, 각 운의 천간 오행이 스탯을 북돋운다 (설계서 11장) */}
      {flows.length > 0 ? (
        <div style={styles.card}>
          <p style={styles.caption}>운의 흐름</p>
          {save.mode === "A" && save.gender === "" ? (
            <p style={styles.flowHint}>성별을 입력하면 대운이 보여요 (생일 다시 입력에서)</p>
          ) : null}
          {flows.map((f) => (
            <div key={f.kind} style={styles.flowRow(elementColor(f.element))}>
              <span style={styles.flowLabel}>{f.label}</span>
              <span style={{ ...styles.flowBonus, color: elementColor(f.element) }}>
                {STAT_KO[f.statKey]} +{f.bonusPct}%
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* 던전 5종 입장 */}
      <p style={{ ...styles.caption, margin: "8px 0 0" }}>오행 던전</p>
      {DUNGEONS.map((d) => {
        const cleared = save.clearedStages[d.id] ?? 0;
        return (
          <button
            key={d.id}
            type="button"
            className="rpg-card-btn"
            style={{ borderLeft: `4px solid ${elementColor(d.element)}` }}
            onClick={() => onDungeon(d)}
          >
            <span style={styles.dungeonEmoji}>{d.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={styles.dungeonName}>{d.name}</span>
              <span style={styles.dungeonDesc}>{d.desc}</span>
            </span>
            <span style={styles.dungeonProgress(cleared >= STAGE_COUNT)}>
              {cleared >= STAGE_COUNT ? "클리어!" : `${cleared}/${STAGE_COUNT}`}
            </span>
          </button>
        );
      })}

      <button type="button" onClick={onReveal} className="rpg-btn secondary">
        정보 다시 보기
      </button>
      {/* 모드 A: 생일 오입력 복구 경로(같은 생일 재저장 시 진행 유지) / 모드 B: 모드 선택으로 회귀(새 캐릭터) */}
      <button type="button" onClick={onRecreate} className="rpg-btn secondary">
        {save.mode === "B" ? "처음부터 다시 (모드 선택)" : "생일 다시 입력 (다르게 넣으면 캐릭터 재생성)"}
      </button>

      <p style={styles.disclaimer}>게임적 재미를 위한 것으로 실제 운세·점술이 아닙니다</p>
    </>
  );
}

// ── dungeon: 스테이지 선택 (순차 해금) ────────────────────
function DungeonView({
  c,
  save,
  d,
  onEnter,
  onBack,
}: {
  c: Character;
  save: SaveData;
  d: Dungeon;
  onEnter: (idx: number) => void;
  onBack: () => void;
}) {
  const cleared = save.clearedStages[d.id] ?? 0;
  const mult = elementMultiplier(c.dayElement, d.element);
  const matchup =
    mult === 1.5
      ? "상성 유리 — 내 공격 ×1.5"
      : mult === 0.7
        ? "상성 불리 — 내 공격 ×0.7"
        : "상성 보통 — 내 공격 ×1.0";

  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${elementColor(d.element)}` }}>
      <p style={styles.caption}>
        {elementKo(d.element)}({d.element}) 속성 던전
      </p>
      <h1 style={styles.title}>
        {d.emoji} {d.name}
      </h1>
      <p style={styles.bodyText}>{d.desc}</p>
      <p style={{ ...styles.mutedText, color: elementColor(d.element) }}>{matchup}</p>

      <div style={styles.sectionGap}>
        {d.stages.map((m, i) => {
          const locked = i > cleared;
          return (
            <button
              key={m.id}
              type="button"
              className="rpg-stage-btn"
              disabled={locked}
              onClick={() => onEnter(i)}
            >
              <span style={styles.stageNo}>{i + 1}</span>
              <span style={styles.stageEmoji}>{locked ? "🔒" : m.emoji}</span>
              <span style={{ flex: 1, textAlign: "left" as const }}>
                <span style={styles.stageName}>
                  {m.name}
                  {m.isBoss ? <span style={styles.bossBadge}>BOSS</span> : null}
                </span>
                <span style={styles.stageExp}>EXP {m.exp}</span>
              </span>
              <span style={styles.stageDone}>{i < cleared ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>

      <button type="button" onClick={onBack} className="rpg-btn secondary">
        홈으로
      </button>
    </div>
  );
}

// ── battle: 먹빛 다크 카드 — 자동 스텝 + 스킬 개입 ────────
function BattleView({
  b,
  d,
  stageIdx,
  log,
  pendingSkill,
  onSkill,
}: {
  b: BattleState;
  d: Dungeon;
  stageIdx: number;
  log: BattleEvent[];
  pendingSkill: boolean;
  onSkill: () => void;
}) {
  const skill = b.job.skill;
  // 발동 중인 십성 시너지 그룹 (n>0) — 이모지 ×n 컴팩트 표기용
  const activeSynergy = TEN_GOD_GROUPS.filter((g) => b.synergy[g] > 0);
  const skillDisabled = b.over || b.skillCooldown > 0 || pendingSkill;
  const skillLabel =
    b.skillCooldown > 0
      ? `${skill.emoji} ${skill.name} — 대기 ${b.skillCooldown}턴`
      : pendingSkill
        ? `${skill.emoji} ${skill.name} — 예약됨`
        : `${skill.emoji} ${skill.name}`;

  return (
    <div style={styles.darkCard}>
      <div style={styles.battleHeader}>
        <span>
          {d.emoji} {d.name} · 스테이지 {stageIdx + 1}/{STAGE_COUNT}
        </span>
        <span>턴 {b.turn}</span>
      </div>

      {/* 플레이어 vs 몬스터 */}
      <div style={styles.fightersRow}>
        <FighterPanel who={b.player} barColor="#5db8a6" align="left" />
        <span style={styles.vsMark}>VS</span>
        <FighterPanel who={b.foe} barColor="#c64545" align="right" />
      </div>

      {/* 운의 흐름 버프 — 컴팩트 한 줄 (대운·세운·월운·일운) */}
      {b.flows.length > 0 ? (
        <p style={styles.buffLine}>
          ☀ {b.flows.map((f) => `${f.kind} ${STAT_KO[f.statKey]}+${f.bonusPct}%`).join(" · ")}
        </p>
      ) : null}

      {/* 발동 중인 십성 시너지 — 이모지 ×n 한 줄 */}
      {activeSynergy.length > 0 ? (
        <p style={styles.synergyLine}>
          ✦ {activeSynergy.map((g) => `${SYNERGIES[g].emoji}×${b.synergy[g]}`).join(" ")}
        </p>
      ) : null}

      {/* 발동 중인 신살 — 이모지 나열 한 줄 */}
      {b.sinsals.length > 0 ? (
        <p style={styles.sinsalLine}>
          ✴ {b.sinsals.map((k) => SINSALS[k].emoji).join(" ")}
        </p>
      ) : null}

      {/* 턴 로그 — 최근 6줄, kind별 색 */}
      <div style={styles.logBox}>
        {log.map((ev, i) => (
          <p key={`${b.turn}-${i}`} style={{ ...styles.logLine, color: LOG_COLOR[ev.kind] }}>
            {ev.text}
          </p>
        ))}
      </div>

      <p style={styles.autoNote}>⚔️ 자동 전투 중 — 스킬만 눌러주세요</p>
      <button type="button" className="rpg-btn skill" disabled={skillDisabled} onClick={onSkill}>
        {skillLabel}
      </button>
      <p style={styles.skillDesc}>{skill.desc}</p>
    </div>
  );
}

// 전투 패널 한쪽 (이모지 + 이름 + HP바)
function FighterPanel({
  who,
  barColor,
  align,
}: {
  who: BattleState["player"];
  barColor: string;
  align: "left" | "right";
}) {
  const hp = Math.max(who.hp, 0);
  const pct = who.maxHp > 0 ? Math.min((hp / who.maxHp) * 100, 100) : 0;
  return (
    <div style={{ flex: 1, textAlign: align }}>
      <div style={styles.fighterEmoji}>{who.emoji}</div>
      <div style={styles.fighterName}>
        {who.name}
        <span style={{ ...styles.fighterEl, color: elementColor(who.element) }}>
          {" "}
          {elementKo(who.element)}
        </span>
      </div>
      <div style={styles.hpTrack}>
        <div className="rpg-hp-fill" style={{ ...styles.hpFill, width: `${pct}%`, background: barColor }} />
      </div>
      <div style={styles.hpText}>
        {hp}/{who.maxHp}
      </div>
    </div>
  );
}

// ── result: 승리/패배 + 상성 힌트 ─────────────────────────
function ResultView({
  c,
  d,
  stageIdx,
  r,
  onNextStage,
  onRetry,
  onDungeon,
  onHome,
}: {
  c: Character;
  d: Dungeon;
  stageIdx: number;
  r: ResultInfo;
  onNextStage: () => void;
  onRetry: () => void;
  onDungeon: () => void;
  onHome: () => void;
}) {
  const m = d.stages[stageIdx];
  const hasNext = stageIdx + 1 < STAGE_COUNT;
  // 상성 힌트 — 내 일간 오행이 극하는(×1.5) 속성을 계약 함수로 찾는다
  const fav = ELEMENT_ORDER.find((e) => elementMultiplier(c.dayElement, e) === 1.5);
  const hint =
    fav !== undefined
      ? `💡 내 ${elementKo(c.dayElement)}(${c.dayElement}) 기운은 ${elementKo(fav)}(${fav}) 속성에게 강해요`
      : "";

  if (r.won) {
    return (
      <div style={styles.card}>
        <p style={styles.caption}>
          {d.emoji} {d.name} · 스테이지 {stageIdx + 1}
        </p>
        <h1 style={styles.resultHero}>승리! 🎉</h1>
        <p style={styles.bodyText}>
          {m.emoji} {m.name}을(를) 물리치고 경험치 +{r.expGained}을 얻었어요.
        </p>
        {/* 도화 신살 — 경험치 보정 캡션 (수치는 SINSALS 단일 소스) */}
        {r.dohwaBonus ? (
          <p style={styles.dohwaNote}>
            🌸 도화 보너스! 경험치 +{SINSALS.도화.expBonusPct}% 보정
          </p>
        ) : null}
        {r.levelsGained > 0 ? (
          <span style={styles.levelUpBadge}>
            LEVEL UP! Lv.{r.levelAfter} (+{r.levelsGained})
          </span>
        ) : null}
        {/* 모드 B 승리 보상 — 획득한 글자 칩 (한자 + 오행 한글) */}
        {r.letters.length > 0 ? (
          <>
            <p style={styles.caption}>획득한 글자</p>
            <div style={styles.dropRow}>
              {r.letters.map((ch, i) => {
                const el = letterEl(ch) ?? c.dayElement;
                return (
                  <span
                    key={`${ch}-${i}`}
                    style={{ ...styles.dropChip, border: `2px solid ${elementColor(el)}` }}
                  >
                    <span style={styles.dropChipChar}>{ch}</span>
                    <span style={{ ...styles.dropChipEl, color: elementColor(el) }}>
                      {elementKo(el)}
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        ) : null}
        {hint !== "" ? <p style={styles.hintText}>{hint}</p> : null}
        {hasNext ? (
          <button type="button" onClick={onNextStage} className="rpg-btn">
            다음 스테이지로
          </button>
        ) : (
          <button type="button" onClick={onHome} className="rpg-btn">
            던전 클리어! 다른 던전으로
          </button>
        )}
        <button type="button" onClick={hasNext ? onDungeon : onHome} className="rpg-btn secondary">
          {hasNext ? "던전 선택" : "홈으로"}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <p style={styles.caption}>
        {d.emoji} {d.name} · 스테이지 {stageIdx + 1}
      </p>
      <h1 style={styles.resultHero}>아쉬워요…</h1>
      <p style={styles.bodyText}>
        패배해도 잃는 건 없어요. 상성 좋은 던전부터 차근차근 레벨을 올려보세요.
      </p>
      {hint !== "" ? <p style={styles.hintText}>{hint}</p> : null}
      <button type="button" onClick={onRetry} className="rpg-btn">
        재도전
      </button>
      <button type="button" onClick={onDungeon} className="rpg-btn secondary">
        던전 선택
      </button>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────
// 버튼·인풋의 상태(press/focus/disabled)는 인라인으로 안 되므로 클래스 CSS로 (플래너 패턴).
const designCss = `
  .rpg-btn {
    width: 100%; padding: 12px 20px; min-height: 40px; margin-top: 8px;
    font-family: ${SANS}; font-size: 14px; font-weight: 500; line-height: 1;
    color: #fff; background: #cc785c; border: none; border-radius: 8px; cursor: pointer;
  }
  .rpg-btn:active { background: #a9583e; }
  .rpg-btn:disabled { background: #e6dfd8; color: #6c6a64; cursor: default; }
  .rpg-btn.secondary { color: #141413; background: #ffffff; border: 1px solid #e6dfd8; }
  .rpg-btn.secondary:active { background: #f5f0e8; }
  .rpg-btn.skill { margin-top: 8px; }
  .rpg-btn.skill:disabled { background: #3a3733; color: #8e8b82; }
  .rpg-input {
    display: block; width: 100%; box-sizing: border-box; margin-top: 6px;
    padding: 10px 14px; font-family: ${SANS}; font-size: 16px;
    color: #141413; background: #faf9f5; border: 1px solid #e6dfd8; border-radius: 8px;
  }
  .rpg-input:focus { outline: none; border-color: #cc785c; box-shadow: 0 0 0 3px rgba(204,120,92,0.15); }
  .rpg-card-btn {
    display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
    background: #ffffff; border: 1px solid #e6dfd8; border-radius: 12px; padding: 14px 16px;
    font-family: ${SANS};
  }
  .rpg-card-btn:active { background: #f5f0e8; }
  .rpg-stage-btn {
    display: flex; align-items: center; gap: 10px; width: 100%; cursor: pointer;
    background: #faf9f5; border: 1px solid #e6dfd8; border-radius: 8px; padding: 10px 12px;
    font-family: ${SANS}; margin-top: 8px;
  }
  .rpg-stage-btn:active { background: #f5f0e8; }
  .rpg-stage-btn:disabled { cursor: default; opacity: 0.55; }
  .rpg-hp-fill { transition: width 0.4s ease; }
  .rpg-mode-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%;
    padding: 14px 10px; text-align: center; cursor: pointer;
    background: #ffffff; border: 1px solid #e6dfd8; border-radius: 12px; font-family: ${SANS};
  }
  .rpg-mode-btn:active { background: #f5f0e8; }
  .rpg-mode-btn.on { border-color: #cc785c; box-shadow: 0 0 0 3px rgba(204,120,92,0.15); }
  .rpg-stem-btn {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 10px 0 6px; cursor: pointer;
    background: #faf9f5; border: 2px solid #e6dfd8; border-radius: 8px; font-family: ${SANS};
  }
  .rpg-stem-btn:active { background: #f5f0e8; }
  .rpg-slot-btn {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    width: 100%; min-height: 62px; padding: 8px 0 6px; cursor: default;
    background: #faf9f5; border: 2px dashed #e6dfd8; border-radius: 8px; font-family: ${SANS};
  }
  .rpg-slot-btn.target { cursor: pointer; box-shadow: 0 0 0 3px rgba(204,120,92,0.22); }
  .rpg-slot-btn.target:active { background: #f5f0e8; }
  .rpg-chip-btn {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; cursor: pointer;
    background: #faf9f5; border: 2px solid #e6dfd8; border-radius: 9999px; font-family: ${SANS};
  }
  .rpg-chip-btn:active { background: #f5f0e8; }
  .rpg-chip-btn.on { box-shadow: 0 0 0 3px rgba(204,120,92,0.25); }
  .rpg-gender-btn {
    width: 100%; padding: 10px 0; text-align: center; cursor: pointer;
    font-family: ${SANS}; font-size: 13px; font-weight: 500; color: #3d3d3a;
    background: #faf9f5; border: 1px solid #e6dfd8; border-radius: 8px;
  }
  .rpg-gender-btn:active { background: #f5f0e8; }
  .rpg-gender-btn.on { color: #141413; border-color: #cc785c; box-shadow: 0 0 0 3px rgba(204,120,92,0.15); }
`;

const styles = {
  main: {
    fontFamily: SANS,
    minHeight: "100vh",
    background: "#faf9f5", // canvas 크림
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: 24,
  } as const,
  shell: {
    width: "100%",
    maxWidth: 520,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 32,
    marginBottom: 48,
  } as const,
  card: {
    background: "#ffffff",
    border: "1px solid #e6dfd8", // hairline
    borderRadius: 12, // rounded.lg
    padding: 24,
  } as const,
  // 전투 전용 먹빛 카드 — "던전에 들어온" 반전
  darkCard: {
    background: "#181715", // surface-dark
    color: "#faf9f5", // on-dark
    borderRadius: 12,
    padding: 24,
  } as const,
  caption: {
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "#8e8b82", // muted-soft
    margin: "0 0 4px",
  } as const,
  title: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: 400,
    letterSpacing: "-0.3px",
    color: "#141413", // ink
    margin: "0 0 12px",
  } as const,
  resultHero: {
    fontFamily: SERIF,
    fontSize: 36,
    fontWeight: 400,
    letterSpacing: "-0.5px",
    lineHeight: 1.15,
    color: "#141413",
    margin: "4px 0 12px",
  } as const,
  bodyText: {
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 1.55,
    color: "#3d3d3a", // body
    margin: "0 0 16px",
  } as const,
  mutedText: {
    fontFamily: SANS,
    color: "#8e8b82",
    fontSize: 13,
    margin: "0 0 8px",
  } as const,
  label: {
    display: "block",
    fontFamily: SANS,
    fontSize: 14,
    color: "#6c6a64", // muted
    marginBottom: 16,
  } as const,
  error: {
    fontFamily: SANS,
    color: "#c64545", // error
    fontSize: 14,
    margin: "8px 0 4px",
  } as const,
  disclaimer: {
    fontFamily: SANS,
    color: "#8e8b82",
    fontSize: 12,
    textAlign: "center",
    margin: "12px 0 0",
  } as const,
  sectionGap: { margin: "16px 0" } as const,

  // reveal — 8자 카드
  pillarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    margin: "8px 0 12px",
  } as const,
  pillarCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 6,
  } as const,
  pillarLabel: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    textAlign: "center",
  } as const,
  glyphCard: (color: string) =>
    ({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "10px 0 6px",
      background: "#faf9f5",
      border: `2px solid ${color}`,
      borderRadius: 8,
    }) as const,
  glyphChar: {
    fontFamily: SERIF,
    fontSize: 34,
    lineHeight: 1.1,
    color: "#141413",
  } as const,
  glyphEl: {
    fontFamily: SANS,
    fontSize: 11,
    fontWeight: 500,
    marginTop: 2,
  } as const,
  glyphEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 66,
    fontFamily: SERIF,
    fontSize: 24,
    color: "#c9c4bb",
    background: "#faf9f5",
    border: "2px dashed #e6dfd8",
    borderRadius: 8,
  } as const,

  // reveal — 오행 바
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  } as const,
  barLabel: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    color: "#3d3d3a",
    width: 118,
    flexShrink: 0,
  } as const,
  barStat: { fontWeight: 400, color: "#8e8b82", fontSize: 12 } as const,
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 9999,
    background: "#efe9de", // surface-card
    overflow: "hidden",
  } as const,
  barFill: { height: "100%", borderRadius: 9999 } as const,
  barValue: {
    fontFamily: SANS,
    fontSize: 13,
    color: "#6c6a64",
    width: 34,
    textAlign: "right",
    flexShrink: 0,
  } as const,

  // reveal — 직업·전투력
  jobCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    background: "#efe9de",
    borderRadius: 12,
    padding: 16,
    margin: "16px 0",
  } as const,
  jobEmoji: { fontSize: 36, lineHeight: 1.2 } as const,
  jobName: {
    fontFamily: SERIF,
    fontSize: 22,
    letterSpacing: "-0.3px",
    color: "#141413",
    margin: "0 0 4px",
  } as const,
  jobDesc: {
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#3d3d3a",
    margin: "0 0 2px",
  } as const,
  powerHero: {
    fontFamily: SERIF,
    fontSize: 52,
    fontWeight: 400,
    letterSpacing: "-1px",
    lineHeight: 1.05,
    color: "#141413",
    margin: "0 0 16px",
  } as const,

  // home — 요약·던전
  summaryRow: { display: "flex", alignItems: "center", gap: 14 } as const,
  summaryEmoji: { fontSize: 40, lineHeight: 1.2 } as const,
  summaryName: {
    fontFamily: SERIF,
    fontSize: 22,
    letterSpacing: "-0.3px",
    color: "#141413",
    margin: "0 0 6px",
  } as const,
  expTrack: {
    height: 8,
    borderRadius: 9999,
    background: "#efe9de",
    overflow: "hidden",
  } as const,
  expFill: {
    height: "100%",
    borderRadius: 9999,
    background: "#cc785c", // 코랄 — 경험치
    transition: "width 0.4s ease",
  } as const,
  expText: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    margin: "4px 0 0",
  } as const,
  powerSmall: {
    fontFamily: SERIF,
    fontSize: 26,
    letterSpacing: "-0.5px",
    color: "#141413",
    margin: 0,
  } as const,
  // home — 운의 흐름 카드 (줄마다 그 운의 오행색 좌측 보더)
  flowRow: (color: string) =>
    ({
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#faf9f5",
      border: "1px solid #e6dfd8",
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: "8px 12px",
      marginTop: 6,
    }) as const,
  flowLabel: {
    flex: 1,
    fontFamily: SANS,
    fontSize: 13,
    color: "#3d3d3a",
  } as const,
  flowBonus: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    flexShrink: 0,
  } as const,
  flowHint: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    background: "#faf9f5",
    border: "1px dashed #e6dfd8",
    borderRadius: 8,
    padding: "8px 12px",
    margin: "6px 0 0",
  } as const,
  dungeonEmoji: { fontSize: 28, lineHeight: 1.2, flexShrink: 0 } as const,
  dungeonName: {
    display: "block",
    fontFamily: SANS,
    fontSize: 15,
    fontWeight: 500,
    color: "#141413",
  } as const,
  dungeonDesc: {
    display: "block",
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    marginTop: 2,
  } as const,
  dungeonProgress: (done: boolean) =>
    ({
      fontFamily: SANS,
      fontSize: 13,
      fontWeight: 500,
      color: done ? "#5db872" : "#6c6a64",
      flexShrink: 0,
    }) as const,

  // dungeon — 스테이지
  stageNo: {
    fontFamily: SERIF,
    fontSize: 18,
    color: "#8e8b82",
    width: 18,
    textAlign: "center",
    flexShrink: 0,
  } as const,
  stageEmoji: { fontSize: 24, lineHeight: 1.2, flexShrink: 0 } as const,
  stageName: {
    display: "block",
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#141413",
  } as const,
  bossBadge: {
    display: "inline-block",
    fontFamily: SANS,
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "1px",
    color: "#ffffff",
    background: "#c64545",
    borderRadius: 9999,
    padding: "2px 8px",
    marginLeft: 6,
    verticalAlign: "middle",
  } as const,
  stageExp: {
    display: "block",
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    marginTop: 2,
  } as const,
  stageDone: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#5db872",
    width: 16,
    flexShrink: 0,
  } as const,

  // battle — 먹빛 카드 내부
  battleHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.5px",
    color: "#a09d96", // on-dark-soft
    marginBottom: 16,
  } as const,
  fightersRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  } as const,
  vsMark: {
    fontFamily: SERIF,
    fontSize: 16,
    color: "#a09d96",
    alignSelf: "center",
    flexShrink: 0,
  } as const,
  fighterEmoji: { fontSize: 40, lineHeight: 1.2 } as const,
  fighterName: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#faf9f5",
    marginTop: 4,
  } as const,
  fighterEl: { fontSize: 12, fontWeight: 500 } as const,
  hpTrack: {
    height: 10,
    borderRadius: 9999,
    background: "#33312d",
    overflow: "hidden",
    marginTop: 8,
  } as const,
  hpFill: { height: "100%", borderRadius: 9999 } as const,
  hpText: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#a09d96",
    marginTop: 4,
  } as const,
  buffLine: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#e8a55a", // accent-amber
    margin: "0 0 10px",
  } as const,
  synergyLine: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#5db8a6", // 木 teal — 내 기운을 북돋는 결
    margin: "0 0 10px",
  } as const,
  sinsalLine: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#e8a55a", // 금색 — 깨어난 신살 (sinsal 로그와 같은 톤)
    margin: "0 0 10px",
  } as const,
  logBox: {
    background: "#1f1e1b", // surface-dark-soft
    borderRadius: 8,
    padding: "10px 12px",
    minHeight: LOG_LINES * 21,
    marginBottom: 12,
  } as const,
  logLine: {
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: "21px",
    margin: 0,
  } as const,
  autoNote: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#a09d96",
    textAlign: "center",
    margin: "0 0 4px",
  } as const,
  skillDesc: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#a09d96",
    textAlign: "center",
    margin: "8px 0 0",
  } as const,

  // create — 모드 선택 2카드 + 일간 10택 그리드
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    margin: "4px 0 8px",
  } as const,
  modeEmoji: { fontSize: 26, lineHeight: 1.2 } as const,
  modeName: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#141413",
  } as const,
  modeDesc: {
    fontFamily: SANS,
    fontSize: 11,
    lineHeight: 1.4,
    color: "#8e8b82",
  } as const,
  stemGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    margin: "8px 0 4px",
  } as const,
  stemChar: {
    fontFamily: SERIF,
    fontSize: 30,
    lineHeight: 1.1,
    color: "#141413",
  } as const,
  stemKo: { fontFamily: SANS, fontSize: 11, fontWeight: 500 } as const,
  genderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 6,
  } as const,
  genderNote: {
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    margin: "6px 0 0",
  } as const,

  // home — 사주판·글자 주머니 (모드 B)
  boardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  } as const,
  completeBadge: {
    display: "inline-block",
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.5px",
    color: "#ffffff",
    background: "#141413", // 먹빛 — 완성의 무게감
    borderRadius: 9999,
    padding: "3px 12px",
  } as const,
  slotChar: {
    fontFamily: SERIF,
    fontSize: 26,
    lineHeight: 1.1,
    color: "#141413",
  } as const,
  slotEmptyChar: {
    fontFamily: SERIF,
    fontSize: 22,
    lineHeight: 1.1,
    color: "#c9c4bb",
  } as const,
  slotEl: { fontFamily: SANS, fontSize: 10, fontWeight: 500 } as const,
  slotHint: {
    fontFamily: SANS,
    fontSize: 10,
    fontWeight: 500,
    color: "#cc785c", // 코랄 — 장착 가능 표시
  } as const,
  dayGanCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 62,
    padding: "8px 0 6px",
    borderRadius: 8,
  } as const,
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "8px 0 4px",
  } as const,
  chipChar: {
    fontFamily: SERIF,
    fontSize: 18,
    lineHeight: 1.1,
    color: "#141413",
  } as const,
  chipCount: {
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    color: "#6c6a64",
  } as const,

  // 십성 시너지 카드 (reveal·home 공용)
  synergyRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#faf9f5",
    border: "1px solid #e6dfd8",
    borderRadius: 8,
    padding: "8px 12px",
    marginTop: 6,
  } as const,
  synergyEmoji: { fontSize: 20, lineHeight: 1.2, flexShrink: 0 } as const,
  synergyName: {
    display: "block",
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#141413",
  } as const,
  synergyCount: { fontWeight: 400, color: "#8e8b82", fontSize: 12 } as const,
  synergyDesc: {
    display: "block",
    fontFamily: SANS,
    fontSize: 12,
    color: "#8e8b82",
    marginTop: 2,
  } as const,
  synergyTotal: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: "#cc785c", // 코랄 — 합계 강조
    flexShrink: 0,
  } as const,

  // 신살 카드 (reveal·home 공용)
  sinsalRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#faf9f5",
    border: "1px solid #e6dfd8",
    borderRadius: 8,
    padding: "8px 12px",
    marginTop: 6,
  } as const,
  sinsalBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    color: "#141413",
    background: "#efe9de", // surface-card — 뱃지 필
    borderRadius: 9999,
    padding: "4px 10px",
    flexShrink: 0,
  } as const,
  sinsalDesc: {
    flex: 1,
    fontFamily: SANS,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#8e8b82",
  } as const,

  // result — 획득 글자 칩 (모드 B)
  dropRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    margin: "4px 0 12px",
  } as const,
  dropChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "#faf9f5",
    borderRadius: 9999,
  } as const,
  dropChipChar: {
    fontFamily: SERIF,
    fontSize: 18,
    lineHeight: 1.1,
    color: "#141413",
  } as const,
  dropChipEl: { fontFamily: SANS, fontSize: 12, fontWeight: 500 } as const,

  // result
  dohwaNote: {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    color: "#e8a55a", // 금색 — 신살 톤 통일
    margin: "0 0 12px",
  } as const,
  levelUpBadge: {
    display: "inline-block",
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "1px",
    color: "#ffffff",
    background: "#cc785c",
    borderRadius: 9999,
    padding: "4px 14px",
    marginBottom: 12,
  } as const,
  hintText: {
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#6c6a64",
    background: "#f5f0e8", // surface-soft
    borderRadius: 8,
    padding: "10px 12px",
    margin: "0 0 12px",
  } as const,
};
