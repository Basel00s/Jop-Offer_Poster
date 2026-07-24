interface StatusPillProps {
  status: string;
}

const colors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  posted: 'bg-green-100 text-green-800',
  paused: 'bg-slate-100 text-slate-600',
  disabled: 'bg-slate-100 text-slate-600',
  skipped: 'bg-slate-100 text-slate-600',
  cooldown: 'bg-amber-100 text-amber-800',
  checkpoint: 'bg-red-100 text-red-800',
  queued: 'bg-violet-100 text-violet-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  connected: 'bg-green-100 text-green-800',
  not_connected: 'bg-slate-100 text-slate-600',
  submitted: 'bg-violet-100 text-violet-800',
  offer_selected: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const pulseStates = new Set(['queued', 'pending_approval']);

export default function StatusPill({ status }: StatusPillProps) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const pulse = pulseStates.has(key);

  return (
    <span
      className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
        colors[key] || 'bg-slate-100 text-slate-600'
      } ${pulse ? 'animate-pulse-soft' : ''}`}
    >
      {status}
    </span>
  );
}
