"use client";

import { useRouter } from "next/navigation";
import { useRef, useEffect } from "react";
import { MessageSquare, Clock, Play, MoreVertical, Trash2 } from "lucide-react";
import { Video } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VideoCardProps {
  video: Video;
  onEditTitle?: (video: Video) => void;
  onDeleteVideo?: (video: Video) => void;
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

export default function VideoCard({ video, onEditTitle, onDeleteVideo }: VideoCardProps) {
  const router = useRouter();
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (clickTimeoutRef.current) {
      // This is a double click!
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (onEditTitle) {
        onEditTitle(video);
      }
    } else {
      // This is a single click! Delay the navigation to determine if it is a double click
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        router.push(`/video/${video.id}`);
      }, 250);
    }
  };

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
        <div className="flex items-start justify-between gap-2">
          <h3
            onClick={handleTitleClick}
            className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-white transition-colors cursor-pointer select-none flex-1"
            title="Double click to edit title"
          >
            {video.title}
          </h3>

          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 active:bg-zinc-800 transition-colors outline-hidden focus:bg-zinc-800/60 focus:text-zinc-300 cursor-pointer"
              aria-label="Video options"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 border-zinc-800 bg-[#121214] text-zinc-100 p-1 shadow-lg">
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDeleteVideo) {
                    onDeleteVideo(video);
                  }
                }}
                className="cursor-pointer gap-2 flex items-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md px-2 py-1.5 text-sm"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Video</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
