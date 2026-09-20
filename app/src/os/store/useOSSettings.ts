import { create } from 'zustand';

export type FontSize = 'small' | 'medium' | 'large';

export interface WallpaperPreset {
  id: string;
  name: string;
  type: 'gradient' | 'image';
  value: string;
  preview: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'default',
    name: 'Akademiya Cosmic (Default)',
    type: 'gradient',
    value: 'var(--bg-desktop)',
    preview: 'linear-gradient(135deg, #1e1b4b 0%, #090d16 100%)',
  },
  {
    id: 'cyber-nebula',
    name: 'Cyber Nebula',
    type: 'gradient',
    value: 'radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.35) 0%, transparent 50%), #0b0f19',
    preview: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #0b0f19 100%)',
  },
  {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    type: 'gradient',
    value: 'radial-gradient(circle at 50% 10%, rgba(16, 185, 129, 0.35) 0%, transparent 60%), radial-gradient(circle at 80% 90%, rgba(6, 182, 212, 0.25) 0%, transparent 60%), #061118',
    preview: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #061118 100%)',
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Horizon',
    type: 'gradient',
    value: 'radial-gradient(circle at 30% 20%, rgba(245, 158, 11, 0.35) 0%, transparent 55%), radial-gradient(circle at 75% 85%, rgba(239, 68, 68, 0.3) 0%, transparent 55%), #120c18',
    preview: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #120c18 100%)',
  },
  {
    id: 'deep-space',
    name: 'Deep Space Minimal',
    type: 'gradient',
    value: 'radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.6) 0%, transparent 80%), #020617',
    preview: 'linear-gradient(135deg, #1e293b 0%, #020617 100%)',
  },
];

interface OSSettingsState {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  dockAutohide: boolean;
  toggleDockAutohide: () => void;
  wallpaper: string;
  wallpaperType: 'preset' | 'custom';
  setWallpaper: (wallpaper: string, type?: 'preset' | 'custom') => void;
  resetWallpaper: () => void;
}

const initialFontSize = (localStorage.getItem('akademiya_font_size') as FontSize) || 'medium';
const initialWallpaper = localStorage.getItem('akademiya_wallpaper') || 'var(--bg-desktop)';
const initialWallpaperType = (localStorage.getItem('akademiya_wallpaper_type') as 'preset' | 'custom') || 'preset';

// Ensure the initial data attribute is immediately placed on document root
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-font-scale', initialFontSize);
}

export const useOSSettings = create<OSSettingsState>((set) => ({
  fontSize: initialFontSize,
  setFontSize: (size) => {
    localStorage.setItem('akademiya_font_size', size);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-font-scale', size);
    }
    set({ fontSize: size });
  },
  dockAutohide: false,
  toggleDockAutohide: () => set((state) => ({ dockAutohide: !state.dockAutohide })),
  wallpaper: initialWallpaper,
  wallpaperType: initialWallpaperType,
  setWallpaper: (wallpaper, type = 'custom') => {
    try {
      localStorage.setItem('akademiya_wallpaper', wallpaper);
      localStorage.setItem('akademiya_wallpaper_type', type);
    } catch (e) {
      console.warn('Failed to save wallpaper to localStorage:', e);
    }
    set({ wallpaper, wallpaperType: type });
  },
  resetWallpaper: () => {
    localStorage.removeItem('akademiya_wallpaper');
    localStorage.setItem('akademiya_wallpaper_type', 'preset');
    set({ wallpaper: 'var(--bg-desktop)', wallpaperType: 'preset' });
  },
}));
