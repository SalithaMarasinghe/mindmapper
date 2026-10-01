

interface QuickRefinementChipsProps {
  onRefinement: (text: string) => void;
}

const REFINEMENTS = [
  'More concise',
  'Strict TypeScript',
  'Tailwind v4',
  'Include tests',
];

export function QuickRefinementChips({ onRefinement }: QuickRefinementChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {REFINEMENTS.map((text) => (
        <button
          key={text}
          onClick={() => onRefinement(text)}
          className="border border-dashed border-border text-text-muted text-xs rounded-full px-2.5 py-1 hover:border-border-strong hover:text-text-secondary transition-colors duration-200 cursor-pointer"
        >
          + {text}
        </button>
      ))}
    </div>
  );
}
