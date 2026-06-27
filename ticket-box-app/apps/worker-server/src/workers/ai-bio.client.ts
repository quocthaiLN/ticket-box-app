/**
 * ai-bio.client.ts — Sinh phần giới thiệu nghệ sĩ qua API AI (OpenAI-compatible).
 *
 * Mặc định dùng Groq (free, không cần thẻ). Đổi nhà cung cấp chỉ bằng env
 * AI_BASE_URL / AI_API_KEY / AI_MODEL (Groq, OpenRouter, Cerebras, Ollama local, ...).
 *
 * Pipeline: làm sạch + ưu tiên thông tin quan trọng + giới hạn token (prioritizeText)
 * → prompt cụ thể (buildPrompt) → gọi chat/completions (callChatCompletion).
 */

// Endpoint OpenAI-compatible. Groq: https://api.groq.com/openai/v1
const BASE_URL = (process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const MODEL = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
// Ngân sách token: tiếng Việt ~1 token ≈ 2.5–3.5 ký tự. Giữ vừa phải để hợp free tier.
const MAX_SOURCE_CHARS = Number(process.env.AI_MAX_SOURCE_CHARS ?? 8000); // input ~2.5–3k token
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 800); // output ~250–350 từ

export type GenerateBioInput = {
  artistName: string;
  eventTitle: string;
  sourceText: string;
};

export async function generateArtistBio(
  input: GenerateBioInput,
): Promise<{ bio: string; model: string }> {
  const prioritized = prioritizeText(input.sourceText, MAX_SOURCE_CHARS);
  return callChatCompletion(buildPrompt({ ...input, sourceText: prioritized }));
}

// ── Prompt: phần giới thiệu nghệ sĩ cho trang chi tiết concert ──────────────
function buildPrompt({ artistName, eventTitle, sourceText }: GenerateBioInput) {
  return `Bạn là biên tập viên giới thiệu nghệ sĩ cho một nền tảng bán vé concert. Dựa CHỈ trên nội dung HỒ SƠ/PRESS KIT dưới đây, viết phần GIỚI THIỆU nghệ sĩ bằng tiếng Việt để hiển thị trên TRANG CHI TIẾT CONCERT.

YÊU CẦU:
- Độ dài khoảng 150–250 từ, 1–2 đoạn.
- Giọng văn trang trọng, cuốn hút, hướng tới khán giả đang cân nhắc mua vé.
- ƯU TIÊN (nếu hồ sơ có): nghệ danh/tên, dòng nhạc – phong cách, 1–2 thành tựu nổi bật (giải thưởng, ca khúc/album đình đám, dấu mốc sự nghiệp), điểm khiến khán giả nên xem trực tiếp.
- TUYỆT ĐỐI KHÔNG bịa thông tin, số liệu hay giải thưởng không có trong hồ sơ. Thiếu dữ liệu thì viết tổng quát và ngắn hơn.
- BỎ QUA thông tin hậu cần/liên hệ/tài trợ/điều khoản/giá vé nếu xuất hiện trong hồ sơ.
- Chỉ trả về đúng đoạn văn giới thiệu (không tiêu đề, không markdown, không gạch đầu dòng).

NGHỆ SĨ: ${artistName}
CONCERT: ${eventTitle}

HỒ SƠ / PRESS KIT:
${sourceText}`;
}

// ── Làm sạch + ưu tiên thông tin quan trọng + cắt theo ngân sách token ───────
const NOISE =
  /(liên hệ|hotline|fax|email|@|https?:\/\/|www\.|bản quyền|©|tài trợ|sponsor|booking|management|press contact|điều khoản|giá vé|đặt vé|địa chỉ:)/i;
const PRIORITY = [
  /giải thưởng|award|cúp|đề cử/i,
  /album|ep\b|mixtape/i,
  /single|ca khúc|bản hit/i,
  /debut|ra mắt|nổi tiếng|thành công|bứt phá/i,
  /tour|lưu diễn|liveshow|concert/i,
  /\b(19|20)\d{2}\b/,
  /triệu|million|tỉ|tỷ|lượt nghe|lượt xem|view|stream/i,
  /phong cách|thể loại|genre|dòng nhạc/i,
];

export function prioritizeText(raw: string, budget: number): string {
  const cleaned = raw.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim();
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20 && !NOISE.test(p)); // làm sạch: bỏ đoạn nhiễu
  if (paragraphs.length === 0) return cleaned.slice(0, budget);

  // Chấm điểm theo từ khoá quan trọng + vị trí (đoạn đầu thường quan trọng hơn).
  const scored = paragraphs
    .map((p, i) => {
      const keyword = PRIORITY.reduce((s, re) => s + (re.test(p) ? 1 : 0), 0);
      const position = Math.max(0, 5 - i * 0.5);
      return { p, i, score: keyword * 2 + position };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i);

  // Đóng gói các đoạn điểm cao nhất tới khi chạm ngân sách, rồi trả về theo thứ tự gốc.
  const picked: { p: string; i: number }[] = [];
  let total = 0;
  for (const s of scored) {
    if (total + s.p.length + 2 > budget) continue;
    picked.push({ p: s.p, i: s.i });
    total += s.p.length + 2;
  }
  const ordered = picked.length ? picked.sort((a, b) => a.i - b.i).map((x) => x.p) : [cleaned.slice(0, budget)];
  return ordered.join("\n\n");
}

// ── Gọi API AI qua chuẩn OpenAI chat/completions (Groq mặc định) ─────────────
async function callChatCompletion(prompt: string): Promise<{ bio: string; model: string }> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY chưa được cấu hình.");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const bio = data.choices?.[0]?.message?.content?.trim();
  if (!bio) throw new Error("AI trả về bio rỗng.");
  return { bio, model: MODEL };
}
