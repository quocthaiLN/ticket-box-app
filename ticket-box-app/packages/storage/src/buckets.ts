export const storageBuckets = {
  publicAssets: "ticketbox-public-assets",
  privateUploads: "ticketbox-private-uploads",
  imports: "ticketbox-imports"
} as const;

export type StorageBucket = (typeof storageBuckets)[keyof typeof storageBuckets];

export type StorageObjectKind = "cover-image" | "seat-map" | "press-kit" | "guest-csv" | "ticket-qr";

const objectPrefixes: Record<StorageObjectKind, string> = {
  "cover-image": "concerts",
  "seat-map": "seat-maps",
  "press-kit": "press-kits",
  "guest-csv": "guest-imports",
  "ticket-qr": "tickets"
};

export function buildObjectKey(kind: StorageObjectKind, ownerId: string, fileName: string) {
  const safeName = fileName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return `${objectPrefixes[kind]}/${ownerId}/${Date.now()}-${safeName}`;
}
