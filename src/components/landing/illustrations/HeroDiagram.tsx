export function HeroDiagram() {
  return (
    <svg 
      viewBox="0 0 400 300" 
      className="w-full h-auto"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Root node */}
      <circle cx="200" cy="50" r="25" fill="#E8A33D" opacity="0.9" />
      <text x="200" y="55" textAnchor="middle" fill="#1C2230" fontSize="12" fontWeight="600">
        Root
      </text>
      
      {/* Branch line 1 */}
      <path d="M200 75 L200 100 L120 100 L120 125" stroke="#2F8F84" strokeWidth="2" fill="none" />
      
      {/* Branch node 1 */}
      <circle cx="120" cy="150" r="20" fill="#2F8F84" opacity="0.9" />
      <text x="120" y="155" textAnchor="middle" fill="#1C2230" fontSize="10" fontWeight="600">
        Branch
      </text>
      
      {/* Branch line 2 */}
      <path d="M200 75 L200 100 L280 100 L280 125" stroke="#2F8F84" strokeWidth="2" fill="none" />
      
      {/* Branch node 2 */}
      <circle cx="280" cy="150" r="20" fill="#2F8F84" opacity="0.9" />
      <text x="280" y="155" textAnchor="middle" fill="#1C2230" fontSize="10" fontWeight="600">
        Branch
      </text>
      
      {/* Leaf line from branch 1 */}
      <path d="M120 170 L120 190" stroke="#6E6ADE" strokeWidth="2" fill="none" />
      
      {/* Expanded leaf node with study card preview */}
      <g>
        <rect x="70" y="190" width="100" height="80" rx="8" fill="#6E6ADE" opacity="0.15" stroke="#6E6ADE" strokeWidth="2" />
        <circle cx="120" cy="210" r="12" fill="#6E6ADE" opacity="0.9" />
        <text x="120" y="214" textAnchor="middle" fill="#1C2230" fontSize="8" fontWeight="600">
          Leaf
        </text>
        <rect x="80" y="228" width="80" height="6" rx="3" fill="#6E6ADE" opacity="0.4" />
        <rect x="80" y="240" width="60" height="6" rx="3" fill="#6E6ADE" opacity="0.3" />
        <rect x="80" y="252" width="70" height="6" rx="3" fill="#6E6ADE" opacity="0.3" />
      </g>
      
      {/* Leaf from branch 2 */}
      <path d="M280 170 L280 190" stroke="#6E6ADE" strokeWidth="2" fill="none" />
      <circle cx="280" cy="210" r="12" fill="#6E6ADE" opacity="0.9" />
      <text x="280" y="214" textAnchor="middle" fill="#1C2230" fontSize="8" fontWeight="600">
        Leaf
      </text>
    </svg>
  );
}
