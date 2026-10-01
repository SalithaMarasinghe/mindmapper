import { Volume2, VolumeX } from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';

export function VoiceDeckHeader() {
  const isMuted = useJarvisStore((s) => s.isMuted);
  const toggleMute = useJarvisStore((s) => s.toggleMute);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-text-secondary">Voice deck</span>
      <button
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        className={`p-1.5 rounded-[8px] border transition-colors duration-200 ${
          isMuted
            ? 'border-red-800/40 text-red-400'
            : 'border-border text-text-muted hover:text-text'
        }`}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
