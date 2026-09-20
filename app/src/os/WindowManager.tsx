import React from 'react';
import { useOSStore } from './store/useOSStore';
import AppWindow from './AppWindow';

// Import the 9 Apps
import StudentIntelligenceApp from '../apps/StudentIntelligenceApp';
import ClassInsightsApp from '../apps/ClassInsightsApp';
import DiagnosticLabApp from '../apps/DiagnosticLabApp';
import InterventionCenterApp from '../apps/InterventionCenterApp';
import MyLearningApp from '../apps/MyLearningApp';
import LearnApp from '../apps/LearnApp';
import PracticeLabApp from '../apps/PracticeLabApp';
import CodeLabApp from '../apps/CodeLabApp';
import ProgressLabApp from '../apps/ProgressLabApp';
import SettingsApp from '../apps/SettingsApp';

export default function WindowManager() {
  const { windows } = useOSStore();

  const renderApp = (appType: string) => {
    switch (appType) {
      case 'student-intelligence':
        return <StudentIntelligenceApp />;
      case 'class-insights':
        return <ClassInsightsApp />;
      case 'diagnostic-lab':
        return <DiagnosticLabApp />;
      case 'intervention-center':
        return <InterventionCenterApp />;
      case 'my-learning':
        return <MyLearningApp />;
      case 'learn':
        return <LearnApp />;
      case 'practice-lab':
        return <PracticeLabApp />;
      case 'code-lab':
        return <CodeLabApp />;
      case 'progress-lab':
        return <ProgressLabApp />;
      case 'settings':
        return <SettingsApp />;
      default:
        return <div>Unknown application: {appType}</div>;
    }
  };

  return (
    <>
      {windows.map((win) => (
        <AppWindow key={win.id} window={win}>
          {renderApp(win.appType)}
        </AppWindow>
      ))}
    </>
  );
}
