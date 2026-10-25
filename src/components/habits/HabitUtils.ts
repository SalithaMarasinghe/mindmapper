export function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours > 0 && remainingMins === 0) {
    return `${hours}h`;
  }
  if (hours > 0 && remainingMins === 30) {
    return `${hours}.5h`;
  }
  if (hours > 0) {
    return `${hours}h ${remainingMins}m`;
  }
  return `${remainingMins}m`;
}

export function getSmartSuggestionChips(targetMinutes: number): number[] {
  const target = Math.max(5, targetMinutes || 30);
  const set = new Set<number>();
  set.add(0);

  if (target <= 30) {
    set.add(10);
    set.add(15);
    set.add(20);
    set.add(target);
    set.add(target + 15);
  } else if (target <= 60) {
    set.add(15);
    set.add(30);
    set.add(45);
    set.add(target);
    set.add(target + 30);
  } else if (target <= 120) {
    set.add(30);
    set.add(60);
    set.add(90);
    set.add(target);
    set.add(target + 30);
  } else {
    set.add(30);
    set.add(60);
    set.add(90);
    set.add(120);
    set.add(target);
    set.add(target + 60);
  }

  return Array.from(set).sort((a, b) => a - b);
}

export const PRESET_HABIT_COLORS = [
  { label: 'Violet', hex: '#8b5cf6' },
  { label: 'Sky', hex: '#0284c7' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Amber', hex: '#f59e0b' },
  { label: 'Rose', hex: '#f43f5e' },
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Teal', hex: '#14b8a6' },
  { label: 'Pink', hex: '#ec4899' },
];
