# Đề xuất đổi nhà cung cấp AI (thay Gemini) — báo cáo trước khi code

Ngày 27/06/2026.

## 1. Tình huống
- **#4 đã chạy đúng**: worker gọi được AI (đã thấy request). Vấn đề mới là **hạn mức**.
- Lỗi `429 RESOURCE_EXHAUSTED`, `limit: 0` cho `generate_content_free_tier_requests` ⇒ **Google đã bỏ free tier cho project này, bắt buộc bật billing**. Retry vô ích (BullMQ đang retry 5 lần → tốn công vô ích).
- ⇒ Cần đổi sang **API AI thực sự free, không cần thẻ/billing**.

## 2. Đề xuất KIẾN TRÚC: chuẩn hoá về OpenAI-compatible (đổi provider bằng env, không sửa code)

Hiện `ai-bio.client.ts` gọi REST **riêng của Gemini**. Đề xuất refactor sang chuẩn **OpenAI Chat Completions** điều khiển qua 3 biến env:
```
AI_BASE_URL   (vd https://api.groq.com/openai/v1)
AI_API_KEY
AI_MODEL      (vd llama-3.3-70b-versatile)
```
Một code path duy nhất dùng được cho **Groq, OpenRouter, Cerebras, Mistral, Together, Ollama/LM Studio (local), và cả Gemini** (nếu sau này bật billing — Gemini cũng có endpoint OpenAI-compatible). **Đổi nhà cung cấp = đổi env, không build lại logic.** Chống lock-in, không lặp lại sự cố hôm nay.

Phần `prioritizeText` (làm sạch + ưu tiên + giới hạn token) và prompt **giữ nguyên**; chỉ thay đoạn gọi HTTP + vài hằng số. Phạm vi sửa nhỏ, gọn trong 1 file.

## 3. So sánh các API free (KHÔNG cần thẻ/billing)

| Provider | Cần thẻ? | Giới hạn free (06/2026) | Tiếng Việt | Tốc độ | Ghi chú |
|---|---|---|---|---|---|
| **Groq** ⭐ | **Không** | `llama-3.3-70b`: 30 req/phút, **~1.000 req/ngày**, ~100K token/ngày; `gpt-oss-120b`: 200K token/ngày | Khá–Tốt | **Rất nhanh** | OpenAI-compatible, không hệ thống credit, không tính tiền/token — chỉ giới hạn nhịp. **Khuyến nghị chính.** |
| **Ollama (local)** ⭐ | **Không bao giờ** | **Không giới hạn** (chạy trên máy bạn) | Tốt (`qwen2.5`) | Tuỳ máy | Free vĩnh viễn, chạy offline, không lo quota. Cần cài Ollama + đủ RAM (model 7B ~5GB). Fallback "chắc ăn" cho demo. |
| OpenRouter (model `:free`) | Không | ~20 req/phút, **50 req/ngày** (1.000/ngày nếu từng nạp ≥$10) | Tốt (DeepSeek/Qwen) | Trung bình | 26 model free (Llama 3.3, DeepSeek V3/R1, Qwen, Gemma…). Model free có thể bị gỡ bất kỳ lúc nào. |
| Cerebras | Không | Free tier rate-limited | Khá | Rất nhanh | OpenAI-compatible, Llama. (Nên kiểm chứng hạn mức hiện tại.) |
| Mistral (La Plateforme) | Không (free tier) | Rate-limited | Khá | Nhanh | `mistral-small`. |
| GitHub Models | Không (GitHub token) | Thấp (dev/test) | Khá | Trung bình | Nhiều model; hạn mức nhỏ. |

## 4. Khuyến nghị

**Chính: Groq** (`llama-3.3-70b-versatile`).
- Đúng nhu cầu: **không cần thẻ**, đăng ký bằng email/Google, có key trong vài phút; ~1.000 request/ngày — quá đủ cho luồng sinh bio (mỗi concert chỉ vài request).
- Nhanh, OpenAI-compatible → khớp kiến trúc đề xuất.
- Tiếng Việt của Llama 3.3 70B ổn cho đoạn giới thiệu 250–350 từ.

**Dự phòng:**
- **Ollama (local)** nếu muốn **không bao giờ đụng quota** / demo offline → đổi env `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=qwen2.5` (qwen tiếng Việt tốt), không cần key.
- **OpenRouter** nếu muốn thử nhiều model (DeepSeek V3 tiếng Việt rất tốt), chấp nhận 50 req/ngày.

> Nhờ kiến trúc OpenAI-compatible, có thể cấu hình **nhiều provider** và chuyển nhanh khi một bên hết hạn mức — chỉ đổi env.

## 5. Lưu ý hạn mức free (để không lại bị chặn)
- **Giảm `AI_MAX_SOURCE_CHARS`** (đang 20.000 ~6–7K token) xuống ~8.000 để mỗi request tốn ít token hơn → nhiều bio/ngày hơn (TPD của Groq là giới hạn chính). Output giữ ~800 token.
- Giữ **BullMQ backoff** cho 429 nhịp (rate-limit tạm thời) nhưng nên đọc `Retry-After`; với lỗi "quota = 0" thì coi là FAILED ngay, đừng retry 5 lần.
- Tránh test ồ ạt; cân nhắc cache theo nội dung press kit nếu cần.

## 6. Phạm vi thay đổi (nếu chốt)
- Sửa **`apps/worker-server/src/workers/ai-bio.client.ts`**: thay `callGemini` → `callOpenAICompatible` (POST `${AI_BASE_URL}/chat/completions`, `Authorization: Bearer ${AI_API_KEY}`, body `{ model, messages, max_tokens, temperature }`, đọc `choices[0].message.content`).
- Cập nhật `.env` gốc `ticket-box-app/.env`: thêm `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (bỏ phụ thuộc `GEMINI_API_KEY`).
- Không đụng worker logic, API, frontend. Ước lượng ~30–45 phút.

## 7. Cần bạn chốt
1. Dùng **Groq** (khuyến nghị) hay **Ollama local** hay **OpenRouter**?
2. Có muốn tôi làm **OpenAI-compatible đa provider** (đổi env là xong) — mặc định Groq, kèm hướng dẫn Ollama/OpenRouter — đúng không?

Chốt xong tôi sẽ refactor `ai-bio.client.ts` + cập nhật env mẫu + báo cáo cách test.

---
Sources: [Groq free tier 2026 (Grizzly Peak)](https://www.grizzlypeaksoftware.com/articles/p/groq-api-free-tier-limits-in-2026-what-you-actually-get-uwysd6mb), [Groq rate limits (GroqDocs)](https://console.groq.com/docs/rate-limits), [OpenRouter free models (CostGoat)](https://costgoat.com/pricing/openrouter-free-models), [OpenRouter rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know)
