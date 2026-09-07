// 상지인터내셔날 리뉴얼 시안용 견본 데이터.
// 실제 구축 시에는 이 파일 대신 창고(DB)에서 읽는다 — 품번·규격·재고·단가는 전부 예시다.

export type CategoryId = "oilseal" | "packing" | "oring" | "belt" | "pulley" | "sealkit" | "fpc";

export interface Category {
  id: CategoryId;
  name: string;
  en: string;
  desc: string;
  /** 규격 표기 방식 — 검색 필터 레이블에 쓴다 */
  specLabel: string;
}

export const CATEGORIES: Category[] = [
  { id: "oilseal", name: "오일씰", en: "Oil Seal", desc: "회전축과 하우징 사이 누유·이물 차단. TC·TB·SC·VC 등 NOK 표준형", specLabel: "축경 × 외경 × 폭" },
  { id: "packing", name: "패킹", en: "Packing", desc: "유압·공압 실린더용 로드·피스톤 패킹. USH·IDI·ISI·OSI·SPGO·SPGW", specLabel: "내경 × 외경 × 높이" },
  { id: "oring", name: "O-Ring", en: "O-Ring", desc: "P·G·V 규격 및 JIS B 2401 대응. NBR·FKM·EPDM·실리콘", specLabel: "내경 × 선경" },
  { id: "belt", name: "타이밍벨트", en: "Timing Belt", desc: "IRON RUBBER(NOK 개발 폴리우레탄) 소재. 어태치먼트 가공 가능", specLabel: "피치 × 폭 × 길이" },
  { id: "pulley", name: "풀리", en: "Pulley", desc: "타이밍벨트 대응 풀리. 치형·잇수·보어 규격별", specLabel: "피치 × 잇수 × 보어" },
  { id: "sealkit", name: "씰키트", en: "Seal Kit", desc: "굴삭기·유압브레이커·지게차·스윙모터용 장비별 키트", specLabel: "적용 장비 · 부위" },
  { id: "fpc", name: "FPC", en: "Flexible PCB", desc: "NOK 그룹 연성회로기판. 설계 사양 기반 견적", specLabel: "층수 · 사이즈" },
];

export type Stock = "in" | "low" | "order";

export interface Product {
  code: string;
  category: CategoryId;
  type: string;
  name: string;
  /** 사람이 읽는 규격 (예: 35 × 52 × 8) */
  spec: string;
  /** 첫 번째 치수 — 축경/내경/피치 등. 범위 필터용 */
  d1: number;
  d2: number;
  d3: number;
  material: string;
  stock: Stock;
  /** 온라인몰(B2C) 판매가. B2B 거래처 단가는 로그인 후 */
  price: number;
  /** 최소 주문 수량 */
  moq: number;
  crossRef?: string[];
  apps: string[];
}

function oilseal(d1: number, d2: number, d3: number, type: string, material: string, stock: Stock, price: number): Product {
  return {
    code: `${type} ${d1}-${d2}-${d3}${material === "NBR" ? "" : " " + material}`,
    category: "oilseal",
    type,
    name: `NOK 오일씰 ${type}형`,
    spec: `${d1} × ${d2} × ${d3}`,
    d1, d2, d3, material, stock, price, moq: 1,
    crossRef: [`AE${String(1000 + d1 * 7 + d2).slice(0, 4)}${material === "FKM" ? "F" : "E"}`],
    apps: d1 >= 60 ? ["굴삭기 스윙모터", "감속기"] : ["유압펌프", "모터 축", "감속기"],
  };
}

function packing(d1: number, d2: number, d3: number, type: string, material: string, stock: Stock, price: number): Product {
  return {
    code: `${type} ${d1}-${d2}-${d3}`,
    category: "packing",
    type,
    name: `NOK ${type} 패킹`,
    spec: `${d1} × ${d2} × ${d3}`,
    d1, d2, d3, material, stock, price, moq: 1,
    apps: type.startsWith("SPG") ? ["유압 실린더 피스톤"] : ["유압 실린더 로드", "건설기계 붐·암 실린더"],
  };
}

