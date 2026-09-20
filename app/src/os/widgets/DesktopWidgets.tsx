import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Clock as ClockIcon, Flame, CalendarCheck, ListChecks, TrendingUp, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOSStore } from '../store/useOSStore';

/**
 * Desktop widgets — glanceable, non-interactive-by-default cards that sit
 * BEHIND every window (low z-index) so they read like real desktop widgets:
 * visible on bare desktop, naturally covered once you open an app, never
 * competing with window content. Student-only: attendance streaks, a
 * pending-studies list, and a performance summary are student concepts: a
 * teacher's equivalent views already live in Class Insights / Student
 * Intelligence.
 */

interface WidgetsData {
  attendance: { dates: string[]; total_days: number; current_streak: number; checked_in_today: boolean };
  performance: {
    score: number | null;
    gap_resolution_pct: number | null;
    accuracy_pct: number | null;
    integrity_pct: number | null;
    total_gaps: number;
    resolved_gaps: number;
    total_study_hours: number;
    violation_count: number;
  };
  pending: Array<{ type: string; severity: 'high' | 'medium' | 'low'; label: string; concept: string; subconcept?: string }>;
}

const REFRESH_MS = 60_000;

export default function DesktopWidgets() {
  const { user } = useAuth();
  const [data, setData] = useState<WidgetsData | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    let cancelled = false;

    const fetchData = () => {
      axios.get(`/api/dashboard/${user.id}/widgets`)
        .then((res) => { if (!cancelled) setData(res.data); })
        .catch(() => { /* widgets are decorative — fail silently, keep last good data */ });
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  const refetch = () => {
    if (!user) return;
    axios.get(`/api/dashboard/${user.id}/widgets`).then((res) => setData(res.data)).catch(() => {});
  };

  if (!user || user.role !== 'student') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        right: 16,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 230,
        pointerEvents: 'none',
      }}
    >
      <ClockWidget />
      {data && <PerformanceWidget performance={data.performance} />}
      {data && <AttendanceWidget attendance={data.attendance} onCheckedIn={refetch} />}
      {data && <TodoWidget pending={data.pending} />}
    </div>
  );
}

function WidgetCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel"
      style={{
        borderRadius: 14,
        padding: 14,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}

function WidgetHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
      {icon}
      {label}
    </div>
  );
}

// ── Clock ──────────────────────────────────────────────────────────────────
function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <WidgetCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
        <ClockIcon size={22} color="#818cf8" />
      </div>
    </WidgetCard>
  );
}

// ── Performance summary ─────────────────────────────────────────────────────
function scoreColor(score: number | null) {
  if (score === null) return '#64748b';
  if (score >= 75) return '#34d399';
  if (score >= 50) return '#fbbf24';
  return '#f87171';
}

function PerformanceWidget({ performance: p }: { performance: WidgetsData['performance'] }) {
  const color = scoreColor(p.score);
  return (
    <WidgetCard delay={0.05}>
      <WidgetHeader icon={<TrendingUp size={12} />} label="Performance" />
      {p.score === null ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Not enough evidence yet — complete some practice to see your standing.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color, letterSpacing: '-0.02em' }}>{p.score}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <MiniBar label="Gaps resolved" value={p.gap_resolution_pct} suffix={`${p.resolved_gaps}/${p.total_gaps}`} />
          <MiniBar label="Accuracy" value={p.accuracy_pct} />
          <MiniBar label="Test integrity" value={p.integrity_pct} suffix={p.violation_count > 0 ? `${p.violation_count} flags` : 'clean'} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
            {p.total_study_hours}h studied
          </div>
        </>
      )}
    </WidgetCard>
  );
}

function MiniBar({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{value === null ? '—' : suffix || `${value}%`}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${value ?? 0}%`,
            background: scoreColor(value),
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

// ── Attendance calendar (GitHub-style check-in heatmap) ─────────────────────
function AttendanceWidget({ attendance, onCheckedIn }: { attendance: WidgetsData['attendance']; onCheckedIn: () => void }) {
  const [checkingIn, setCheckingIn] = useState(false);
  const dateSet = useMemo(() => new Set(attendance.dates), [attendance.dates]);

  const handleCheckIn = async () => {
    if (attendance.checked_in_today || checkingIn) return;
    setCheckingIn(true);
    try {
      await axios.post('/api/dashboard/checkin');
      onCheckedIn();
    } catch {
      /* widgets are decorative — a failed check-in just leaves the button active to retry */
    } finally {
      setCheckingIn(false);
    }
  };

  // 10 weeks x 7 days, ending today, laid out column-major (like GitHub).
  const weeks = useMemo(() => {
    const totalDays = 70;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: string; checkedIn: boolean }[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, checkedIn: dateSet.has(iso) });
    }
    const cols: { date: string; checkedIn: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));
    return cols;
  }, [dateSet]);

  return (
    <WidgetCard delay={0.1}>
      <WidgetHeader icon={<CalendarCheck size={12} />} label="Attendance" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Flame size={16} color={attendance.current_streak > 0 ? '#f97316' : 'var(--text-muted)'} />
        <span style={{ fontSize: 13, fontWeight: 800 }}>{attendance.current_streak}-day streak</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {weeks.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {col.map((day) => (
              <div
                key={day.date}
                title={day.date}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: day.checkedIn ? '#34d399' : 'rgba(255,255,255,0.06)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
        {attendance.total_days} check-in{attendance.total_days === 1 ? '' : 's'} recorded
      </div>
      <button
        onClick={handleCheckIn}
        disabled={attendance.checked_in_today || checkingIn}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 0',
          borderRadius: 8,
          border: 'none',
          fontSize: 11,
          fontWeight: 700,
          cursor: attendance.checked_in_today ? 'default' : 'pointer',
          background: attendance.checked_in_today ? 'rgba(52, 211, 153, 0.15)' : 'var(--accent-gradient)',
          color: attendance.checked_in_today ? '#34d399' : 'white',
          opacity: checkingIn ? 0.7 : 1,
          transition: 'all 0.15s ease',
        }}
      >
        {attendance.checked_in_today ? (
          <>
            <Check size={13} /> Checked In Today
          </>
        ) : (
          <>{checkingIn ? 'Checking in...' : 'Check In'}</>
        )}
      </button>
    </WidgetCard>
  );
}

// ── Pending studies (todo list) ──────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#64748b' };

function TodoWidget({ pending }: { pending: WidgetsData['pending'] }) {
  const openWindow = useOSStore((s) => s.openWindow);

  const handleItemClick = (item: WidgetsData['pending'][number]) => {
    if (item.type === 'intervention') {
      openWindow('my-learning');
    } else {
      openWindow('practice-lab');
    }
  };

  return (
    <WidgetCard delay={0.15}>
      <WidgetHeader icon={<ListChecks size={12} />} label="Pending Studies" />
      {pending.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>All caught up — nothing pending right now.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {pending.map((item, i) => (
            <button
              key={i}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--panel-border)',
                borderRadius: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLOR[item.severity], flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <ChevronRight size={12} color="var(--text-muted)" />
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
