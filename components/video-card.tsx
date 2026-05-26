"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, Clock, Play } from "lucide-react";
import { Video } from "@/types";

interface VideoCardProps {
  video: Video;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function VideoCard({ video }: VideoCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/video/${video.id}`)}
      className="group relative flex flex-col rounded-2xl border border-zinc-800/80 bg-[#121214] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700/60 hover:shadow-2xl hover:shadow-black/40"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-zinc-900">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />

        {/* Play Button (shows on hover) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-xl">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-zinc-100 text-xs font-mono font-semibold px-2 py-0.5 rounded-md border border-white/10">
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {video.title}
        </h3>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(video.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{video.commentsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
