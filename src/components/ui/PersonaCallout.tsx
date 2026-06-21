// Usage:
// <PersonaCallout calloutLabel="The Analyst" fact="Backs stats over gut every time." />
// <PersonaCallout calloutLabel="The Optimist" fact="Always backs the underdog." variant="ticket" />
interface PersonaCalloutProps {
  calloutLabel: string;
  fact: string;
  variant?: 'border' | 'ticket';
}

export function PersonaCallout({
  calloutLabel,
  fact,
  variant = 'border',
}: PersonaCalloutProps) {
  if (variant === 'ticket') {
    return (
      <div className="bg-ps-amber-soft rounded-lg px-[11px] py-2">
        <p
          className="text-micro font-bold uppercase text-ps-amber-deep mb-0.5"
          style={{ letterSpacing: '0.06em' }}
        >
          {calloutLabel}
        </p>
        <p className="text-caption font-serif text-ps-text italic">
          {fact}
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-ps-amber-soft rounded-r-lg px-[11px] py-2"
      style={{ borderLeft: '3px solid var(--ps-amber)' }}
    >
      <p
        className="text-micro font-bold uppercase text-ps-amber-deep mb-0.5"
        style={{ letterSpacing: '0.06em' }}
      >
        {calloutLabel}
      </p>
      <p className="text-caption font-serif text-ps-text italic">
        {fact}
      </p>
    </div>
  );
}
