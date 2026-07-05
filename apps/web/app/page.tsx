"use client";

// 사주 플래너(실습) — 단일 페이지. view 상태(input|fortune) + localStorage(sajuweb:profile).
// SSR 안전: localStorage는 useEffect(마운트 후)에서만 읽는다. 마운트 확정 전에는 중립 로딩 뷰.
import { useEffect, useState } from "react";
import { calculateFortune, type Fortune } from "../lib/saju";

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
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        태어난 시각 (선택 · 모르면 비워두세요)
        <input
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
          style={styles.input}
        />
      </label>

      {error !== "" ? <p style={styles.error}>{error}</p> : null}

      <button type="button" onClick={handleSave} style={styles.button}>
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
        <button type="button" onClick={onEdit} style={styles.button}>
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
      <p style={styles.muted}>{todayText}</p>
      <h1 style={styles.title}>{fortune.todayLabel}</h1>
      <p style={styles.grade(fortune.grade)}>운세 등급: {fortune.grade}</p>
      <p style={styles.comment}>{fortune.comment}</p>
      <p style={styles.disclaimer}>운세는 재미로 참고해주세요</p>
      <button type="button" onClick={onEdit} style={styles.button}>
        정보 수정
      </button>
    </div>
  );
}

// 오늘 날짜를 'YYYY년 M월 D일' 로
function formatToday(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const gradeColor: Record<Fortune["grade"], string> = {
  좋음: "#15803d",
  보통: "#525252",
  주의: "#b45309",
};

const styles = {
  main: {
    fontFamily: "system-ui",
    minHeight: "100vh",
    background: "#f5f5f4",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: 24,
  } as const,
  card: {
    background: "#fff",
    border: "1px solid #e5e5e3",
    borderRadius: 12,
    maxWidth: 420,
    width: "100%",
    padding: 24,
    marginTop: 48,
  } as const,
  title: { fontSize: 22, margin: "0 0 16px" } as const,
  label: {
    display: "block",
    fontSize: 14,
    color: "#525252",
    marginBottom: 16,
  } as const,
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginTop: 6,
    padding: "10px 12px",
    fontSize: 16,
    border: "1px solid #d4d4d2",
    borderRadius: 8,
  } as const,
  button: {
    width: "100%",
    padding: "12px",
    fontSize: 16,
    background: "#171717",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 8,
  } as const,
  error: { color: "#dc2626", fontSize: 14, margin: "0 0 12px" } as const,
  muted: { color: "#737373", fontSize: 14, margin: "0 0 8px" } as const,
  comment: { fontSize: 16, margin: "12px 0" } as const,
  disclaimer: { color: "#a3a3a3", fontSize: 12, margin: "16px 0" } as const,
  grade: (g: Fortune["grade"]) =>
    ({
      fontSize: 16,
      fontWeight: 600,
      color: gradeColor[g],
      margin: "8px 0",
    }) as const,
};
