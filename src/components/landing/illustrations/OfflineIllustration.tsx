export function OfflineIllustration() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Device frame */}
      <rect x="100" y="50" width="200" height="140" rx="16" fill="#1e2433" stroke="#2d3748" strokeWidth="2" />
      
      {/* Mini map inside device */}
      <circle cx="200" cy="100" r="20" fill="#E8A33D" opacity="0.9" />
      <path d="M200 120 L200 140 L150 140 L150 160" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <circle cx="150" cy="175" r="15" fill="#2F8F84" opacity="0.9" />
      <path d="M200 120 L200 140 L250 140 L250 160" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <circle cx="250" cy="175" r="15" fill="#2F8F84" opacity="0.9" />
      
      {/* WiFi icon with X (offline) */}
      <circle cx="320" cy="80" r="25" fill="#1e2433" opacity="0.3" />
      <path d="M310 70 Q320 60 330 70" stroke="#94a3b8" strokeWidth="2" fill="none" opacity="0.3" />
      <path d="M305 75 Q320 65 335 75" stroke="#94a3b8" strokeWidth="2" fill="none" opacity="0.3" />
      <path d="M312 85 L328 85" stroke="#DC2626" strokeWidth="3" />
      <path d="M320 77 L320 93" stroke="#DC2626" strokeWidth="3" />
      
      {/* Sync arrows */}
      <path d="M80 220 L100 220 L100 210 M100 230 L100 220 L90 220" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <path d="M320 220 L300 220 L300 210 M300 230 L300 220 L310 220" stroke="#2F8F84" strokeWidth="2" fill="none" />
      
      {/* Cloud sync representation */}
      <ellipse cx="200" cy="240" rx="40" ry="20" fill="#2F8F84" opacity="0.2" />
      <path d="M180 240 L180 250 M200 235 L200 255 M220 240 L220 250" stroke="#2F8F84" strokeWidth="2" opacity="0.5" />
    </svg>
  );
}
