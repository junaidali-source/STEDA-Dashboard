/** Normalise CSV district labels for aggregation + geo lookup. */
export function normalizeStedaDistrict(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
}

/**
 * Approximate centroids for STEDA list districts (Sindh + Karachi divisions).
 * Used for map markers — not survey-accurate boundaries.
 */
const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  badin: [24.657, 68.842],
  dadu: [26.7323, 67.776],
  ghotki: [27.847, 69.732],
  hyderabad: [25.396, 68.377],
  jacobabad: [28.281, 68.437],
  jamshoro: [25.434, 68.281],
  'karachi central': [24.886, 67.011],
  'karachi east': [24.892, 67.05],
  'karachi korangi': [24.792, 67.124],
  'karachi malir': [25.086, 67.195],
  'karachi south': [24.814, 67.03],
  'karachi west': [24.946, 66.995],
  'karachi kaemari': [24.811, 66.955],
  'karachi kemari': [24.811, 66.955],
  karachi: [24.8607, 67.0011],
  'kashmore kandhkot': [28.432, 69.584],
  'khairpur mirs': [27.529, 68.761],
  larkana: [27.5619, 68.2064],
  matiari: [25.597, 68.446],
  mirpurkhas: [25.525, 69.015],
  'naushehro feroze': [26.84, 68.122],
  'naushahro feroze': [26.84, 68.122],
  'qamber shahdadkot': [27.949, 67.924],
  sanghar: [26.046, 68.949],
  sba: [26.247, 68.409],
  'shaheed benazirabad': [26.247, 68.409],
  shikarpur: [27.955, 68.638],
  sukkur: [27.7044, 68.8574],
  sujawal: [24.607, 68.093],
  thatta: [24.746, 67.923],
  tharparkar: [24.641, 69.155],
  'tando allahyar': [25.461, 68.719],
  'tando muhammad khan': [25.123, 68.535],
  umerkot: [25.361, 69.741],
}

const SINDH_FALLBACK: [number, number] = [26.1, 68.5]

function keyForLookup(normalized: string): string {
  return normalized.toLowerCase()
}

export function getDistrictLatLng(districtRaw: string): [number, number] {
  const n = normalizeStedaDistrict(districtRaw)
  if (!n) return SINDH_FALLBACK
  const k = keyForLookup(n)
  if (DISTRICT_CENTROIDS[k]) return DISTRICT_CENTROIDS[k]
  // Try without trailing space variants
  const compact = k.replace(/\s+/g, ' ').trim()
  if (DISTRICT_CENTROIDS[compact]) return DISTRICT_CENTROIDS[compact]
  return SINDH_FALLBACK
}

/** 0 = low onboarding, 1 = high — for marker colour */
export function onboardingHue(pct: number): string {
  if (pct >= 70) return '#16a34a'
  if (pct >= 40) return '#ca8a04'
  if (pct > 0) return '#ea580c'
  return '#64748b'
}
