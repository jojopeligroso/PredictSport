import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GIF_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_COMPETITION_STORAGE = 200 * 1024 * 1024; // 200MB per competition
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * POST /api/chat/upload
 * Upload an image or GIF for chat.
 * FormData: file (File), competitionId (string)
 * Returns: { url, mediaType }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const competitionId = formData.get("competitionId") as string | null;

  if (!file || !competitionId) {
    return NextResponse.json(
      { error: "file and competitionId are required" },
      { status: 400 }
    );
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF files are allowed" },
      { status: 400 }
    );
  }

  const isGif = file.type === "image/gif";
  const maxSize = isGif ? MAX_GIF_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return NextResponse.json(
      {
        error: `File too large. Max ${isGif ? "3MB for GIFs" : "5MB for images"}`,
      },
      { status: 400 }
    );
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("competition_members")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this competition" },
      { status: 403 }
    );
  }

  // Check per-competition storage cap
  // List all files in the competition's folder and sum sizes
  const { data: existingFiles } = await supabase.storage
    .from("chat-media")
    .list(competitionId, { limit: 1000 });

  if (existingFiles) {
    const totalSize = existingFiles.reduce(
      (sum, f) => sum + (f.metadata?.size ?? 0),
      0
    );
    if (totalSize + file.size > MAX_COMPETITION_STORAGE) {
      return NextResponse.json(
        { error: "Competition media storage limit reached (200MB)" },
        { status: 413 }
      );
    }
  }

  // Upload to storage: competitionId/userId/timestamp-filename
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${competitionId}/${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed", details: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("chat-media").getPublicUrl(filePath);

  return NextResponse.json({
    url: publicUrl,
    mediaType: isGif ? "gif" : "image",
  });
}
