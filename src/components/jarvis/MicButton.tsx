import { Mic, MicOff, VolumeX } from 'lucide-react';

interface MicButtonProps {
  isRecording: boolean;
  isDisabled: boolean;
  isSpeaking: boolean;
  onToggle: () => void;
  onStopSpeaking: () => void;
}

export function MicButton({
  isRecording,
  isDisabled,
  isSpeaking,
  onToggle,
  onStopSpeaking,
}: MicButtonProps) {
  const handleClick = () => {
    if (isDisabled) return;
    if (isSpeaking) {
      onStopSpeaking();
      onToggle();
    } else {
      onToggle();
    }
  };

  let bgClass = 'bg-white text-[#0B0B0C]';
  let label = 'Start recording';
  let Icon = Mic;

  if (isSpeaking) {
    bgClass = 'bg-surface-2 text-text border border-border';
    label = 'Interrupt & speak';
    Icon = VolumeX;
  } else if (isRecording) {
    bgClass = 'bg-accent text-[#0B0B0C]';
    label = 'Stop recording';
    Icon = MicOff;
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={label}
      className={`w-full rounded-[12px] py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] ${bgClass} ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
