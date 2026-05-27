"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Comment } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, Edit2, Trash2 } from "lucide-react";

interface CommentItemProps {
  comment: Comment;
  isActive: boolean;
  isOwnComment: boolean;
  onClickTimestamp: (ts: number) => void;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
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

export default function CommentItem({
  comment,
  isActive,
  isOwnComment,
  onClickTimestamp,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);

  const initials = comment.userName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  const handleSave = () => {
    if (!editText.trim()) return;
    onEdit?.(editText.trim());
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group flex gap-3 p-3 rounded-xl transition-all duration-200 cursor-default relative",
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

        {isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none resize-none"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditText(comment.content);
                  setIsEditing(false);
                }}
                className="px-2 py-1 rounded bg-zinc-850 hover:bg-zinc-800 text-[10px] font-semibold text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed pr-8">{comment.content}</p>
        )}

        {comment.timestamp !== null && !isEditing && (
          <button
            onClick={() => onClickTimestamp(comment.timestamp as number)}
            className="flex items-center gap-1.5 mt-2 text-[11px] font-mono font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Clock className="h-3 w-3" />
            {formatTimestamp(comment.timestamp)}
          </button>
        )}
      </div>

      {isOwnComment && !isEditing && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 flex items-center justify-center rounded bg-zinc-800/80 border border-zinc-700/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Edit Comment"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete this comment?")) {
                onDelete?.();
              }
            }}
            className="h-6 w-6 flex items-center justify-center rounded bg-zinc-800/80 border border-zinc-700/50 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete Comment"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
