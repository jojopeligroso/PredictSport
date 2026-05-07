'use client';

// Usage:
// <PickNote ownerIsYou onChange={(text, vis) => console.log(text, vis)} />
// <PickNote initialText="I have a feeling about this one." initialVisibility="public" locked />
// <PickNote initialText="Never tell." initialVisibility="private" locked />
import { useState } from 'react';

interface PickNoteProps {
  initialText?: string;
  initialVisibility?: 'public' | 'private';
  locked?: boolean;
  ownerIsYou?: boolean;
  onChange?: (text: string, visibility: 'public' | 'private') => void;
}

export function PickNote({
  initialText = '',
  initialVisibility = 'public',
  locked = false,
  ownerIsYou = false,
  onChange,
}: PickNoteProps) {
  const [text, setText] = useState(initialText);
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility);

  // Locked + no text → render nothing
  if (locked && !initialText) {
    return null;
  }

  // Locked with text → read-only display
  if (locked && initialText) {
    const isPrivate = initialVisibility === 'private';
    return (
      <div
        className={[
          'rounded-lg px-3 py-2.5',
          isPrivate
            ? 'bg-[rgba(139,92,246,0.10)]'
            : 'bg-ps-amber-soft',
        ].join(' ')}
        aria-label={isPrivate ? 'Private note' : 'Public note'}
      >
        <p
          className={[
            'font-semibold uppercase mb-1',
            isPrivate ? 'text-ps-violet' : 'text-ps-amber-deep',
          ].join(' ')}
          style={{ fontSize: 9, letterSpacing: '0.06em' }}
        >
          {isPrivate ? `🔒 Private note${ownerIsYou ? ' · only you see this' : ''}` : '✏️ Note'}
        </p>
        <p className="italic text-ps-text" style={{ fontSize: 12 }}>
          &ldquo;{initialText}&rdquo;
        </p>
      </div>
    );
  }

  // Editable state
  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setText(next);
    onChange?.(next, visibility);
  }

  function handleVisibilityChange(next: 'public' | 'private') {
    setVisibility(next);
    onChange?.(text, next);
  }

  const helperText =
    visibility === 'public'
      ? 'Shown to the group when picks lock.'
      : 'Only you ever see it.';

  return (
    <div className="rounded-lg border border-dashed border-ps-border-strong px-3 py-2.5">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-ps-text-sec font-medium" style={{ fontSize: 11 }}>
          Add a note{' '}
          <span className="text-ps-text-ter font-normal">(optional)</span>
        </span>

        {/* Segmented toggle */}
        <div
          className="flex items-center rounded-full border border-ps-border bg-ps-chip overflow-hidden shrink-0"
          role="group"
          aria-label="Note visibility"
        >
          {(['public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleVisibilityChange(v)}
              aria-pressed={visibility === v}
              className={[
                'px-2.5 py-0.5 font-semibold uppercase transition-colors',
                visibility === v
                  ? 'bg-ps-amber text-white'
                  : 'text-ps-text-sec hover:text-ps-text',
              ].join(' ')}
              style={{ fontSize: 9, letterSpacing: '0.05em' }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={text}
        onChange={handleTextChange}
        placeholder="e.g. Backing the stats here…"
        rows={2}
        className="w-full bg-transparent resize-none text-ps-text placeholder:text-ps-text-ter outline-none leading-snug"
        style={{ fontSize: 12 }}
        aria-label="Pick note"
      />

      <p className="text-ps-text-ter mt-1" style={{ fontSize: 10 }}>
        {helperText}
      </p>
    </div>
  );
}
