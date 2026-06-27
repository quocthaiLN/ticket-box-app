/**
 * drive.ts — Tách Google Drive folder id từ input của BTC/admin.
 *
 * Khi gán thư mục Drive chứa CSV khách mời cho concert, người dùng có thể dán
 * full URL hoặc id thuần. Chuẩn hoá về id trước khi lưu `Concert.guestDriveFolderId`.
 */

/**
 * Trích folder id của Google Drive từ link đầy đủ hoặc id thuần. Hỗ trợ:
 *   - https://drive.google.com/drive/folders/<ID>[?usp=sharing]
 *   - https://drive.google.com/drive/u/0/folders/<ID>
 *   - https://drive.google.com/open?id=<ID>
 *   - <ID> (id thuần)
 *
 * Trả về id, hoặc `null` nếu không tách được id hợp lệ.
 */
export function extractDriveFolderId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const fromFolders = value.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (fromFolders) return fromFolders[1];

  const fromIdParam = value.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (fromIdParam) return fromIdParam[1];

  // id thuần: không chứa "/" và chỉ gồm ký tự id hợp lệ của Drive.
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value;

  return null;
}
