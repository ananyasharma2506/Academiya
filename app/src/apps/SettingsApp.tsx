import React, { useState } from 'react';

interface SettingsAppProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
}

export const SettingsApp: React.FC<SettingsAppProps> = ({ user }) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      <div className="border-b border-neutral-800 pb-4 mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Account details, appearance, and accessibility preferences
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Account Info */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">Account Profile</h3>
          <div>
            <label className="text-xs text-neutral-400">Name</label>
            <p className="text-sm font-semibold text-neutral-200">{user?.name || 'User'}</p>
          </div>
          <div>
            <label className="text-xs text-neutral-400">Email</label>
            <p className="text-sm font-semibold text-neutral-200">{user?.email || 'user@platform.local'}</p>
          </div>
          <div>
            <label className="text-xs text-neutral-400">Role</label>
            <p className="text-xs font-mono uppercase text-sky-400 mt-0.5">{user?.role || 'student'}</p>
          </div>
        </div>

        {/* Theme */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-neutral-200">Appearance Theme</span>
            <p className="text-xs text-neutral-400">Switch between dark and light appearance</p>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
          >
            {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>

        {/* Font Size */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-neutral-200">Global Font Size</span>
            <p className="text-xs text-neutral-400">Adjust reading typography size</p>
          </div>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as any)}
            className="bg-neutral-800 border border-neutral-700 text-xs px-2.5 py-1.5 rounded-lg text-neutral-200"
          >
            <option value="normal">Normal (14px)</option>
            <option value="large">Large (16px)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default SettingsApp;
