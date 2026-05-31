"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2, Download, Shield, MessageSquare, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoPlayer from "@/components/video-player";
import CommentSidebar from "@/components/comment-sidebar";
import TimelineMarkers from "@/components/timeline-markers";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { Comment, Video } from "@/types";
import { supabase } from "@/lib/supabase";
import { getEffectiveRole, hasPermission, Role } from "@/lib/auth-utils";
import { toast } from "sonner";

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
  content?: string;
  timestamp_seconds: number | null;
  created_at: string;
}

export default function VideoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [effectiveRole, setEffectiveRole] = useState<Role | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Permission states
  const [canComment, setCanComment] = useState(false);

  const player = useVideoPlayer();

  useEffect(() => {
    async function loadVideoDetails() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const metadata = session.user.user_metadata || {};
        const currUser: CurrentUser = {
          id: session.user.id,
          name: metadata.full_name || metadata.name || session.user.email?.split("@")[0] || "User",
          email: session.user.email || "",
          avatarUrl: metadata.avatar_url || "",
        };
        setCurrentUser(currUser);

        // 1. Fetch from Supabase
        const { data, error } = await supabase
          .from("videos")
          .select("*")
          .eq("id", videoId)
          .maybeSingle();

        if (error) {
          console.warn("Could not fetch video from Supabase:", error.message);
          setVideo(null);
          setLoading(false);
          return;
        }

        if (!data) {
          setVideo(null);
          setLoading(false);
          return;
        }

        // 2. Access Control Check
        const projId = data.project_id;
        if (!projId) {
          // Legacy video with no project, allow viewing for testing
          setEffectiveRole("editor");
          setCanComment(true);
        } else {
          const role = await getEffectiveRole(session.user.id, projId);
          setEffectiveRole(role);

          if (!role) {
            // Access Denied: User has no role in the project
            setLoading(false);
            return;
          }

          const commentPerm = await hasPermission(session.user.id, projId, "COMMENT");
          setCanComment(commentPerm);
        }

        // Set video object
        setVideo({
          id: data.id,
          title: data.title,
          description: data.description || "",
          thumbnailUrl: data.thumbnail_url || "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=640",
          videoUrl: data.video_url || "",
          duration: data.duration_seconds || 0,
          createdAt: data.created_at || new Date().toISOString(),
          commentsCount: 0,
        });

        // 3. Fetch comments for this video
        const { data: commentsData, error: commentsError } = await supabase
          .from("comments")
          .select("*")
          .eq("video_id", videoId);

        if (commentsError) {
          console.warn("Could not fetch comments:", commentsError.message);
        } else if (commentsData) {
          const mappedComments: Comment[] = (commentsData as unknown as DatabaseComment[]).map((item) => {
            const isMe = item.user_id === session.user.id;
            let userName = `User (${item.user_id.slice(0, 5)})`;
            let userAvatar = "";

            // Map user details
            if (item.user_id === "a1111111-1111-1111-1111-111111111111") {
              userName = "Alice";
              userAvatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256";
            } else if (item.user_id === "b2222222-2222-2222-2222-222222222222") {
              userName = "Bob";
              userAvatar = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=256";
            } else if (item.user_id === "c3333333-3333-3333-3333-333333333333") {
              userName = "John";
              userAvatar = "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256";
            }

            if (isMe) {
              userName = `${userName} (You)`;
            }

            return {
              id: item.id,
              videoId: item.video_id,
              userId: item.user_id,
              userName,
              userAvatar,
              timestamp: item.timestamp_seconds,
              content: item.content || item.text || "",
              createdAt: item.created_at,
            };
          });
          setComments(mappedComments);
        }

      } catch (err) {
        console.error("Failed to load video review:", err);
      } finally {
        setLoading(false);
      }
    }

    loadVideoDetails();
  }, [videoId, router]);

  const handleAddComment = async (content: string, useTimestamp: boolean) => {
    if (!currentUser || !video) return;
    const timestamp = useTimestamp && player.videoRef.current
      ? player.videoRef.current.currentTime
      : null;

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          content,
          timestamp,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add comment");
      }

      const data = await response.json();

      if (data) {
        const newComment: Comment = {
          id: data.id,
          videoId: data.video_id,
          userId: currentUser.id,
          userName: `${currentUser.name} (You)`,
          userAvatar: currentUser.avatarUrl,
          timestamp: data.timestamp_seconds,
          content: data.content || data.text,
          createdAt: data.created_at,
        };
        setComments((prev) => [...prev, newComment]);
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const handleEditComment = async (commentId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .update({
          content: newText,
          text: newText // keep compatibility
        })
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
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/comments?commentId=${commentId}&userId=${currentUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete comment");
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

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

  if (!video || !effectiveRole) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center p-6 border border-zinc-800 bg-zinc-950 rounded-2xl max-w-sm">
          <Shield className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-200 mb-2">Access Denied</h2>
          <p className="text-sm text-zinc-500 mb-6">
            You do not have permission to review this video, or it does not exist.
          </p>
          <Button onClick={() => router.push("/orgs")} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 w-full">
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
              onClick={() => {
                if (video.project_id) {
                  router.push(`/projects/${video.project_id}`);
                } else {
                  router.push("/");
                }
              }}
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
                <p className="text-xs text-zinc-400 leading-relaxed">{video.description || "No description provided."}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Comment Sidebar */}
        {sidebarOpen && (
          <div className="w-80 xl:w-96 shrink-0 hidden md:flex">
            {canComment ? (
              <CommentSidebar
                comments={comments}
                currentTime={player.currentTime}
                currentUserId={currentUser?.id}
                onSeek={player.seek}
                onAddComment={handleAddComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
              />
            ) : (
              <div className="flex flex-col h-full bg-[#0c0c0e] border-l border-zinc-800/80 p-6 items-center justify-center text-center">
                <MessageSquare className="h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-400 font-bold">Comments Read-only</p>
                <p className="text-[11px] text-zinc-500 mt-1">Your project role does not allow leaving comments.</p>
              </div>
            )}
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
            {canComment ? (
              <CommentSidebar
                comments={comments}
                currentTime={player.currentTime}
                currentUserId={currentUser?.id}
                onSeek={player.seek}
                onAddComment={handleAddComment}
                onEditComment={handleEditComment}
                onDeleteComment={handleDeleteComment}
              />
            ) : (
              <div className="flex flex-col h-full bg-[#0c0c0e] border-l border-zinc-800/80 p-6 items-center justify-center text-center">
                <MessageSquare className="h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-400 font-bold">Comments Read-only</p>
                <p className="text-[11px] text-zinc-500 mt-1">Your project role does not allow leaving comments.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