function oring(code: string, d1: number, d3: number, material: string, stock: Stock, price: number): Product {
  return {
    code: `${code}${material === "NBR" ? "" : "-" + material}`,
    category: "oring",
    type: code.split("-")[0],
    name: `NOK O-Ring ${code.split("-")[0]}규격`,
    spec: `내경 ${d1} × 선경 ${d3}`,
    d1, d2: d1 + d3 * 2, d3, material, stock, price, moq: 10,
    apps: ["유압 피팅", "밸브", "실린더 헤드"],
  };
}

export const PRODUCTS: Product[] = [
  oilseal(20, 35, 7, "TC", "NBR", "in", 3200),
  oilseal(25, 40, 7, "TC", "NBR", "in", 3400),
  oilseal(30, 47, 8, "TC", "NBR", "in", 3900),
  oilseal(35, 52, 8, "TC", "NBR", "in", 4300),
  oilseal(35, 52, 8, "TC", "FKM", "low", 9800),
  oilseal(40, 62, 10, "TC", "NBR", "in", 5600),
  oilseal(45, 65, 10, "TB", "NBR", "in", 6100),
  oilseal(50, 72, 12, "TC", "NBR", "in", 7200),
  oilseal(55, 78, 12, "TC", "NBR", "order", 7900),
  oilseal(60, 85, 12, "SC", "NBR", "in", 8400),
  oilseal(70, 95, 13, "TC", "FKM", "order", 21000),
  oilseal(80, 110, 13, "TB", "NBR", "low", 14500),
  oilseal(100, 130, 13, "VC", "NBR", "order", 19800),
  packing(40, 50, 6, "USH", "PU", "in", 5800),
  packing(45, 55, 6, "USH", "PU", "in", 6200),
  packing(50, 60, 6, "USH", "PU", "in", 6600),
  packing(63, 73, 6, "USH", "PU", "low", 7900),
  packing(50, 60, 6, "IDI", "NBR", "in", 5400),
  packing(40, 48, 6, "ISI", "NBR", "in", 4700),
  packing(56, 64, 8, "OSI", "NBR", "order", 6900),
  packing(80, 65, 9, "SPGO", "PTFE+NBR", "in", 24000),
  packing(100, 85, 10, "SPGW", "PTFE+NBR", "order", 31000),
  oring("P-10", 9.8, 1.9, "NBR", "in", 320),
  oring("P-20", 19.8, 2.4, "NBR", "in", 420),
  oring("P-20", 19.8, 2.4, "FKM", "in", 1250),
  oring("P-30", 29.7, 3.5, "NBR", "in", 560),
  oring("P-45", 44.7, 3.5, "NBR", "low", 720),
  oring("G-45", 44.4, 3.1, "NBR", "in", 690),
  oring("G-60", 59.4, 3.1, "NBR", "in", 810),
  oring("G-100", 99.4, 3.1, "NBR", "order", 1200),
  oring("V-15", 14.5, 4.0, "NBR", "order", 980),
  {
    code: "S3M-300-10", category: "belt", type: "S3M", name: "타이밍벨트 S3M (IRON RUBBER)",
    spec: "피치 3 × 폭 10 × 길이 300", d1: 3, d2: 10, d3: 300, material: "PU(IRON RUBBER)", stock: "in", price: 8700, moq: 1,
    apps: ["소형 반송장치", "자동화 설비"],
  },
  {
    code: "S5M-600-15", category: "belt", type: "S5M", name: "타이밍벨트 S5M (IRON RUBBER)",
    spec: "피치 5 × 폭 15 × 길이 600", d1: 5, d2: 15, d3: 600, material: "PU(IRON RUBBER)", stock: "in", price: 14200, moq: 1,
    apps: ["컨베이어", "제화기계"],
  },
  {
    code: "S8M-1200-30", category: "belt", type: "S8M", name: "타이밍벨트 S8M (IRON RUBBER)",
    spec: "피치 8 × 폭 30 × 길이 1200", d1: 8, d2: 30, d3: 1200, material: "PU(IRON RUBBER)", stock: "order", price: 36500, moq: 1,
    apps: ["산업용 로봇 구동", "대형 반송"],
  },
  {
    code: "PL-S5M-30-A", category: "pulley", type: "S5M", name: "타이밍풀리 S5M 30T", spec: "피치 5 × 30T × 보어 8",
    d1: 5, d2: 30, d3: 8, material: "S45C", stock: "in", price: 16800, moq: 1, apps: ["S5M 벨트 구동부"],
  },
  {
    code: "PL-S8M-40-B", category: "pulley", type: "S8M", name: "타이밍풀리 S8M 40T", spec: "피치 8 × 40T × 보어 15",
    d1: 8, d2: 40, d3: 15, material: "S45C", stock: "order", price: 29000, moq: 1, apps: ["S8M 벨트 구동부"],
  },
  {
    code: "SK-EX200-BOOM", category: "sealkit", type: "굴삭기", name: "굴삭기 붐 실린더 씰키트 (20톤급)", spec: "붐 실린더 · 로드/피스톤 풀세트",
    d1: 20, d2: 0, d3: 0, material: "PU/NBR/PTFE", stock: "in", price: 148000, moq: 1, apps: ["굴삭기 20톤급 붐 실린더"],
  },
  {
    code: "SK-EX200-ARM", category: "sealkit", type: "굴삭기", name: "굴삭기 암 실린더 씰키트 (20톤급)", spec: "암 실린더 · 로드/피스톤 풀세트",
    d1: 20, d2: 0, d3: 0, material: "PU/NBR/PTFE", stock: "low", price: 152000, moq: 1, apps: ["굴삭기 20톤급 암 실린더"],
  },
  {
    code: "SK-BRK-SB81", category: "sealkit", type: "유압브레이커", name: "유압브레이커 씰키트 SB81급", spec: "브레이커 본체 씰 풀세트",
    d1: 0, d2: 0, d3: 0, material: "PU/NBR", stock: "in", price: 96000, moq: 1, apps: ["유압브레이커"],
  },
  {
    code: "SK-FL-MAST-25", category: "sealkit", type: "지게차", name: "지게차 마스트 실린더 씰키트 2.5톤", spec: "리프트 실린더 · 로드 세트",
    d1: 25, d2: 0, d3: 0, material: "PU/NBR", stock: "in", price: 42000, moq: 1, apps: ["지게차 2.5톤 마스트"],
  },
  {
    code: "SK-SWING-M5X", category: "sealkit", type: "스윙모터", name: "스윙모터 씰키트 M5X 계열", spec: "스윙모터 샤프트 씰 세트",
    d1: 0, d2: 0, d3: 0, material: "NBR/FKM", stock: "order", price: 78000, moq: 1, apps: ["굴삭기 스윙모터"],
  },
  {
    code: "FPC-CUSTOM", category: "fpc", type: "FPC", name: "FPC 연성회로기판 (설계 사양 견적)", spec: "층수·사이즈·수량 기반 개별 견적",
    d1: 0, d2: 0, d3: 0, material: "PI/Cu", stock: "order", price: 0, moq: 100, apps: ["전장품", "센서 모듈"],
  },
];

