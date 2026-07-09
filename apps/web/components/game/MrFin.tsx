// 미스터 핀(Mr. Fin) — 사채 상어 캐릭터. 웜 카지노 카툰 스타일 인라인 SVG.
// mood: deal(계약 권유·능글 윙크) / menace(마지막 제안·가는 눈+그림자) / happy(돈 회수·눈웃음)
// 몸통·지느러미·모자·미소(금니)는 공통, 눈·눈썹·효과만 mood 로 분기.
export function MrFin({ mood, size = 64 }: { mood: "deal" | "menace" | "happy"; size?: number }) {
  const O = "#1a1833"; // 공통 아웃라인 색

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="미스터 핀">
      <defs>
        {/* id 충돌 방지: mrfin- 프리픽스 */}
        <linearGradient id="mrfin-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#79cdba" />
          <stop offset="1" stopColor="#4ea391" />
        </linearGradient>
        <clipPath id="mrfin-clip">
          <ellipse cx="60" cy="70" rx="45" ry="40" />
        </clipPath>
      </defs>

      {/* ── 공통: 몸통(틸) ── */}
      <ellipse cx="60" cy="70" rx="45" ry="40" fill="url(#mrfin-body)" />
      <g clipPath="url(#mrfin-clip)">
        {/* 배(크림) */}
        <ellipse cx="60" cy="98" rx="31" ry="22" fill="#faf3e0" />
        {/* menace: 얼굴 위쪽 그림자 */}
        {mood === "menace" ? <rect x="14" y="30" width="92" height="24" fill={O} opacity="0.2" /> : null}
        {/* 좌상단 글로시 하이라이트 */}
        <ellipse cx="41" cy="43" rx="14" ry="8" fill="#ffffff" opacity="0.4" transform="rotate(-14 41 43)" />
      </g>
      {/* 몸통 아웃라인(배 위에 다시 그림) */}
      <ellipse cx="60" cy="70" rx="45" ry="40" fill="none" stroke={O} strokeWidth="4" />

      {/* 아가미 */}
      <path d="M20 60 q4 4 0 9 M26 57 q4 5 0 10" fill="none" stroke={O} strokeWidth="2.5" opacity="0.35" strokeLinecap="round" />
      {/* 콧구멍 */}
      <circle cx="56.5" cy="70" r="1.5" fill={O} opacity="0.55" />
      <circle cx="63.5" cy="70" r="1.5" fill={O} opacity="0.55" />

      {/* ── 공통: 정장 소매 지느러미(네이비) + 셔츠 커프스 + 금 커프스단추 ── */}
      <g stroke={O} strokeWidth="3.5" strokeLinejoin="round">
        <path d="M33 66 Q8 72 7 92 Q22 90 35 79 Z" fill="#232043" />
        <path d="M87 66 Q112 72 113 92 Q98 90 85 79 Z" fill="#232043" />
      </g>
      <path d="M30 70 Q26 76 27 83" fill="none" stroke="#faf3e0" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M90 70 Q94 76 93 83" fill="none" stroke="#faf3e0" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="28" cy="76.5" r="2" fill="#f5c542" stroke={O} strokeWidth="1.5" />
      <circle cx="92" cy="76.5" r="2" fill="#f5c542" stroke={O} strokeWidth="1.5" />

      {/* ── 공통: 좁은 세로 중절모(네이비+골드 밴드) ── */}
      <path d="M47 30 L47 12 Q47 6 53 6 L67 6 Q73 6 73 12 L73 30 Z" fill="#232043" stroke={O} strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="47" y="21" width="26" height="6.5" fill="#f5c542" stroke={O} strokeWidth="2" />
      <ellipse cx="60" cy="31" rx="26" ry="6" fill="#232043" stroke={O} strokeWidth="3.5" />
      <ellipse cx="55" cy="11" rx="7" ry="2.6" fill="#ffffff" opacity="0.18" transform="rotate(-10 55 11)" />

      {/* ── 공통: 능글 미소 + 이빨(3번째가 금니) ── */}
      <path d="M28 79 Q58 94 92 75" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
      <g stroke={O} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M37 83 l11 1.5 l-5 9 Z" fill="#ffffff" />
        <path d="M51 85.5 l11 0.5 l-5.5 9 Z" fill="#ffffff" />
        <path d="M65 85 l11 -1 l-4.5 9.5 Z" fill="#f5c542" />
        <path d="M78 81.5 l10 -2.5 l-3.5 9 Z" fill="#ffffff" />
      </g>
      {/* 금니 반짝(4각 별) */}
      <path d="M74.5 82 l1.4 2.8 2.8 1.4 -2.8 1.4 -1.4 2.8 -1.4 -2.8 -2.8 -1.4 2.8 -1.4 Z" fill="#ffffff" opacity="0.95" />

      {/* ── mood: deal — 왼눈 크게 + 오른눈 윙크 + 능글 눈썹 ── */}
      {mood === "deal" ? (
        <g>
          <circle cx="42" cy="57" r="8.5" fill="#ffffff" stroke={O} strokeWidth="3" />
          <circle cx="44" cy="58" r="3.5" fill={O} />
          <circle cx="42.5" cy="55.5" r="1.2" fill="#ffffff" />
          <path d="M70 57 Q78 62 86 56" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
          <path d="M33 44 Q42 39 51 44" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
          <path d="M69 48 Q78 45 87 49" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
        </g>
      ) : null}

      {/* ── mood: menace — 가늘어진 눈 + 안쪽으로 꺾인 눈썹 ── */}
      {mood === "menace" ? (
        <g>
          <ellipse cx="42" cy="58" rx="8.5" ry="4" fill="#ffffff" stroke={O} strokeWidth="3" />
          <ellipse cx="78" cy="58" rx="8.5" ry="4" fill="#ffffff" stroke={O} strokeWidth="3" />
          <circle cx="44" cy="58" r="2.6" fill={O} />
          <circle cx="76" cy="58" r="2.6" fill={O} />
          <path d="M32 47 L53 53" stroke={O} strokeWidth="4" strokeLinecap="round" />
          <path d="M88 47 L67 53" stroke={O} strokeWidth="4" strokeLinecap="round" />
        </g>
      ) : null}

      {/* ── mood: happy — 눈웃음 + 홍조 ── */}
      {mood === "happy" ? (
        <g>
          <path d="M34 58 Q42 50 50 58" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
          <path d="M70 58 Q78 50 86 58" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
          <circle cx="27" cy="67" r="4.5" fill="#e8a55a" opacity="0.55" />
          <circle cx="93" cy="67" r="4.5" fill="#e8a55a" opacity="0.55" />
        </g>
      ) : null}
    </svg>
  );
}
