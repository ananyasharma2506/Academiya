import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOSStore } from './store/useOSStore';
import { useOSSettings } from './store/useOSSettings';
import MenuBar from './MenuBar';
import Dock from './Dock';
import WindowManager from './WindowManager';
import ConsoleDebugger from './components/ConsoleDebugger';
import AssessmentStudioModal from './components/AssessmentStudioModal';
import DesktopWidgets from './widgets/DesktopWidgets';
import academiyaLogo from '../media/academiya.webp';

export default function Desktop() {
  const { user } = useAuth();
  const { openWindow, windows } = useOSStore();
  const { wallpaper } = useOSSettings();
  const [showDebugger, setShowDebugger] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (user && !initialized.current && windows.length === 0) {
      initialized.current = true;
      if (user.role === 'teacher') {
        openWindow('student-intelligence');
      } else {
        openWindow('my-learning');
      }
    }

    const handleOpenStudio = () => setShowTestModal(true);
    window.addEventListener('akademiya-open-test-studio', handleOpenStudio);
    return () => {
      window.removeEventListener('akademiya-open-test-studio', handleOpenStudio);
      useOSStore.getState().closeAll();
    };
  }, [user]);

  const isBuiltInWallpaper = useMemo(() => {
    if (!wallpaper || wallpaper === 'var(--bg-desktop)') return true;
    if (
      wallpaper.startsWith('http://') ||
      wallpaper.startsWith('https://') ||
      wallpaper.startsWith('data:image')
    ) {
      return false;
    }
    return true;
  }, [wallpaper]);

  const desktopBgStyle = useMemo<React.CSSProperties>(() => {
    if (!wallpaper || wallpaper === 'var(--bg-desktop)') {
      return { background: 'var(--bg-desktop)' };
    }
    if (
      wallpaper.startsWith('http://') ||
      wallpaper.startsWith('https://') ||
      wallpaper.startsWith('data:image')
    ) {
      return {
        backgroundImage: `linear-gradient(rgba(10, 12, 20, 0.45), rgba(10, 12, 20, 0.65)), url("${wallpaper}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return { background: wallpaper };
  }, [wallpaper]);

  // Keep underlying viewport canvas (body & html) synced so scaling or zooming never leaves empty borders
  useEffect(() => {
    if (desktopBgStyle.background) {
      document.body.style.background = desktopBgStyle.background as string;
      document.documentElement.style.background = desktopBgStyle.background as string;
      document.body.style.backgroundImage = 'none';
      document.documentElement.style.backgroundImage = 'none';
    } else if (desktopBgStyle.backgroundImage) {
      document.body.style.backgroundImage = desktopBgStyle.backgroundImage as string;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.documentElement.style.backgroundImage = desktopBgStyle.backgroundImage as string;
      document.documentElement.style.backgroundSize = 'cover';
      document.documentElement.style.backgroundPosition = 'center';
    }
  }, [desktopBgStyle]);

  return (
    <div
      className="desktop-container"
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        transition: 'background 0.35s ease, background-image 0.35s ease',
        ...desktopBgStyle,
      }}
    >
      {/* Ambient floating accents, purely decorative and behind all chrome */}
      <div className="ambient-orb" style={{ width: 460, height: 460, top: '-8%', left: '-6%', background: 'rgba(124, 58, 237, 0.14)' }} />
      <div className="ambient-orb" style={{ width: 400, height: 400, bottom: '-10%', right: '-4%', background: 'rgba(236, 72, 153, 0.10)', animationDelay: '-7s' }} />

      {/* Centered Akademiya Logo Watermark for Default / Built-in Wallpapers */}
      {isBuiltInWallpaper && (
        <div
          className="desktop-logo-watermark"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Ambient luminous glow behind emblem */}
            <div
              style={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, rgba(56, 189, 248, 0.14) 50%, transparent 70%)',
                filter: 'blur(30px)',
              }}
            />
            <img
              src={academiyaLogo}
              alt="Akademiya"
              style={{
                width: 140,
                height: 140,
                objectFit: 'contain',
                opacity: 0.34,
                filter: 'drop-shadow(0 14px 40px rgba(0, 0, 0, 0.6))',
                borderRadius: '24%',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              opacity: 0.28,
            }}
          >
            Akademiya
          </span>
        </div>
      )}

      {/* Top MenuBar */}
      <MenuBar
        isDebuggerOpen={showDebugger}
        onToggleDebugger={() => setShowDebugger((prev) => !prev)}
        onOpenCreateTest={() => setShowTestModal(true)}
      />

      {/* Background widgets — sit behind every window (low z-index), like real
          desktop widgets: visible on bare desktop, covered once you open an app. */}
      <DesktopWidgets />

      {/* Main Desktop Space */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          bottom: 0,
          left: 0,
          right: 0,
          overflow: 'hidden',
        }}
      >
        <WindowManager />
      </div>

      {/* Floating Bottom Dock */}
      <Dock />

      {/* Live Floating Terminal & Console Debugger */}
      <ConsoleDebugger
        isOpen={showDebugger}
        onClose={() => setShowDebugger(false)}
      />

      {/* Assessment Studio & Test Authoring Modal */}
      <AssessmentStudioModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
      />
    </div>
  );
}
