"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LegacyVideoRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  useEffect(() => {
    if (videoId) {
      router.push(`/videos/${videoId}`);
    } else {
      router.push("/");
    }
  }, [videoId, router]);

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Loading video review...</p>
      </div>
    </div>
  );
}
