import { drive as driveApi, auth as googleAuth, type drive_v3 } from "@googleapis/drive";

// Kho CSV khách mời = Google Drive. BTC tự thêm/sửa/xoá file trong thư mục riêng
// của mỗi concert; backend chỉ đọc (service account quyền Viewer).

/** Giải mã service-account key từ env. Hỗ trợ cả base64 lẫn JSON thô. */
function decodeCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON chưa được cấu hình.");
  }
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

let client: drive_v3.Drive | null = null;

function drive(): drive_v3.Drive {
  if (!client) {
    const authClient = new googleAuth.GoogleAuth({
      credentials: decodeCredentials(),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    client = driveApi({ version: "v3", auth: authClient });
  }
  return client;
}

export type DriveCsvFile = { id: string; name: string };

/** Scheduler: liệt kê các file CSV trong thư mục Drive của một concert. */
export async function listConcertCsvFiles(folderId: string): Promise<DriveCsvFile[]> {
  const res = await drive().files.list({
    q: `'${folderId}' in parents and trashed = false and (mimeType = 'text/csv' or name contains '.csv')`,
    fields: "files(id, name)",
    pageSize: 1000,
  });

  return (res.data.files ?? [])
    .filter((file): file is drive_v3.Schema$File & { id: string; name: string } =>
      Boolean(file.id && file.name),
    )
    .map((file) => ({ id: file.id, name: file.name }));
}

/** Worker: tải nội dung text của một file CSV trên Drive theo fileId. */
export async function downloadDriveFile(fileId: string): Promise<string> {
  const res = await drive().files.get(
    { fileId, alt: "media" },
    { responseType: "text" },
  );
  return res.data as unknown as string;
}
