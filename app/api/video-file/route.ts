import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 });
    }

    const rangeHeader = request.headers.get("range");

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Range: rangeHeader || undefined,
    });

    const response = await r2.send(command);

    if (!response.Body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Transform S3 body stream to web readable stream
    const stream = response.Body.transformToWebStream();

    const isPartial = !!response.ContentRange;
    const status = isPartial ? 206 : 200;

    const headers: Record<string, string> = {
      "Content-Type": response.ContentType || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    if (response.ContentLength) {
      headers["Content-Length"] = response.ContentLength.toString();
    }
    if (response.ContentRange) {
      headers["Content-Range"] = response.ContentRange;
    }

    return new Response(stream, {
      status,
      headers,
    });
  } catch (error) {
    console.error("Error retrieving file from R2:", error);
    return NextResponse.json({ error: "Failed to retrieve file" }, { status: 500 });
  }
}
