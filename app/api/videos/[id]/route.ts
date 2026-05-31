import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission, getEffectiveRole } from "@/lib/auth-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!id || !userId) {
      return NextResponse.json(
        { error: "Video ID and User ID are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the video asset
    const { data: video, error: videoError } = await supabaseAdmin
      .from("videos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (videoError) {
      console.error("Error fetching video:", videoError);
      return NextResponse.json({ error: "Failed to retrieve video metadata" }, { status: 500 });
    }

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // 2. Resolve requester's role and check view permission
    const role = await getEffectiveRole(userId, video.project_id || video.id, supabaseAdmin);
    
    // If the video is part of a project, make sure user has access
    if (video.project_id && !role) {
      return NextResponse.json({ error: "Unauthorized: Access denied" }, { status: 403 });
    }

    // 3. Fetch all versions of the video
    const { data: versions, error: versionsError } = await supabaseAdmin
      .from("video_versions")
      .select("*")
      .eq("video_id", id)
      .order("version_number", { ascending: false });

    if (versionsError) {
      console.error("Error fetching video versions:", versionsError);
      return NextResponse.json({ error: "Failed to retrieve video versions" }, { status: 500 });
    }

    // 4. Enrich versions with uploader details
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const enrichedVersions = (versions || []).map((v) => {
      const uploaderUser = authUsers?.users?.find((u) => u.id === v.uploaded_by);
      const email = uploaderUser?.email || "unknown@studio.com";
      const name = uploaderUser?.user_metadata?.full_name || email.split("@")[0] || "Unknown User";
      const avatar = uploaderUser?.user_metadata?.avatar_url || "";
      
      return {
        ...v,
        uploader: {
          id: v.uploaded_by,
          name,
          email,
          avatar,
        },
      };
    });

    return NextResponse.json({
      video,
      versions: enrichedVersions,
      role: role || "viewer", // default to viewer if no explicit project role (e.g. legacy videos)
    });
  } catch (error) {
    console.error("Unexpected error in video details GET handler:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

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

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // 1. Fetch the video details to perform permission checks
    const { data: video, error: fetchError } = await supabaseAdmin
      .from("videos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !video) {
      console.error("Error fetching video details:", fetchError);
      return NextResponse.json({ error: "Video not found or failed to fetch metadata" }, { status: 404 });
    }

    // 2. Perform permission check: DELETE_VIDEO permission or uploader check
    const canDelete = await hasPermission(userId, video.project_id || video.id, "DELETE_VIDEO", supabaseAdmin);
    const isUploader = video.created_by === userId || video.user_id === userId;

    if (!canDelete && !isUploader) {
      return NextResponse.json({ error: "Unauthorized: You do not have permission to delete this video" }, { status: 403 });
    }

    // 3. Fetch all versions of the video to delete their files from R2
    const { data: versions } = await supabaseAdmin
      .from("video_versions")
      .select("storage_path")
      .eq("video_id", id);

    const bucketName = process.env.R2_BUCKET_NAME!;

    if (versions && versions.length > 0) {
      for (const version of versions) {
        const key = version.storage_path;
        if (key) {
          try {
            const command = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: key,
            });
            await r2.send(command);
            console.log(`Successfully deleted R2 object with key: ${key}`);
          } catch (r2Error) {
            console.error(`Failed to delete object from Cloudflare R2 (${key}):`, r2Error);
          }
        }
      }
    }

    // 4. Delete video record from Supabase table (cascades to video_versions and comments)
    const { error: dbDeleteError } = await supabaseAdmin
      .from("videos")
      .delete()
      .eq("id", id);

    if (dbDeleteError) {
      console.error("Error deleting video from Supabase:", dbDeleteError);
      return NextResponse.json({ error: "Failed to delete video metadata" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Video and all versions deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in delete API handler:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
