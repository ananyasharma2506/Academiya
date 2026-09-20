import React from 'react';
import { useAuth } from './context/AuthContext';
import Desktop from './os/Desktop';
import LockScreen from './os/LockScreen';

export default function App() {
  const { isAuthenticated, isCheckingSession, user } = useAuth();

  if (isCheckingSession) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          background: 'var(--bg-desktop, #0b0f19)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTop: '3px solid #38bdf8',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #94a3b8)', letterSpacing: '0.04em' }}>
            Verifying Session Security...
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && user ? <Desktop /> : <LockScreen />}
    </>
  );
}

