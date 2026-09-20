import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, UserCheck, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOSStore } from './store/useOSStore';
import academiyaLogo from '../media/academiya.webp';

export default function LockScreen() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guarantee that whenever the lock screen is shown, no lingering windows remain
    useOSStore.getState().closeAll();
    // Trap browser back button so it stays on lock screen
    window.history.replaceState({ screen: 'lock' }, '', '/');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoRole: 'teacher' | 'student') => {
    setError(null);
    setLoading(true);
    try {
      const demoEmail = demoRole === 'teacher' ? 'teacher.golden@akademiya.io' : 'student.golden@akademiya.io';
      await login(demoEmail, 'password123');
    } catch (err: any) {
      // If demo account not present, auto-register
      try {
        const demoName = demoRole === 'teacher' ? 'Prof. Alan Turing' : 'Ada Lovelace';
        const demoEmail = demoRole === 'teacher' ? 'teacher.golden@akademiya.io' : 'student.golden@akademiya.io';
        await register(demoName, demoEmail, 'password123', demoRole);
      } catch (regErr: any) {
        setError(regErr.response?.data?.error || regErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-desktop)',
        zIndex: 1000,
        padding: 20,
        overflow: 'hidden',
      }}
    >
      {/* Ambient floating orbs behind the card */}
      <div
        className="ambient-orb"
        style={{ width: 420, height: 420, top: '8%', left: '10%', background: 'rgba(124, 58, 237, 0.35)' }}
      />
      <div
        className="ambient-orb"
        style={{ width: 380, height: 380, bottom: '5%', right: '8%', background: 'rgba(236, 72, 153, 0.28)', animationDelay: '-6s' }}
      />

      <motion.div
        className="glass-panel"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 24,
          padding: 36,
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.5), 0 0 30px rgba(var(--accent), 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo & Header */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'var(--accent-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(var(--accent), 0.4)',
              marginBottom: 12,
            }}
          >
            <img src={academiyaLogo} alt="Akademiya" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          </motion.div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            Akademiya
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Learning Intelligence Platform
          </p>
        </div>

        {/* Quick Demo Logins */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 14,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Zap size={13} strokeWidth={2.2} /> Instant One-Click Demo Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleQuickDemo('teacher')}
              disabled={loading}
              className="btn-secondary"
              style={{ justifyContent: 'center', fontSize: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <UserCheck size={14} strokeWidth={2} /> Teacher
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              disabled={loading}
              className="btn-secondary"
              style={{ justifyContent: 'center', fontSize: 12, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <GraduationCap size={14} strokeWidth={2} /> Student
            </button>
          </div>
        </div>

        {/* Form Mode Selector */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 10,
            padding: 3,
          }}
        >
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '6px 0',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {!isRegister && (
              <motion.div
                layoutId="lockscreen-tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.15)', borderRadius: 8, zIndex: -1 }}
              />
            )}
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '6px 0',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {isRegister && (
              <motion.div
                layoutId="lockscreen-tab-pill"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.15)', borderRadius: 8, zIndex: -1 }}
              />
            )}
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: '#f87171',
            }}
          >
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isRegister && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marie Curie"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Role
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'student'}
                      onChange={() => setRole('student')}
                    />
                    Student
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="role"
                      checked={role === 'teacher'}
                      onChange={() => setRole('teacher')}
                    />
                    Teacher
                  </label>
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@akademiya.io"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--input-bg)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--input-bg)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: 10 }}
          >
            {loading ? 'Please wait...' : isRegister ? 'Register & Enter' : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
