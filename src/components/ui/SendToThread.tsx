'use client';

// Usage:
// <SendToThread defaultText="Man City 1–0 Liverpool. My pick locked!" />
// <SendToThread defaultText="Check this round out" label="Share round" variant="block" members={members} />
// <SendToThread defaultText="Send to WhatsApp" variant="icon" />
// Long-press (380ms) opens bottom-sheet composer with editable text and @-mention picker.

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildWaLink } from '@/lib/whatsapp';
import { WAIcon } from './WAIcon';

interface Member {
  id: string;
  display_name: string;
}

interface SendToThreadProps {
  defaultText: string;
  label?: string;
  variant?: 'inline' | 'block' | 'icon';
  members?: Member[];
}

const WA_GREEN = 'var(--ps-wa-green, #25d366)';
const WA_GREEN_DARK = 'var(--ps-wa-green-dark, #128c4d)';
const WA_GREEN_SOFT = 'var(--ps-wa-green-soft, rgba(37,211,102,0.14))';

// ─── Composer bottom sheet ────────────────────────────────────────────────────

interface ComposerProps {
  defaultText: string;
  members?: Member[];
  onCancel: () => void;
  onSend: (text: string) => void;
}

function SendToThreadComposer({ defaultText, members = [], onCancel, onSend }: ComposerProps) {
  const [text, setText] = useState(defaultText);
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertMention(name: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + `@${name} `);
      setShowPicker(false);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + `@${name} ` + text.slice(end);
    setText(next);
    setShowPicker(false);
    // Restore cursor after state update
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + name.length + 2;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    // Overlay
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Bottom sheet — stop pointer events from bubbling to overlay */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--ps-bg, #0f1117)',
          borderRadius: '20px 20px 0 0',
          padding: '14px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 9999,
              background: 'var(--ps-border-strong, rgba(255,255,255,0.18))',
            }}
          />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WAIcon size={18} color={WA_GREEN} />
          <span className="text-body" style={{ fontWeight: 600, color: 'var(--ps-text, #f1f5f9)' }}>
            Send to the WhatsApp group
          </span>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label="Message text"
          className="text-body"
          style={{
            width: '100%',
            background: 'var(--ps-surface, #1a1f2e)',
            border: '1px solid var(--ps-border-strong, rgba(255,255,255,0.18))',
            borderRadius: 10,
            padding: '10px 12px',
            color: 'var(--ps-text, #f1f5f9)',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* @ Mention toggle */}
        {members.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="text-caption"
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: '1px solid var(--ps-border-strong, rgba(255,255,255,0.18))',
                borderRadius: 999,
                padding: '4px 12px',
                fontWeight: 600,
                color: 'var(--ps-text-muted, #94a3b8)',
                cursor: 'pointer',
              }}
            >
              @ Mention
            </button>

            {showPicker && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => insertMention(m.display_name)}
                    className="text-caption"
                    style={{
                      background: 'var(--ps-surface, #1a1f2e)',
                      border: '1px solid var(--ps-border-strong, rgba(255,255,255,0.18))',
                      borderRadius: 999,
                      padding: '4px 10px',
                      color: 'var(--ps-text, #f1f5f9)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            className="text-body"
            style={{
              flex: '0 0 auto',
              background: 'transparent',
              border: '1px solid var(--ps-border-strong, rgba(255,255,255,0.18))',
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 600,
              color: 'var(--ps-text-muted, #94a3b8)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSend(text)}
            className="text-body"
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${WA_GREEN}, ${WA_GREEN_DARK})`,
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <WAIcon size={16} color="#fff" />
            Send to the group
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SendToThread({
  defaultText,
  label = 'Send',
  variant = 'inline',
  members,
}: SendToThreadProps) {
  const [sent, setSent] = useState(false);
  const [composing, setComposing] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  function fire(text: string) {
    window.open(buildWaLink(text), '_blank', 'noopener,noreferrer');
    setSent(true);
    setTimeout(() => setSent(false), 2400);
  }

  function onPointerDown() {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setComposing(true);
    }, 380);
  }

  function onPointerUp() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!longPressed.current) fire(defaultText);
  }

  function onPointerLeave() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  const pressProps = {
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };

  const composer =
    composing && typeof document !== 'undefined'
      ? createPortal(
          <SendToThreadComposer
            defaultText={defaultText}
            members={members}
            onCancel={() => setComposing(false)}
            onSend={(text) => {
              setComposing(false);
              fire(text);
            }}
          />,
          document.body
        )
      : null;

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          {...pressProps}
          aria-label={sent ? 'Sent to WhatsApp' : 'Send to WhatsApp'}
          title="Tap to send · Hold to edit"
          className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{
            width: 30,
            height: 30,
            background: sent ? WA_GREEN : WA_GREEN_SOFT,
            transform: sent ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform 200ms ease-out, background 200ms ease-out',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <WAIcon size={16} color={sent ? '#fff' : WA_GREEN_DARK} />
        </button>
        {composer}
      </>
    );
  }

  if (variant === 'block') {
    return (
      <>
        <button
          type="button"
          {...pressProps}
          aria-label={sent ? 'Sent to WhatsApp' : label}
          title="Tap to send · Hold to edit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 text-body"
          style={{
            background: `linear-gradient(135deg, ${WA_GREEN} 0%, ${WA_GREEN_DARK} 100%)`,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <WAIcon size={18} color="#fff" />
          <span>{sent ? 'Sent!' : label}</span>
        </button>
        {composer}
      </>
    );
  }

  // inline (default)
  return (
    <>
      <button
        type="button"
        {...pressProps}
        aria-label={sent ? 'Sent to WhatsApp' : label}
        title="Tap to send · Hold to edit"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 text-caption"
        style={{
          background: sent ? WA_GREEN : WA_GREEN_SOFT,
          color: WA_GREEN_DARK,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <WAIcon size={13} color={sent ? '#fff' : WA_GREEN_DARK} />
        <span>{sent ? 'Sent!' : label}</span>
      </button>
      {composer}
    </>
  );
}