export const MATERIALS = Array.from(new Set(PRODUCTS.map((p) => p.material)));

export function categoryOf(id: CategoryId): Category {
  const c = CATEGORIES.find((x) => x.id === id);
  if (c === undefined) throw new Error("unknown category " + id);
  return c;
}

export function findProduct(code: string): Product | null {
  const p = PRODUCTS.find((x) => x.code === code);
  return p === undefined ? null : p;
}

/** 품번 검색 — 공백·하이픈·대소문자를 무시하고 부분 일치. "tc 35 52" 도 "TC 35-52-8" 을 찾는다. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_×x*]/g, "");
}

export function matchesQuery(p: Product, q: string): boolean {
  const n = normalize(q);
  if (n === "") return true;
  const hay = [p.code, p.name, p.type, p.spec, ...(p.crossRef ?? [])].map(normalize).join("|");
  return hay.includes(n);
}

export const STOCK_LABEL: Record<Stock, string> = { in: "재고 있음", low: "재고 소량", order: "발주 (7~14일)" };

export function won(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

/** 시안용 상세 페이지 정적 경로 목록 — 품번에 공백이 있어 URL 에서는 인코딩된다 */
export function allCodes(): string[] {
  return PRODUCTS.map((p) => p.code);
}

export function codeToSlug(code: string): string {
  return encodeURIComponent(code);
}

