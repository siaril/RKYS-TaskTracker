import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Executable / script types we never accept (defense for a shared tool).
const BLOCKED_EXT = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "pif", "cpl",
  "sh", "bash", "ps1", "psm1", "vbs", "vbe", "js", "mjs", "cjs",
  "jar", "app", "dll", "sys", "deb", "rpm", "apk", "dmg",
]);

// Extension -> Content-Type for the files we serve back inline / for download.
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", pdf: "application/pdf", txt: "text/plain", csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
};

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** True if a file should be rejected (blocked executable/script type). */
export function isBlockedFile(name: string, mimeType?: string): boolean {
  if (BLOCKED_EXT.has(extOf(name))) return true;
  if (mimeType && (mimeType === "application/x-msdownload" || mimeType === "application/x-sh")) {
    return true;
  }
  return false;
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[extOf(name)] ?? "application/octet-stream";
}

/** Write an uploaded file to public/uploads (the Render disk in prod) under a
 *  random name, preserving the original extension. Returns the stored name and
 *  the served URL path. */
export async function saveToDisk(file: File): Promise<{ storedName: string; url: string }> {
  const ext = extOf(file.name);
  const storedName = ext ? `${randomUUID()}.${ext}` : randomUUID();
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
  return { storedName, url: `/api/files/${storedName}` };
}
