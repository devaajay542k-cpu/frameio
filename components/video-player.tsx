"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Comment } from "@/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VideoPlayerProps {
  videoUrl: string;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  buffered: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  comments: Comment[];
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  seek: (time: number) => void;
  seekPercent: (percent: number) => void;
  toggleFullscreen: () => void;
  setPlaybackRate: (rate: number) => void;
}

function formatTime(s: number): string {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function VideoPlayer({
  videoUrl, isPlaying, isMuted, currentTime, duration, volume, playbackRate,
  buffered, videoRef, comments, togglePlay, toggleMute, setVolume,
  seek, seekPercent, toggleFullscreen, setPlaybackRate,
}: VideoPlayerProps) {
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const rateLabel = playbackRate === 1 ? "1x" : `${playbackRate}x`;

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 1000);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleTimelineDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration === 0) return;
    setIsDragging(true);

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = Math.max(0, Math.min((clickX / rect.width) * duration, duration));
    seek(seekTime);
  };

  const handleTimelineHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !timelineRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || duration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const seekTime = Math.max(0, Math.min((clickX / rect.width) * duration, duration));
      seek(seekTime);
      setHoverTime(seekTime);
      setHoverX(Math.max(0, Math.min(e.clientX - rect.left, rect.width)));
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setHoverTime(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, duration, seek]);

  const timestampComments = comments.filter((c) => c.timestamp !== null);

  return (
    <div
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        playsInline
        preload="metadata"
      />

      {/* Cinematic Center Play Overlay */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center cursor-pointer z-10 transition-all duration-300 bg-black/20",
          isPlaying ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
        )}
        onClick={togglePlay}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-white/20">
          <Play className="h-9 w-9 text-white fill-white ml-1" />
        </div>
      </div>

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 px-4 pb-3 pt-16",
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Timeline Scrubber */}
        <div
          ref={timelineRef}
          className="relative w-full h-6 flex items-end cursor-pointer group/timeline mb-2 select-none"
          onMouseDown={handleTimelineDown}
          onMouseMove={handleTimelineHover}
          onMouseLeave={() => !isDragging && setHoverTime(null)}
        >
          {/* Track Background */}
          <div className={cn(
            "absolute bottom-2 left-0 right-0 h-1 bg-zinc-700/60 rounded-full transition-all duration-150 w-full",
            (isDragging || hoverTime !== null) ? "h-1.5" : "group-hover/timeline:h-1.5"
          )}>
            {/* Buffered */}
            <div
              className="absolute top-0 left-0 h-full bg-zinc-600/50 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Progress */}
            <div
              className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-none"
              style={{ width: `${progress}%` }}
            />
            {/* Scrub Head */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-indigo-400 rounded-full border-2 border-white shadow-md transition-all duration-150",
                (isDragging || hoverTime !== null) ? "opacity-100 scale-125" : "opacity-0 group-hover/timeline:opacity-100"
              )}
              style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)` }}
            />
          </div>

          {/* Comment Markers */}
          {timestampComments.map((c) => {
            const pos = ((c.timestamp as number) / duration) * 100;
            return (
              <Tooltip key={c.id}>
                <TooltipTrigger
                  render={
                    <div
                      className="absolute bottom-1 h-2.5 w-2.5 rounded-full bg-amber-400/90 border border-amber-300/40 hover:scale-150 transition-transform z-10 cursor-pointer"
                      style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
                      onClick={(e) => { e.stopPropagation(); seek(c.timestamp as number); }}
                    />
                  }
                />
                <TooltipContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-xs px-3 py-2 rounded-lg" side="top">
                  <p className="text-[11px] font-semibold text-amber-400 mb-0.5">{formatTime(c.timestamp as number)}</p>
                  <p className="text-[11px] text-zinc-300 line-clamp-2">{c.content}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Hover time tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute bottom-6 bg-zinc-900/90 border border-zinc-700 text-zinc-100 text-[11px] font-mono px-2 py-0.5 rounded pointer-events-none"
              style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Skip Back */}
            <button onClick={() => seek(currentTime - 10)} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
              <SkipBack className="h-4 w-4" />
            </button>

            {/* Play/Pause */}
            <button onClick={togglePlay} className="h-9 w-9 flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors">
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
            </button>

            {/* Skip Forward */}
            <button onClick={() => seek(currentTime + 10)} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 ml-1 group/vol">
              <button onClick={toggleMute} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-indigo-500 h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
              />
            </div>

            {/* Time Display */}
            <div className="ml-2 text-xs font-mono text-zinc-400 select-none">
              <span className="text-zinc-200">{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Playback Rate */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="h-8 px-2 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold font-mono" />
                }
              >
                {rateLabel}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-700 text-zinc-100 min-w-0" align="end">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => setPlaybackRate(r)}
                    className={cn(
                      "text-xs font-mono cursor-pointer",
                      playbackRate === r ? "text-indigo-400 font-semibold" : "text-zinc-300"
                    )}
                  >
                    {r}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
