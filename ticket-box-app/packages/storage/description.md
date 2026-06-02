# Storage Package

## Vai trò

`storage` là package định nghĩa contract làm việc với MinIO/CDN/S3-compatible object storage. Module nghiệp vụ không nên tự ghép bucket, object key hoặc URL; nên đi qua package này để thống nhất cách lưu ảnh, seat map, press kit, CSV và QR asset.

## Hiện trạng Sprint 1

- Bucket convention nằm ở `src/buckets.ts`.
- Object key convention nằm ở `buildObjectKey`.
- Storage client interface nằm ở `src/client.ts`.
- `createUploadUrl` và `createDownloadUrl` hiện là stub URL local để giữ contract; chưa kết nối MinIO SDK thật.
- Export tập trung ở `src/index.ts`.

## Cách đọc folder này

1. Đọc `package.json` để biết package build ra sao.
2. Đọc `src/buckets.ts` để hiểu bucket name và object key.
3. Đọc `src/client.ts` để hiểu interface upload/download/public URL.
4. Đọc `src/index.ts` để xem package export gì cho app khác dùng.

## Quy ước cần giữ

- Không hard-code bucket/key trong module nghiệp vụ.
- Object key nên có prefix theo loại file và owner/resource id.
- Public asset dùng public URL; file riêng tư nên dùng presigned URL có TTL.
- Không đưa credential MinIO/S3 xuống frontend.
- Khi thay đổi bucket convention phải cập nhật Catalog/admin/upload flow liên quan.

## Ghi chú học thêm

- MinIO JavaScript SDK: https://docs.min.io/aistor/developers/sdk/javascript/
- MinIO JavaScript API Reference: https://docs.min.io/aistor/developers/sdk/javascript/api/
- AWS S3 object key naming: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html
- AWS S3 presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html

## Cần cập nhật ở các sprint sau

- Khi tích hợp MinIO SDK thật, ghi env vars cần có và cách generate presigned URL.
- Khi Catalog dùng cover image/seat map, ghi object key convention cụ thể.
- Khi guest CSV/press kit upload được implement, ghi bucket và TTL download/upload.
