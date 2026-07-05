// lunar-javascript(v1.x)는 .d.ts 를 제공하지 않는다.
// saju.ts 에서 쓰는 범위만 any 기반으로 선언한다(외부 라이브러리 접점 격리).
declare module "lunar-javascript" {
  const pkg: {
    Solar: any;
    Lunar: any;
    [key: string]: any;
  };
  export default pkg;
}
