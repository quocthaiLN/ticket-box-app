// Quy tắc slug concert (chốt 2026-07-05): slugify(tên) + "-" + 5 ký tự cuối
// của concert id. Suffix theo id bảo đảm slug unique nên đổi tên concert
// (chỉ được phép khi DRAFT) không cần redirect URL cũ.
export function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length > 0 ? base : "concert";
}

export function concertIdSuffix(concertId: string): string {
  return concertId.replace(/-/g, "").slice(-5);
}

export function buildConcertSlug(source: string, concertId: string): string {
  return `${slugify(source)}-${concertIdSuffix(concertId)}`;
}
