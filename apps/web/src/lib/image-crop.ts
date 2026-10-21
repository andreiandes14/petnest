export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export type CropArea = { x: number; y: number; width: number; height: number };

export function validateCropFile(file: Pick<File, "type" | "size">) {
  if (!IMAGE_TYPES.has(file.type)) return "Choose a JPG, PNG, WebP or GIF image.";
  if (file.size <= 0) return "This image is empty. Choose another image.";
  if (file.size > MAX_IMAGE_BYTES) return "Choose an image smaller than 6 MB.";
  return null;
}

export function cropGeometry(area: CropArea, width: number, height: number, maxSize: number) {
  if (![area.x, area.y, area.width, area.height, width, height, maxSize].every(Number.isFinite) ||
      width <= 0 || height <= 0 || maxSize < 1 || area.x < 0 || area.y < 0 || area.width < 1 || area.height < 1 ||
      area.x + area.width > width + 1 || area.y + area.height > height + 1) {
    throw new Error("Choose a valid crop area.");
  }
  const scale = Math.min(1, maxSize / Math.max(area.width, area.height));
  return { width: Math.max(1, Math.round(area.width * scale)), height: Math.max(1, Math.round(area.height * scale)) };
}

/** Draw only the selected source rectangle; never return the original file. */
export async function croppedImage(source: string, area: CropArea, maxSize = 1200): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("This image could not be opened. Choose another image."));
    image.src = source;
  });
  const size = cropGeometry(area, image.naturalWidth, image.naturalHeight, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image cropping is unavailable in this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size.width, size.height);
  const result = canvas.toDataURL("image/webp", 0.9);
  if (!result.startsWith("data:image/") || result.length > 8_000_000) throw new Error("The cropped image is too large. Try a smaller crop.");
  return result;
}
