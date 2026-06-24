import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { contentTypeFor } from "@/lib/uploads";

// Streams an uploaded file back from disk (public/uploads — a persistent Render
// Disk in production). We serve through this route handler instead of relying on
// Next's static file server because that only serves files present in public/ at
// BUILD time; files uploaded at runtime aren't served statically (they 404 on
// `next start`). Auth-gated so only signed-in (allowlisted) users can fetch.
// Used for inline rich-text images and comment file links. (Structured task
// attachments are served with per-project access control via /api/attachments.)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  // Only allow plain stored filenames (<uuid>.<ext>) — no slashes, no traversal.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = contentTypeFor(name);
  const isImage = contentType.startsWith("image/");
  // Non-images download with their original name (?name=) when provided.
  const original = new URL(req.url).searchParams.get("name");

  try {
    const buffer = await readFile(path.join(process.cwd(), "public", "uploads", name));
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=86400",
    };
    if (!isImage) {
      const safe = (original ?? name).replace(/["\\\r\n]/g, "_");
      headers["Content-Disposition"] = `attachment; filename="${safe}"`;
    }
    return new Response(buffer, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
