import proj4 from "proj4";

// Naver 지역검색 mapx/mapy → WGS84 (lng, lat) 변환.
// Korea TM128 (Bessel, Korea Central Belt) 좌표계.
const TM128 =
  "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 " +
  "+ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";

proj4.defs("KOREA_TM128", TM128);

export function tm128ToWgs84(x: number, y: number): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("tm128ToWgs84: invalid input");
  }
  const [lng, lat] = proj4("KOREA_TM128", "WGS84", [x, y]);
  return [lng, lat];
}
