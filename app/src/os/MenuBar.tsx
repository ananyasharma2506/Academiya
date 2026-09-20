import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LightbulbOn } from '@keyline-icons/react';
import { Plus, Terminal, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOSStore } from './store/useOSStore';
import academiyaLogo from '../media/academiya.webp';

interface MenuBarProps {
  isDebuggerOpen?: boolean;
  onToggleDebugger?: () => void;
  onOpenCreateTest?: () => void;
}

export default function MenuBar({ isDebuggerOpen, onToggleDebugger, onOpenCreateTest }: MenuBarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { windows, focusedWindowId, openWindow } = useOSStore();
  const [time, setTime] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const isLight = theme === 'light';
  const menuBarBg = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(10, 12, 20, 0.75)';
  const menuBarBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'var(--panel-border)';
  const btnBg = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)';
  const btnBorder = isLight ? 'rgba(0, 0, 0, 0.12)' : 'var(--panel-border)';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeWindow = windows.find((w) => w.id === focusedWindowId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        background: menuBarBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${menuBarBorder}`,
        boxShadow: isLight ? '0 1px 10px rgba(0, 0, 0, 0.05)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: 12,
        fontWeight: 500,
        zIndex: 500,
        color: 'var(--text-primary)',
        overflowX: 'auto',
        userSelect: 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700 }}>
          <img
            src={academiyaLogo}
            alt="Akademiya"
            style={{
              height: 20,
              width: 20,
              objectFit: 'contain',
              borderRadius: 4,
              display: 'block',
            }}
          />
          <span
            style={{
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.02em',
              fontSize: 13,
            }}
          >
            Akademiya
          </span>
        </div>
        {activeWindow && (
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11 }}>
            / {activeWindow.title}
          </span>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, marginRight: 4 }}>{time}</span>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 2, flexShrink: 0 }}>
            <span
              className={`badge ${
                user.role === 'teacher' ? 'badge-active' : 'badge-emerging'
              }`}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              {user.role}
            </span>
            <span style={{ fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
              {user.name}
            </span>
          </div>
        )}

        {user && (
          <button
            onClick={() => openWindow('my-learning')}
            className="my-learning-menu-btn"
            style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            title="Open My Learning Cockpit"
          >
            <LightbulbOn width={13} height={13} strokeWidth={2.2} className="keyline-theme-icon" />
            <span>My Learning</span>
          </button>
        )}

        {user?.role === 'teacher' && onOpenCreateTest && (
          <button
            onClick={onOpenCreateTest}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              borderRadius: 6,
              padding: '3px 8px',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(168, 85, 247, 0.4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
            title="Create or Generate Assessment / Test"
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>Create Test</span>
          </button>
        )}

        <button
          onClick={onToggleDebugger}
          style={{
            background: isDebuggerOpen
              ? (isLight ? 'rgba(14, 165, 233, 0.18)' : 'rgba(56, 189, 248, 0.25)')
              : btnBg,
            border: `1px solid ${isDebuggerOpen ? (isLight ? '#0284c7' : '#38bdf8') : btnBorder}`,
            borderRadius: 6,
            padding: '3px 8px',
            color: isDebuggerOpen ? (isLight ? '#0284c7' : '#38bdf8') : 'var(--text-primary)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Toggle Live Console & Terminal Debugger"
        >
          <Terminal size={12} strokeWidth={2} />
          <span>Console</span>
        </button>

        <button
          onClick={toggleTheme}
          style={{
            background: btnBg,
            border: `1px solid ${btnBorder}`,
            borderRadius: 6,
            padding: '3px 8px',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Toggle Theme"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isLight ? 'moon' : 'sun'}
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ display: 'inline-flex' }}
            >
              {isLight ? <Moon size={12} strokeWidth={2} /> : <Sun size={12} strokeWidth={2} />}
            </motion.span>
          </AnimatePresence>
          <span>{isLight ? 'Dark' : 'Light'}</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            background: isLight ? 'rgba(239, 68, 68, 0.10)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: 6,
            padding: '3px 8px',
            color: isLight ? '#dc2626' : '#f87171',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <LogOut size={12} strokeWidth={2} />
          <span>{loggingOut ? 'Signing out...' : 'Log Out'}</span>
        </button>
      </div>
    </div>
  );
}
