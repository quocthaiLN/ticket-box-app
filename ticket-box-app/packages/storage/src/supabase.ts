import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// PDF press kit để private (chỉ backend đọc); ảnh nghệ sĩ để public (hiển thị trực tiếp).
const PRESS_KIT_BUCKET = process.env.SUPABASE_PRESS_KIT_BUCKET ?? "press-kits";
const ARTIST_IMAGE_BUCKET = process.env.SUPABASE_ARTIST_IMAGE_BUCKET ?? "artist-images";
// Sơ đồ chỗ ngồi (SVG + ảnh PNG/JPEG) để public — audience xem trực tiếp, email mời nhúng URL.
const SEAT_MAP_BUCKET = process.env.SUPABASE_SEAT_MAP_BUCKET ?? "seat-maps";

/** Supabase đã cấu hình chưa — caller dùng để quyết định upload cloud hay fallback local (dev). */
export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình.");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** API: upload file PDF press kit lên Supabase (private). Trả object key để lưu DB. */
export async function uploadPressKit(objectKey: string, buffer: Buffer): Promise<string> {
  const { error } = await supabase().storage
    .from(PRESS_KIT_BUCKET)
    .upload(objectKey, buffer, { contentType: "application/pdf", upsert: false });
  if (error) throw error;
  return objectKey;
}

/** API: upload ảnh nghệ sĩ lên Supabase (public). Trả object key + public URL để hiển thị. */
export async function uploadArtistImage(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ object_key: string; url: string }> {
  const { error } = await supabase().storage
    .from(ARTIST_IMAGE_BUCKET)
    .upload(objectKey, buffer, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase().storage.from(ARTIST_IMAGE_BUCKET).getPublicUrl(objectKey);
  return { object_key: objectKey, url: data.publicUrl };
}

/** API: upload sơ đồ chỗ ngồi (SVG hoặc ảnh) lên Supabase (public). Trả object key + public URL. */
export async function uploadSeatMapAsset(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ object_key: string; url: string }> {
  const { error } = await supabase().storage
    .from(SEAT_MAP_BUCKET)
    .upload(objectKey, buffer, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase().storage.from(SEAT_MAP_BUCKET).getPublicUrl(objectKey);
  return { object_key: objectKey, url: data.publicUrl };
}

/** Worker: tải file press kit từ Supabase về buffer để tách nội dung. */
export async function downloadPressKit(objectKey: string): Promise<Buffer> {
  const { data, error } = await supabase().storage.from(PRESS_KIT_BUCKET).download(objectKey);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
