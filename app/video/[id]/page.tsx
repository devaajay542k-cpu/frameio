"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2, MoreHorizontal, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/video-player";
import CommentSidebar from "@/components/comment-sidebar";
import TimelineMarkers from "@/components/timeline-markers";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { MOCK_VIDEOS, MOCK_COMMENTS, CURRENT_USER } from "@/lib/mock-data";
import { Comment } from "@/types";

export default function VideoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  const video = MOCK_VIDEOS.find((v) => v.id === videoId);
  const initialComments = MOCK_COMMENTS.filter((c) => c.videoId === videoId);

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const player = useVideoPlayer();

  const handleAddComment = (content: string, timestamp: number | null) => {
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      videoId,
      userId: CURRENT_USER.id,
      userName: `${CURRENT_USER.name} (You)`,
      userAvatar: CURRENT_USER.avatarUrl,
      timestamp,
      content,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
  };

  if (!video) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">Video not found</h2>
          <p className="text-sm text-zinc-500 mb-4">The video you&apos;re looking for doesn&apos;t exist.</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-9 w-9 rounded-lg"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold text-zinc-100 truncate max-w-[300px] md:max-w-xl">
                {video.title}
              </h1>
              <p className="text-[11px] text-zinc-500">
                {new Date(video.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-9 w-9 rounded-lg"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-9 w-9 rounded-lg"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 h-9 px-3 rounded-lg text-xs font-semibold"
            >
              {sidebarOpen ? "Hide" : "Show"} Comments
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-6 lg:p-8">
            {/* Player */}
            <div className="w-full max-w-5xl">
              <VideoPlayer
                videoUrl={video.videoUrl}
                videoRef={player.videoRef}
                isPlaying={player.isPlaying}
                isMuted={player.isMuted}
                currentTime={player.currentTime}
                duration={player.duration}
                volume={player.volume}
                playbackRate={player.playbackRate}
                buffered={player.buffered}
                comments={comments}
                togglePlay={player.togglePlay}
                toggleMute={player.toggleMute}
                setVolume={player.setVolume}
                seek={player.seek}
                seekPercent={player.seekPercent}
                toggleFullscreen={player.toggleFullscreen}
                setPlaybackRate={player.setPlaybackRate}
              />

              {/* Timeline Markers (below player) */}
              <TimelineMarkers
                comments={comments}
                duration={player.duration}
                onSeek={player.seek}
              />

              {/* Video Description */}
              <div className="mt-6 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
                <h2 className="text-sm font-semibold text-zinc-200 mb-2">Description</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">{video.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Comment Sidebar */}
        {sidebarOpen && (
          <div className="w-80 xl:w-96 shrink-0 hidden md:flex">
            <CommentSidebar
              comments={comments}
              currentTime={player.currentTime}
              onSeek={player.seek}
              onAddComment={handleAddComment}
            />
          </div>
        )}
      </div>

      {/* Mobile Comment Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80">
            <CommentSidebar
              comments={comments}
              currentTime={player.currentTime}
              onSeek={player.seek}
              onAddComment={handleAddComment}
            />
          </div>
        </div>
      )}
    </div>
  );
}
