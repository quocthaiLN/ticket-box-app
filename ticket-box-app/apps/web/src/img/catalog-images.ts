import anhSangManDem from "./anh-sang-man-dem.jpg";
import anhTraiSayHi from "./anh-trai-say-hi.jpg";
import anhTraiVuotNganChongGai from "./anh-trai-vuot-ngan-chong-gai.jpg";
import chiDepDapGioReSong from "./chi-dep-dap-gio-re-song.jpg";
import diQuaThuongNho from "./di-qua-thuong-nho.jpg";
import emXinhSayHi from "./em-xinh-say-hi.jpg";
import motThoiDaYeu from "./mot-thoi-da-yeu.jpg";
import noiTinhYeuBatDau from "./noi-tinh-yeu-bat-dau.jpg";
import our20thMoment from "./our-20th-moment-2026.jpg";
import secretShow from "./secret-show-2026.jpg";

const imageByFileName: Record<string, string> = {
  "anh-sang-man-dem.jpg": anhSangManDem,
  "anh-trai-say-hi.jpg": anhTraiSayHi,
  "anh-trai-vuot-ngan-chong-gai.jpg": anhTraiVuotNganChongGai,
  "chi-dep-dap-gio-re-song.jpg": chiDepDapGioReSong,
  "di-qua-thuong-nho.jpg": diQuaThuongNho,
  "em-xinh-say-hi.jpg": emXinhSayHi,
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

