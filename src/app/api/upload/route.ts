import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { MAX_UPLOAD_BYTES, isBlockedFile, isImageType, saveToDisk } from "@/lib/uploads";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (isBlockedFile(file.name, file.type)) {
    return NextResponse.json({ error: "That file type isn't allowed." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
  }

  const { url, storedName } = await saveToDisk(file);
  return NextResponse.json({
    url,
    storedName,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    isImage: isImageType(file.type),
  });
}
