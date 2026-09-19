import type { AppType } from '../store/useOSStore';

export interface AppDefinition {
  id: AppType;
  name: string;
  icon: string;
  defaultSize: { width: number; height: number };
  defaultPosition: { x: number; y: number };
  allowedRoles: Array<'student' | 'teacher'>;
  singleton: boolean;
}

// These screens already exist under /app and consume the root server's API.
export const APP_REGISTRY: AppDefinition[] = [
  { id: 'my-learning', name: 'My Learning', icon: '💡', defaultSize: { width: 880, height: 600 }, defaultPosition: { x: 80, y: 50 }, allowedRoles: ['student', 'teacher'], singleton: true },
  { id: 'practice-lab', name: 'Practice Lab', icon: '📝', defaultSize: { width: 860, height: 620 }, defaultPosition: { x: 90, y: 60 }, allowedRoles: ['student', 'teacher'], singleton: true },
  { id: 'code-lab', name: 'Code Lab', icon: '💻', defaultSize: { width: 1050, height: 700 }, defaultPosition: { x: 60, y: 40 }, allowedRoles: ['student', 'teacher'], singleton: true },
  { id: 'progress-lab', name: 'Progress Lab', icon: '📈', defaultSize: { width: 900, height: 640 }, defaultPosition: { x: 110, y: 75 }, allowedRoles: ['student', 'teacher'], singleton: true },
  { id: 'student-intelligence', name: 'Student Intelligence', icon: '🧠', defaultSize: { width: 960, height: 680 }, defaultPosition: { x: 70, y: 50 }, allowedRoles: ['teacher'], singleton: true },
  { id: 'class-insights', name: 'Class Insights', icon: '📊', defaultSize: { width: 900, height: 620 }, defaultPosition: { x: 90, y: 65 }, allowedRoles: ['teacher'], singleton: true },
  { id: 'settings', name: 'Settings', icon: '⚙️', defaultSize: { width: 680, height: 520 }, defaultPosition: { x: 130, y: 80 }, allowedRoles: ['student', 'teacher'], singleton: true },
];

export function getAppsForRole(role: 'student' | 'teacher'): AppDefinition[] {
  return APP_REGISTRY.filter(app => app.allowedRoles.includes(role));
}

export function getAppById(id: AppType): AppDefinition | undefined {
  return APP_REGISTRY.find(app => app.id === id);
}
