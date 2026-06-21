'use client';

// Usage:
// <EmojiReactions reactions={{ '👍': 3, '🔥': 1 }} onReact={(emoji) => console.log(emoji)} />
import { useRef, useState, useEffect } from 'react';

const EMOJI_GRID = [
  '👍', '🔥', '😂', '💀', '🤡', '🧠', '😭', '💩', '🫡',
  '🐐', '😱', '👀', '🍻', '🤝', '🤬', '🙄', '🥶', '🤌',
];

interface EmojiReactionsProps {
  reactions: Record<string, number>;
  onReact: (emoji: string) => void;
}

export function EmojiReactions({ reactions, onReact }: EmojiReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  function handleReact(emoji: string) {
    onReact(emoji);
    setPickerOpen(false);
  }

  const existingEmojis = Object.entries(reactions).filter(([, count]) => count > 0);

  return (
    <div className="relative flex items-center gap-1 flex-wrap">
      {existingEmojis.map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-full border border-ps-border bg-ps-amber-soft text-body text-ps-text transition-colors hover:border-ps-amber"
          aria-label={`React with ${emoji}, ${count} reaction${count !== 1 ? 's' : ''}`}
        >
          <span>{emoji}</span>
          <span className="text-caption text-ps-text-sec">
            {count}
          </span>
        </button>
      ))}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Add reaction"
        aria-expanded={pickerOpen}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-ps-border bg-ps-chip text-body text-ps-text-sec hover:border-ps-border-strong hover:text-ps-text transition-colors"
      >
        +
      </button>

      {pickerOpen && (
        <div
          ref={pickerRef}
          role="dialog"
          aria-label="Emoji picker"
          className="absolute bottom-full left-0 mb-2 z-50 bg-ps-surface border-2 border-ps-border-strong shadow-lg rounded-xl p-2"
        >
          <div className="grid grid-cols-9 gap-0.5">
            {EMOJI_GRID.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReact(emoji)}
                aria-label={`React with ${emoji}`}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-section-title hover:bg-ps-chip transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
