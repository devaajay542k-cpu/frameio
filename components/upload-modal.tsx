"use client";

import { useRef, useState, useCallback } from "react";
import { X, UploadCloud, Film, CheckCircle, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type UploadStatus = "idle" | "dragging" | "uploading" | "processing" | "done" | "error";

export default function UploadModal({ open, onClose, onSuccess }: UploadModalProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setStatus("uploading");
    setProgress(0);

    try {
      // 1. Request presigned URL from API route
      const presignResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
        }),
      });

      if (!presignResponse.ok) {
        throw new Error("Failed to get presigned upload URL");
      }

      const { presignedUrl, key } = await presignResponse.json();
      console.log("1", presignedUrl, key);

      // 2. Upload file directly to R2 using XMLHttpRequest to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

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

        xhr.send(file);
      });

      setStatus("processing");

      // 3. Save video record in Supabase
      const videoUrl = `/api/video-file?key=${encodeURIComponent(key)}`;

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        throw new Error("No active user session found. Please log in.");
      }

      const { error: dbError } = await supabase
        .from("videos")
        .insert({
          title: file.name.replace(/\.[^/.]+$/, ""), // remove extension for clean title
          video_url: videoUrl,
          created_at: new Date().toISOString(),
          user_id: userId
        });

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw dbError;
      }

      setStatus("done");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("R2 Upload failed:", err);
      setStatus("error");
    }
  }, [onSuccess]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setStatus("idle");
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleClose = () => {
    setStatus("idle");
    setProgress(0);
    setFileName(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg border-zinc-800 bg-[#121214] text-zinc-100 shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold text-zinc-100">
              Upload Video
            </DialogTitle>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Supported formats: MP4, MOV, AVI, MKV, WebM. Max 10 GB.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Drop Zone */}
          {status === "idle" || status === "dragging" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setStatus("dragging"); }}
              onDragLeave={() => setStatus("idle")}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-14 px-8 cursor-pointer transition-all duration-200",
                status === "dragging"
                  ? "border-indigo-500 bg-indigo-600/10"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
              )}
            >
              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl transition-colors duration-200",
                status === "dragging" ? "bg-indigo-600/20" : "bg-zinc-900"
              )}>
                <UploadCloud className={cn(
                  "h-7 w-7 transition-colors duration-200",
                  status === "dragging" ? "text-indigo-400" : "text-zinc-500"
                )} />
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-sm font-semibold transition-colors",
                  status === "dragging" ? "text-indigo-300" : "text-zinc-300"
                )}>
                  {status === "dragging" ? "Release to upload" : "Drag & drop your video here"}
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
          ) : null}

          {/* Upload Progress */}
          {(status === "uploading" || status === "processing") && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
                  <Film className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{fileName}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {status === "uploading"
                      ? `Uploading… ${Math.round(progress)}%`
                      : "Processing video…"}
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
                  <p className="text-xs text-amber-400">Generating thumbnail & metadata…</p>
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
                  <span className="text-zinc-300 font-medium">{fileName}</span> is ready for review.
                </p>
              </div>
              <Button
                onClick={handleClose}
                className="bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium h-9 px-6 rounded-lg"
              >
                View in Dashboard
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
                <p className="text-xs text-zinc-500 mt-1">Something went wrong. Please try again.</p>
              </div>
              <Button
                onClick={() => setStatus("idle")}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-9 px-6 rounded-lg"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(status === "idle" || status === "dragging") && (
          <div className="flex justify-end gap-3 px-6 pb-5">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 h-9 rounded-lg"
            >
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
