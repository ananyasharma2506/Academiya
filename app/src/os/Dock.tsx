import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { APP_REGISTRY } from './apps/registry';
import DockIcon from './components/DockIcon';
import { useOSStore } from './store/useOSStore';

const REVEAL_ZONE_PX = 60; // distance from the bottom edge of the viewport that triggers reveal
const HIDE_DELAY_MS = 450; // grace period before hiding, so it doesn't flicker at the boundary
const INITIAL_VISIBLE_MS = 1600; // shown briefly on load so it's discoverable at all

export default function Dock() {
  const { user } = useAuth();
  const { windows, focusedWindowId, openWindow, focusWindow, restoreWindow } = useOSStore();
  const mouseX = useMotionValue(Infinity);

  const [isVisible, setIsVisible] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nearBottomEdge = window.innerHeight - e.clientY <= REVEAL_ZONE_PX;
      const rect = wrapperRef.current?.getBoundingClientRect();
      const overDock = rect
        ? e.clientX >= rect.left - 24 && e.clientX <= rect.right + 24 && e.clientY >= rect.top - 40
        : false;

      if (nearBottomEdge || overDock) {
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = undefined;
        }
        setIsVisible(true);
      } else if (!hideTimerRef.current) {
        hideTimerRef.current = window.setTimeout(() => {
          setIsVisible(false);
          hideTimerRef.current = undefined;
        }, HIDE_DELAY_MS);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    const initialHideTimer = window.setTimeout(() => setIsVisible(false), INITIAL_VISIBLE_MS);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.clearTimeout(initialHideTimer);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!user) return null;

  // Filter apps permitted for user's role
  const permittedApps = APP_REGISTRY.filter((app) => app.allowedRoles.includes(user.role));

  const handleAppClick = (appId: string) => {
    const existing = windows.find((w) => w.appType === appId);
    if (!existing) {
      openWindow(appId as any);
    } else if (existing.isMinimized) {
      restoreWindow(existing.id);
    } else if (focusedWindowId === existing.id) {
      // already focused
    } else {
      focusWindow(existing.id);
    }
  };

  // Nothing open to switch between — always show the dock rather than
  // making the user hunt for it on an empty desktop.
  const noWindowsOpen = windows.length === 0;
  const effectiveVisible = isVisible || noWindowsOpen;

  return (
    <motion.div
      ref={wrapperRef}
      initial={false}
      animate={{ y: effectiveVisible ? 0 : 92, opacity: effectiveVisible ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      style={{
        position: 'fixed',
        bottom: 14,
        left: '50%',
        translateX: '-50%',
        zIndex: 400,
        pointerEvents: effectiveVisible ? 'auto' : 'none',
      }}
    >
      <motion.div
        className="liquid-dock"
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          // Top/bottom look uneven at 8px/8px because the active-app dot
          // (4px + 4px margin) sits below every icon and eats into the
          // bottom gap only — bumping the top pad to match balances it.
          padding: '16px 16px 8px',
          borderRadius: 24,
        }}
      >
        {permittedApps.map((app) => {
          const win = windows.find((w) => w.appType === app.id);
          const isOpen = Boolean(win);
          const isActive = win?.id === focusedWindowId && !win?.isMinimized;

          return (
            <DockIcon
              key={app.id}
              app={app}
              isOpen={isOpen}
              isActive={isActive}
              mouseX={mouseX}
              onClick={() => handleAppClick(app.id)}
            />
          );
        })}
      </motion.div>
    </motion.div>
  );
}
