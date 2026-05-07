'use client';

// Usage:
// <SendToThread defaultText="Man City 1–0 Liverpool. My pick locked! 🔥" />
// <SendToThread defaultText="Check this round out" label="Share round" variant="block" />
// <SendToThread defaultText="Send to WhatsApp" variant="icon" />
import { useState } from 'react';
import { WAIcon } from '@/components/ui/WAIcon';

interface SendToThreadProps {
  defaultText: string;
  label?: string;
  variant?: 'inline' | 'block' | 'icon';
}

const WA_GREEN = '#0aa86d';
const WA_GREEN_SOFT = 'rgba(10, 168, 109, 0.14)';

export function SendToThread({
  defaultText,
  label = 'Send',
  variant = 'inline',
}: SendToThreadProps) {
  const [sent, setSent] = useState(false);

  function handleClick() {
    const url = `https://wa.me/?text=${encodeURIComponent(defaultText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSent(true);
    setTimeout(() => setSent(false), 2400);
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={sent ? 'Sent to WhatsApp' : 'Send to WhatsApp'}
        className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          width: 30,
          height: 30,
          background: WA_GREEN_SOFT,
        }}
      >
        <WAIcon size={16} color={WA_GREEN} />
      </button>
    );
  }

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={sent ? 'Sent to WhatsApp' : label}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          background: `linear-gradient(135deg, ${WA_GREEN} 0%, #07875a 100%)`,
          fontSize: 14,
        }}
      >
        <WAIcon size={18} color="#fff" />
        <span>{sent ? 'Sent!' : label}</span>
      </button>
    );
  }

  // inline (default)
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={sent ? 'Sent to WhatsApp' : label}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{
        background: WA_GREEN_SOFT,
        color: WA_GREEN,
        fontSize: 12,
      }}
    >
      <WAIcon size={13} color={WA_GREEN} />
      <span>{sent ? 'Sent!' : label}</span>
    </button>
  );
}
