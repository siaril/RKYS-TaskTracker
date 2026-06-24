import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess, type SessionUser } from "@/lib/access";

// Streams a task attachment off disk, gated by per-project access (only users
// with access to the attachment's project may download it). Sends the original
// filename + stored mime type as a download.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: { select: { projectId: true } } },
  });
  if (!attachment) return new Response("Not found", { status: 404 });

  const access = await getProjectAccess(attachment.task.projectId, session.user as SessionUser);
  if (!access) return new Response("Not found", { status: 404 });

  try {
    const buffer = await readFile(
      path.join(process.cwd(), "public", "uploads", attachment.storedName),
    );
    const safe = attachment.filename.replace(/["\\\r\n]/g, "_");
    return new Response(buffer, {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
