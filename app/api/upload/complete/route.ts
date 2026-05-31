import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const {
      projectId,
      videoId,
      versionNumber,
      key,
      title,
      description,
      changeNotes,
      userId,
      duration,
      fileSize,
    } = await request.json();

    if (!projectId || !videoId || !versionNumber || !key || !userId) {
      return NextResponse.json(
        { error: "projectId, videoId, versionNumber, key, and userId are required" },
        { status: 400 }
      );
    }

    // 1. Verify that the user has the UPLOAD_VIDEO permission in the project
    const canUpload = await hasPermission(userId, projectId, "UPLOAD_VIDEO", supabaseAdmin);
    if (!canUpload) {
      return NextResponse.json(
        { error: "Unauthorized: You do not have permission to upload videos to this project" },
        { status: 403 }
      );
    }

    // 2. Perform atomic database updates
    if (versionNumber === 1) {
      // Create new video asset
      const { error: videoError } = await supabaseAdmin
        .from("videos")
        .insert({
          id: videoId,
          project_id: projectId,
          title: title || "Untitled Video",
          description: description || "",
          created_by: userId,
          status: "ready", // backwards compatibility
        });

      if (videoError) {
        console.error("Error creating video record:", videoError);
        return NextResponse.json(
          { error: `Failed to create video record: ${videoError.message}` },
          { status: 500 }
        );
      }
    }

    // Create the video version record
    const { data: versionData, error: versionError } = await supabaseAdmin
      .from("video_versions")
      .insert({
        video_id: videoId,
        version_number: versionNumber,
        storage_path: key,
        thumbnail_url: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=640",
        duration: duration || 0,
        file_size: fileSize || 0,
        uploaded_by: userId,
        change_notes: changeNotes || (versionNumber === 1 ? "Initial upload" : `Version ${versionNumber}`),
        status: "Draft",
      })
      .select()
      .single();

    if (versionError) {
      console.error("Error creating video version record:", versionError);
      
      // Clean up the video asset if version 1 creation failed
      if (versionNumber === 1) {
        await supabaseAdmin.from("videos").delete().eq("id", videoId);
      }

      return NextResponse.json(
        { error: `Failed to create video version: ${versionError.message}` },
        { status: 500 }
      );
    }

    // Update the video asset with the current version ID
    const { error: updateError } = await supabaseAdmin
      .from("videos")
      .update({
        current_version_id: versionData.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoId);

    if (updateError) {
      console.error("Error updating video current version:", updateError);
      return NextResponse.json(
        { error: `Failed to update video current version: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      videoId,
      version: versionData,
    });
  } catch (error) {
    console.error("Unexpected error in upload complete handler:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
