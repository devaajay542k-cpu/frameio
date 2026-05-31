import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const userId = body?.user_id;

    console.log("DELETE ROUTE HIT", id, userId);

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 1. Fetch the video details to get the video_url (which contains the R2 key)
    const { data: video, error: fetchError } = await supabaseAdmin
      .from("videos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching video metadata from Supabase:", fetchError);
      return NextResponse.json({ error: "Failed to retrieve video metadata" }, { status: 500 });
    }

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 2. Perform permission check: inherited from project
    const canDelete = await hasPermission(userId, video.project_id, "DELETE_VIDEO", supabaseAdmin);
    
    // Fallback: If it has no project (e.g. legacy/mock videos), check if user is uploader
    const isUploader = video.user_id === userId;
    
    if (!canDelete && !isUploader) {
      return NextResponse.json({ error: "Unauthorized: You do not have permission to delete this video" }, { status: 403 });
    }

    // 3. Extract key from video_url
    const videoUrl = video.video_url || video.videoUrl;
    let key: string | null = null;
    console.log(videoUrl);
    if (videoUrl) {
      try {
        const url = new URL(videoUrl, "http://localhost");
        key = url.searchParams.get("key");
      } catch (err) {
        console.error("Error parsing video URL:", err);
      }
    }

    // 4. Delete object from Cloudflare R2 bucket if key is found
    if (key) {
      try {
        const bucketName = process.env.R2_BUCKET_NAME!;
        const command = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        });
        await r2.send(command);
        console.log(`Successfully deleted R2 object with key: ${key}`);
      } catch (r2Error) {
        console.error("Failed to delete object from Cloudflare R2:", r2Error);
        // Continue database deletion even if R2 file deletion fails (to prevent dead database records)
      }
    } else {
      console.warn(`No R2 key found in video_url for video ID: ${id}`);
    }

    // 5. Delete associated comments first to prevent foreign key constraint issues
    const { error: commentsDeleteError } = await supabaseAdmin
      .from("comments")
      .delete()
      .eq("video_id", id);

    if (commentsDeleteError) {
      console.error("Error deleting video comments:", commentsDeleteError);
      return NextResponse.json({ error: "Failed to delete video comments" }, { status: 500 });
    }

    // 6. Delete video record from Supabase table
    const { error: dbDeleteError } = await supabaseAdmin
      .from("videos")
      .delete()
      .eq("id", id);

    if (dbDeleteError) {
      console.error("Error deleting video from Supabase:", dbDeleteError);
      return NextResponse.json({ error: "Failed to delete video metadata" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Video and associated comments deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in delete API handler:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
