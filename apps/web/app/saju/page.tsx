"use client";

// 사주 플래너(실습) — 단일 페이지. view 상태(input|fortune) + localStorage(sajuweb:profile).
// SSR 안전: localStorage는 useEffect(마운트 후)에서만 읽는다. 마운트 확정 전에는 중립 로딩 뷰.
import { useEffect, useState } from "react";
import { calculateFortune, type Fortune } from "../../lib/saju";

const STORAGE_KEY = "sajuweb:profile";

interface Profile {
  birthDate: string; // 'YYYY-MM-DD'
  birthTime: string; // 'HH:MM' | ''
}

type View = "loading" | "input" | "fortune";

export default function Home() {
  // 최초에는 loading — 마운트 후 localStorage를 읽어 input/fortune을 정한다(하이드레이션 불일치 방지).
  const [view, setView] = useState<View>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let stored: Profile | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as Partial<Profile>;
        if (
          typeof parsed.birthDate === "string" &&
          parsed.birthDate !== "" &&
          typeof parsed.birthTime === "string"
        ) {
          stored = { birthDate: parsed.birthDate, birthTime: parsed.birthTime };
        }
      }
    } catch {
      stored = null; // 읽기/파싱 실패 시 저장 안 된 것으로 간주 → S1
    }
    if (stored === null) {
      setView("input");
    } else {
      setProfile(stored);
      setView("fortune");
    }
  }, []);

  // 저장 성공 → 프로필 반영 후 S2로
  function handleSaved(saved: Profile) {
    setProfile(saved);
    setView("fortune");
  }

  // 정보 수정 → S1로
  function goEdit() {
    setView("input");
  }

  return (
    <main style={styles.main}>
      {/* DESIGN.md(Anthropic Claude) — 코랄 버튼 press 다크닝 + 인풋 포커스 코랄 링 */}
      <style>{designCss}</style>
      <div style={styles.card}>
        {view === "loading" ? <LoadingView /> : null}
        {view === "input" ? (
          <BirthInput initial={profile} onSaved={handleSaved} />
        ) : null}
        {view === "fortune" && profile !== null ? (
          <FortuneView profile={profile} onEdit={goEdit} />
        ) : null}
      </div>
    </main>
  );
}

// DESIGN.md 폰트 스택 (라이선스 폰트 대체: 세리프=Georgia, 산세=Inter 계열)
const SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// 버튼·인풋의 상태(press/focus)는 인라인 스타일로 안 되므로 클래스 CSS로.
const designCss = `
  .saju-btn {
    width: 100%; padding: 12px 20px; min-height: 40px; margin-top: 8px;
    font-family: ${SANS}; font-size: 14px; font-weight: 500; line-height: 1;
    color: #fff; background: #cc785c; border: none; border-radius: 8px; cursor: pointer;
  }
  .saju-btn:active { background: #a9583e; }
  .saju-btn.secondary { color: #141413; background: #ffffff; border: 1px solid #e6dfd8; }
  .saju-btn.secondary:active { background: #f5f0e8; }
  .saju-input {
    display: block; width: 100%; box-sizing: border-box; margin-top: 6px;
    padding: 10px 14px; font-family: ${SANS}; font-size: 16px;
    color: #141413; background: #faf9f5; border: 1px solid #e6dfd8; border-radius: 8px;
  }
  .saju-input:focus { outline: none; border-color: #cc785c; box-shadow: 0 0 0 3px rgba(204,120,92,0.15); }
  a.saju-btn { display: block; box-sizing: border-box; text-align: center; text-decoration: none; line-height: 1; }
`;

// 중립 로딩 뷰 (마운트 확정 전)
function LoadingView() {
  return <p style={styles.muted}>불러오는 중…</p>;
}

// S1. 생년월일 입력
function BirthInput({
  initial,
  onSaved,
}: {
  initial: Profile | null;
  onSaved: (p: Profile) => void;
}) {
  const [birthDate, setBirthDate] = useState<string>(initial?.birthDate ?? "");
  const [birthTime, setBirthTime] = useState<string>(initial?.birthTime ?? "");
  const [error, setError] = useState<string>("");

  function handleSave() {
    setError("");

    // 잘못된 입력: 생년월일 비면 안내
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

    // 저장 (실패 시 안내)
    const toSave: Profile = { birthDate, birthTime };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      setError("저장에 실패했어요. 다시 눌러주세요");
      return;
    }
    onSaved(toSave);
  }

  return (
    <div>
      <h1 style={styles.title}>내 사주 정보</h1>

      <label style={styles.label}>
        생년월일 (필수)
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="saju-input"
        />
      </label>

      <label style={styles.label}>
        태어난 시각 (선택 · 모르면 비워두세요)
        <input
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
          className="saju-input"
        />
      </label>

      {error !== "" ? <p style={styles.error}>{error}</p> : null}

      <button type="button" onClick={handleSave} className="saju-btn">
        저장
      </button>
    </div>
  );
}

