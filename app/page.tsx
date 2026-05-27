"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import VideoCard from "@/components/video-card";
import UploadModal from "@/components/upload-modal";
import { Film, LayoutGrid, List } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Video } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DatabaseVideo {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  video_url?: string;
  videoUrl?: string;
  duration?: number;
  created_at?: string;
  createdAt?: string;
  comments_count?: number;
  commentsCount?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit/Delete state
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function checkAuthAndFetch() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        setAuthLoading(false);

        const { data, error } = await supabase
          .from("videos")
          .select("*");

        if (error) {
          console.warn("Could not fetch videos from Supabase:", error.message);
          return;
        }

        if (data) {
          const mappedVideos: Video[] = (data as unknown as DatabaseVideo[]).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description || "",
            thumbnailUrl: item.thumbnail_url || item.thumbnailUrl || "",
            videoUrl: item.video_url || item.videoUrl || "",
            duration: item.duration || 0,
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
            commentsCount: item.comments_count || item.commentsCount || 0,
          }));
          setVideos(mappedVideos);
        }
      } catch (err) {
        console.error("Error during auth check / fetch:", err);
        router.push("/login");
      }
    }

    checkAuthAndFetch();
  }, [router, refreshTrigger]);

  const startEditTitle = (video: Video) => {
    setEditingVideo(video);
    setNewTitle(video.title);
  };

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo || !newTitle.trim()) return;

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User not authenticated");
        return;
      }
      console.log(editingVideo.id);
      console.log(user.id);
      const { data, error } = await supabase
        .from("videos")
        .update({
          title: newTitle.trim(),
        })
        .eq("id", editingVideo.id)
        .eq("user_id", user.id)
        .select();

      console.log(data, error);

      if (error) {
        throw error;
      }

      setRefreshTrigger((prev) => prev + 1);
      setEditingVideo(null);
    } catch (err) {
      console.error("Failed to update video title:", err);
      alert("Failed to update video title. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!deletingVideo) return;

    setIsDeleting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User not authenticated");
        return;
      }

      const res = await fetch(`/api/videos/${deletingVideo.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete video");
      }

      setRefreshTrigger((prev) => prev + 1);
      setDeletingVideo(null);
    } catch (err) {
      console.error("Failed to delete video:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to delete video. Please try again.";
      alert(errorMsg);
    } finally {
      setIsDeleting(false);
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

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Navbar
        onUploadClick={() => setUploadOpen(true)}
        onMobileMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden md:flex" />

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed left-0 top-14 bottom-0 z-50 md:hidden">
              <Sidebar className="h-full" />
            </div>
          </>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">
          <div className="px-6 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">My Projects</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {videos.length} video{videos.length !== 1 ? "s" : ""} in your workspace
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-1 bg-zinc-900 rounded-lg border border-zinc-800/80 p-0.5">
                <button className="h-8 w-8 flex items-center justify-center rounded-md bg-zinc-800 text-zinc-200 transition-colors">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 transition-colors">
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Grid */}
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onEditTitle={startEditTitle}
                    onDeleteVideo={setDeletingVideo}
                  />
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 mb-6">
                  <Film className="h-10 w-10 text-zinc-600" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-200 mb-2">No videos yet</h2>
                <p className="text-sm text-zinc-500 max-w-sm mb-6">
                  Upload your first video to start collaborating with your team on frame-accurate reviews.
                </p>
                <button
                  onClick={() => setUploadOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-10 px-6 rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 text-sm"
                >
                  Upload Your First Video
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Edit Title Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Rename Video
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Give your video project a new, descriptive name.
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveTitle} className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="video-title-input" className="text-xs font-semibold text-zinc-400">
                Title
              </label>
              <Input
                id="video-title-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter video title"
                className="w-full bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:ring-indigo-500/20"
                required
                disabled={isSaving}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingVideo(null)}
                className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg px-4 cursor-pointer"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all duration-200 cursor-pointer"
                disabled={isSaving || !newTitle.trim()}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingVideo} onOpenChange={(open) => !open && setDeletingVideo(null)}>
        <DialogContent className="sm:max-w-md border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-red-400">
              Delete Video
            </DialogTitle>
            <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Are you sure you want to delete <span className="text-zinc-300 font-semibold">&ldquo;{deletingVideo?.title}&rdquo;</span>? This will permanently delete the video file from the Cloudflare R2 bucket and erase all associated comments. This action cannot be undone.
            </div>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingVideo(null)}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg px-4 cursor-pointer"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteVideo}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-medium h-9 px-4 rounded-lg shadow-md shadow-red-600/10 hover:shadow-red-500/20 transition-all duration-200 cursor-pointer"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
                  <span>Deleting...</span>
                </div>
              ) : (
                "Delete Video"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
