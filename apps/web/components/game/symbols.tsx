// 슬롯 심볼 5종 커스텀 SVG — 웜 카지노 카툰 세트
// 공통 규칙: viewBox 0 0 64 64, 아웃라인 #1a1833 굵기 3.5, 좌상단 글로시 하이라이트.
// 크림 릴 창과 다크 모달 양쪽에서 읽히도록 큰 덩어리 + 굵은 선으로만 구성 (14px에서도 실루엣 유지).
// 그라데이션 id는 심볼별 고유 prefix(sym-*) — 같은 심볼이 여러 번 렌더돼도 defs 내용이 동일해 무해하다.
import type { ReactElement } from "react";
import type { SlotSymbol } from "../../lib/game/rules";

const OUT = "#1a1833"; // 공통 아웃라인 색
const SW = 3.5; // 공통 아웃라인 굵기

// 반짝이(4갈래) — 세븐 전용 장식. 골드 채움 + 얇은 아웃라인이라 밝은/어두운 배경 모두에서 보인다.
function spark(x: number, y: number, r: number): ReactElement {
  const q = r * 0.22;
  return (
    <path
      d={`M${x} ${y - r} Q${x + q} ${y - q} ${x + r} ${y} Q${x + q} ${y + q} ${x} ${y + r} Q${x - q} ${y + q} ${x - r} ${y} Q${x - q} ${y - q} ${x} ${y - r} Z`}
      fill="#ffe08a"
      stroke={OUT}
      strokeWidth={1.5}
    />
  );
}

