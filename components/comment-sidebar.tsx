"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Clock, AtSign } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Comment } from "@/types";
import CommentItem from "@/components/comment-item";
import { cn } from "@/lib/utils";

interface CommentSidebarProps {
  comments: Comment[];
  currentTime: number;
  onSeek: (time: number) => void;
  onAddComment: (content: string, useTimestamp: boolean) => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CommentSidebar({ comments, currentTime, onSeek, onAddComment }: CommentSidebarProps) {
  const [newComment, setNewComment] = useState("");
  const [attachTimestamp, setAttachTimestamp] = useState(true);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Highlight the comment closest to the current playback time
  useEffect(() => {
    const timestampedComments = comments.filter((c) => c.timestamp !== null);
    if (timestampedComments.length === 0) {
      setActiveCommentId(null);
      return;
    }

    let closest: Comment | null = null;
    let minDist = Infinity;
    for (const c of timestampedComments) {
      const dist = Math.abs((c.timestamp as number) - currentTime);
      if (dist < minDist && dist < 3) {
        closest = c;
        minDist = dist;
      }
    }
    setActiveCommentId(closest?.id ?? null);
  }, [currentTime, comments]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim(), attachTimestamp);
    setNewComment("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const timestampedComments = comments.filter((c) => c.timestamp !== null).sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
  const generalComments = comments.filter((c) => c.timestamp === null);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] border-l border-zinc-800/80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80">
        <MessageSquare className="h-4 w-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Comments</h2>
        <span className="ml-auto text-[10px] font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">
          {comments.length}
        </span>
      </div>

      {/* Comments List */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {timestampedComments.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase px-1 mb-2">
              Timestamped
            </p>
            <div className="space-y-1">
              {timestampedComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  isActive={activeCommentId === c.id}
                  onClickTimestamp={onSeek}
                />
              ))}
            </div>
          </div>
        )}

        {generalComments.length > 0 && (
          <div>
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase px-1 mb-2">
              General
            </p>
            <div className="space-y-1">
              {generalComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  isActive={false}
                  onClickTimestamp={onSeek}
                />
              ))}
            </div>
          </div>
        )}

        {comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 font-medium">No comments yet</p>
            <p className="text-xs text-zinc-600 mt-1">Be the first to leave feedback</p>
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-zinc-800/80 p-3 space-y-2">
        {/* Timestamp Toggle */}
        <button
          onClick={() => setAttachTimestamp(!attachTimestamp)}
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200",
            attachTimestamp
              ? "bg-indigo-600/15 text-indigo-400 border border-indigo-600/20"
              : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300"
          )}
        >
          <Clock className="h-3 w-3" />
          {attachTimestamp ? `At ${formatTimestamp(currentTime)}` : "No timestamp"}
        </button>

        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add feedback…"
            className="min-h-[36px] max-h-24 resize-none bg-zinc-900/50 border-zinc-800/80 text-zinc-100 placeholder:text-zinc-600 text-xs rounded-lg focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            className="shrink-0 h-9 w-9 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-30"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600">⌘ + Enter to send</p>
      </div>
    </div>
  );
}
