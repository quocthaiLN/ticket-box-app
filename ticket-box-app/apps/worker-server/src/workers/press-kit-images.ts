import { downloadPressKit, uploadArtistImage } from "@ticketbox/storage";

/**
 * Tách ảnh nhúng trong PDF press kit và đưa lên Supabase (bucket ảnh public).
 *
 * Quy ước P1 mở rộng (multi-artist, chốt 2026-07-05): ảnh ở TRANG 1 là ảnh
 * concert/cover; từ TRANG 2 mỗi nghệ sĩ kèm 1 ảnh chân dung theo ĐÚNG THỨ TỰ
 * xuất hiện trong hồ sơ — ảnh thứ i (sắp theo trang, rồi thứ tự trong trang)
 * gán cho nghệ sĩ thứ i. Logo/icon nhỏ bị loại qua imageThreshold.
 */
export type PressKitImages = {
  coverImageUrl?: string;
  // Ảnh nghệ sĩ theo thứ tự xuất hiện (trang 2+).
  artistImageUrls: string[];
};

// Bỏ ảnh nhỏ hơn 200px (logo, icon, chữ ký) ngay từ bước trích.
const MIN_IMAGE_DIMENSION = 200;
// Chặn press kit bất thường: tối đa 8 ảnh nghệ sĩ.
const MAX_ARTIST_IMAGES = 8;

type ExtractedImage = {
  pageNumber: number;
  indexInPage: number;
  width: number;
  height: number;
  data: Uint8Array;
};

export async function extractAndUploadPressKitImages(
  sourceFileUrl: string,
  ownerKey: string,
): Promise<PressKitImages> {
  const buffer = /^https?:\/\//i.test(sourceFileUrl.trim())
    ? Buffer.from(await (await fetch(sourceFileUrl.trim())).arrayBuffer())
    : await downloadPressKit(sourceFileUrl.trim());

  const images = await extractImages(buffer);
  if (images.length === 0) return { artistImageUrls: [] };

  const cover = pickLargest(images.filter((image) => image.pageNumber === 1));
  const artistImages = images
    .filter((image) => image.pageNumber > 1)
    .sort((a, b) => a.pageNumber - b.pageNumber || a.indexInPage - b.indexInPage)
    .slice(0, MAX_ARTIST_IMAGES);

  const result: PressKitImages = { artistImageUrls: [] };
  if (cover) {
    result.coverImageUrl = await upload(cover, `press-kit/${ownerKey}/cover.png`);
  }
  for (const [index, image] of artistImages.entries()) {
    result.artistImageUrls.push(
      await upload(image, `press-kit/${ownerKey}/artist-${index + 1}.png`),
    );
  }
  return result;
}

async function extractImages(buffer: Buffer): Promise<ExtractedImage[]> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getImage({
      imageBuffer: true,
      imageThreshold: MIN_IMAGE_DIMENSION,
    });

    return result.pages.flatMap((page) =>
      page.images
        .filter((image) => image.data && image.data.length > 0)
        .map((image, indexInPage) => ({
          pageNumber: page.pageNumber,
          indexInPage,
          width: image.width,
          height: image.height,
          data: image.data,
        })),
    );
  } finally {
    await parser.destroy();
  }
}

function pickLargest(images: ExtractedImage[]): ExtractedImage | undefined {
  return images.reduce<ExtractedImage | undefined>(
    (best, image) =>
      !best || image.width * image.height > best.width * best.height ? image : best,
    undefined,
  );
}

async function upload(image: ExtractedImage, objectKey: string): Promise<string> {
  // getImage với imageBuffer trả PNG (canvas.toBuffer) — upload thẳng.
  const { url } = await uploadArtistImage(objectKey, Buffer.from(image.data), "image/png");
  return url;
}
