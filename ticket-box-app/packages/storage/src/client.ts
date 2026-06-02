import { storageBuckets, type StorageBucket } from "./buckets.js";

export type StorageUrlOptions = {
  bucket: StorageBucket;
  objectKey: string;
  expiresInSeconds?: number;
  contentType?: string;
};

export type StorageClient = {
  getPublicUrl(bucket: StorageBucket, objectKey: string): string;
  createUploadUrl(options: StorageUrlOptions): Promise<string>;
  createDownloadUrl(options: StorageUrlOptions): Promise<string>;
};

export type StorageClientConfig = {
  publicBaseUrl?: string;
};

export function createStorageClient(config: StorageClientConfig = {}): StorageClient {
  const publicBaseUrl = config.publicBaseUrl ?? process.env.STORAGE_PUBLIC_BASE_URL ?? "http://localhost:9000";

  return {
    getPublicUrl(bucket, objectKey) {
      return `${publicBaseUrl.replace(/\/$/, "")}/${bucket}/${objectKey}`;
    },
    async createUploadUrl(options) {
      return createLocalStubUrl(publicBaseUrl, "upload", options);
    },
    async createDownloadUrl(options) {
      return createLocalStubUrl(publicBaseUrl, "download", options);
    }
  };
}

export const defaultStorageClient = createStorageClient();

export function getCatalogAssetUrl(objectKey: string) {
  return defaultStorageClient.getPublicUrl(storageBuckets.publicAssets, objectKey);
}

function createLocalStubUrl(baseUrl: string, action: "upload" | "download", options: StorageUrlOptions) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${options.bucket}/${options.objectKey}`);
  url.searchParams.set("action", action);
  url.searchParams.set("expires_in", String(options.expiresInSeconds ?? 900));

  if (options.contentType) {
    url.searchParams.set("content_type", options.contentType);
  }

  return url.toString();
}