// 심볼별 본체 (defs 포함)
const BODY: Record<SlotSymbol, ReactElement> = {
  // 🍒 체리 — 통통한 두 알 + 틸 잎
  cherry: (
    <>
      <defs>
        <radialGradient id="sym-cherry-g" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff8a7a" />
          <stop offset="55%" stopColor="#d64541" />
          <stop offset="100%" stopColor="#a83430" />
        </radialGradient>
      </defs>
      {/* 꼭지 두 갈래 — 아웃라인 위에 초록 심을 겹쳐 그린다 */}
      <path d="M33 7 C26 14 22 26 21 35" fill="none" stroke={OUT} strokeWidth={6} strokeLinecap="round" />
      <path d="M33 7 C38 13 43 21 44 30" fill="none" stroke={OUT} strokeWidth={6} strokeLinecap="round" />
      <path d="M33 7 C26 14 22 26 21 35" fill="none" stroke="#5db8a6" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M33 7 C38 13 43 21 44 30" fill="none" stroke="#5db8a6" strokeWidth={2.5} strokeLinecap="round" />
      {/* 잎 */}
      <ellipse cx="42" cy="10" rx="8" ry="4.5" transform="rotate(-18 42 10)" fill="#5db8a6" stroke={OUT} strokeWidth={3} />
      {/* 체리 두 알 */}
      <circle cx="21" cy="45" r="12.5" fill="url(#sym-cherry-g)" stroke={OUT} strokeWidth={SW} />
      <circle cx="44" cy="41" r="11.5" fill="url(#sym-cherry-g)" stroke={OUT} strokeWidth={SW} />
      {/* 글로시 하이라이트 */}
      <ellipse cx="17" cy="40" rx="4.2" ry="2.8" transform="rotate(-25 17 40)" fill="#fff" opacity={0.45} />
      <ellipse cx="40.5" cy="36.5" rx="3.6" ry="2.4" transform="rotate(-25 40.5 36.5)" fill="#fff" opacity={0.45} />
    </>
  ),

  // 🍋 레몬 — 양끝 꼭지 달린 통통한 타원 + 잎
  lemon: (
    <>
      <defs>
        <linearGradient id="sym-lemon-g" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="55%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#d9a621" />
        </linearGradient>
      </defs>
      <g transform="rotate(-16 32 38)">
        {/* 양끝 꼭지 */}
        <circle cx="10" cy="38" r="4.5" fill="#d9a621" stroke={OUT} strokeWidth={3} />
        <circle cx="54" cy="38" r="4.5" fill="#d9a621" stroke={OUT} strokeWidth={3} />
        {/* 몸통 */}
        <ellipse cx="32" cy="38" rx="21.5" ry="15" fill="url(#sym-lemon-g)" stroke={OUT} strokeWidth={SW} />
        {/* 글로시 하이라이트 */}
        <ellipse cx="23" cy="31" rx="6.5" ry="3.6" transform="rotate(-14 23 31)" fill="#fff" opacity={0.45} />
      </g>
      {/* 잎 + 짧은 줄기 */}
      <path d="M25 17 L28 23" fill="none" stroke={OUT} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx="21" cy="13" rx="7.5" ry="4.2" transform="rotate(-28 21 13)" fill="#5db8a6" stroke={OUT} strokeWidth={3} />
    </>
  ),

  // ⭐ 별 — 통통한 5각 별 (모서리 둥글게)
  star: (
    <>
      <defs>
        <linearGradient id="sym-star-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="55%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#d9a621" />
        </linearGradient>
      </defs>
      <polygon
        points="32,9 39.1,24.3 55.8,26.3 43.4,37.7 46.7,54.2 32,46 17.3,54.2 20.6,37.7 8.2,26.3 24.9,24.3"
        fill="url(#sym-star-g)"
        stroke={OUT}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      <ellipse cx="26" cy="24" rx="5" ry="2.8" transform="rotate(-32 26 24)" fill="#fff" opacity={0.45} />
    </>
  ),

  // 💎 다이아몬드 — 틸 브릴리언트 컷
  gem: (
    <>
      <defs>
        <linearGradient id="sym-gem-g" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#a9e8d8" />
          <stop offset="50%" stopColor="#5db8a6" />
          <stop offset="100%" stopColor="#3e8d7e" />
        </linearGradient>
      </defs>
      <path d="M18 10 L46 10 L57 27 L32 56 L7 27 Z" fill="url(#sym-gem-g)" stroke={OUT} strokeWidth={SW} strokeLinejoin="round" />
      {/* 컷 면 라인 */}
      <g stroke="#2e6e61" strokeWidth={2} fill="none" opacity={0.85}>
        <path d="M7 27 L57 27" />
        <path d="M18 10 L25 27 L32 56" />
        <path d="M46 10 L39 27 L32 56" />
      </g>
      {/* 글로시 하이라이트 + 흰 반짝 */}
      <ellipse cx="21" cy="18" rx="4.8" ry="2.6" transform="rotate(-10 21 18)" fill="#fff" opacity={0.5} />
      <path d="M43 32 L44.5 37 L49 38.5 L44.5 40 L43 45 L41.5 40 L37 38.5 L41.5 37 Z" fill="#fff" opacity={0.6} />
    </>
  ),

  // 7️⃣ 럭키 세븐 — 잭팟 심볼. 골드 입체 숫자 + 후광 + 반짝이 3개로 제일 화려하게
  seven: (
    <>
      <defs>
        <linearGradient id="sym-seven-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a3" />
          <stop offset="45%" stopColor="#f5c542" />
          <stop offset="100%" stopColor="#d9a621" />
        </linearGradient>
        <radialGradient id="sym-seven-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5c542" stopOpacity="0.55" />
          <stop offset="70%" stopColor="#f5c542" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f5c542" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 잭팟 후광 */}
      <circle cx="32" cy="32" r="30" fill="url(#sym-seven-glow)" />
      {/* 입체 뒷면(두께) — 같은 7을 3.5px 어긋나게 어두운 골드로 */}
      <path
        d="M13 8 L53 8 L53 21 L34 54 L19 54 L37 21 L13 21 Z"
        transform="translate(3.5 3.5)"
        fill="#a5761a"
        stroke={OUT}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      {/* 앞면 */}
      <path
        d="M13 8 L53 8 L53 21 L34 54 L19 54 L37 21 L13 21 Z"
        fill="url(#sym-seven-g)"
        stroke={OUT}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
      {/* 윗변 광 */}
      <path d="M17 13 L48 13" stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      {/* 반짝이 */}
      {spark(9, 27, 3.5)}
      {spark(56, 35, 5)}
      {spark(44, 57, 3)}
    </>
  ),
};

// 심볼 아이콘 — 릴 셀(≈44px)과 페이테이블(≈14px) 공용
export function SymbolIcon({ id, size = 44 }: { id: SlotSymbol; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ verticalAlign: "middle" }}>
      {BODY[id]}
    </svg>
  );
}
