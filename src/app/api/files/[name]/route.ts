import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";

// Maps file extension -> Content-Type for the images we accept on upload.
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

// Streams an uploaded image back from disk (public/uploads — a persistent Render
// Disk in production). We serve through this route handler instead of relying on
// Next's static file server because that only serves files present in public/ at
// BUILD time; images uploaded at runtime aren't served statically (they 404 on
// `next start`), so they must be streamed through here. Auth-gated so only
// signed-in (allowlisted) users can fetch attachments.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name } = await params;
  // Only allow plain filenames (<uuid>.<ext>) — no slashes, no path traversal.
  if (!/^[A-Za-z0-9_-]+\.(png|jpe?g|gif|webp)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  const ext = name.split(".").pop()!.toLowerCase();

  try {
    const buffer = await readFile(
      path.join(process.cwd(), "public", "uploads", name),
    );
    return new Response(buffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
