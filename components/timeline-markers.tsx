"use client";

import { Comment } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TimelineMarkersProps {
  comments: Comment[];
  duration: number;
  onSeek: (time: number) => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimelineMarkers({ comments, duration, onSeek }: TimelineMarkersProps) {
  const timestampedComments = comments.filter((c) => c.timestamp !== null);

  if (timestampedComments.length === 0 || duration === 0) return null;

  return (
    <div className="w-full mt-3 px-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
          {timestampedComments.length} Marker{timestampedComments.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative w-full h-8 bg-zinc-900/60 rounded-lg border border-zinc-800/60 overflow-hidden">
        {/* Track line */}
        <div className="absolute top-1/2 left-3 right-3 h-px bg-zinc-800 -translate-y-1/2" />

        {/* Markers */}
        {timestampedComments.map((c) => {
          const leftPercent = ((c.timestamp as number) / duration) * 100;
          return (
            <Tooltip key={c.id}>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => onSeek(c.timestamp as number)}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-amber-200/30 shadow-lg shadow-amber-500/20 hover:scale-150 transition-transform duration-200 z-10"
                    style={{ left: `calc(${leftPercent}% * 0.94 + 3%)` }}
                  />
                }
              />
              <TooltipContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-xs px-3 py-2 rounded-lg" side="top">
                <p className="text-[11px] font-semibold text-amber-400 font-mono">{formatTimestamp(c.timestamp as number)}</p>
                <p className="text-[11px] text-zinc-300 mt-0.5 line-clamp-2">{c.content}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{c.userName.split(" (")[0]}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
