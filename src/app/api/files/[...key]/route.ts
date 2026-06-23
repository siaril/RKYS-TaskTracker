import { GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { s3, isS3Configured, S3_BUCKET, UPLOAD_PREFIX } from "@/lib/s3";

// Streams an uploaded image back from S3. Auth-gated: only signed-in (allowlisted)
// users can fetch attachments, and only keys under the uploads/ prefix.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isS3Configured || !s3) {
    return new Response("Not configured", { status: 404 });
  }

  const { key } = await params;
  const Key = key.join("/");
  if (!Key.startsWith(UPLOAD_PREFIX) || Key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    if (!obj.Body) return new Response("Not found", { status: 404 });
    const bytes = await obj.Body.transformToByteArray();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": obj.ContentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
