"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { X, UploadCloud, Film, CheckCircle, AlertCircle, Layers, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projectId?: string;
  videoId?: string;
  videoTitle?: string;
}

type UploadStatus = "idle" | "configuring" | "uploading" | "processing" | "done" | "error";

export default function UploadModal({
  open,
  onClose,
  onSuccess,
  projectId,
  videoId,
  videoTitle,
}: UploadModalProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [uploadMode, setUploadMode] = useState<"new_video" | "new_version">(
    videoId ? "new_version" : "new_video"
  );

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  const [projectVideos, setProjectVideos] = useState<{ id: string; title: string }[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");

  // Progress state
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset states on open/close
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setUploadMode(videoId ? "new_version" : "new_video");
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      setChangeNotes("");
      setSelectedVideoId(videoId || "");

      // If on project page and no preselected video, fetch project videos to allow versioning
      if (projectId && !videoId) {
        supabase
          .from("videos")
          .select("id, title")
          .eq("project_id", projectId)
          .order("title", { ascending: true })
          .then(({ data }) => {
            if (data) {
              setProjectVideos(data);
              if (data.length > 0) {
                setSelectedVideoId(data[0].id);
              }
            }
          });
      }
    }
  }, [open, projectId, videoId]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setFileName(file.name);
    // Auto-populate title for new video mode
    setTitle(file.name.replace(/\.[^/.]+$/, ""));
    setStatus("configuring");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("video/")) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const startUpload = async () => {
    if (!selectedFile) return;

    setStatus("uploading");
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        throw new Error("No active user session found. Please log in.");
      }

      // 1. Get presigned R2 upload URL
      const targetVideoId = uploadMode === "new_version" ? selectedVideoId : undefined;
      const presignResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || "video/mp4",
          projectId,
          videoId: targetVideoId,
          userId,
        }),
      });

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json();
        throw new Error(errorData.error || "Failed to get presigned upload URL");
      }

      const { presignedUrl, key, videoId: finalVideoId, versionNumber } = await presignResponse.json();

      // 2. Upload file directly to R2
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.setRequestHeader("Content-Type", selectedFile.type || "video/mp4");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setProgress(Math.round(percentComplete));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };

        xhr.send(selectedFile);
      });

      setStatus("processing");

      // 3. Complete database integration
      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          videoId: finalVideoId,
          versionNumber,
          key,
          title: uploadMode === "new_video" ? title : undefined,
          description: uploadMode === "new_video" ? description : undefined,
          changeNotes: uploadMode === "new_version" ? changeNotes : undefined,
          userId,
          duration: 0, // In production, we'd extract duration via canvas/meta, fallback to 0
          fileSize: selectedFile.size,
        }),
      });

      if (!completeResponse.ok) {
        const completeError = await completeResponse.json();
        throw new Error(completeError.error || "Failed to finalize database records");
      }

      setStatus("done");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("Upload failed:", err);
      setStatus("error");
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileName(null);
    setProgress(0);
    setStatus("idle");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-zinc-100">
              {uploadMode === "new_version" ? "Upload Revision Version" : "Upload New Video"}
            </DialogTitle>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Supported formats: MP4, MOV, AVI, MKV, WebM. Max 10 GB.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Mode Selector Toggle (only if videoId is not preselected) */}
          {status === "idle" && !videoId && projectVideos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900/60 rounded-xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setUploadMode("new_video")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all",
                  uploadMode === "new_video"
                    ? "bg-[#1e1e24] text-zinc-100 shadow-sm border border-zinc-800"
                    : "text-zinc-550 hover:text-zinc-300"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Create New Video
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("new_version")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all",
                  uploadMode === "new_version"
                    ? "bg-[#1e1e24] text-zinc-100 shadow-sm border border-zinc-800"
                    : "text-zinc-550 hover:text-zinc-300"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Upload New Version
              </button>
            </div>
          )}

          {/* Step 1: Drop Zone */}
          {status === "idle" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50 py-14 px-8 cursor-pointer transition-all duration-200"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900">
                <UploadCloud className="h-7 w-7 text-zinc-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-300">
                  Drag & drop your video here
                </p>
                <p className="text-xs text-zinc-500 mt-1">or click to browse files</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Step 2: Metadata Configuration */}
          {status === "configuring" && selectedFile && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-3 p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                  <Film className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>

              {uploadMode === "new_video" ? (
                // New Video Fields
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-xs font-semibold text-zinc-400">
                      Video Title
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter video title…"
                      className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-650 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 h-9.5 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desc" className="text-xs font-semibold text-zinc-400">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add brief details about this asset…"
                      className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-650 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 text-xs rounded-lg min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                // Upload Version Fields
                <div className="space-y-3">
                  {videoId ? (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-550">
                        Target Asset
                      </span>
                      <p className="text-xs text-zinc-250 font-semibold">{videoTitle || "Current Video"}</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="target-video" className="text-xs font-semibold text-zinc-400">
                        Select Target Video
                      </Label>
                      <select
                        id="target-video"
                        value={selectedVideoId}
                        onChange={(e) => setSelectedVideoId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800/80 text-zinc-200 text-xs rounded-lg h-9.5 px-3 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 outline-none"
                      >
                        {projectVideos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs font-semibold text-zinc-400">
                      Version Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={changeNotes}
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="Describe what changed (e.g. New color grade, audio mix adjustments, updated feedback)…"
                      className="bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-650 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 text-xs rounded-lg min-h-[80px]"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress */}
          {(status === "uploading" || status === "processing") && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
                  <Film className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-250 truncate">{fileName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {status === "uploading"
                      ? `Uploading… ${Math.round(progress)}%`
                      : "Processing video metadata…"}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Progress
                  value={status === "processing" ? 100 : progress}
                  className="h-1.5 bg-zinc-800 [&>div]:bg-indigo-500 [&>div]:transition-all [&>div]:duration-200"
                />
              </div>
              {status === "processing" && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <p className="text-xs text-amber-400">Generating thumbnail & database files…</p>
                </div>
              )}
            </div>
          )}

          {/* Done State */}
          {status === "done" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-100">Upload Complete!</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                  <span className="text-zinc-300 font-medium">{fileName}</span> has been uploaded successfully.
                </p>
              </div>
              <Button
                onClick={handleClose}
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-6 rounded-lg"
              >
                Close
              </Button>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-100">Upload Failed</p>
                <p className="text-xs text-zinc-500 mt-1">Something went wrong. Please check permissions and try again.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setStatus("configuring")}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 px-6 rounded-lg"
                >
                  Configure Again
                </Button>
                <Button
                  onClick={() => setStatus("idle")}
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-200 h-9 px-6 rounded-lg"
                >
                  Clear File
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {status === "idle" && (
          <div className="flex justify-end gap-3 px-6 pb-5">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg text-xs font-semibold"
            >
              Cancel
            </Button>
          </div>
        )}

        {status === "configuring" && (
          <div className="flex justify-end gap-3 px-6 pb-5">
            <Button
              variant="ghost"
              onClick={() => setStatus("idle")}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg text-xs font-semibold"
            >
              Back
            </Button>
            <Button
              onClick={startUpload}
              disabled={
                (uploadMode === "new_video" && !title.trim()) ||
                (uploadMode === "new_version" && (!selectedVideoId || !changeNotes.trim()))
              }
              className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-semibold h-9 px-6 rounded-lg text-xs"
            >
              {uploadMode === "new_version" ? "Upload Version" : "Upload Video"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
