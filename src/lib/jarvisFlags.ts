// Centralized Feature Flags for Jarvis Voice I/O
// Active by default with the 3-Free Account Cascading Engine + Browser Speech Fallback ($0.00 spend).
// To disable on a specific client for text-only mode:
//   localStorage.setItem('FLAG_ENABLE_VOICE_INPUT', 'false')
//   localStorage.setItem('FLAG_ENABLE_VOICE_OUTPUT', 'false')

export const isVoiceInputEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('FLAG_ENABLE_VOICE_INPUT') !== 'false';
};

export const isVoiceOutputEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage?.getItem('FLAG_ENABLE_VOICE_OUTPUT') !== 'false';
};
