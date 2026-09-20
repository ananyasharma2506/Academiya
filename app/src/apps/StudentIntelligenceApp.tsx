import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus,
  Brain,
  Microscope,
  Target,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  BookOpen,
  Sparkles,
  Layers,
  Share2,
} from 'lucide-react';
import { useOSStore } from '../os/store/useOSStore';
import StudentAcademicGraph from './StudentAcademicGraph';

export default function StudentIntelligenceApp() {
  const { openWindow } = useOSStore();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'telemetry' | 'gaps' | 'graph'>('telemetry');
  const [gaps, setGaps] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any>(null);
  const [violations, setViolations] = useState<any>(null);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [progressRecords, setProgressRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch students list
    axios.get('/api/auth/users?role=student')
      .then(res => {
        setStudents(res.data.users);
        if (res.data.users.length > 0) {
          setSelectedStudentId(res.data.users[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);

    Promise.all([
      axios.get(`/api/gaps/${selectedStudentId}`).catch(() => ({ data: { gaps: [] } })),
      axios.get(`/api/activity/summary/${selectedStudentId}`).catch(() => ({ data: { summary: {}, topics: [] } })),
      axios.get(`/api/questions/students/${selectedStudentId}/integrity-summary`).catch(() => ({ data: { total_violations: 0, by_assessment: [] } })),
      axios.get(`/api/interventions/student/${selectedStudentId}`).catch(() => ({ data: { interventions: [] } })),
      axios.get(`/api/progress/${selectedStudentId}`).catch(() => ({ data: { progress: [] } })),
    ])
      .then(([gapRes, actRes, violRes, ivRes, progRes]) => {
        setGaps(gapRes.data.gaps || []);
        setActivityData(actRes.data || { summary: {}, topics: [] });
        setViolations(violRes.data || { total_violations: 0, by_assessment: [] });
        setInterventions(ivRes.data.interventions || []);
        setProgressRecords(progRes.data.progress || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const summary = activityData?.summary || {};
  const topics = activityData?.topics || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--panel-border)', paddingBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={20} color="#a855f7" />
            <span>Teacher Console — Student Intelligence &amp; Telemetry</span>
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Monitor real-time student active study cadence, reading velocity, and AI-detected struggle topics.
          </p>
        </div>

        {/* Controls: Create Test & Student Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('akademiya-open-test-studio'))}
            className="btn-primary"
            style={{
              fontSize: 12,
              padding: '6px 12px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Select Student:</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--panel-border)',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#1e293b', color: 'white' }}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--panel-border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={activeTab === 'telemetry' ? 'btn-primary' : 'btn-secondary'}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 7,
          }}
        >
          <Activity size={14} />
          <span>Active Webpage &amp; Study Telemetry</span>
          {summary.rapid_scroll_count > 0 && (
            <span style={{ background: '#f59e0b', color: '#000', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10 }}>
              {summary.rapid_scroll_count} alerts
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('gaps')}
          className={activeTab === 'gaps' ? 'btn-primary' : 'btn-secondary'}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 7,
          }}
        >
          <Brain size={14} />
          <span>Conceptual Evidence Gaps ({gaps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          className={activeTab === 'graph' ? 'btn-primary' : 'btn-secondary'}
          style={{
            fontSize: 12,
            padding: '5px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 7,
          }}
        >
          <Share2 size={14} />
          <span>Academic Graph</span>
          {violations?.total_violations > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10 }}>
              {violations.total_violations} violations
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading student profile telemetry &amp; evidence...
        </div>
      ) : activeTab === 'telemetry' ? (
        /* ── TELEMETRY & STRUGGLE VIEW ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dashboard Numbers */}
          <div className="stagger-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {/* Stat 1: Total Hours */}
            <div
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
                  Student Active Study
                </span>
                <Clock size={16} color="#38bdf8" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                {summary.total_active_hours_str || '0.00 hours'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {summary.total_topics_tracked || 0} topics recorded
              </div>
            </div>

            {/* Stat 2: Stayed The Most */}
            <div
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: '1px solid rgba(168, 85, 247, 0.3)',
                background: 'rgba(168, 85, 247, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#c084fc' }}>
                  Stayed The Most
                </span>
                <Flame size={16} color="#c084fc" />
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={summary.stayed_most_topic?.topic_title || 'No data'}
              >
                {summary.stayed_most_topic?.topic_title || 'None recorded'}
              </div>
              <div style={{ fontSize: 11, color: '#c084fc', fontWeight: 600 }}>
                {summary.stayed_most_topic ? `${summary.stayed_most_topic.hours_studied_str} time spent` : 'Awaiting reading activity'}
              </div>
            </div>

            {/* Stat 3: Struggle Intelligence */}
            <div
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: summary.highest_struggle_topic ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--panel-border)',
                background: summary.highest_struggle_topic ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: summary.highest_struggle_topic ? '#f87171' : 'var(--text-muted)' }}>
                  AI Struggle Detection
                </span>
                <AlertTriangle size={16} color={summary.highest_struggle_topic ? '#f87171' : 'var(--text-muted)'} />
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: summary.highest_struggle_topic ? '#fca5a5' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={summary.highest_struggle_topic?.topic_title || 'Optimal cadence'}
              >
                {summary.highest_struggle_topic ? summary.highest_struggle_topic.topic_title : 'No Struggle Detected'}
              </div>
              <div style={{ fontSize: 11, color: summary.highest_struggle_topic ? '#f87171' : 'var(--text-secondary)' }}>
                {summary.highest_struggle_topic
                  ? `Struggle Score: ${summary.highest_struggle_topic.struggle_score} / 10`
                  : 'Student reading with regular flow'}
              </div>
            </div>

            {/* Stat 4: Rapid Scroll Skim Guard */}
            <div
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: summary.rapid_scroll_count > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.3)',
                background: summary.rapid_scroll_count > 0 ? 'rgba(245, 158, 11, 0.06)' : 'rgba(16, 185, 129, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: summary.rapid_scroll_count > 0 ? '#fbbf24' : '#34d399' }}>
                  Reading Integrity
                </span>
                {summary.rapid_scroll_count > 0 ? <AlertTriangle size={16} color="#fbbf24" /> : <CheckCircle2 size={16} color="#34d399" />}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)' }}>
                {summary.considered_read_count || 0} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Verified</span>
              </div>
              <div style={{ fontSize: 11, color: summary.rapid_scroll_count > 0 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>
                {summary.rapid_scroll_count > 0
                  ? `⚠️ ${summary.rapid_scroll_count} topic(s) unverified (speed-scrolled)`
                  : '✓ All topics verified'}
              </div>
            </div>
          </div>

          {/* Detailed Topic-by-Topic Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={16} color="#38bdf8" />
                <span>Student Reading Breakdown for {selectedStudent?.name}</span>
              </div>
            </div>

            {topics.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No active reading activity recorded for this student yet.
              </div>
            ) : (
              <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topics.map((t: any) => (
                  <div
                    key={t.id || t.topic_id}
                    className="glass-panel"
                    style={{
                      borderRadius: 12,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      border: t.struggle_level === 'high_struggle'
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : t.rapid_scroll_detected
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : '1px solid var(--panel-border)',
                      background: t.struggle_level === 'high_struggle'
                        ? 'rgba(239, 68, 68, 0.04)'
                        : 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Prompt-mandated format: Topic X : Studied x hours */}
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {t.topic_label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6 }}>
                          {t.subject_name}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
                        {t.topic_title}
                      </div>

                      {t.struggle_level !== 'normal' && (
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <AlertTriangle size={12} />
                          <span>AI Intelligence Struggle Reason: {t.struggle_reason}</span>
                        </div>
                      )}

                      {t.rapid_scroll_detected && (
                        <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <XCircle size={12} />
                          <span>Speed scrolling flagged: student rapidly scrolled through without reading. Topic not marked as read.</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {t.is_considered_read ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 16,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Verified Read
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 16,
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <XCircle size={12} /> Unverified Read
                        </span>
                      )}

                      {t.struggle_level === 'high_struggle' && (
                        <button
                          onClick={() => openWindow('diagnostic-lab', { studentId: selectedStudentId })}
                          className="btn-primary"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                            border: 'none',
                          }}
                        >
                          <Microscope size={12} /> Probe Struggle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'gaps' ? (
        /* ── EVIDENCE & GAPS VIEW ── */
        gaps.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active learning gaps detected for {selectedStudent?.name || 'this student'}.
          </div>
        ) : (
          <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {gaps.map((gap) => (
              <div
                key={gap.id}
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Gap Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Brain size={20} color="#818cf8" />
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>{gap.concept}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{gap.subconcept}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge badge-${gap.status}`}>{gap.status}</span>
                    {gap.status !== 'resolved' && (
                      <>
                        <button
                          onClick={() => openWindow('diagnostic-lab', { gapId: gap.id, studentId: gap.student_id })}
                          className="btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Microscope size={12} /> Run Diagnostic
                        </button>
                        <button
                          onClick={() => openWindow('intervention-center', { gapId: gap.id, studentId: gap.student_id })}
                          className="btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Target size={12} /> Intervene
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Evidence Section */}
                <div
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    Concrete Evidence Observations ({gap.evidence?.length || 0} attempts):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {gap.evidence && gap.evidence.length > 0 ? (
                      gap.evidence.map((ev: any, idx: number) => (
                        <div
                          key={ev.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            fontSize: 12,
                            lineHeight: '1.4',
                          }}
                        >
                          <span style={{ color: ev.result === 'correct' ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            •
                          </span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>
                              {ev.result === 'correct' ? 'Demonstrated Mastery: ' : 'Failed Attempt: '}
                            </span>
                            <span style={{ color: 'var(--text-primary)' }}>
                              {ev.statement || `Attempt recorded on ${ev.subconcept}`}
                            </span>
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)' }}>
                              Source: {ev.attempt_source || 'practice'} | Awarded: {ev.marks_awarded || 0} pts | {new Date(ev.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No evidence rows linked.</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── ACADEMIC GRAPH VIEW ── */
        <StudentAcademicGraph
          studentName={selectedStudent?.name || ''}
          gaps={gaps}
          topics={topics}
          violations={violations}
          interventions={interventions}
          progress={progressRecords}
        />
      )}
    </div>
  );
}
