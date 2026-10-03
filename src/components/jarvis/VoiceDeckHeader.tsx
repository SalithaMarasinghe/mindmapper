import { Volume2, VolumeX, Headphones, Loader2 } from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';

export function VoiceDeckHeader() {
  const isMuted = useJarvisStore((s) => s.isMuted);
  const toggleMute = useJarvisStore((s) => s.toggleMute);
  const isHandsFree = useJarvisStore((s) => s.isHandsFree);
  const isWakeWordLoading = useJarvisStore((s) => s.isWakeWordLoading);
  const toggleHandsFree = useJarvisStore((s) => s.toggleHandsFree);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-text-secondary">Voice deck</span>
        {isHandsFree && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-accent/20 text-accent border border-accent/40 animate-pulse">
            LIVE
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Hands-Free Wake-Word Toggle */}
        <button
          onClick={() => void toggleHandsFree()}
          disabled={isWakeWordLoading}
          aria-label="Toggle Hands-Free"
          title={isHandsFree ? "Hands-Free listening active · Say 'Hey Jarvis'" : "Turn on Hands-Free ('Hey Jarvis')"}
          className={`px-2 py-1 rounded-[8px] text-[11px] border transition-all flex items-center gap-1 cursor-pointer ${
            isHandsFree
              ? 'bg-accent/15 text-accent border-accent/50 font-medium ring-1 ring-accent/30'
              : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {isWakeWordLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
          ) : (
            <Headphones className={`w-3 h-3 ${isHandsFree ? 'text-accent animate-pulse' : ''}`} />
          )}
          <span>{isWakeWordLoading ? '...' : isHandsFree ? 'Hey Jarvis' : 'Hands-Free'}</span>
        </button>

        {/* Mute Button */}
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className={`p-1.5 rounded-[8px] border transition-colors duration-200 ${
            isMuted
              ? 'border-red-800/40 text-red-400'
              : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
