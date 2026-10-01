export type RGB = [number, number, number];

export interface OrbColorPalette {
  idle: RGB;
  active: RGB;
  muted: RGB;
  speaking: RGB;
}

// Fallback RGB palettes matching design tokens
export const DEFAULT_ORB_COLORS: OrbColorPalette = {
  idle: [237, 237, 237],      // #EDEDED (--orb-idle)
  active: [94, 234, 212],     // #5EEAD4 (--orb-active)
  muted: [139, 139, 146],     // #8B8B92 (--orb-muted)
  speaking: [165, 235, 224],  // 50/50 blend of idle & active
};

/**
 * Parses hex (#RRGGBB) or rgb(r, g, b) strings into [r, g, b] numbers.
 */
export function parseCssColor(str: string, fallback: RGB): RGB {
  const trimmed = str.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
  }

  return fallback;
}

/**
 * Linearly interpolates two RGB colors.
 */
export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  const clampedT = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * clampedT),
    Math.round(a[1] + (b[1] - a[1]) * clampedT),
    Math.round(a[2] + (b[2] - a[2]) * clampedT),
  ];
}

/**
 * Formats an RGB tuple into an rgba(r, g, b, a) CSS string.
 */
export function toRgbaString(rgb: RGB, alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Resolves CSS variables from DOM computed styles.
 */
export function getOrbColorsFromDom(element: HTMLElement | null): OrbColorPalette {
  if (typeof window === 'undefined' || !element) {
    return DEFAULT_ORB_COLORS;
  }

  try {
    const style = getComputedStyle(element);
    const idleStr = style.getPropertyValue('--orb-idle');
    const activeStr = style.getPropertyValue('--orb-active');
    const mutedStr = style.getPropertyValue('--orb-muted');

    const idle = parseCssColor(idleStr, DEFAULT_ORB_COLORS.idle);
    const active = parseCssColor(activeStr, DEFAULT_ORB_COLORS.active);
    const muted = parseCssColor(mutedStr, DEFAULT_ORB_COLORS.muted);

    // Speaking is the 50/50 blend of idle and active
    const speaking = lerpRGB(idle, active, 0.5);

    return { idle, active, muted, speaking };
  } catch {
    return DEFAULT_ORB_COLORS;
  }
}

/**
 * Maps 64 AnalyserNode frequency bins symmetrically to 40 radial bars.
 * Emphasizes the 80 - 3000 Hz human voice spectrum.
 */
export function mapFrequencyDataToSymmetricBars(
  dataArray: ArrayLike<number>,
  barCount = 40
): number[] {
  const halfCount = Math.floor(barCount / 2); // 20 bars for left half, 20 for right half
  const halfTargets = new Float32Array(halfCount);

  // We have ~64 bins from fftSize 128 (bin 0 is DC, bins 1 to 14 cover ~80 to ~3200 Hz).
  // Map halfCount bars non-linearly across speech frequencies:
  for (let i = 0; i < halfCount; i++) {
    const normIndex = i / (halfCount - 1);
    // Exponential curve giving more resolution to voice fundamentals and lower harmonics
    const binFloat = 1 + Math.pow(normIndex, 1.35) * 15;
    const lowerBin = Math.floor(binFloat);
    const upperBin = Math.min(dataArray.length - 1, lowerBin + 1);
    const fraction = binFloat - lowerBin;

    const val1 = dataArray[lowerBin] || 0;
    const val2 = dataArray[upperBin] || 0;
    const interpolatedVal = val1 * (1 - fraction) + val2 * fraction;

    // Normalize to 0-1 range with perceptual speech boost
    const normalized = Math.min(1, (interpolatedVal / 255) * 1.3);
    halfTargets[i] = normalized;
  }

  // Build symmetric 40-bar circle:
  // Top-center starts at index 0 and 39, flowing around clockwise and counterclockwise
  const fullTargets: number[] = new Array(barCount);
  for (let i = 0; i < halfCount; i++) {
    const amplitude = halfTargets[i];
    fullTargets[i] = amplitude;
    fullTargets[barCount - 1 - i] = amplitude;
  }

  return fullTargets;
}

/**
 * Calculates synthetic idle breathing wave (period ~4000ms).
 */
export function getIdleBarTargets(timeMs: number, barCount = 40): number[] {
  const targets: number[] = new Array(barCount);
  const cycle = (timeMs % 4000) / 4000;
  for (let i = 0; i < barCount; i++) {
    const barPhase = i / barCount;
    // Traveling wave around the ring
    const wave = Math.sin((barPhase - cycle) * Math.PI * 2);
    // Map wave from -1..1 to 0.25..0.35 (low amplitude breathing)
    targets[i] = 0.25 + 0.10 * ((wave + 1) / 2);
  }
  return targets;
}

/**
 * Calculates synthetic thinking comet wave (period ~1800ms).
 */
export function getThinkingBarTargets(timeMs: number, barCount = 40): number[] {
  const targets: number[] = new Array(barCount);
  const cycle = (timeMs % 1800) / 1800;
  const cometPos = cycle * barCount;

  for (let i = 0; i < barCount; i++) {
    // Angular distance on circle (0 to barCount / 2)
    const rawDist = Math.abs(i - cometPos);
    const circularDist = Math.min(rawDist, barCount - rawDist);
    // Smooth bell curve tail for comet
    const cometIntensity = Math.exp(-Math.pow(circularDist / 3.2, 2));
    // Base 0.18 amplitude, comet peaks at 0.92
    targets[i] = 0.18 + 0.74 * cometIntensity;
  }
  return targets;
}

/**
 * Calculates synthetic speaking pseudo-random speech envelope rhythm.
 */
export function getSpeakingSyntheticBarTargets(timeMs: number, barCount = 40): number[] {
  const targets: number[] = new Array(barCount);
  // Multi-harmonic modulation mimicking speech cadences (3-6 Hz syllable rhythm)
  const syllable1 = Math.sin(timeMs * 0.008);
  const syllable2 = Math.cos(timeMs * 0.015);
  const envelope = Math.max(0, syllable1 * 0.6 + syllable2 * 0.4);

  const halfCount = Math.floor(barCount / 2);
  for (let i = 0; i < halfCount; i++) {
    const wave1 = Math.sin(timeMs * 0.012 + i * 0.45);
    const wave2 = Math.cos(timeMs * 0.019 - i * 0.35);
    const localVariance = Math.max(0, 0.4 + 0.6 * (wave1 * 0.5 + wave2 * 0.5));
    const amp = Math.min(1, 0.20 + 0.75 * envelope * localVariance);

    targets[i] = amp;
    targets[barCount - 1 - i] = amp;
  }
  return targets;
}
