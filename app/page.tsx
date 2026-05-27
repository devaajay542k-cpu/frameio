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
        console.log(data);
        console.log(error);
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
                  <VideoCard key={video.id} video={video} />
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
    </div>
  );
}
