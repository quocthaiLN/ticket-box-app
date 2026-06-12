import anhSangManDem from "./anh-sang-man-dem.jpg";
import diQuaThuongNho from "./di-qua-thuong-nho.jpg";
import motThoiDaYeu from "./mot-thoi-da-yeu.jpg";
import noiTinhYeuBatDau from "./noi-tinh-yeu-bat-dau.jpg";
import our20thMoment from "./our-20th-moment-2026.jpg";
import secretShow from "./secret-show-2026.jpg";

const imageByFileName: Record<string, string> = {
  "anh-sang-man-dem.jpg": anhSangManDem,
  "di-qua-thuong-nho.jpg": diQuaThuongNho,
  "mot-thoi-da-yeu.jpg": motThoiDaYeu,
  "noi-tinh-yeu-bat-dau.jpg": noiTinhYeuBatDau,
  "our-20th-moment-2026.jpg": our20thMoment,
  "secret-show-2026.jpg": secretShow,
};

export function resolveCatalogImageUrl(url?: string) {
  if (!url) return "";
  const fileName = url.split("/").pop();
  return fileName ? imageByFileName[fileName] ?? url : url;
}

