"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/video-player";
import CommentSidebar from "@/components/comment-sidebar";
import TimelineMarkers from "@/components/timeline-markers";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { MOCK_VIDEOS, MOCK_COMMENTS } from "@/lib/mock-data";
import { Comment, Video } from "@/types";
import { supabase } from "@/lib/supabase";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface DatabaseComment {
  id: string;
  video_id: string;
  user_id: string;
  text: string;
  timestamp_seconds: number | null;
  created_at: string;
}

export default function VideoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const player = useVideoPlayer();

  useEffect(() => {
    async function loadVideo() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const metadata = session.user.user_metadata || {};
        setCurrentUser({
          id: session.user.id,
          name: metadata.full_name || metadata.name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatarUrl: metadata.avatar_url || "",
        });

        setAuthLoading(false);

        // Try searching in MOCK_VIDEOS first
        const mockVideo = MOCK_VIDEOS.find((v) => v.id === videoId);
        if (mockVideo) {
          setVideo(mockVideo);
          const initialComments = MOCK_COMMENTS.filter((c) => c.videoId === videoId);
          setComments(initialComments);
          setLoading(false);
          return;
        }

        // Fetch from Supabase
        const { data, error } = await supabase
          .from("videos")
          .select("*")
          .eq("id", videoId)
          .maybeSingle();

        if (error) {
          console.warn("Could not fetch video from Supabase:", error.message);
        } else if (data) {
          setVideo({
            id: data.id,
            title: data.title,
            description: data.description || "",
            thumbnailUrl: data.thumbnail_url || data.thumbnailUrl || "",
            videoUrl: data.video_url || data.videoUrl || "",
            duration: data.duration || 0,
            createdAt: data.created_at || data.createdAt || new Date().toISOString(),
            commentsCount: data.comments_count || data.commentsCount || 0,
          });

          // Fetch comments for this video from Supabase
          const { data: commentsData, error: commentsError } = await supabase
            .from("comments")
            .select("*")
            .eq("video_id", videoId);

          if (commentsError) {
            console.warn("Could not fetch comments from Supabase:", commentsError.message);
          } else if (commentsData) {
            const mappedComments: Comment[] = (commentsData as unknown as DatabaseComment[]).map((item) => {
              const isMe = item.user_id === session.user.id;
              const userName = isMe
                ? `${metadata.full_name || metadata.name || session.user.email?.split("@")[0] || "User"} (You)`
                : `User (${item.user_id.slice(0, 5)})`;
              const userAvatar = isMe ? (metadata.avatar_url || "") : "";
              return {
                id: item.id,
                videoId: item.video_id,
                userId: item.user_id,
                userName,
                userAvatar,
                timestamp: item.timestamp_seconds,
                content: item.text,
                createdAt: item.created_at,
              };
            });
            setComments(mappedComments);
          }
        }
      } catch (err) {
        console.error("Failed to load video:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    loadVideo();
  }, [videoId, router]);

  const handleAddComment = async (content: string, useTimestamp: boolean) => {
    if (!currentUser) return;
    const timestamp = useTimestamp && player.videoRef.current
      ? player.videoRef.current.currentTime
      : null;

    console.log("INSERTING COMMENT", {
      video_id: videoId,
      user_id: currentUser.id,
      text: content,
      timestamp_seconds: timestamp,
    });

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          video_id: videoId,
          user_id: currentUser.id,
          text: content,
          timestamp_seconds: timestamp,
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting comment:", error.message);
        return;
      }

      if (data) {
        const newComment: Comment = {
          id: data.id,
          videoId: data.video_id,
          userId: currentUser.id,
          userName: `${currentUser.name} (You)`,
          userAvatar: currentUser.avatarUrl,
          timestamp: data.timestamp_seconds,
          content: data.text,
          createdAt: data.created_at,
        };
        setComments((prev) => [...prev, newComment]);
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleEditComment = async (commentId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .update({ text: newText })
        .eq("id", commentId);

      if (error) {
        console.error("Error editing comment:", error.message);
        return;
      }

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: newText } : c))
      );
    } catch (err) {
      console.error("Failed to edit comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) {
        console.error("Error deleting comment:", error.message);
        return;
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-zinc-400">Loading video details...</p>
        </div>
      </div>
    );
  }

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
              currentUserId={currentUser?.id}
              onSeek={player.seek}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
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
              currentUserId={currentUser?.id}
              onSeek={player.seek}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
            />
          </div>
        </div>
      )}
    </div>
  );
}