export interface Industry {
  id: string;
  name: string;
  tagline: string;
  equipment: string[];
  kits: string[];
  caseTitle: string;
  caseBody: string;
}

export const INDUSTRIES: Industry[] = [
  {
    id: "construction", name: "건설기계", tagline: "굴삭기·브레이커·스윙모터, 현장이 멈추지 않게",
    equipment: ["굴삭기 붐·암·버킷 실린더", "유압브레이커", "스윙모터·주행모터", "덤프·크레인 실린더"],
    kits: ["SK-EX200-BOOM", "SK-EX200-ARM", "SK-BRK-SB81", "SK-SWING-M5X"],
    caseTitle: "20톤급 굴삭기 붐 실린더 누유 — 씰키트 교체로 당일 복구",
    caseBody: "장비사 정비팀이 품번 대신 장비 모델·부위로 검색해 키트를 특정, 오전 견적·오후 출고. 로드 패킹은 PU, 더스트씰은 내마모 사양으로 조합.",
  },
  {
    id: "industrial", name: "산업설비", tagline: "펌프·감속기·프레스, 계획 정비 주기에 맞춘 공급",
    equipment: ["유압펌프·모터", "감속기·기어박스", "프레스·사출기 실린더", "컨베이어 구동부"],
    kits: ["TC 50-72-12", "USH 50-60-6", "S8M-1200-30"],
    caseTitle: "제지 설비 감속기 오일씰 — FKM 사양으로 교체 주기 2배",
    caseBody: "고온·고속 축에서 NBR 씰 조기 경화가 반복. 동일 규격 FKM(TC 35-52-8 FKM)으로 전환 제안, 정비 주기를 6개월에서 12개월로.",
  },
  {
    id: "agri", name: "농기계", tagline: "트랙터·콤바인 유압부, 성수기 전 재고 확보",
    equipment: ["트랙터 유압 실린더", "콤바인 주행부", "로더 실린더"],
    kits: ["USH 40-50-6", "TC 35-52-8", "P-20"],
    caseTitle: "농기계 대리점 성수기 소모품 세트 — 규격 묶음 견적",
    caseBody: "자주 나가는 O-Ring·패킹 30종을 묶음으로 등록, 견적 한 번으로 재주문. B2B 거래처 단가 자동 적용.",
  },
  {
    id: "steel", name: "제철·중공업", tagline: "대구경·고온 사양, 특수 재질 선정 지원",
    equipment: ["압연기 유압 실린더", "대형 감속기", "크레인 권상 실린더"],
    kits: ["VC 100-130-13", "SPGW 100-85-10", "G-100"],
    caseTitle: "압연 라인 대구경 오일씰 — 발주 리드타임 사전 공지",
    caseBody: "재고 없는 대구경 품목은 발주 7~14일 표시로 정비 계획에 반영. 대체 가능 규격을 함께 제안.",
  },
  {
    id: "cylinder", name: "유압실린더 제조", tagline: "OEM 실린더 조립용 패킹 세트, 도면 기반 선정",
    equipment: ["로드 패킹·더스트씰", "피스톤 패킹", "백업링·웨어링"],
    kits: ["USH 63-73-6", "SPGO 80-65-9", "IDI 50-60-6"],
    caseTitle: "실린더 제조사 신규 모델 — 도면 첨부 견적으로 패킹 조합 확정",
    caseBody: "견적 요청 시 도면 PDF 첨부, 기술 담당이 로드·피스톤 조합을 제안. 확정 후 품번 세트로 반복 주문.",
  },
  {
    id: "robot", name: "산업용 로봇·자동화", tagline: "타이밍벨트·풀리·소형 씰, 정밀 구동부",
    equipment: ["로봇 관절 감속기", "리니어 반송 벨트", "그리퍼 공압 실린더"],
    kits: ["S5M-600-15", "PL-S5M-30-A", "TC 20-35-7"],
    caseTitle: "자동화 라인 반송 벨트 — 어태치먼트 가공 벨트 제작",
    caseBody: "IRON RUBBER 벨트에 반송용 어태치먼트를 가공, 규격 확정 후 정기 납품.",
  },
];

