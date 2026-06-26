import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Bucket lưu file PDF hồ sơ nghệ sĩ / press kit. Đặt private; chỉ backend dùng service-role key.
const BUCKET = process.env.SUPABASE_PRESS_KIT_BUCKET ?? "press-kits";

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

/** API: cấp signed upload URL để client PUT thẳng file PDF lên Supabase. */
export async function createPressKitUploadUrl(objectPath: string) {
  const { data, error } = await supabase().storage
    .from(BUCKET)
    .createSignedUploadUrl(objectPath);
  if (error) throw error;
  return { path: objectPath, token: data.token, signed_url: data.signedUrl };
}

/** Worker: tải file press kit từ Supabase về buffer để tách nội dung. */
export async function downloadPressKit(objectPath: string): Promise<Buffer> {
  const { data, error } = await supabase().storage.from(BUCKET).download(objectPath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}
