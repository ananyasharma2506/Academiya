import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Trophy,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BookOpen,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Share2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StudentAcademicGraph from './StudentAcademicGraph';

export default function ProgressLabApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'graph'>('overview');
  const [progressList, setProgressList] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any>(null);
  const [gaps, setGaps] = useState<any[]>([]);
  const [violations, setViolations] = useState<any>(null);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    Promise.all([
      axios.get(`/api/progress/${user.id}`).catch(() => ({ data: { progress: [] } })),
      axios.get(`/api/activity/summary/${user.id}`).catch(() => ({ data: { summary: {}, topics: [] } })),
      axios.get(`/api/gaps/${user.id}`).catch(() => ({ data: { gaps: [] } })),
      axios.get(`/api/questions/students/${user.id}/integrity-summary`).catch(() => ({ data: { total_violations: 0, by_assessment: [] } })),
      axios.get(`/api/interventions/student/${user.id}`).catch(() => ({ data: { interventions: [] } })),
    ])
      .then(([progRes, actRes, gapRes, violRes, ivRes]) => {
        setProgressList(progRes.data.progress || []);
        setActivityData(actRes.data || { summary: {}, topics: [] });
        setGaps(gapRes.data.gaps || []);
        setViolations(violRes.data || { total_violations: 0, by_assessment: [] });
        setInterventions(ivRes.data.interventions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const summary = activityData?.summary || {};
  const topics = activityData?.topics || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={22} color="#38bdf8" />
              <span>Progress Lab &amp; Student Activity Intelligence</span>
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
              Real-time active learning telemetry, reading verification metrics, and verified conceptual mastery gain.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontSize: 11,
                fontWeight: 700,
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              <Activity size={12} className="pulse-dot" /> Live Webpage Tracking Active
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--panel-border)', paddingBottom: 8 }}>
        <button
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 7 }}
        >
          <TrendingUp size={14} />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={activeTab === 'graph' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 7 }}
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

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading student activity telemetry &amp; progress records...
        </div>
      ) : activeTab === 'graph' ? (
        /* ── ACADEMIC GRAPH VIEW ── */
        <StudentAcademicGraph
          studentName={user?.name || ''}
          gaps={gaps}
          topics={topics}
          violations={violations}
          interventions={interventions}
          progress={progressList}
        />
      ) : (
        <>
          {/* ── 1. ACTIVE WEBPAGE TELEMETRY DASHBOARD NUMBERS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              <Sparkles size={16} color="#f59e0b" />
              <span>Active Study Telemetry &amp; Dashboard Analytics</span>
            </div>

            <div className="stagger-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              {/* Card 1: Total Active Study Hours */}
              <div
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#38bdf8' }}>
                    Active Study Time
                  </span>
                  <Clock size={16} color="#38bdf8" />
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                  {summary.total_active_hours_str || '0.00 hours'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Total active focused reading time across {summary.total_topics_tracked || 0} topics
                </div>
              </div>

              {/* Card 2: Where Student Stayed The Most */}
              <div
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
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
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={summary.stayed_most_topic?.topic_title || 'No topics tracked yet'}
                >
                  {summary.stayed_most_topic?.topic_title || 'None yet'}
                </div>
                <div style={{ fontSize: 11, color: '#c084fc', fontWeight: 600 }}>
                  {summary.stayed_most_topic ? `${summary.stayed_most_topic.hours_studied_str} active study` : 'Awaiting reading activity'}
                </div>
              </div>

              {/* Card 3: Highest Struggle Topic (Intelligence) */}
              <div
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: summary.highest_struggle_topic ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--panel-border)',
                  background: summary.highest_struggle_topic
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.4) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
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
                  title={summary.highest_struggle_topic?.topic_title || 'No struggles detected'}
                >
                  {summary.highest_struggle_topic ? summary.highest_struggle_topic.topic_title : 'Optimal Comprehension'}
                </div>
                <div style={{ fontSize: 11, color: summary.highest_struggle_topic ? '#f87171' : 'var(--text-secondary)' }}>
                  {summary.highest_struggle_topic
                    ? `Struggle Index: ${summary.highest_struggle_topic.struggle_score} / 10`
                    : 'No excessive dwell or hesitation detected'}
                </div>
              </div>

              {/* Card 4: Reading Integrity & Rapid Scroll Detection */}
              <div
                className="glass-panel"
                style={{
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: summary.rapid_scroll_count > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.3)',
                  background: summary.rapid_scroll_count > 0
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: summary.rapid_scroll_count > 0 ? '#fbbf24' : '#34d399' }}>
                    Reading Integrity
                  </span>
                  {summary.rapid_scroll_count > 0 ? <AlertTriangle size={16} color="#fbbf24" /> : <CheckCircle2 size={16} color="#34d399" />}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {summary.considered_read_count || 0} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Verified Reads</span>
                </div>
                <div style={{ fontSize: 11, color: summary.rapid_scroll_count > 0 ? '#f59e0b' : '#34d399', fontWeight: 600 }}>
                  {summary.rapid_scroll_count > 0
                    ? `⚠️ ${summary.rapid_scroll_count} topic(s) rapid-scrolled & unverified`
                    : '✓ All topics passed genuine reading velocity'}
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. TOPIC-BY-TOPIC STUDY LOG (TOPIC 1 : STUDIED X HOURS) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                <BookOpen size={16} color="#38bdf8" />
                <span>Curriculum Topic Breakdown</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {topics.length} recorded topic session(s)
              </span>
            </div>

            {topics.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  borderRadius: 12,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
              >
                No topic activity recorded yet. Open the <strong>Learn</strong> app to begin reading modules.
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
                      gap: 14,
                      border: t.struggle_level === 'high_struggle'
                        ? '1px solid rgba(239, 68, 68, 0.4)'
                        : t.rapid_scroll_detected
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : '1px solid var(--panel-border)',
                      background: t.struggle_level === 'high_struggle'
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'rgba(255, 255, 255, 0.02)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Left: Formatted Topic Studied Heading & Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Explicit user format: Topic X : Studied x hours */}
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            fontFamily: 'monospace',
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {t.topic_label}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {t.subject_name}
                        </span>
                      </div>

                      <div style={{ fontSize: 13, fontWeight: 600, color: '#38bdf8' }}>
                        {t.topic_title}
                      </div>

                      {/* Diagnostic reason if struggling */}
                      {t.struggle_level !== 'normal' && (
                        <div style={{ fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <AlertTriangle size={12} />
                          <span>AI Intelligence: {t.struggle_reason}</span>
                        </div>
                      )}

                      {/* Rapid scroll warning if detected */}
                      {t.rapid_scroll_detected && (
                        <div style={{ fontSize: 11, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                          <XCircle size={12} />
                          <span>Fast scrolling detected without genuine reading. Topic is NOT marked as read.</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Status Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Struggle badge */}
                      {t.struggle_level === 'high_struggle' ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 20,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                          }}
                        >
                          High Struggle Detected
                        </span>
                      ) : t.struggle_level === 'moderate_struggle' ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 20,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                          }}
                        >
                          Moderate Hesitation
                        </span>
                      ) : null}

                      {/* Read verification status badge */}
                      {t.is_considered_read ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: 20,
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
                            padding: '4px 10px',
                            borderRadius: 20,
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <XCircle size={12} /> Not Read
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. LEARNING LOOP REASSESSMENT PROGRESS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
              <Trophy size={16} color="#f59e0b" />
              <span>Verified Conceptual Mastery Gains &amp; Closed Loops</span>
            </div>

            {progressList.length === 0 ? (
              <div
                className="glass-panel"
                style={{
                  padding: 24,
                  textAlign: 'center',
                  borderRadius: 12,
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
              >
                No reassessed progress records yet. Complete an intervention practice set and reassessment to close the learning loop.
              </div>
            ) : (
              <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {progressList.map((prog) => {
                  const delta = typeof prog.delta === 'string' ? JSON.parse(prog.delta) : prog.delta;
                  return (
                    <div
                      key={prog.id}
                      className="glass-panel"
                      style={{
                        borderRadius: 14,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      {/* Milestone Banner */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Trophy size={22} color="#f59e0b" />
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 800 }}>{prog.concept} Learning Loop Closed</h3>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Reassessment Completed: {new Date(prog.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="badge badge-resolved">Loop Resolved</span>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: 20,
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              fontWeight: 800,
                              fontSize: 13,
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                            }}
                          >
                            +{delta?.accuracy_gain_pct || 0}% Accuracy Gain
                          </span>
                        </div>
                      </div>

                      {/* Before / After Evidence Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {/* Before Evidence */}
                        <div
                          style={{
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                              Baseline Evidence ({delta?.before_total || 0} attempts)
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#f87171' }}>
                              {delta?.before_accuracy_pct || 0}% Accuracy
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {prog.before_evidence && prog.before_evidence.map((ev: any, i: number) => (
                              <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                • {ev.statement || 'Practice attempt'} — <span style={{ color: ev.result === 'correct' ? '#34d399' : '#f87171' }}>{ev.result}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* After Evidence */}
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                              Post-Intervention Evidence ({delta?.after_total || 0} attempts)
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>
                              {delta?.after_accuracy_pct || 0}% Accuracy
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {prog.after_evidence && prog.after_evidence.map((ev: any, i: number) => (
                              <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                • {ev.statement || 'Reassessment attempt'} — <span style={{ color: ev.result === 'correct' ? '#34d399' : '#f87171' }}>{ev.result}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
