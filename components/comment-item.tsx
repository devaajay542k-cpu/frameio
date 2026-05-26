"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Comment } from "@/types";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface CommentItemProps {
  comment: Comment;
  isActive: boolean;
  onClickTimestamp: (ts: number) => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return "Just now";
}

export default function CommentItem({ comment, isActive, onClickTimestamp }: CommentItemProps) {
  const initials = comment.userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <div
      className={cn(
        "group flex gap-3 p-3 rounded-xl transition-all duration-200 cursor-default",
        isActive
          ? "bg-indigo-600/10 border border-indigo-600/20"
          : "border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800/60"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarImage src={comment.userAvatar} alt={comment.userName} />
        <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-zinc-200 truncate">
            {comment.userName.split(" (")[0]}
          </span>
          <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">{comment.content}</p>

        {comment.timestamp !== null && (
          <button
            onClick={() => onClickTimestamp(comment.timestamp as number)}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-mono font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Clock className="h-3 w-3" />
            {formatTimestamp(comment.timestamp)}
          </button>
        )}
      </div>
    </div>
  );
}
