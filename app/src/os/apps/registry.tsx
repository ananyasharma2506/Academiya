import React from 'react';
import { LightbulbOn } from '@keyline-icons/react';
import {
  Brain,
  BarChart3,
  Microscope,
  Target,
  FileText,
  Code2,
  TrendingUp,
  Settings,
  BookOpen,
} from 'lucide-react';
import type { AppType } from '../store/useOSStore';

export interface AppDefinition {
  id: AppType;
  name: string;
  category: 'teacher' | 'student' | 'shared';
  icon: React.ReactNode;
  description: string;
  allowedRoles: Array<'teacher' | 'student'>;
}

export const APP_REGISTRY: AppDefinition[] = [
  // ── Teacher Apps ──────────────────────────────────────────
  {
    id: 'student-intelligence',
    name: 'Student Intelligence',
    category: 'teacher',
    icon: <Brain size={24} strokeWidth={1.8} />,
    description: 'Inspect individual learning gaps and concrete evidence trails',
    allowedRoles: ['teacher'],
  },
  {
    id: 'class-insights',
    name: 'Class Insights',
    category: 'teacher',
    icon: <BarChart3 size={24} strokeWidth={1.8} />,
    description: 'Class-wide conceptual gap aggregations and heatmaps',
    allowedRoles: ['teacher'],
  },
  {
    id: 'diagnostic-lab',
    name: 'Diagnostic Lab',
    category: 'teacher',
    icon: <Microscope size={24} strokeWidth={1.8} />,
    description: 'Targeted probe generation and misconception isolation',
    allowedRoles: ['teacher'],
  },
  {
    id: 'intervention-center',
    name: 'Intervention Center',
    category: 'teacher',
    icon: <Target size={24} strokeWidth={1.8} />,
    description: 'Assign scaffolded remedial plans and targeted practice sets',
    allowedRoles: ['teacher'],
  },

  // ── Student Apps ──────────────────────────────────────────
  {
    id: 'my-learning',
    name: 'My Learning',
    category: 'student',
    icon: <LightbulbOn width={26} height={26} strokeWidth={2} className="keyline-theme-icon" />,
    description: 'Unified learning cockpit with active interventions & progress',
    allowedRoles: ['student', 'teacher'],
  },
  {
    id: 'learn',
    name: 'Learn',
    category: 'student',
    icon: <BookOpen size={24} strokeWidth={1.8} />,
    description: 'Structured 1st to 3rd year CS curriculum: DSA, DBMS & Networks',
    allowedRoles: ['student', 'teacher'],
  },
  {
    id: 'practice-lab',
    name: 'Practice Lab',
    category: 'student',
    icon: <FileText size={24} strokeWidth={1.8} />,
    description: 'Interactive MCQ & multi-choice conceptual practice',
    allowedRoles: ['student', 'teacher'],
  },
  {
    id: 'code-lab',
    name: 'Code Lab',
    category: 'student',
    icon: <Code2 size={24} strokeWidth={1.8} />,
    description: 'Live coding environment with local test verification & AI hints',
    allowedRoles: ['student', 'teacher'],
  },

  {
    id: 'progress-lab',
    name: 'Progress Lab',
    category: 'student',
    icon: <TrendingUp size={24} strokeWidth={1.8} />,
    description: 'Inspectable before/after evidence comparison and delta mastery',
    allowedRoles: ['student'],
  },

  // ── Shared Apps ───────────────────────────────────────────
  {
    id: 'settings',
    name: 'Settings',
    category: 'shared',
    icon: <Settings size={24} strokeWidth={1.8} />,
    description: 'User profile, appearance theme, and display preferences',
    allowedRoles: ['teacher', 'student'],
  },
];
