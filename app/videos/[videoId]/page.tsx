"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Share2,
  Download,
  Shield,
  MessageSquare,
  Trash2,
  History,
  Calendar,
  User,
  Plus,
  Loader2,
  CheckCircle2,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import VideoPlayer from "@/components/video-player";
import CommentSidebar from "@/components/comment-sidebar";
import TimelineMarkers from "@/components/timeline-markers";
import UploadModal from "@/components/upload-modal";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { Comment, Video, VideoVersion } from "@/types";
import { supabase } from "@/lib/supabase";
import { Role } from "@/lib/auth-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface DatabaseComment {
  id: string;
  video_id: string;
  video_version_id: string;
  user_id: string;
  text: string;
  content?: string;
  timestamp_seconds: number | null;
  created_at: string;
}

const STATUS_OPTIONS = ["Draft", "In Review", "Changes Requested", "Approved", "Final"];

export default function VideoReviewPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;

  const [video, setVideo] = useState<Video | null>(null);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VideoVersion | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<Role | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"comments" | "versions">("comments");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Modal and action states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const player = useVideoPlayer();

  // Load Video, Versions, and Role details
  const loadVideoDetails = async (selectSpecificVersionId?: string) => {
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

      // Fetch details from backend API
      const res = await fetch(`/api/videos/${videoId}?userId=${session.user.id}`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setVideo(null);
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch video details");
      }

      const data = await res.json();
      setVideo(data.video);
      setEffectiveRole(data.role);

      const fetchedVersions: VideoVersion[] = data.versions || [];
      setVersions(fetchedVersions);

      // Select active version: specific parameter, current_version_id, or first version
      let activeVer = fetchedVersions.find((v) => v.id === selectSpecificVersionId);
      if (!activeVer) {
        activeVer = fetchedVersions.find((v) => v.id === data.video.current_version_id);
      }
      if (!activeVer && fetchedVersions.length > 0) {
        activeVer = fetchedVersions[0];
      }

      setSelectedVersion(activeVer || null);
      if (activeVer) {
        setNotesText(activeVer.change_notes || "");
      }
    } catch (err) {
      console.error("Failed to load video review:", err);
      toast.error("Failed to load video details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoId) {
      loadVideoDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, router]);

  // Load comments for the selected version
  useEffect(() => {
    async function loadVersionComments() {
      if (!selectedVersion || !currentUser) {
        setComments([]);
        return;
      }

      setCommentsLoading(true);
      try {
        const { data: commentsData, error: commentsError } = await supabase
          .from("comments")
          .select("*")
          .eq("video_version_id", selectedVersion.id)
          .order("created_at", { ascending: true });

        if (commentsError) {
          throw commentsError;
        }

        if (commentsData) {
          const mappedComments: Comment[] = (commentsData as unknown as DatabaseComment[]).map((item) => {
            const isMe = item.user_id === currentUser.id;
            let userName = `User (${item.user_id.slice(0, 5)})`;
            let userAvatar = "";

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
              videoVersionId: item.video_version_id,
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
        console.error("Error loading comments:", err);
      } finally {
        setCommentsLoading(false);
      }
    }

    loadVersionComments();
  }, [selectedVersion, currentUser]);

  // Add Comment
  const handleAddComment = async (content: string, useTimestamp: boolean) => {
    if (!currentUser || !selectedVersion || !video) return;
    const timestamp = useTimestamp && player.videoRef.current
      ? player.videoRef.current.currentTime
      : null;

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoVersionId: selectedVersion.id,
          videoId: video.id,
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
          videoVersionId: data.video_version_id,
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
          text: newText,
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

  // Status management
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedVersion || !currentUser) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch("/api/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: selectedVersion.id,
          userId: currentUser.id,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update version status");
      }

      // Update state local list
      setVersions((prev) =>
        prev.map((v) => (v.id === selectedVersion.id ? { ...v, status: newStatus as any } : v))
      );
      setSelectedVersion((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    if (!selectedVersion || !currentUser) return;
    setSavingNotes(true);
    try {
      const response = await fetch("/api/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: selectedVersion.id,
          userId: currentUser.id,
          changeNotes: notesText,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save revision notes");
      }

      setVersions((prev) =>
        prev.map((v) => (v.id === selectedVersion.id ? { ...v, change_notes: notesText } : v))
      );
      setSelectedVersion((prev) => (prev ? { ...prev, change_notes: notesText } : null));
      setEditingNotes(false);
      toast.success("Version notes updated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update notes");
    } finally {
      setSavingNotes(false);
    }
  };

  // Restore version
  const handleRestoreVersion = async (version: VideoVersion) => {
    if (!currentUser) return;
    try {
      const response = await fetch("/api/versions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          userId: currentUser.id,
          restore: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to restore version");
      }

      toast.success(`Restored Version ${version.version_number} to Current Active`);
      loadVideoDetails(version.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to restore version");
    }
  };

  // Delete version
  const handleDeleteVersion = async (version: VideoVersion) => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/versions?versionId=${version.id}&userId=${currentUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete version");
      }

      toast.success(`Deleted Version ${version.version_number}`);
      // If we deleted the currently viewed version, we reload and it will fallback to active
      loadVideoDetails(selectedVersion?.id === version.id ? undefined : selectedVersion?.id);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete version");
    }
  };

  // Download video version file
  const handleDownload = () => {
    if (!selectedVersion || !video) return;
    const extension = selectedVersion.storage_path.split(".").pop() || "mp4";
    const filename = `${video.title} - Version ${selectedVersion.version_number}.${extension}`;
    const downloadUrl = `/api/video-file?key=${encodeURIComponent(selectedVersion.storage_path)}&download=true&filename=${encodeURIComponent(filename)}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (!video || !effectiveRole || !selectedVersion) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center p-6 border border-zinc-800 bg-zinc-950 rounded-2xl max-w-sm">
          <Shield className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-200 mb-2">Access Denied</h2>
          <p className="text-sm text-zinc-500 mb-6">
            You do not have permission to review this video, or it has no upload versions.
          </p>
          <Button onClick={() => router.push("/orgs")} className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 w-full">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Construct active video file URL
  const videoFileUrl = `/api/video-file?key=${encodeURIComponent(selectedVersion.storage_path)}`;

  // Status styling map
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Final":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "In Review":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Changes Requested":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-zinc-800/40 text-zinc-400 border-zinc-700/50";
    }
  };

  const isLatestVersion = versions.length > 0 && versions[0].id === selectedVersion.id;

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
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-zinc-100 truncate max-w-[200px] md:max-w-md">
                  {video.title}
                </h1>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  getStatusStyle(selectedVersion.status)
                )}>
                  V{selectedVersion.version_number} • {selectedVersion.status}
                </span>
                {video.current_version_id === selectedVersion.id && (
                  <span className="text-[9px] font-bold bg-indigo-600/15 text-indigo-400 border border-indigo-600/20 px-1.5 py-0.2 rounded">
                    Current
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Created on {new Date(video.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "editor") && (
              <Button
                onClick={() => setUploadOpen(true)}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-505 text-white h-8.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload revision
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8.5 w-8.5 rounded-lg"
              title="Download video"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 h-8.5 w-8.5 rounded-lg"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 h-8.5 px-3 rounded-lg text-xs font-semibold"
            >
              {sidebarOpen ? "Hide" : "Show"} Panel
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-6 lg:p-8">
            <div className="w-full max-w-5xl">
              {/* Player */}
              <VideoPlayer
                videoUrl={videoFileUrl}
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

              {/* Timeline Markers */}
              <TimelineMarkers
                comments={comments}
                duration={player.duration}
                onSeek={player.seek}
              />

              {/* Video Description */}
              <div className="mt-6 p-4 rounded-xl bg-[#121214]/60 border border-zinc-800/60">
                <h2 className="text-sm font-semibold text-zinc-200 mb-2">Description</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">{video.description || "No description provided."}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar */}
        {sidebarOpen && (
          <div className="w-80 xl:w-96 shrink-0 hidden md:flex flex-col bg-[#0c0c0e] border-l border-zinc-800/80 h-full">
            {/* Tabs Header */}
            <div className="grid grid-cols-2 border-b border-zinc-850">
              <button
                onClick={() => setSidebarTab("comments")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
                  sidebarTab === "comments"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-350"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comments ({comments.length})
              </button>
              <button
                onClick={() => setSidebarTab("versions")}
                className={cn(
                  "flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
                  sidebarTab === "versions"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-350"
                )}
              >
                <History className="h-3.5 w-3.5" />
                Versions ({versions.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === "comments" ? (
                // Comments Tab
                commentsLoading ? (
                  <div className="flex flex-col h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-650" />
                    <p className="text-xs text-zinc-500 mt-2">Loading feedback…</p>
                  </div>
                ) : effectiveRole ? (
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
                  <div className="flex flex-col h-full items-center justify-center text-center p-6">
                    <Shield className="h-8 w-8 text-zinc-600 mb-2" />
                    <p className="text-xs text-zinc-400 font-bold">ReadOnly Access</p>
                  </div>
                )
              ) : (
                // Versions and Review Tab
                <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {/* Status Manager Block */}
                  <div className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                        Version Status
                      </span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", getStatusStyle(selectedVersion.status))}>
                        {selectedVersion.status}
                      </span>
                    </div>

                    {(effectiveRole === "owner" || effectiveRole === "admin") ? (
                      <div className="space-y-1">
                        <select
                          value={selectedVersion.status}
                          disabled={updatingStatus}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800/80 text-zinc-200 text-xs rounded-lg h-9 px-2 focus:border-zinc-700 outline-none cursor-pointer"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option
                              key={opt}
                              value={opt}
                              disabled={
                                (opt === "Approved" && effectiveRole !== "owner") ||
                                (opt === "Final" && !isLatestVersion)
                              }
                            >
                              {opt}
                              {opt === "Approved" && " (Owner only)"}
                              {opt === "Final" && !isLatestVersion && " (Latest version only)"}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-zinc-550">
                          * Only the latest uploaded version can be marked &quot;Final&quot;.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-zinc-500 leading-normal">
                        Your project role permissions do not allow modifying revision status.
                      </p>
                    )}
                  </div>

                  {/* Revision Notes Block */}
                  <div className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                          Revision Notes (V{selectedVersion.version_number})
                        </span>
                      </div>
                      {(effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "editor") && !editingNotes && (
                        <button
                          onClick={() => setEditingNotes(true)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {editingNotes ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          className="min-h-[70px] bg-zinc-950 border-zinc-850 text-xs text-zinc-200 p-2 rounded-lg"
                          placeholder="Describe changes in this version…"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setNotesText(selectedVersion.change_notes || "");
                              setEditingNotes(false);
                            }}
                            className="h-7 px-2 text-[10px] text-zinc-400 hover:text-zinc-200"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={savingNotes}
                            onClick={handleSaveNotes}
                            className="h-7 px-3 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                          >
                            {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-350 leading-relaxed italic bg-zinc-950/20 p-2 border border-zinc-850/40 rounded-lg">
                        {selectedVersion.change_notes || "No revision details provided."}
                      </p>
                    )}
                  </div>

                  {/* Versions Timeline/History List */}
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-1">
                      Version Timeline History
                    </span>
                    <div className="space-y-2">
                      {versions.map((ver) => {
                        const isCurrent = ver.id === selectedVersion.id;
                        const isMainCurrent = ver.id === video.current_version_id;

                        return (
                          <div
                            key={ver.id}
                            onClick={() => {
                              setSelectedVersion(ver);
                              setNotesText(ver.change_notes || "");
                              setEditingNotes(false);
                            }}
                            className={cn(
                              "group relative p-3 rounded-xl border transition-all cursor-pointer",
                              isCurrent
                                ? "bg-[#121214] border-indigo-500/50 shadow-md shadow-indigo-600/5"
                                : "bg-zinc-900/10 border-zinc-850 hover:bg-zinc-900/40 hover:border-zinc-800"
                            )}
                          >
                            {/* Blue Accent indicator on selection */}
                            {isCurrent && (
                              <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r" />
                            )}

                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-zinc-200">
                                    Version {ver.version_number}
                                  </span>
                                  {isMainCurrent && (
                                    <span className="text-[9px] bg-indigo-600/15 text-indigo-400 border border-indigo-600/20 px-1 rounded">
                                      Active
                                    </span>
                                  )}
                                  <span className={cn("text-[9px] px-1.5 py-0.2 border rounded-full", getStatusStyle(ver.status))}>
                                    {ver.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                                  <div className="flex items-center gap-0.5">
                                    <User className="h-2.5 w-2.5" />
                                    <span>{ver.uploader?.name || "Member"}</span>
                                  </div>
                                  <span>•</span>
                                  <div className="flex items-center gap-0.5">
                                    <Calendar className="h-2.5 w-2.5" />
                                    <span>
                                      {new Date(ver.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Version specific operations (Owner only) */}
                              {effectiveRole === "owner" && (
                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                  {!isMainCurrent && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Restore/Make Active"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestoreVersion(ver);
                                      }}
                                      className="h-7 w-7 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Delete Version"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteVersion(ver);
                                    }}
                                    className="h-7 w-7 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {ver.change_notes && (
                              <p className="text-[10.5px] text-zinc-450 mt-2 line-clamp-2 leading-relaxed italic bg-zinc-950/10 p-1.5 rounded border border-zinc-850/40">
                                {ver.change_notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Overlay (Comments only for simple UI) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-[#0c0c0e] flex flex-col">
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

      {/* Upload Revision Version Modal */}
      {video && (
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onSuccess={() => {
            setUploadOpen(false);
            loadVideoDetails();
          }}
          projectId={video.project_id}
          videoId={video.id}
          videoTitle={video.title}
        />
      )}
    </div>
  );
}
