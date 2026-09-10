export function NodeEditorIllustration() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Card background */}
      <rect x="50" y="30" width="300" height="240" rx="12" fill="#1e2433" stroke="#2d3748" strokeWidth="1" />
      
      {/* Node header */}
      <rect x="50" y="30" width="300" height="40" rx="12" fill="#6E6ADE" opacity="0.2" />
      <rect x="50" y="58" width="300" height="12" fill="#6E6ADE" opacity="0.2" />
      <circle cx="80" cy="50" r="12" fill="#6E6ADE" opacity="0.9" />
      <text x="80" y="54" textAnchor="middle" fill="#1C2230" fontSize="8" fontWeight="600">
        Node
      </text>
      
      {/* Definition section */}
      <text x="70" y="95" fill="#e2e8f0" fontSize="11" fontWeight="600">
        Definition
      </text>
      <rect x="70" y="105" width="260" height="8" rx="4" fill="#2d3748" opacity="0.5" />
      <rect x="70" y="120" width="200" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      
      {/* Mental model section */}
      <text x="70" y="150" fill="#e2e8f0" fontSize="11" fontWeight="600">
        Mental Model
      </text>
      <rect x="70" y="160" width="240" height="8" rx="4" fill="#2d3748" opacity="0.5" />
      <rect x="70" y="175" width="180" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      
      {/* Key points section */}
      <text x="70" y="205" fill="#e2e8f0" fontSize="11" fontWeight="600">
        Key Points
      </text>
      <rect x="75" y="218" width="4" height="4" rx="2" fill="#2F8F84" opacity="0.8" />
      <rect x="85" y="215" width="230" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      <rect x="75" y="233" width="4" height="4" rx="2" fill="#2F8F84" opacity="0.8" />
      <rect x="85" y="230" width="200" height="8" rx="4" fill="#2d3748" opacity="0.3" />
      <rect x="75" y="248" width="4" height="4" rx="2" fill="#2F8F84" opacity="0.8" />
      <rect x="85" y="245" width="210" height="8" rx="4" fill="#2d3748" opacity="0.3" />
    </svg>
  );
}
