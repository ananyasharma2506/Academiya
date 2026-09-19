export type AppType =
  | 'student-intelligence'
  | 'class-insights'
  | 'diagnostic-lab'
  | 'intervention-center'
  | 'my-learning'
  | 'practice-lab'
  | 'code-lab'
  | 'progress-lab'
  | 'settings';

export interface AppDefinition {
  id: AppType;
  name: string;
  category: 'teacher' | 'student' | 'shared';
  icon: string;
  description: string;
  allowedRoles: Array<'teacher' | 'student'>;
  defaultSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };
}

export const APP_REGISTRY: AppDefinition[] = [
  // ── Teacher Apps ──────────────────────────────────────────
  {
    id: 'student-intelligence',
    name: 'Student Intelligence',
    category: 'teacher',
    icon: '🧠',
    description: 'Inspect individual learning gaps and concrete evidence trails',
    allowedRoles: ['teacher'],
    defaultSize: { width: 960, height: 680 },
    defaultPosition: { x: 70, y: 50 },
  },
  {
    id: 'class-insights',
    name: 'Class Insights',
    category: 'teacher',
    icon: '📊',
    description: 'Class-wide conceptual gap aggregations and heatmaps',
    allowedRoles: ['teacher'],
    defaultSize: { width: 900, height: 620 },
    defaultPosition: { x: 90, y: 65 },
  },
  {
    id: 'diagnostic-lab',
    name: 'Diagnostic Lab',
    category: 'teacher',
    icon: '🔬',
    description: 'Targeted probe generation and misconception isolation',
    allowedRoles: ['teacher'],
    defaultSize: { width: 980, height: 680 },
    defaultPosition: { x: 80, y: 55 },
  },
  {
    id: 'intervention-center',
    name: 'Intervention Center',
    category: 'teacher',
    icon: '🎯',
    description: 'Remediation plan design, assigned exercises, and progress tracking',
    allowedRoles: ['teacher'],
    defaultSize: { width: 960, height: 660 },
    defaultPosition: { x: 100, y: 70 },
  },

  // ── Student Apps ──────────────────────────────────────────
  {
    id: 'my-learning',
    name: 'My Learning',
    category: 'student',
    icon: '💡',
    description: 'Unified learning cockpit with active interventions & progress',
    allowedRoles: ['student', 'teacher'],
    defaultSize: { width: 880, height: 600 },
    defaultPosition: { x: 80, y: 50 },
  },
  {
    id: 'practice-lab',
    name: 'Practice Lab',
    category: 'student',
    icon: '📝',
    description: 'Interactive MCQ & multi-choice conceptual practice',
    allowedRoles: ['student', 'teacher'],
    defaultSize: { width: 860, height: 620 },
    defaultPosition: { x: 90, y: 60 },
  },
  {
    id: 'code-lab',
    name: 'Code Lab',
    category: 'student',
    icon: '💻',
    description: 'Live coding environment with local test verification & AI hints',
    allowedRoles: ['student', 'teacher'],
    defaultSize: { width: 1050, height: 700 },
    defaultPosition: { x: 60, y: 40 },
  },
  {
    id: 'progress-lab',
    name: 'Progress Lab',
    category: 'student',
    icon: '📈',
    description: 'Inspectable before/after evidence comparison and delta mastery',
    allowedRoles: ['student', 'teacher'],
    defaultSize: { width: 900, height: 640 },
    defaultPosition: { x: 110, y: 75 },
  },

  // ── Shared Apps ───────────────────────────────────────────
  {
    id: 'settings',
    name: 'Settings',
    category: 'shared',
    icon: '⚙️',
    description: 'User profile, appearance theme, and display preferences',
    allowedRoles: ['teacher', 'student'],
    defaultSize: { width: 680, height: 520 },
    defaultPosition: { x: 130, y: 80 },
  },
];

export function getAppsForRole(role: 'teacher' | 'student'): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.allowedRoles.includes(role));
}

export function getAppById(id: AppType): AppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}
