import { useState, type ReactNode } from 'react';

interface TestModeOverlayProps {
  sectionName: string;
  isTestMode: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onReset: () => void;
  children: ReactNode;
}

export function TestModeOverlay({ 
  sectionName, 
  isTestMode, 
  isRevealed, 
  onReveal, 
  onReset,
  children 
}: TestModeOverlayProps) {
  const [scratch, setScratch] = useState('');

  if (!isTestMode) {
    return <>{children}</>;
  }

  if (!isRevealed) {
    return (
      <div className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 p-5 animate-in fade-in transition-all">
        <label className="text-sm font-bold text-gray-500 flex items-center gap-2 mb-3">
          💭 Try to recall the <span className="text-orange-600 uppercase tracking-widest">{sectionName}</span> from memory...
        </label>
        <textarea
          autoFocus={isTestMode && !isRevealed}
          value={scratch}
          onChange={(e) => setScratch(e.target.value)}
          placeholder="Write your attempt here..."
          className="w-full min-h-[120px] resize-y bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium placeholder:text-slate-500 shadow-inner"
        />
        <div className="flex justify-end mt-4">
          <button 
            onClick={onReveal}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-teal-700 active:scale-95 transition-all text-sm"
          >
            Reveal Answer &rarr;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in transition-all border-l-4 border-l-teal-500 pl-4 py-2">
      {scratch.trim() && (
        <div className="bg-[#0a0a0a] rounded-lg p-4 relative opacity-80 border border-[#1a1a1a]">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Your attempt:</div>
          <div className="text-sm font-medium text-slate-400 whitespace-pre-wrap">{scratch}</div>
          <button 
             onClick={onReset}
             className="absolute top-3 right-3 text-[10px] uppercase font-bold text-slate-500 hover:text-slate-200 hover:bg-[#141414] px-2 py-1 rounded transition"
          >
            Hide again
          </button>
        </div>
      )}
      {!scratch.trim() && (
        <div className="flex justify-end -mb-6 relative z-10">
          <button 
             onClick={onReset}
             className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-200 hover:bg-[#141414] px-2 py-1 rounded transition bg-[#0a0a0a] border border-[#1a1a1a]"
          >
            Hide again
          </button>
        </div>
      )}
      <div className="pointer-events-none opacity-90 grayscale-[20%]">
        {children}
      </div>
    </div>
  );
}