// S2. 오늘의 운세
function FortuneView({
  profile,
  onEdit,
}: {
  profile: Profile;
  onEdit: () => void;
}) {
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const result = calculateFortune(
        profile.birthDate,
        profile.birthTime,
        new Date(),
      );
      setFortune(result);
      setFailed(false);
    } catch {
      // 계산 실패: 앱이 죽지 않고 안내 + 정보 수정 버튼
      setFailed(true);
      setFortune(null);
    }
  }, [profile.birthDate, profile.birthTime]);

  const todayText = formatToday(new Date());

  // 계산 실패
  if (failed) {
    return (
      <div>
        <p style={styles.error}>운세를 불러오지 못했어요. 다시 시도</p>
        <button type="button" onClick={onEdit} className="saju-btn secondary">
          정보 수정
        </button>
      </div>
    );
  }

  // 계산 중 (즉시라 거의 없음)
  if (fortune === null) {
    return <p style={styles.muted}>운세 계산 중…</p>;
  }

  return (
    <div>
      <p style={styles.dateCaption}>{todayText}</p>
      <h1 style={styles.hero}>{fortune.todayLabel}</h1>
      <span style={styles.gradeBadge(fortune.grade)}>운세 · {fortune.grade}</span>
      <p style={styles.comment}>{fortune.comment}</p>
      <a href="/rpg" className="saju-btn">
        🗡️ 내 사주로 모험 떠나기
      </a>
      <p style={styles.disclaimer}>운세는 재미로 참고해주세요</p>
      <button type="button" onClick={onEdit} className="saju-btn secondary">
        정보 수정
      </button>
    </div>
  );
}

// 오늘 날짜를 'YYYY년 M월 D일' 로
function formatToday(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// DESIGN.md 등급 팔레트 (좋음=success, 보통=muted, 주의=warning — 따뜻한 톤)
const gradePalette: Record<Fortune["grade"], { bg: string; fg: string }> = {
  좋음: { bg: "#e7f4ea", fg: "#3f8f52" },
  보통: { bg: "#efe9de", fg: "#6c6a64" },
  주의: { bg: "#f7efd9", fg: "#a07d10" },
};

const styles = {
  main: {
    fontFamily: SANS,
    minHeight: "100vh",
    background: "#faf9f5", // canvas 크림
    // column으로 두고 alignItems로 가로 중앙 정렬 — 카드 아래 게임 입구 링크가 온다 (배치는 기존과 동일)
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 24,
  } as const,
  card: {
    background: "#ffffff",
    border: "1px solid #e6dfd8", // hairline
    borderRadius: 12, // rounded.lg
    maxWidth: 440,
    width: "100%",
    padding: 32, // spacing.xl — 여백 넉넉히
    marginTop: 64,
  } as const,
  // 세리프 디스플레이 (S1 제목)
  title: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: 400,
    letterSpacing: "-0.3px",
    color: "#141413", // ink
    margin: "0 0 20px",
  } as const,
  // 세리프 히어로 (오늘의 운세 라벨)
  hero: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: 400,
    letterSpacing: "-0.5px",
    lineHeight: 1.15,
    color: "#141413",
    margin: "4px 0 16px",
  } as const,
  label: {
    display: "block",
    fontFamily: SANS,
    fontSize: 14,
    color: "#6c6a64", // muted
    marginBottom: 16,
  } as const,
  // caption-uppercase (오늘 날짜)
  dateCaption: {
    fontFamily: SANS,
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "#8e8b82", // muted-soft
    margin: "0 0 4px",
  } as const,
  error: {
    fontFamily: SANS,
    color: "#c64545", // error
    fontSize: 14,
    margin: "0 0 12px",
  } as const,
  muted: {
    fontFamily: SANS,
    color: "#8e8b82",
    fontSize: 14,
    margin: "0 0 8px",
  } as const,
  comment: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 1.55,
    color: "#3d3d3a", // body
    margin: "16px 0",
  } as const,
  disclaimer: {
    fontFamily: SANS,
    color: "#8e8b82",
    fontSize: 12,
    margin: "16px 0 0",
  } as const,
  // 등급 pill 배지
  gradeBadge: (g: Fortune["grade"]) =>
    ({
      display: "inline-block",
      fontFamily: SANS,
      fontSize: 13,
      fontWeight: 500,
      padding: "4px 12px",
      borderRadius: 9999, // pill
      background: gradePalette[g].bg,
      color: gradePalette[g].fg,
      marginBottom: 4,
    }) as const,
};
