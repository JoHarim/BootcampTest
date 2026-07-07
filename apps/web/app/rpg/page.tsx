"use client";

// 사주 RPG — 단일 페이지 + 뷰 상태머신 (loading→create→reveal→home→dungeon→battle→result).
// 플래너 app/page.tsx 패턴 승계: 인라인 styles 객체 + <style> 블록, localStorage는 마운트 후 try/catch.
import { useEffect, useRef, useState } from "react";
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  Character,
  DailyFortune,
  Dungeon,
  Element,
  Pillar,
  SaveData,
} from "../../lib/rpg/types";
import { DUNGEONS, MAX_LEVEL, expForLevel } from "../../lib/rpg/content";
import {
  createCharacter,
  elementColor,
  elementKo,
  elementMultiplier,
  getDailyFortune,
} from "../../lib/rpg/saju-engine";
import { initBattle, stepBattle } from "../../lib/rpg/battle";

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

// 오행 표시 순서(상생 순) + 오행 → 담당 스탯 한글
const ELEMENT_ORDER: Element[] = ["木", "火", "土", "金", "水"];
const ELEMENT_STAT_KO: Record<Element, string> = {
  木: "체력", 火: "공격", 土: "운", 金: "방어", 水: "지능",
};

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
  expGained: number;
  levelsGained: number;
  levelAfter: number;
}

