// Shared chart palette for the 5 Rumi features, anchored on the brand's
// navy + coral (see Documents/Rumi Agents .../skills/rumi-brand) and validated
// for dark-surface categorical use with the dataviz skill's CVD checker
// (node scripts/validate_palette.js — all checks pass in this exact order;
// reordering the slots can reintroduce a failing adjacent pair).
export const FEATURE_COLORS: Record<string, string> = {
  'Lesson Plans':        '#4F74E3', // navy
  'Coaching Sessions':   '#D9572E', // coral
  'Coaching':            '#D9572E',
  'Reading Assessments': '#9085E9', // violet
  'Reading':             '#9085E9',
  'Video Generation':    '#C98500', // gold
  'Image Analysis':      '#D55181', // magenta
}

export const FEATURE_COLOR_FALLBACK = '#64748B'

export function featureColor(label: string): string {
  return FEATURE_COLORS[label] ?? FEATURE_COLOR_FALLBACK
}

// Ordinal ramp for "how many features has a teacher tried" (0..4+) — a
// magnitude/depth concept, so it gets one hue light→dark rather than the
// categorical set above (dataviz rule: sequential/ordinal = one hue).
export const ENGAGEMENT_DEPTH_RAMP: Record<number, string> = {
  0: '#334155',
  1: '#93C5FD',
  2: '#60A5FA',
  3: '#3B82F6',
  4: '#1D4ED8',
}
