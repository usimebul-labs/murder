import type { MetadataRoute } from "next";

/** PWA 매니페스트: 홈 화면 추가 시 전체 화면으로 실행 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "머더 미스터리",
    short_name: "머더 미스터리",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c1916",
    theme_color: "#1c1916",
    icons: [],
  };
}
