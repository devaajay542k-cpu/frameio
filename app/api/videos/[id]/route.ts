import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

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
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching video metadata from Supabase:", fetchError);
      return NextResponse.json({ error: "Failed to retrieve video metadata" }, { status: 500 });
    }

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 2. Extract key from video_url
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

    // 3. Delete object from Cloudflare R2 bucket if key is found
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

    // 4. Delete associated comments first to prevent foreign key constraint issues
    const { error: commentsDeleteError } = await supabaseAdmin
      .from("comments")
      .delete()
      .eq("video_id", id);

    if (commentsDeleteError) {
      console.error("Error deleting video comments:", commentsDeleteError);
      return NextResponse.json({ error: "Failed to delete video comments" }, { status: 500 });
    }

    // 5. Delete video record from Supabase table
    const { error: dbDeleteError } = await supabaseAdmin
      .from("videos")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

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
