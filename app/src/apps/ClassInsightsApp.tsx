import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus,
  BarChart3,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Shield,
  Search,
  User,
} from 'lucide-react';
import { useOSStore } from '../os/store/useOSStore';

export default function ClassInsightsApp() {
  const { openWindow } = useOSStore();
  const [activeTab, setActiveTab] = useState<'concepts' | 'attendance'>('concepts');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Attendance state
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionRoster, setSessionRoster] = useState<any>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const fetchInsights = () => {
    axios.get('/api/insights/class')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchSessions = () => {
    axios.get('/api/attendance/sessions')
      .then(res => {
        setSessions(res.data.sessions || []);
        if (res.data.sessions?.length > 0 && !selectedSessionId) {
          setSelectedSessionId(res.data.sessions[0].id);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchInsights();
    fetchSessions();
  }, []);

  const handleCreateQuickSession = async () => {
    setCreatingSession(true);
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      await axios.post('/api/attendance/sessions', {
        title: `Class Session — ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
      });
      fetchSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingSession(false);
    }
  };

  const loadSessionRoster = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLoadingRoster(true);
    axios.get(`/api/attendance/session/${sessionId}`)
      .then(res => setSessionRoster(res.data))
      .catch(console.error)
      .finally(() => setLoadingRoster(false));
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionRoster(selectedSessionId);
    }
  }, [selectedSessionId]);

  if (loading) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading Class Insights...
      </div>
    );
  }

  const { summary = {}, concepts = [] } = data || {};

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Class Insights</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Class-wide conceptual gap analysis and deterministic auto-attendance
          </p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('akademiya-open-test-studio'))}
          className="btn-primary"
          style={{
            fontSize: 12,
            padding: '6px 14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            border: 'none',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)',
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>Create / Generate Test</span>
        </button>
      </div>

      {/* Subnav Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--panel-border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('concepts')}
          className={activeTab === 'concepts' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 12, padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <BarChart3 size={13} strokeWidth={2} /> Concept Health & Gaps
        </button>
        <button
          onClick={() => { setActiveTab('attendance'); fetchSessions(); }}
          className={activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 12, padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Calendar size={13} strokeWidth={2} /> Deterministic Auto-Attendance ({sessions.filter(s => s.is_active).length} Active)
        </button>
      </div>

      {activeTab === 'attendance' ? (
        /* Auto Attendance Tab Panel */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Sessions List */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Class Sessions</h3>
              <button
                onClick={handleCreateQuickSession}
                disabled={creatingSession}
                className="btn-primary"
                style={{ fontSize: 10, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {creatingSession ? 'Starting...' : <><Plus size={11} strokeWidth={2.5} /> Start 1h Window</>}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  No class sessions defined yet. Click "Start 1h Window" to begin.
                </div>
              ) : (
                sessions.map((sess) => {
                  const isSelected = selectedSessionId === sess.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => setSelectedSessionId(sess.id)}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(var(--accent), 0.2)' : 'var(--card-bg)',
                        border: isSelected ? '1px solid rgba(var(--accent), 0.6)' : '1px solid var(--panel-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{sess.title}</span>
                        {sess.is_active ? (
                          <span className="badge badge-resolved" style={{ fontSize: 9 }}>ACTIVE NOW</span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ended</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {new Date(sess.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(sess.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Users size={12} /> {sess.attended_count} attended
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Session Roster */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {sessionRoster ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>{sessionRoster.session?.title}</h3>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Teacher: {sessionRoster.session?.teacher_name} • Window: {new Date(sessionRoster.session?.start_time).toLocaleTimeString()} to {new Date(sessionRoster.session?.end_time).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{sessionRoster.stats?.attendance_rate_pct}%</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Attendance Rate</div>
                    </div>
                  </div>
                </div>

                {/* Roster Table */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--panel-border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px' }}>Student Name</th>
                        <th style={{ padding: '8px 10px' }}>Email</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                        <th style={{ padding: '8px 10px' }}>Deterministic Trigger Source</th>
                        <th style={{ padding: '8px 10px' }}>Marked At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionRoster.roster?.map((st: any) => (
                        <tr key={st.student_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 10px', fontWeight: 600 }}>{st.student_name}</td>
                          <td style={{ padding: '10px 10px', color: 'var(--text-secondary)' }}>{st.student_email}</td>
                          <td style={{ padding: '10px 10px' }}>
                            {st.is_present ? (
                              <span className="badge badge-resolved" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle2 size={10} /> Present
                              </span>
                            ) : (
                              <span className="badge badge-confirmed" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <XCircle size={10} /> Absent
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            {st.attendance_source ? (
                              <code style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: 4 }}>
                                {st.attendance_source}
                              </code>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                            {st.marked_at ? new Date(st.marked_at).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a class session to inspect the live student attendance roster.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Concepts Tab Panel */
        <>
          {/* Assessment Integrity Quick-Audit Banner */}
          <div
            className="glass-panel"
            style={{
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={20} color="#818cf8" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Assessment Focus & Integrity Engine</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Configure Anticheat on tests and inspect deterministic forensic audit trails.
                </div>
              </div>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('akademiya-open-test-studio'))}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Search size={12} />
              <span>View Integrity & Assessments</span>
            </button>
          </div>

          {/* Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="glass-panel" style={{ borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Gaps
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{summary.total_gaps || 0}</div>
            </div>
            <div className="glass-panel" style={{ borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                Emerging
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24', marginTop: 4 }}>{summary.emerging_gaps || 0}</div>
            </div>
            <div className="glass-panel" style={{ borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                Confirmed
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171', marginTop: 4 }}>{summary.confirmed_gaps || 0}</div>
            </div>
            <div className="glass-panel" style={{ borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                Resolved
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399', marginTop: 4 }}>{summary.resolved_gaps || 0}</div>
            </div>
          </div>
        </>
      )}

      {/* Concept Breakdown (rendered when concepts tab is active) */}
      {activeTab === 'concepts' && (
        <div className="stagger-fade-in" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>
          Concepts Needing Attention ({concepts.length})
        </h3>

        {concepts.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            No class-wide learning gaps currently detected.
          </div>
        ) : (
          concepts.map((c: any, idx: number) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700 }}>{c.concept}</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.subconcept}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-emerging">{c.emerging_students_count} Emerging</span>
                  {parseInt(c.confirmed_students_count, 10) > 0 && (
                    <span className="badge badge-confirmed">{c.confirmed_students_count} Confirmed</span>
                  )}
                  {parseInt(c.resolved_students_count, 10) > 0 && (
                    <span className="badge badge-resolved">{c.resolved_students_count} Resolved</span>
                  )}
                </div>
              </div>

              {/* Student list for this concept */}
              <div
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Students Affected:
                </span>
                {c.student_gaps && c.student_gaps.map((sg: any, sIdx: number) => (
                  <button
                    key={sIdx}
                    onClick={() => openWindow('student-intelligence', { studentId: sg.student_id })}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <User size={11} /> {sg.student_name} ({sg.status})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      )}
    </div>
  );
}
