import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const { videoVersionId, videoId, userId, content, text, timestamp } = await request.json();

    if (!userId || (!content && !text)) {
      return NextResponse.json(
        { error: "User ID and content are required" },
        { status: 400 }
      );
    }

    if (!videoVersionId && !videoId) {
      return NextResponse.json(
        { error: "Either Video Version ID or Video ID is required" },
        { status: 400 }
      );
    }

    // 1. Resolve videoVersionId, videoId, and projectId
    let activeVersionId = videoVersionId;
    let activeVideoId = videoId;
    let projectId = null;

    if (!activeVersionId) {
      // Legacy upload/call - fetch current_version_id of video
      const { data: video } = await supabaseAdmin
        .from("videos")
        .select("project_id, current_version_id")
        .eq("id", videoId)
        .maybeSingle();

      if (!video) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      activeVersionId = video.current_version_id;
      projectId = video.project_id;
    } else {
      // Fetch details from video_versions
      const { data: version } = await supabaseAdmin
        .from("video_versions")
        .select("video_id, videos!video_versions_video_id_fkey(project_id)")
        .eq("id", activeVersionId)
        .maybeSingle();

      if (!version || !version.videos) {
        return NextResponse.json({ error: "Video version not found" }, { status: 404 });
      }

      activeVideoId = version.video_id;
      projectId = Array.isArray(version.videos)
        ? (version.videos[0] as any)?.project_id
        : (version.videos as any)?.project_id;
    }

    if (!activeVersionId) {
      return NextResponse.json(
        { error: "This video does not have any active version to comment on" },
        { status: 400 }
      );
    }

    // 2. Validate COMMENT permission on the project
    if (projectId) {
      const canComment = await hasPermission(userId, projectId, "COMMENT", supabaseAdmin);
      if (!canComment) {
        return NextResponse.json(
          { error: "Unauthorized: You do not have permission to comment on this project's videos" },
          { status: 403 }
        );
      }
    }

    const commentText = content || text;

    // 3. Insert comment
    const { data: comment, error: commentError } = await supabaseAdmin
      .from("comments")
      .insert({
        video_version_id: activeVersionId,
        video_id: activeVideoId, // keep for backward compatibility
        user_id: userId,
        content: commentText,
        text: commentText,
        timestamp_seconds: timestamp !== undefined ? timestamp : null,
      })
      .select()
      .single();

    if (commentError) {
      console.error("Error creating comment:", commentError);
      return NextResponse.json({ error: commentError.message }, { status: 500 });
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Unexpected error creating comment:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");
    const userId = searchParams.get("userId");

    if (!commentId || !userId) {
      return NextResponse.json(
        { error: "Comment ID and user ID are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the comment
    const { data: comment, error: fetchError } = await supabaseAdmin
      .from("comments")
      .select("*, videos(project_id)")
      .eq("id", commentId)
      .maybeSingle();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Access control: Is it the owner of the comment?
    const isOwner = comment.user_id === userId;
    
    // Or is it a project Editor or Org Admin/Owner?
    const projectId = comment.videos?.project_id;
    let canModerate = false;
    if (projectId) {
      canModerate = await hasPermission(userId, projectId, "DELETE_VIDEO", supabaseAdmin);
    }

    if (!isOwner && !canModerate) {
      return NextResponse.json(
        { error: "Unauthorized: You can only delete your own comments or moderate if you are an editor/admin" },
        { status: 403 }
      );
    }

    // 3. Delete the comment
    const { error: deleteError } = await supabaseAdmin
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in comment deletion:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
