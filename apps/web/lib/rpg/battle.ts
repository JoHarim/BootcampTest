// 전투 엔진 — 순수 함수만(인자 불변). 난수는 시드 LCG로 결정적(재현 가능), Math.random 금지.
// 계약: types.ts / 수치·공식: docs/plan/rpg-design.md 4장
import type {
  BattleCommand,
  BattleEvent,
  BattleState,
  Character,
  Combatant,
  DailyFortune,
  Monster,
  StatKey,
  Stats,
} from "./types";
import { elementMultiplier, statsAtLevel } from "./saju-engine";

// ── 밸런스 상수 (설계서 4장) ──────────────────────────
const BASE_MAX_HP = 40; // maxHp = 40 + hp×3 (시뮬 튜닝 2026-07-07: 60+×4는 무패 게임이라 하향)
const HP_SCALE = 3;
const DEF_REDUCE = 0.35; // 피해에서 상대 def×0.35 감산 (0.5는 초중반 몬스터 공격을 전부 뭉갬)
const MIN_DAMAGE = 1; // 최소 데미지
const VARIANCE_MIN = 0.9; // 기본공격 변동 하한
const VARIANCE_RANGE = 0.2; // 변동 폭 (0.9~1.1)
const CRIT_BASE_PCT = 5; // 치명타 확률 = min(5 + luk×0.25, 35)%
const CRIT_PER_LUK = 0.25; // 토(土) 점수가 구조적으로 높아 0.4면 전원 상한 도달
const CRIT_MAX_PCT = 35;
const CRIT_MULT = 1.6; // 치명타 배율
const LCG_A = 1103515245; // seed = (seed×A + C) mod 2^31
const LCG_C = 12345;
const LCG_M = 2147483648; // 2^31

// ── 결정적 난수 (LCG) ─────────────────────────────────
// seed×A 는 2^53 을 넘어 배정밀도 곱으로는 정확한 mod 가 안 나온다.
// (seed×A) mod 2^31 = ((seed×A) mod 2^32) mod 2^31 이므로 Math.imul(32비트 정확 곱)의
// 하위 31비트를 취하면 수학적으로 정확한 값이 된다.
function nextSeed(seed: number): number {
  return (((Math.imul(seed, LCG_A) >>> 0) & 0x7fffffff) + LCG_C) % LCG_M;
}

// 시드를 한 번 전진시키고 0~1 난수를 얻는다 (rand01 = 새 seed / 2^31).
function roll(seed: number): { seed: number; value: number } {
  const next = nextSeed(seed);
  return { seed: next, value: next / LCG_M };
}

// 스탯 1종에 +pct% 곱연산(반올림). 원본 불변.
function applyPct(stats: Stats, key: StatKey, pct: number): Stats {
  const next: Stats = { ...stats };
  next[key] = Math.round(next[key] * (1 + pct / 100));
  return next;
}

// 상성 배율이 1.0이 아니면 로그 꼬리표 (예: " (상성 유리 ×1.5)")
function elemSuffix(mult: number): string {
  if (mult === 1.5) {
    return ` (상성 유리 ×${mult})`;
  }
  if (mult === 0.7) {
    return ` (상성 불리 ×${mult})`;
  }
  return "";
}

// 전투 시작 상태 구성. 레벨 성장 → 직업 패시브 → 오늘의 기운 순서로 곱연산 적용.
export function initBattle(
  c: Character,
  level: number,
  m: Monster,
  f: DailyFortune | null,
  seed: number,
): BattleState {
  let stats = statsAtLevel(c.stats, level);
  stats = applyPct(stats, c.job.passiveStat, c.job.passivePct);
  if (f !== null) {
    stats = applyPct(stats, f.statKey, f.bonusPct);
  }
  const maxHp = BASE_MAX_HP + stats.hp * HP_SCALE;

  const player: Combatant = {
    name: c.job.name, // 캐릭터 별도 이름이 없어 직업명으로 표시
    emoji: c.job.emoji,
    element: c.dayElement,
    maxHp,
    hp: maxHp,
    atk: stats.atk,
    def: stats.def,
    int: stats.int,
    luk: stats.luk,
  };

  const foe: Combatant = {
    name: m.name,
    emoji: m.emoji,
    element: m.element,
    maxHp: m.hp,
    hp: m.hp,
    atk: m.atk,
    def: m.def,
    int: 0, // 몬스터는 스킬·치명타 없음
    luk: 0,
  };

  return {
    turn: 1,
    player,
    foe,
    job: c.job,
    skillCooldown: 0,
    fortune: f,
    seed,
    over: false,
    won: false,
  };
}

