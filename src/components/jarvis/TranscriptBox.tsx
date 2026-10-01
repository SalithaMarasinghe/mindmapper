

export function TranscriptBox({ transcript }: { transcript: string }) {
  return (
    <div className="bg-surface rounded-[8px] border border-border p-2.5 min-h-[40px] text-xs text-text transition-all duration-200">
      {!transcript ? (
        <span className="text-text-muted italic">Your words will appear here…</span>
      ) : (
        <span className="animate-in fade-in duration-300">{transcript}</span>
      )}
    </div>
  );
}
