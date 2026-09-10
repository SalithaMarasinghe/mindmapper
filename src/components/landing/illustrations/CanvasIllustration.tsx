export function CanvasIllustration() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background grid hint */}
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2d3748" opacity="0.3" strokeWidth="0.5"/>
      </pattern>
      <rect width="400" height="300" fill="url(#grid)" />
      
      {/* Root node */}
      <circle cx="200" cy="60" r="30" fill="#E8A33D" opacity="0.9" />
      <text x="200" y="65" textAnchor="middle" fill="#1C2230" fontSize="14" fontWeight="600">
        Root
      </text>
      
      {/* Curved branch lines */}
      <path d="M200 90 Q200 120 140 120 Q140 150 140 180" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <path d="M200 90 Q200 120 260 120 Q260 150 260 180" stroke="#2F8F84" strokeWidth="2" fill="none" />
      <path d="M200 90 Q200 130 320 130 Q320 160 320 190" stroke="#2F8F84" strokeWidth="2" fill="none" />
      
      {/* Branch nodes */}
      <circle cx="140" cy="210" r="25" fill="#2F8F84" opacity="0.9" />
      <text x="140" y="215" textAnchor="middle" fill="#1C2230" fontSize="12" fontWeight="600">
        Branch
      </text>
      
      <circle cx="260" cy="210" r="25" fill="#2F8F84" opacity="0.9" />
      <text x="260" y="215" textAnchor="middle" fill="#1C2230" fontSize="12" fontWeight="600">
        Branch
      </text>
      
      <circle cx="320" cy="220" r="20" fill="#2F8F84" opacity="0.9" />
      <text x="320" y="224" textAnchor="middle" fill="#1C2230" fontSize="10" fontWeight="600">
        Branch
      </text>
      
      {/* Leaf nodes */}
      <path d="M140 235 L140 255" stroke="#6E6ADE" strokeWidth="2" fill="none" />
      <circle cx="140" cy="270" r="15" fill="#6E6ADE" opacity="0.9" />
      
      <path d="M260 235 L260 255" stroke="#6E6ADE" strokeWidth="2" fill="none" />
      <circle cx="260" cy="270" r="15" fill="#6E6ADE" opacity="0.9" />
      
      {/* Drag handle hint */}
      <circle cx="140" cy="210" r="30" stroke="#2F8F84" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
    </svg>
  );
}