// 한 스텝 = 플레이어 행동(attack|skill) → 몬스터 생존 시 반격 1회.
export function stepBattle(
  s: BattleState,
  cmd: BattleCommand,
): { state: BattleState; events: BattleEvent[] } {
  // 이미 끝난 전투는 그대로 반환
  if (s.over) {
    return { state: s, events: [] };
  }

  const events: BattleEvent[] = [];
  let seed = s.seed;
  let cooldown = s.skillCooldown;
  let playerHp = s.player.hp;
  let foeHp = s.foe.hp;

  // ── 플레이어 행동 (쿨다운 중 skill 명령은 attack 으로 처리) ──
  const useSkill = cmd === "skill" && cooldown === 0;

  if (useSkill) {
    const skill = s.job.skill;
    if (skill.kind === "damage") {
      // 스킬 데미지 = int × power × 상성배율 (변동·치명타·방어 감산 없음)
      const mult = elementMultiplier(s.player.element, s.foe.element);
      const dmg = Math.max(
        MIN_DAMAGE,
        Math.round(s.player.int * skill.power * mult),
      );
      foeHp = Math.max(0, foeHp - dmg);
      events.push({
        kind: "skill",
        text: `${skill.emoji} ${skill.name}! ${s.foe.name}에게 ${dmg} 피해!${elemSuffix(mult)}`,
        amount: dmg,
      });
    } else {
      // 회복 = maxHp × power (최대 maxHp 클램프)
      const healed = Math.min(
        Math.round(s.player.maxHp * skill.power),
        s.player.maxHp - playerHp,
      );
      playerHp += healed;
      events.push({
        kind: "heal",
        text: `${skill.emoji} ${skill.name}! HP ${healed} 회복!`,
        amount: healed,
      });
    }
    cooldown = skill.cooldown; // 사용 직후 쿨다운 재설정
  } else {
    // 기본공격 = atk × 상성 × 변동(0.9~1.1) − 상대 def×0.5, 최소 1
    // 시드 소비 순서 고정: 변동 롤 → 치명 롤 (재현성)
    const mult = elementMultiplier(s.player.element, s.foe.element);
    const varRoll = roll(seed);
    seed = varRoll.seed;
    const critRoll = roll(seed);
    seed = critRoll.seed;
    const critPct = Math.min(
      CRIT_BASE_PCT + s.player.luk * CRIT_PER_LUK,
      CRIT_MAX_PCT,
    );
    const isCrit = critRoll.value * 100 < critPct;
    let raw = s.player.atk * mult * (VARIANCE_MIN + varRoll.value * VARIANCE_RANGE);
    if (isCrit) {
      raw *= CRIT_MULT; // 치명타는 공격항에 ×1.6 (방어 감산 전)
    }
    const dmg = Math.max(MIN_DAMAGE, Math.round(raw - s.foe.def * DEF_REDUCE));
    foeHp = Math.max(0, foeHp - dmg);
    events.push({
      kind: isCrit ? "crit" : "player-hit",
      text: isCrit
        ? `💥 치명타! ${s.foe.name}에게 ${dmg} 피해!${elemSuffix(mult)}`
        : `⚔️ ${s.foe.name}에게 ${dmg} 피해!${elemSuffix(mult)}`,
      amount: dmg,
    });
  }

  let over = false;
  let won = false;

  if (foeHp === 0) {
    // 승리 — 반격 없음
    over = true;
    won = true;
    events.push({ kind: "win", text: `🎉 ${s.foe.name} 격파! 승리!` });
  } else {
    // ── 몬스터 반격 (같은 수식, 상성 포함, 치명타 없음) ──
    const mult = elementMultiplier(s.foe.element, s.player.element);
    const varRoll = roll(seed);
    seed = varRoll.seed;
    const dmg = Math.max(
      MIN_DAMAGE,
      Math.round(
        s.foe.atk * mult * (VARIANCE_MIN + varRoll.value * VARIANCE_RANGE) -
          s.player.def * DEF_REDUCE,
      ),
    );
    playerHp = Math.max(0, playerHp - dmg);
    events.push({
      kind: "foe-hit",
      text: `${s.foe.emoji} ${s.foe.name}의 반격! ${dmg} 피해${elemSuffix(mult)}`,
      amount: dmg,
    });
    if (playerHp === 0) {
      over = true;
      won = false;
      events.push({ kind: "lose", text: "💀 쓰러졌다… 패배" });
    }
  }

  // 스텝 끝: 쿨다운 1 감소 (0 미만 금지)
  cooldown = Math.max(0, cooldown - 1);

  const state: BattleState = {
    ...s,
    turn: s.turn + 1,
    player: { ...s.player, hp: playerHp },
    foe: { ...s.foe, hp: foeHp },
    skillCooldown: cooldown,
    seed,
    over,
    won,
  };
  return { state, events };
}
