export function ShareIllustration() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main map */}
      <circle cx="200" cy="80" r="25" fill="#E8A33D" opacity="0.9" />
      <path d="M200 105 L200 130 L140 130 L140 155" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <circle cx="140" cy="175" r="20" fill="#2F8F84" opacity="0.9" />
      <path d="M200 105 L200 130 L260 130 L260 155" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <circle cx="260" cy="175" r="20" fill="#2F8F84" opacity="0.9" />
      
      {/* Share link card */}
      <rect x="100" y="200" width="200" height="60" rx="8" fill="#1e2433" stroke="#2d3748" strokeWidth="1" />
      <rect x="115" y="218" width="20" height="20" rx="4" fill="#2F8F84" opacity="0.8" />
      <path d="M125 223 L125 233 M120 228 L130 228" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="145" y="222" width="130" height="12" rx="6" fill="#2d3748" opacity="0.5" />
      <rect x="145" y="240" width="80" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      
      {/* User avatars */}
      <circle cx="60" cy="100" r="15" fill="#6E6ADE" opacity="0.6" />
      <circle cx="340" cy="100" r="15" fill="#E8A33D" opacity="0.6" />
      <circle cx="340" cy="140" r="15" fill="#2F8F84" opacity="0.6" />
      
      {/* Connection lines to users */}
      <path d="M75 100 L175 80" stroke="#2d3748" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
      <path d="M325 100 L225 80" stroke="#2d3748" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
      <path d="M325 140 L280 175" stroke="#2d3748" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
    </svg>
  );
}
