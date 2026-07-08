/**
 * ai-bio.client.ts — Sinh phần giới thiệu nghệ sĩ qua API AI (OpenAI-compatible).
 *
 * Mặc định dùng Groq (free, không cần thẻ). Đổi nhà cung cấp chỉ bằng env
 * AI_BASE_URL / AI_API_KEY / AI_MODEL (Groq, OpenRouter, Cerebras, Ollama local, ...).
 *
 * Pipeline (ngân sách token chia ĐỀU theo phần — concert + từng nghệ sĩ):
 *   tách press kit theo section nghệ sĩ (splitPressKit) → mỗi section nhận
 *   MAX_SOURCE_CHARS/(k+1) ký tự input (prioritizeText) → prompt yêu cầu đủ n
 *   phần tử, mỗi bio tối đa 250 từ (buildPrompt) → max_tokens = (n+1) suất
 *   TOKENS_PER_SECTION (computeOutputBudget) → gọi chat/completions có kiểm tra
 *   finish_reason, retry khi output bị cắt (callChatCompletion).
 */

// Endpoint OpenAI-compatible. Groq: https://api.groq.com/openai/v1
const BASE_URL = (process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const MODEL = process.env.AI_MODEL ?? "llama-3.3-70b-versatile";
// Ngân sách token: tiếng Việt ~1 token ≈ 2.5–3.5 ký tự. Giữ vừa phải để hợp free tier.
const MAX_SOURCE_CHARS = Number(process.env.AI_MAX_SOURCE_CHARS ?? 8000); // input ~2.5–3k token, chia đều cho các section
// Suất output cho MỖI PHẦN (concert_bio hoặc 1 nghệ sĩ): 250 từ VN ≈ 425 token, chừa dư.
const TOKENS_PER_SECTION = Number(process.env.AI_TOKENS_PER_SECTION ?? 500);
const JSON_OVERHEAD_TOKENS = 150;
// Trần cứng cho max_tokens (không phải giá trị cố định như trước).
const OUTPUT_HARD_CAP = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 6000);

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
  const names = parseArtistNames(input.artistName);
  const artistCount = Math.max(1, names.length);

  // Chia đều ngân sách INPUT: mỗi section (concert + từng nghệ sĩ) một suất bằng nhau.
  const sections = splitPressKit(input.sourceText, names);
  let prioritized: string;
  if (sections.length >= 2) {
    const perSection = Math.floor(MAX_SOURCE_CHARS / sections.length);
    prioritized = sections
      .map((section) => `### ${section.label}\n${prioritizeText(section.text, perSection)}`)
      .join("\n\n");
  } else {
    // Press kit không có cấu trúc nhận diện được → đường cũ, giảm thiên vị đoạn đầu
    // để dữ liệu nghệ sĩ cuối không bị loại trước.
    prioritized = prioritizeText(input.sourceText, MAX_SOURCE_CHARS, { base: 2, step: 0.25 });
  }

  const { content, model } = await callChatCompletion(
    buildPrompt({ ...input, sourceText: prioritized }, artistCount),
    computeOutputBudget(artistCount),
  );
  const { artists, concertBio } = parseBios(content, input.artistName);
  if (artists.length < artistCount) {
    console.warn("[ai-bio] model trả thiếu nghệ sĩ", {
      expected: artistCount,
      got: artists.length,
    });
  }
  return { artists, concertBio, model };
}

// ── Ngân sách theo phần ──────────────────────────────────────────────────────

