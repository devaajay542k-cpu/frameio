import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "@/lib/r2";

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename and contentType are required" },
        { status: 400 }
      );
    }

    const key = `videos/${Date.now()}-${filename}`;
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
    });
  } catch (error) {
    console.error("Presign URL generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 }
    );
  }
}
