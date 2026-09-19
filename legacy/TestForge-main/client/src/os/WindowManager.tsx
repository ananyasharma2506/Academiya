import { useOSStore } from './store/useOSStore';
import AppWindow from './AppWindow';
import type { AppType } from './store/useOSStore';
import { useAuth } from '../context/AuthContext';

// Reuse the supplied Learning Intelligence screens rather than recreating them.
import StudentIntelligenceApp from '../../../../../app/src/apps/StudentIntelligenceApp';
import ClassInsightsApp from '../../../../../app/src/apps/ClassInsightsApp';
import MyLearningApp from '../../../../../app/src/apps/MyLearningApp';
import PracticeLabApp from '../../../../../app/src/apps/PracticeLabApp';
import CodeLabApp from '../../../../../app/src/apps/CodeLabApp';
import ProgressLabApp from '../../../../../app/src/apps/ProgressLabApp';
import SettingsApp from '../../../../../app/src/apps/SettingsApp';

const APP_COMPONENTS: Partial<Record<AppType, React.ComponentType<any>>> = {
  'student-intelligence': StudentIntelligenceApp,
  'class-insights':       ClassInsightsApp,
  'my-learning':          MyLearningApp,
  'practice-lab':         PracticeLabApp,
  'code-lab':             CodeLabApp,
  'progress-lab':         ProgressLabApp,
  'settings':             SettingsApp,
};

export default function WindowManager() {
  const { windows } = useOSStore();
  const { session, user } = useAuth();
  const backendProps = {
    token: session?.access_token ?? '',
    studentId: user?.id ?? '',
    user: user ?? { name: 'User', email: '', role: 'student' },
    apiBaseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api',
  };

  return (
    <>
      {windows.map(win => {
        const AppComponent = APP_COMPONENTS[win.appType];
        if (!AppComponent) return null;

        return (
          <AppWindow key={win.id} window={win}>
            <AppComponent id={win.id} {...backendProps} {...(win.appProps ?? {})} />
          </AppWindow>
        );
      })}
    </>
  );
}