export default function RpgPage() {
  // 최초에는 loading — 마운트 후 localStorage를 읽어 create/home을 정한다(하이드레이션 불일치 방지).
  const [view, setView] = useState<View>("loading");
  const [character, setCharacter] = useState<Character | null>(null);
  const [save, setSave] = useState<SaveData | null>(null);
  const [fortune, setFortune] = useState<DailyFortune | null>(null);
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

    // RPG 진행 저장
    let loaded: SaveData | null = null;
    try {
      const raw = window.localStorage.getItem(RPG_KEY);
      if (raw !== null) {
        const p = JSON.parse(raw) as Partial<SaveData>;
        if (
          typeof p.birthDate === "string" && p.birthDate !== "" &&
          typeof p.birthTime === "string" &&
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
          loaded = {
            birthDate: p.birthDate,
            birthTime: p.birthTime,
            level: p.level,
            exp: p.exp,
            clearedStages: cleared,
          };
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
      // 저장된 생일로 캐릭터 재구성 — 생일이 바뀌었다면 create에서 새 SaveData로 재생성된다
      const c = createCharacter(loaded.birthDate, loaded.birthTime);
      setCharacter(c);
      setSave(loaded);
      setFortune(getDailyFortune(c, new Date()));
      setView("home");
    } catch {
      setView("create"); // 저장은 있지만 계산 실패 → 재입력
    }
  }, []);

  // create 제출 → 캐릭터 생성 + 저장. 실패 시 에러 문구 반환(성공은 "").
  function handleCreate(birthDate: string, birthTime: string): string {
    let c: Character;
    try {
      c = createCharacter(birthDate, birthTime);
    } catch {
      return "사주를 계산하지 못했어요. 생년월일을 확인해주세요";
    }
    // 생일이 저장값과 같으면 진행도 유지, 다르면 새 캐릭터로 재생성
    const next: SaveData =
      save !== null && save.birthDate === birthDate && save.birthTime === birthTime
        ? save
        : { birthDate, birthTime, level: 1, exp: 0, clearedStages: {} };
    try {
      window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
    } catch {
      return "저장에 실패했어요. 다시 눌러주세요";
    }
    setCharacter(c);
    setSave(next);
    setFortune(getDailyFortune(c, new Date()));
    setResult(null);
    setView("reveal");
    return "";
  }

  // 전투 시작 — 시드는 현재 시각 기반(결정적 LCG의 초기값일 뿐, Math.random 아님)
  function startBattle(d: Dungeon, idx: number) {
    if (character === null || save === null) return;
    if (idx < 0 || idx >= d.stages.length) return;
    const m = d.stages[idx];
    const seed = Date.now() % SEED_MOD;
    const st = initBattle(character, save.level, m, fortune, seed);
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

  // 전투 종료 처리 — 승리면 경험치·레벨업·클리어 기록 반영 후 저장, 잠시 뒤 result로
  function finishBattle(finalState: BattleState) {
    let info: ResultInfo = {
      won: finalState.won,
      expGained: 0,
      levelsGained: 0,
      levelAfter: save !== null ? save.level : 1,
    };
    if (finalState.won && save !== null && dungeon !== null) {
      const m = dungeon.stages[stageIdx];
      let level = save.level;
      let exp = save.exp + m.exp;
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
      const next: SaveData = { ...save, level, exp, clearedStages: cleared };
      try {
        window.localStorage.setItem(RPG_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 이번 세션 진행은 유지
      }
      setSave(next);
      info = { won: true, expGained: m.exp, levelsGained: ups, levelAfter: level };
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
          <CreateView planner={plannerProfile} onSubmit={handleCreate} />
        ) : null}

        {view === "reveal" && character !== null ? (
          <RevealView c={character} onStart={() => setView("home")} />
        ) : null}

        {view === "home" && character !== null && save !== null ? (
          <HomeView
            c={character}
            save={save}
            fortune={fortune}
            onDungeon={(d) => {
              setDungeon(d);
              setView("dungeon");
            }}
            onReveal={() => setView("reveal")}
            onRecreate={() => setView("create")}
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

// ── create: 생년월일 입력 ─────────────────────────────────
function CreateView({
  planner,
  onSubmit,
}: {
  planner: PlannerProfile | null;
  onSubmit: (birthDate: string, birthTime: string) => string;
}) {
  const [birthDate, setBirthDate] = useState<string>("");
  const [birthTime, setBirthTime] = useState<string>("");
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

    const failMsg = onSubmit(birthDate, birthTime);
    if (failMsg !== "") {
      setError(failMsg);
    }
  }

  return (
    <div style={styles.card}>
      <p style={styles.caption}>SAJU RPG</p>
      <h1 style={styles.title}>내 사주로 캐릭터 만들기</h1>
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
    </div>
  );
}

// ── reveal: 사주 8자 + 오행 바 + 직업 + 전투력 ────────────
function RevealView({ c, onStart }: { c: Character; onStart: () => void }) {
  const cols: { label: string; pillar: Pillar | null }[] = [
    { label: "연주", pillar: c.pillars.year },
    { label: "월주", pillar: c.pillars.month },
    { label: "일주", pillar: c.pillars.day },
    { label: "시주", pillar: c.pillars.time },
  ];
  const maxScore = Math.max(...ELEMENT_ORDER.map((e) => c.elements[e]), 1);

  return (
    <div style={styles.card}>
      <p style={styles.caption}>캐릭터 각성</p>
      <h1 style={styles.title}>당신의 사주 여덟 글자</h1>

      {/* 4주 8자 카드 — 글자별 오행색 테두리 */}
      <div style={styles.pillarGrid}>
        {cols.map((col) => (
          <div key={col.label} style={styles.pillarCol}>
            <span style={styles.pillarLabel}>{col.label}</span>
            {col.pillar !== null ? (
              <>
                <Glyph ch={col.pillar.gan} el={GAN_ELEMENT[col.pillar.gan] ?? c.dayElement} />
                <Glyph ch={col.pillar.zhi} el={ZHI_ELEMENT[col.pillar.zhi] ?? c.dayElement} />
              </>
            ) : (
              <>
                <div style={styles.glyphEmpty}>?</div>
                <div style={styles.glyphEmpty}>?</div>
              </>
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

// ── home: 허브 (요약·오늘의 기운·던전 입장·면책) ──────────
function HomeView({
  c,
  save,
  fortune,
  onDungeon,
  onReveal,
  onRecreate,
}: {
  c: Character;
  save: SaveData;
  fortune: DailyFortune | null;
  onDungeon: (d: Dungeon) => void;
  onReveal: () => void;
  onRecreate: () => void;
}) {
  const maxed = save.level >= MAX_LEVEL;
  const need = expForLevel(save.level);
  const expPct = maxed ? 100 : Math.min((save.exp / need) * 100, 100);

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

      {/* 오늘의 기운 */}
      {fortune !== null ? (
        <div style={{ ...styles.card, borderLeft: `4px solid ${elementColor(fortune.element)}` }}>
          <p style={styles.caption}>오늘의 기운</p>
          <p style={styles.fortuneTitle}>
            {fortune.ganzhiKo}({fortune.ganzhiHanja})일
          </p>
          <p style={styles.bodyText}>{fortune.desc}</p>
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
      {/* 생일을 잘못 넣었을 때의 유일한 복구 경로 — 같은 생일로 다시 저장하면 진행도는 유지된다 */}
      <button type="button" onClick={onRecreate} className="rpg-btn secondary">
        생일 다시 입력 (다르게 넣으면 캐릭터 재생성)
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

      {/* 오늘의 기운 버프 */}
      {b.fortune !== null ? <p style={styles.buffLine}>☀ {b.fortune.desc}</p> : null}

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
        {r.levelsGained > 0 ? (
          <span style={styles.levelUpBadge}>
            LEVEL UP! Lv.{r.levelAfter} (+{r.levelsGained})
          </span>
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
  fortuneTitle: {
    fontFamily: SERIF,
    fontSize: 22,
    letterSpacing: "-0.3px",
    color: "#141413",
    margin: "0 0 6px",
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

  // result
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
