"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Match Reactions — emoji reactions + short comments below live match cards
// Adds social engagement layer to the live experience
// ============================================================================

interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

interface Comment {
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

interface MatchReactionsProps {
  matchId: string;
  reactions: Reaction[];
  comments: Comment[];
  onReact?: (emoji: string) => void;
  onComment?: (text: string) => void;
}

const EMOJI_OPTIONS = ["⚽", "🔥", "😂", "😱", "💀", "👏"];
const MAX_COMMENT_LENGTH = 100;
const CURRENT_USER_ID = "4"; // mock current user

// --- Mock data for demonstration ---
export const MOCK_REACTIONS: MatchReactionsProps = {
  matchId: "1",
  reactions: [
    { emoji: "🔥", userId: "1", userName: "דני" },
    { emoji: "🔥", userId: "2", userName: "יוני" },
    { emoji: "⚽", userId: "1", userName: "דני" },
    { emoji: "😱", userId: "3", userName: "דור" },
    { emoji: "💀", userId: "5", userName: "רון ב" },
    { emoji: "🔥", userId: "4", userName: "אמית" },
    { emoji: "👏", userId: "6", userName: "רון ג" },
    { emoji: "👏", userId: "2", userName: "יוני" },
  ],
  comments: [
    { userId: "1", userName: "דני", text: "ארגנטינה מוחצת!", timestamp: "72'" },
    { userId: "3", userName: "דור", text: "מסי פשוט לא מהעולם הזה", timestamp: "70'" },
    { userId: "5", userName: "רון ב", text: "הניחוש שלי הלך 💀", timestamp: "68'" },
  ],
};

export function MatchReactions({
  matchId,
  reactions,
  comments,
  onReact,
  onComment,
}: MatchReactionsProps) {
  const [localReactions, setLocalReactions] = useState<Reaction[]>(reactions);
  const [localComments, setLocalComments] = useState<Comment[]>(comments);
  const [commentText, setCommentText] = useState("");
  const [tappedEmoji, setTappedEmoji] = useState<string | null>(null);

  // Count reactions per emoji
  const reactionCounts = EMOJI_OPTIONS.map((emoji) => ({
    emoji,
    count: localReactions.filter((r) => r.emoji === emoji).length,
    hasReacted: localReactions.some(
      (r) => r.emoji === emoji && r.userId === CURRENT_USER_ID
    ),
  }));

  const handleReact = (emoji: string) => {
    setTappedEmoji(emoji);
    setTimeout(() => setTappedEmoji(null), 300);

    const alreadyReacted = localReactions.find(
      (r) => r.emoji === emoji && r.userId === CURRENT_USER_ID
    );

    if (alreadyReacted) {
      // Toggle off
      setLocalReactions((prev) =>
        prev.filter(
          (r) => !(r.emoji === emoji && r.userId === CURRENT_USER_ID)
        )
      );
    } else {
      // Toggle on
      setLocalReactions((prev) => [
        ...prev,
        { emoji, userId: CURRENT_USER_ID, userName: "אמית" },
      ]);
    }

    onReact?.(emoji);
  };

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return;

    const newComment: Comment = {
      userId: CURRENT_USER_ID,
      userName: "אמית",
      text: trimmed,
      timestamp: "עכשיו",
    };

    setLocalComments((prev) => [newComment, ...prev]);
    setCommentText("");
    onComment?.(trimmed);
  };

  return (
    <div className="border-t border-gray-100 px-4 py-3" dir="rtl">
      {/* Emoji reaction row */}
      <div className="flex items-center gap-1.5 mb-3">
        {reactionCounts.map(({ emoji, count, hasReacted }) => (
          <motion.button
            key={`${matchId}-${emoji}`}
            onClick={() => handleReact(emoji)}
            whileTap={{ scale: 1.3 }}
            animate={
              tappedEmoji === emoji
                ? { scale: [1, 1.4, 1], rotate: [0, -10, 10, 0] }
                : {}
            }
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm border transition-colors ${
              hasReacted
                ? "bg-blue-50 border-blue-300 shadow-sm"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span className="text-base">{emoji}</span>
            {count > 0 && (
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={count}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className={`text-xs font-bold tabular-nums ${
                    hasReacted ? "text-blue-600" : "text-gray-500"
                  }`}
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            )}
          </motion.button>
        ))}
      </div>

      {/* Comments list */}
      {localComments.length > 0 && (
        <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto">
          {localComments.map((c, i) => (
            <motion.div
              key={`${c.userId}-${c.timestamp}-${i}`}
              initial={i === 0 ? { opacity: 0, y: -8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2 text-sm"
            >
              <span className="font-bold text-gray-800 shrink-0">
                {c.userName}
              </span>
              <span className="text-gray-600 break-words min-w-0">
                {c.text}
              </span>
              <span
                className="text-xs text-gray-400 shrink-0 ms-auto"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {c.timestamp}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={commentText}
          onChange={(e) =>
            setCommentText(e.target.value.slice(0, MAX_COMMENT_LENGTH))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmitComment();
          }}
          placeholder="הגב..."
          className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-4 py-2 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-all placeholder:text-gray-400"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSubmitComment}
          disabled={!commentText.trim()}
          className="shrink-0 w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="rotate-180"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>

      {/* Character counter */}
      {commentText.length > 0 && (
        <p
          className={`text-[10px] mt-1 text-end ${
            commentText.length > MAX_COMMENT_LENGTH - 10
              ? "text-red-400"
              : "text-gray-400"
          }`}
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {commentText.length}/{MAX_COMMENT_LENGTH}
        </p>
      )}
    </div>
  );
}
