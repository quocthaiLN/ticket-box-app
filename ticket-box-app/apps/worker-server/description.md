# Worker Server

## Role

Runs BullMQ workers and lightweight local schedulers for background jobs.

## Workers

| Worker | Queue | Mô tả |
|--------|-------|--------|
| `notification.worker` | `notifications` | Gửi email/push/SMS mock theo channel; cập nhật DB `SENT`/`FAILED`; retry 3 lần exponential backoff. |
| `expire-holds.worker` | `expire-holds` | Scan order `HELD` hết TTL và release inventory. |
| `ai-bio.worker` | `ai-bio` | Generate artist bio từ press kit qua AI adapter. |
| `guest-import.worker` | `guest-import` | Parse CSV guest list, validate từng dòng, upsert. |

## Schedulers

| Scheduler | Interval | Mô tả |
|-----------|----------|--------|
| `reminder.scheduler` | 15 phút | Query concert sắp diễn ra trong 24h; enqueue notification EMAIL cho ticket holder ISSUED chưa nhận reminder. Idempotent: skip nếu đã có notification cùng (ticket, concert, type). |
| expire-holds (inline) | `EXPIRE_HOLDS_INTERVAL_MS` | Đưa job vào queue `expire-holds` theo chu kỳ. |

## Env

| Variable | Default | Mô tả |
|----------|---------|--------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `EXPIRE_HOLDS_INTERVAL_MS` | `60000` | Tần suất job expire-holds |
| `EXPIRE_HOLDS_BATCH_SIZE` | `50` | Số order xử lý mỗi batch |
| `EXPIRE_HOLDS_DRY_RUN` | `false` | Scan without release (debug) |

## Rules To Keep

- Worker phải handle lỗi từng item độc lập — lỗi một order/ticket không block worker.
- Notification worker: lỗi tạm thời → re-throw để BullMQ retry; lỗi cuối cùng (attempt >= MAX) → set `FAILED`.
- Reminder scheduler: kiểm tra `PENDING` notifications đã tồn tại trước khi tạo mới.
- Graceful shutdown: close workers → close queues → close Redis.
- `unhandledRejection` không exit process — lỗi cô lập, các worker khác vẫn chạy.
