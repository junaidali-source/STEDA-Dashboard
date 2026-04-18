/**
 * Cohort 1 — "The Torch Bearers"
 * Teachers selected by the admin for deeper coaching engagement (April 2026).
 * Names are WhatsApp display names, matched fuzzy to the users table.
 */

export const TORCH_BEARER_NAMES: string[] = [
  'AQ QADEER Kanhar',
  'Aisha Aziz',
  'Asma Jabeen',
  'BASEERAT SULTANA',
  'Farhat Naz',
  'Hira',
  'Huma Rehan',
  'Irshad Ali',
  'Khadija',
  'Muhammad Ali',
  'Nadir Ali Jamali',
  'Nida Aamir',
  'Nigha -E- Zahra',
  'Nimra',
  'Nusrat Shah',
  'Quratulain kamran',
  'Rabail Shams',
  'Rabia bibi',
  'Rakhshanda Abid',
  'Ramsha',
  'Sabah Naz',
  'Samreen Tahir',
  'Shankar Lal',
  'Shumaila Zain',
  'Sima Kareem',
  'Umarah',
  'Zia ul Haque',
]

// Designation → Grade level (Pakistan education system)
export const GRADE_LEVEL: Record<string, string> = {
  'PST':             'Grades 1–5',
  'EST':             'Grades 6–8',
  'HST':             'Grades 9–12',
  'JEST':            'Grades 9–10',
  'JST':             'Grades 9–10',
  'English Teacher': 'Mixed',
  'Teacher':         'Unspecified',
}

export function getGradeLevel(designation: string): string {
  return GRADE_LEVEL[designation] ?? 'Unspecified'
}

// Phone numbers for members whose numbers appear in the Cohort chat
// (added directly with +92 prefixes)
export const TORCH_BEARER_PHONES: string[] = [
  '+92 314 2869615',
  '+92 316 3503972',
  '+92 332 3820475',
  '+92 343 6977451',
]
