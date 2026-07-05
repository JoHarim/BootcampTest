// 사주 계산 모듈 — 순수 함수만. lunar-javascript(외부 라이브러리)는 이 파일에서만 import.
// 반환은 전부 한자 → 아래 최소 매핑으로 한글/오행/음양/십신/등급/코멘트를 산출한다.
import pkg from "lunar-javascript";

const { Solar } = pkg;

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

// 오행 5종
type Element = "木" | "火" | "土" | "金" | "水";

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

// 십신 10종
export type TenGod =
  | "비견"
  | "겁재"
  | "식신"
  | "상관"
  | "편재"
  | "정재"
  | "편관"
  | "정관"
  | "편인"
  | "정인";

// 운세 등급
export type Grade = "좋음" | "보통" | "주의";

// 생(生) 순서: 木→火→土→金→水→木
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

// 십신 10종별 한 줄 코멘트 (재미·참고 톤, 단정/예언 금지)
const TEN_GOD_COMMENT: Record<TenGod, string> = {
  비견: "내 페이스를 지키며 꾸준히 가기 좋은 날이에요.",
  겁재: "욕심보다 나눔이 마음을 편하게 해줄 수 있어요.",
  식신: "여유롭게 즐기며 표현해보기 좋은 날이에요.",
  상관: "아이디어가 반짝이니 가볍게 시도해보세요.",
  편재: "기회에 열려 있되 무리한 베팅은 살짝 미뤄보세요.",
  정재: "차분히 실속을 챙기기 좋은 날이에요.",
  편관: "무리한 결정은 한 박자 미뤄보세요.",
  정관: "원칙대로 차근차근 풀면 매듭이 지어질 거예요.",
  편인: "혼자만의 시간에 생각을 정리해보기 좋아요.",
  정인: "배우고 채우는 하루로 삼아보면 어울려요.",
};

// 십신 → 등급 매핑
// 인성(편인·정인)=좋음, 재성(편재·정재)=좋음, 비겁(비견·겁재)=보통, 식상(식신·상관)=보통, 관성(편관·정관)=주의
const TEN_GOD_GRADE: Record<TenGod, Grade> = {
  편인: "좋음",
  정인: "좋음",
  편재: "좋음",
  정재: "좋음",
  비견: "보통",
  겁재: "보통",
  식신: "보통",
  상관: "보통",
  편관: "주의",
  정관: "주의",
};

// 일간(dayStem) 기준, 상대 천간(otherStem)의 십신을 산출.
// 오행 생극 + 음양 동/이로 판정.
function tenGod(dayStem: string, otherStem: string): TenGod {
  const me = STEM_ELEMENT[dayStem];
  const other = STEM_ELEMENT[otherStem];
  const sameYinYang = STEM_YANG[dayStem] === STEM_YANG[otherStem];

  if (me === other) {
    // 같은 오행: 음양 같으면 비견, 다르면 겁재
    return sameYinYang ? "비견" : "겁재";
  }
  if (PRODUCES[me] === other) {
    // 내가 생하는 오행(식상): 같으면 식신, 다르면 상관
    return sameYinYang ? "식신" : "상관";
  }
  if (CONTROLS[me] === other) {
    // 내가 극하는 오행(재성): 같으면 편재, 다르면 정재
    return sameYinYang ? "편재" : "정재";
  }
  if (CONTROLS[other] === me) {
    // 나를 극하는 오행(관성): 같으면 편관, 다르면 정관
    return sameYinYang ? "편관" : "정관";
  }
  // 나를 생하는 오행(인성): 같으면 편인, 다르면 정인
  return sameYinYang ? "편인" : "정인";
}

// S2 계산 결과
export interface Fortune {
  todayLabel: string; // 예: "오늘은 갑자(甲子)일"
  todayGanzhiHanja: string; // 예: "甲子"
  grade: Grade;
  comment: string;
  tenGod: TenGod;
}

// 내 생일의 일간(천간 한자) 구하기.
// 시각 모름(hour===null)이면 정오(12) 더미 — 일주는 날짜 기준이라 결과에 영향 없음.
function getMyDayStem(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  minute: number | null,
): string {
  const useHour = hour === null ? 12 : hour;
  const useMinute = minute === null ? 0 : minute;
  const ec = Solar.fromYmdHms(year, month, day, useHour, useMinute, 0)
    .getLunar()
    .getEightChar();
  const ganzhi: string = ec.getDay(); // '甲子' 같은 한자 2글자
  return ganzhi[0]; // 일간 天干 한자
}

// birthDate 'YYYY-MM-DD', birthTime 'HH:MM'|'' 를 받아 오늘 운세를 계산한다.
// 저장값이 이상하거나 계산이 실패하면 예외를 던진다(호출부 try/catch에서 처리).
export function calculateFortune(
  birthDate: string,
  birthTime: string,
  today: Date,
): Fortune {
  // 생년월일 파싱
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (dateMatch === null) {
    throw new Error("생년월일 형식이 올바르지 않습니다.");
  }
  const by = Number(dateMatch[1]);
  const bm = Number(dateMatch[2]);
  const bd = Number(dateMatch[3]);

  // 시각 파싱 (비어 있으면 null → 정오 더미)
  let hour: number | null = null;
  let minute: number | null = null;
  if (birthTime !== "") {
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(birthTime);
    if (timeMatch === null) {
      throw new Error("태어난 시각 형식이 올바르지 않습니다.");
    }
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }

  // 내 일간
  const myDayStem = getMyDayStem(by, bm, bd, hour, minute);
  if (STEM_ELEMENT[myDayStem] === undefined) {
    throw new Error("일간을 인식하지 못했습니다.");
  }

  // 오늘의 일진 간지
  const todayLunar = Solar.fromYmd(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  ).getLunar();
  const todayStem: string = todayLunar.getDayGan(); // '甲'
  const todayBranch: string = todayLunar.getDayZhi(); // '子'
  if (
    STEM_KO[todayStem] === undefined ||
    BRANCH_KO[todayBranch] === undefined
  ) {
    throw new Error("오늘 일진을 인식하지 못했습니다.");
  }

  // 십신(내 일간 vs 오늘 일진 천간) → 등급·코멘트
  const god = tenGod(myDayStem, todayStem);
  const grade = TEN_GOD_GRADE[god];
  const comment = TEN_GOD_COMMENT[god];

  const ganzhiHanja = `${todayStem}${todayBranch}`;
  const ganzhiKo = `${STEM_KO[todayStem]}${BRANCH_KO[todayBranch]}`;

  return {
    todayLabel: `오늘은 ${ganzhiKo}(${ganzhiHanja})일`,
    todayGanzhiHanja: ganzhiHanja,
    grade,
    comment,
    tenGod: god,
  };
}
