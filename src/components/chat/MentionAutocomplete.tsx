"use client";

import { useState } from "react";
import type { UseChatMember } from "./useRealtimeChat";

interface MentionAutocompleteProps {
  members: UseChatMember[];
  /** The current text input value */
  inputValue: string;
  /** Cursor position in the input */
  cursorPosition: number;
  /** Called when a member is selected — passes the display name to insert */
  onSelect: (displayName: string, startIndex: number) => void;
  onClose: () => void;
}

export function MentionAutocomplete({
  members,
  inputValue,
  cursorPosition,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Find the @ trigger position and extract the query
  const atIndex = findAtTrigger(inputValue, cursorPosition);
  const query =
    atIndex >= 0
      ? inputValue.slice(atIndex + 1, cursorPosition).toLowerCase()
      : "";

  const filtered =
    atIndex >= 0
      ? members.filter((m) =>
          m.display_name.toLowerCase().includes(query)
        )
      : [];

  // Close if no results
  if (atIndex < 0 || filtered.length === 0) {
    return null;
  }

  // Clamp selectedIndex to valid range
  const safeIndex = Math.min(selectedIndex, filtered.length - 1);

  const handleSelect = (member: UseChatMember) => {
    onSelect(member.display_name, atIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleSelect(filtered[safeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-ps-border bg-ps-surface shadow-lg max-h-40 overflow-y-auto z-10"
      onKeyDown={handleKeyDown}
    >
      {filtered.map((member, i) => (
        <button
          key={member.user_id}
          onClick={() => handleSelect(member)}
          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
            i === safeIndex
              ? "bg-ps-amber/10 text-ps-text"
              : "text-ps-text-sec hover:bg-ps-chip"
          }`}
        >
          <span className="font-medium">{member.display_name}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Find the position of the `@` character that triggered autocomplete.
 * Returns -1 if no trigger is found.
 * A valid trigger is an `@` at start of input or preceded by a space.
 */
function findAtTrigger(text: string, cursorPos: number): number {
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === " " || text[i] === "\n") return -1;
    if (text[i] === "@") {
      // Valid if at start or preceded by space/newline
      if (i === 0 || text[i - 1] === " " || text[i - 1] === "\n") {
        return i;
      }
      return -1;
    }
  }
  return -1;
}

export { findAtTrigger };
