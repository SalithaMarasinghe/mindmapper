export function TestModeIllustration() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Question card */}
      <rect x="50" y="40" width="300" height="100" rx="12" fill="#1e2433" stroke="#2d3748" strokeWidth="1" />
      
      <text x="70" y="70" fill="#e2e8f0" fontSize="12" fontWeight="600">
        Question
      </text>
      <rect x="70" y="85" width="260" height="8" rx="4" fill="#2d3748" opacity="0.5" />
      <rect x="70" y="100" width="200" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      
      {/* Answer options (blurred/hidden) */}
      <rect x="50" y="160" width="300" height="40" rx="8" fill="#1e2433" stroke="#2d3748" strokeWidth="1" strokeDasharray="4 2" />
      <rect x="70" y="175" width="40" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      <rect x="120" y="175" width="180" height="8" rx="4" fill="#2d3748" opacity="0.2" />
      
      <rect x="50" y="210" width="300" height="40" rx="8" fill="#1e2433" stroke="#2d3748" strokeWidth="1" strokeDasharray="4 2" />
      <rect x="70" y="225" width="40" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      <rect x="120" y="225" width="160" height="8" rx="4" fill="#2d3748" opacity="0.2" />
      
      {/* Progress indicator */}
      <text x="50" y="275" fill="#94a3b8" fontSize="10">
        Progress
      </text>
      <rect x="50" y="285" width="300" height="6" rx="3" fill="#2d3748" opacity="0.3" />
      <rect x="50" y="285" width="180" height="6" rx="3" fill="#2F8F84" opacity="0.8" />
    </svg>
  );
}
