import { Loader2 } from 'lucide-react';

interface SystemStatusRowProps {
  text: string;
}

export function SystemStatusRow({ text }: SystemStatusRowProps) {
  return (
    <div className="flex items-center gap-2 py-2 px-1 text-xs text-text-muted">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span
        style={{
          background: 'linear-gradient(90deg, var(--text-muted) 25%, var(--text-secondary) 50%, var(--text-muted) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s infinite linear',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
        className="font-medium"
      >
        {text}
      </span>
    </div>
  );
}