// Lineup đăng ký phân tách bằng DẤU PHẨY: "A, B, C" → ["A", "B", "C"].
export function parseArtistNames(artistName: string): string[] {
  return artistName
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function countArtists(artistName: string): number {
  return Math.max(1, parseArtistNames(artistName).length);
}

// max_tokens = (số nghệ sĩ + 1 phần concert) × suất mỗi phần + khung JSON, có trần cứng.
export function computeOutputBudget(artistCount: number): number {
  const sections = Math.max(1, artistCount) + 1;
  return Math.min(sections * TOKENS_PER_SECTION + JSON_OVERHEAD_TOKENS, OUTPUT_HARD_CAP);
}

// ── Prompt: press kit chứa thông tin concert + 1..n nghệ sĩ → tách từng phần ─
function buildPrompt(
  { artistName, eventTitle, sourceText }: GenerateBioInput,
  artistCount: number,
) {
  return `Bạn là biên tập viên nội dung cho một nền tảng bán vé concert. HỒ SƠ/PRESS KIT dưới đây chứa thông tin về CONCERT và về MỘT HOẶC NHIỀU NGHỆ SĨ tham gia. Dựa CHỈ trên hồ sơ, viết bằng tiếng Việt:

1. "concert_bio": GIỚI THIỆU CONCERT cho tab "Thông tin" — chương trình có gì, chủ đề/không khí đêm diễn, điểm nhấn của sự kiện. Tối đa 250 từ. Nếu hồ sơ không có thông tin về concert thì trả chuỗi rỗng "".
2. "artists": DANH SÁCH NGHỆ SĨ — mỗi nghệ sĩ xuất hiện trong hồ sơ là MỘT phần tử {"name": tên nghệ sĩ/ban nhạc, "bio": giới thiệu tối đa 250 từ gồm dòng nhạc – phong cách, 1–2 thành tựu nổi bật, điểm khiến khán giả nên xem trực tiếp}.

YÊU CẦU CHUNG:
- Hồ sơ đăng ký có ${artistCount} nghệ sĩ — "artists" PHẢI có đủ ${artistCount} phần tử, độ dài các bio đồng đều nhau; KHÔNG viết dài phần đầu rồi bỏ hoặc viết sơ sài phần cuối.
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

// Parse phòng thủ: JSON chuẩn → JSON lồng trong text → format cũ {artist_bio}.
// Content trông giống JSON nhưng parse fail = output hỏng (thường bị cắt) → ném lỗi
// để BullMQ retry, KHÔNG lưu chuỗi JSON dở dang làm bio. Fallback "cả output là bio
// 1 nghệ sĩ" chỉ dành cho model trả văn xuôi thuần.
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
  if (content.trimStart().startsWith("{")) {
    throw new Error("AI trả JSON không hợp lệ (có thể output bị cắt).");
  }
  return { artists: [{ name: fallbackArtistName, bio: content.trim() }], concertBio: "" };
}

// ── Tách press kit theo section nghệ sĩ ──────────────────────────────────────

export type PressKitSection = { label: string; text: string };

// So khớp không phân biệt hoa/thường và dấu tiếng Việt.
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Tách press kit theo vị trí xuất hiện tên nghệ sĩ (từ lineup, cách nhau dấu phẩy).
 * Trả [section concert (phần trước nghệ sĩ đầu), section nghệ sĩ 1, ...].
 * Ưu tiên lần xuất hiện ở ĐẦU ĐOẠN (heading); tìm được < 2 mốc → trả 1 section
 * duy nhất (caller dùng đường xử lý cũ).
 */
export function splitPressKit(raw: string, artistNames: string[]): PressKitSection[] {
  const haystack = normalizeForMatch(raw);
  const paragraphStarts = new Set<number>([0]);
  for (const match of raw.matchAll(/\n\s*\n/g)) {
    paragraphStarts.add(match.index + match[0].length);
  }

  const markers: { name: string; index: number }[] = [];
  for (const name of artistNames) {
    const needle = normalizeForMatch(name);
    if (!needle) continue;
    let headingIndex = -1;
    let firstIndex = -1;
    let from = 0;
    while (true) {
      const i = haystack.indexOf(needle, from);
      if (i < 0) break;
      if (firstIndex < 0) firstIndex = i;
      // "Đầu đoạn" = tên nằm trong 80 ký tự đầu của một paragraph.
      const isNearStart = [...paragraphStarts].some((p) => i >= p && i - p <= 80);
      if (isNearStart) {
        headingIndex = i;
        break;
      }
      from = i + needle.length;
    }
    const index = headingIndex >= 0 ? headingIndex : firstIndex;
    if (index >= 0) markers.push({ name, index });
  }

  markers.sort((a, b) => a.index - b.index);
  if (markers.length < 2) return [{ label: "TOÀN BỘ HỒ SƠ", text: raw }];

  const sections: PressKitSection[] = [];
  const introText = raw.slice(0, markers[0].index).trim();
  if (introText) sections.push({ label: "CONCERT", text: introText });
  markers.forEach((marker, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].index : raw.length;
    const text = raw.slice(marker.index, end).trim();
    if (text) sections.push({ label: `NGHỆ SĨ: ${marker.name}`, text });
  });
  return sections;
}

// ── Làm sạch + ưu tiên thông tin quan trọng + cắt theo ngân sách ─────────────
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

// `position` điều chỉnh mức ưu tiên đoạn đầu: trong 1 section của nghệ sĩ, đoạn đầu
// thường là giới thiệu chính (mặc định giữ mạnh); khi chạy trên TOÀN press kit
// (fallback không tách được section), caller truyền trọng số thấp để nghệ sĩ cuối
// không bị loại trước.
export function prioritizeText(
  raw: string,
  budget: number,
  position: { base: number; step: number } = { base: 5, step: 0.5 },
): string {
  const cleaned = raw.replace(/\0/g, " ").replace(/[ \t]+/g, " ").trim();
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20 && !NOISE.test(p)); // làm sạch: bỏ đoạn nhiễu
  if (paragraphs.length === 0) return cleaned.slice(0, budget);

  // Chấm điểm theo từ khoá quan trọng + vị trí.
  const scored = paragraphs
    .map((p, i) => {
      const keyword = PRIORITY.reduce((s, re) => s + (re.test(p) ? 1 : 0), 0);
      const positionScore = Math.max(0, position.base - i * position.step);
      return { p, i, score: keyword * 2 + positionScore };
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
async function callChatCompletion(
  prompt: string,
  maxTokens: number,
): Promise<{ content: string; model: string }> {
  const key = process.env.AI_API_KEY;
  if (!key) throw new Error("AI_API_KEY chưa được cấu hình.");

  // Output chạm trần max_tokens (finish_reason=length) → JSON bị cắt, không dùng
  // được: thử lại 1 lần với ngân sách gấp đôi (trong trần cứng) rồi mới chịu thua.
  let budget = maxTokens;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        max_tokens: budget,
        // JSON mode: buộc model trả object JSON hợp lệ (Groq/OpenAI-compatible).
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      throw new Error(`AI API error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      const nextBudget = Math.min(budget * 2, OUTPUT_HARD_CAP);
      if (attempt === 0 && nextBudget > budget) {
        console.warn("[ai-bio] output bị cắt (finish_reason=length), retry", {
          max_tokens: budget,
          retry_max_tokens: nextBudget,
        });
        budget = nextBudget;
        continue;
      }
      throw new Error(
        `AI output bị cắt do vượt max_tokens=${budget} (finish_reason=length).`,
      );
    }

    const content = choice?.message?.content?.trim();
    if (!content) throw new Error("AI trả về nội dung rỗng.");
    return { content, model: MODEL };
  }
}