export interface Resource {
  id: string;
  title: string;
  kind: "카탈로그" | "규격표" | "선정가이드" | "기술자료" | "인증서";
  format: string;
  size: string;
  category?: CategoryId;
  updated: string;
}

export const RESOURCES: Resource[] = [
  { id: "r1", title: "NOK 오일씰 종합 카탈로그 (국문)", kind: "카탈로그", format: "PDF", size: "18.2 MB", category: "oilseal", updated: "2026-03" },
  { id: "r2", title: "NOK 오일씰 표준 규격표 TC·TB·SC·VC", kind: "규격표", format: "PDF · XLSX", size: "2.4 MB", category: "oilseal", updated: "2026-03" },
  { id: "r3", title: "유압·공압 패킹 카탈로그 (USH·IDI·ISI·OSI·SPG)", kind: "카탈로그", format: "PDF", size: "22.7 MB", category: "packing", updated: "2025-11" },
  { id: "r4", title: "패킹 선정 가이드 — 압력·속도·온도별", kind: "선정가이드", format: "PDF", size: "3.1 MB", category: "packing", updated: "2025-11" },
  { id: "r5", title: "O-Ring 규격표 (P·G·V, JIS B 2401)", kind: "규격표", format: "PDF · XLSX", size: "1.8 MB", category: "oring", updated: "2026-01" },
  { id: "r6", title: "O-Ring 재질별 사용 온도·내유성 비교", kind: "기술자료", format: "PDF", size: "0.9 MB", category: "oring", updated: "2026-01" },
  { id: "r7", title: "IRON RUBBER 타이밍벨트 카탈로그", kind: "카탈로그", format: "PDF", size: "9.6 MB", category: "belt", updated: "2025-08" },
  { id: "r8", title: "타이밍벨트·풀리 선정 계산 시트", kind: "선정가이드", format: "XLSX", size: "0.4 MB", category: "belt", updated: "2025-08" },
  { id: "r9", title: "오일씰 취급·조립 주의사항", kind: "기술자료", format: "PDF", size: "1.2 MB", category: "oilseal", updated: "2025-05" },
  { id: "r10", title: "NOK 공식 대리점 인증서", kind: "인증서", format: "PDF", size: "0.6 MB", updated: "2026-01" },
];

export const COMPANY = {
  name: "상지인터내셔날(주)",
  en: "SANGJI International CORP.",
  since: 1997,
  address: "경기도 고양시 일산동구 일산로 142, 유니테크빌벤처타운 703호",
  tel: "031-909-7300",
  hours: "평일 09:00 ~ 18:00 (토·일·공휴일 휴무)",
};
