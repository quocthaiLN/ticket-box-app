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
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 2000); // concert bio + n nghệ sĩ (~150-200 từ/người) + khung JSON

export type GenerateBioInput = {
  artistName: string;
  eventTitle: string;
  sourceText: string;
};

export type GeneratedArtist = {
  name: string;
  bio: string;
};

export type GenerateBiosResult = {
  // Danh sách nghệ sĩ theo ĐÚNG THỨ TỰ xuất hiện trong press kit — luôn có ≥1 phần tử.
  artists: GeneratedArtist[];
  // Giới thiệu concert (tab "Thông tin") — có thể rỗng nếu press kit không đủ dữ liệu.
  concertBio: string;
  model: string;
};

export async function generateBios(
  input: GenerateBioInput,
): Promise<GenerateBiosResult> {
  const prioritized = prioritizeText(input.sourceText, MAX_SOURCE_CHARS);
  const { content, model } = await callChatCompletion(
    buildPrompt({ ...input, sourceText: prioritized }),
  );
  const { artists, concertBio } = parseBios(content, input.artistName);
  return { artists, concertBio, model };
}

// ── Prompt: press kit chứa thông tin concert + 1..n nghệ sĩ → tách từng phần ─
function buildPrompt({ artistName, eventTitle, sourceText }: GenerateBioInput) {
  return `Bạn là biên tập viên nội dung cho một nền tảng bán vé concert. HỒ SƠ/PRESS KIT dưới đây chứa thông tin về CONCERT và về MỘT HOẶC NHIỀU NGHỆ SĨ tham gia. Dựa CHỈ trên hồ sơ, viết bằng tiếng Việt:

1. "concert_bio": GIỚI THIỆU CONCERT cho tab "Thông tin" — chương trình có gì, chủ đề/không khí đêm diễn, điểm nhấn của sự kiện. Khoảng 100–200 từ. Nếu hồ sơ không có thông tin về concert thì trả chuỗi rỗng "".
2. "artists": DANH SÁCH NGHỆ SĨ — mỗi nghệ sĩ xuất hiện trong hồ sơ là MỘT phần tử {"name": tên nghệ sĩ/ban nhạc, "bio": giới thiệu 100–200 từ gồm dòng nhạc – phong cách, 1–2 thành tựu nổi bật, điểm khiến khán giả nên xem trực tiếp}.

YÊU CẦU CHUNG:
- "artists" phải theo ĐÚNG THỨ TỰ nghệ sĩ xuất hiện trong hồ sơ; KHÔNG thêm nghệ sĩ không có trong hồ sơ, KHÔNG gộp nhiều nghệ sĩ vào một phần tử.
- Giọng văn trang trọng, cuốn hút, hướng tới khán giả đang cân nhắc mua vé.
- TUYỆT ĐỐI KHÔNG bịa thông tin, số liệu hay giải thưởng không có trong hồ sơ. Thiếu dữ liệu thì viết tổng quát và ngắn hơn.
- KHÔNG lặp nội dung: thành tựu/sự nghiệp nghệ sĩ để trong bio của nghệ sĩ đó, nội dung chương trình để trong concert_bio.
- BỎ QUA thông tin hậu cần/liên hệ/tài trợ/điều khoản/giá vé nếu xuất hiện trong hồ sơ.
- Trả về DUY NHẤT một JSON object dạng {"concert_bio": "...", "artists": [{"name": "...", "bio": "..."}]} — không markdown, không giải thích.

NGHỆ SĨ/LINEUP THEO HỒ SƠ ĐĂNG KÝ: ${artistName}
CONCERT: ${eventTitle}

HỒ SƠ / PRESS KIT:
${sourceText}`;
}

// Parse phòng thủ: JSON chuẩn → JSON lồng trong text → format cũ {artist_bio}
// → fallback cuối coi toàn bộ output là bio của 1 nghệ sĩ (tên theo hồ sơ).
export function parseBios(
  content: string,
  fallbackArtistName: string,
): { artists: GeneratedArtist[]; concertBio: string } {
  const candidates = [content, content.match(/\{[\s\S]*\}/)?.[0]];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as {
        concert_bio?: unknown;
        artists?: unknown;
        artist_bio?: unknown;
      };
      const concertBio = typeof parsed.concert_bio === "string" ? parsed.concert_bio.trim() : "";
      if (Array.isArray(parsed.artists)) {
        const artists = parsed.artists
          .map((item) => {
            const record = item as { name?: unknown; bio?: unknown };
            return {
              name: typeof record.name === "string" ? record.name.trim() : "",
              bio: typeof record.bio === "string" ? record.bio.trim() : "",
            };
          })
          .filter((artist) => artist.bio.length > 0)
          .map((artist) => ({ ...artist, name: artist.name || fallbackArtistName }));
        if (artists.length > 0) return { artists, concertBio };
      }
      if (typeof parsed.artist_bio === "string" && parsed.artist_bio.trim()) {
        return {
          artists: [{ name: fallbackArtistName, bio: parsed.artist_bio.trim() }],
          concertBio,
        };
      }
    } catch {
      // thử candidate tiếp theo
    }
  }
  return { artists: [{ name: fallbackArtistName, bio: content.trim() }], concertBio: "" };
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
async function callChatCompletion(prompt: string): Promise<{ content: string; model: string }> {
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
      // JSON mode: buộc model trả object JSON hợp lệ (Groq/OpenAI-compatible).
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    throw new Error(`AI API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI trả về nội dung rỗng.");
  return { content, model: MODEL };
}
