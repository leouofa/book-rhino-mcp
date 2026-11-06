import { promises as fs } from "node:fs";
import * as path from "node:path";

export const MAX_IMAGE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (matches Api::ImageAttacher::MAX_FILE_SIZE)

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export interface PreparedLocalImage {
  filename: string;
  content_type: string;
  image_base64: string;
  byte_size: number;
}

export interface ManuscriptExportResult {
  saved_to: string;
  bytes_written: number;
}

export async function prepareLocalImageUpload(filePath: string): Promise<PreparedLocalImage> {
  const resolvedPath = path.resolve(filePath.trim());

  let stats;
  try {
    stats = await fs.stat(resolvedPath);
  } catch {
    throw new Error(`Local image file not found at path: "${filePath}" (resolved to: ${resolvedPath})`);
  }

  if (!stats.isFile()) {
    throw new Error(`Path is not a regular file: "${filePath}"`);
  }

  if (stats.size === 0) {
    throw new Error(`Image file is empty (0 bytes): "${filePath}"`);
  }

  if (stats.size > MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `Image file size (${stats.size} bytes) exceeds Book Rhino's maximum limit of 25 MB (${MAX_IMAGE_FILE_SIZE} bytes)`
    );
  }

  const filename = path.basename(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = IMAGE_EXT_TO_MIME[ext];

  if (!contentType) {
    throw new Error(
      `Unsupported image file extension "${ext || "(none)"}" for "${filename}". Supported extensions: ${Object.keys(IMAGE_EXT_TO_MIME).join(", ")}`
    );
  }

  const buffer = await fs.readFile(resolvedPath);
  const encoded = buffer.toString("base64");

  return {
    filename,
    content_type: contentType,
    image_base64: `data:${contentType};base64,${encoded}`,
    byte_size: stats.size,
  };
}

export async function writeManuscriptFile(
  outputPath: string,
  markdown: string
): Promise<ManuscriptExportResult> {
  const resolvedPath = path.resolve(outputPath.trim());
  const parentDir = path.dirname(resolvedPath);

  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(resolvedPath, markdown, "utf8");

  return {
    saved_to: resolvedPath,
    bytes_written: Buffer.byteLength(markdown, "utf8"),
  };
}
