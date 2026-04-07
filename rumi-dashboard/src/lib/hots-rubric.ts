/**
 * HOTS classroom observation indicators shown on the Coaching dashboard.
 * Order matches `analysis_data.scores.goal1_total` … `goal5_total` from completed sessions.
 */
export const HOTS_OBSERVATION_INDICATORS = [
  {
    dimension: 1,
    dataKey: 'avg_g1' as const,
    label: 'HOTS assessment',
    description:
      'Formative checks and prompts that elicit reasoning, analysis, or evaluation — not recall only.',
  },
  {
    dimension: 2,
    dataKey: 'avg_g2' as const,
    label: 'Cognitive engagement',
    description: 'Students are actively grappling with ideas, explaining, or applying concepts.',
  },
  {
    dimension: 3,
    dataKey: 'avg_g3' as const,
    label: 'Rigorous instruction',
    description: 'Explanations, examples, and tasks target higher-order thinking (analyze, evaluate, create).',
  },
  {
    dimension: 4,
    dataKey: 'avg_g4' as const,
    label: 'Reasoning discourse',
    description: 'Classroom talk builds on ideas, justifications, and arguments.',
  },
  {
    dimension: 5,
    dataKey: 'avg_g5' as const,
    label: 'Climate for thinking',
    description: 'Time, norms, and management support sustained thinking and intellectual risk-taking.',
  },
] as const
