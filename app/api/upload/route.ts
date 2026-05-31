import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasPermission } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const { filename, contentType, projectId, videoId, userId } = await request.json();

    if (!filename || !contentType || !projectId || !userId) {
      return NextResponse.json(
        { error: "Filename, contentType, projectId, and userId are required" },
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

    // 2. Resolve or generate video ID and version number
    let activeVideoId = videoId;
    let versionNumber = 1;

    if (activeVideoId) {
      // Find the highest version number of existing versions
      const { data: versions, error: versionsError } = await supabaseAdmin
        .from("video_versions")
        .select("version_number")
        .eq("video_id", activeVideoId)
        .order("version_number", { ascending: false })
        .limit(1);

      if (versionsError) {
        console.error("Error fetching video versions:", versionsError);
        return NextResponse.json(
          { error: "Failed to resolve video versions" },
          { status: 500 }
        );
      }

      if (versions && versions.length > 0) {
        versionNumber = versions[0].version_number + 1;
      }
    } else {
      // Generate a new UUID for the video asset
      activeVideoId = crypto.randomUUID();
    }

    // 3. Generate structured storage path: videos/{projectId}/{videoId}/v{versionNumber}.mp4
    // Extract file extension or default to mp4
    const extension = filename.split(".").pop() || "mp4";
    const key = `videos/${projectId}/${activeVideoId}/v${versionNumber}.${extension}`;
    const bucketName = process.env.R2_BUCKET_NAME!;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    // Generate presigned URL valid for 1 hour (3600 seconds)
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

    return NextResponse.json({
      presignedUrl,
      key,
      videoId: activeVideoId,
      versionNumber,
    });
  } catch (error) {
    console.error("Presign URL generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
