import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Target,
  FileText,
  Shield,
  Maximize,
  BookOpen,
  AlertTriangle,
  X,
  Bot,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Zap,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PracticeLabApp() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'practice' | 'assessments'>('practice');

  // Practice Pool state
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string>('all');
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [descriptiveAnswer, setDescriptiveAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Assigned Assessments state
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [examSessionStarted, setExamSessionStarted] = useState(false);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);

  // Anticheat & Focus Telemetry state
  const [violations, setViolations] = useState<any[]>([]);
  const [violationAlert, setViolationAlert] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeAssessmentRef = useRef<any>(null);
  activeAssessmentRef.current = activeAssessment;
  const examSessionStartedRef = useRef(false);
  examSessionStartedRef.current = examSessionStarted;

  // Fetch standard practice questions
  const fetchPracticeQuestions = () => {
    if (!user) return;
    setLoading(true);
    axios.get(`/api/practice/${user.id}`)
      .then(res => {
        setQuestions(res.data.questions);
        if (res.data.questions.length > 0 && !selectedQuestion) {
          setSelectedQuestion(res.data.questions[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Fetch available assessments
  const fetchAvailableAssessments = () => {
    setLoadingAssessments(true);
    axios.get('/api/practice/assessments/available')
      .then(res => setAssessments(res.data.assessments || []))
      .catch(console.error)
      .finally(() => setLoadingAssessments(false));
  };

  useEffect(() => {
    fetchPracticeQuestions();
    fetchAvailableAssessments();
  }, [user]);

  // Record a deterministic integrity forensic event
  const logIntegrityEvent = async (eventType: string, metadata: any = {}) => {
    const currentAssess = activeAssessmentRef.current;
    if (!currentAssess || !currentAssess.proctoring_enabled) return;

    try {
      await axios.post(`/api/questions/assessments/${currentAssess.id}/integrity-event`, {
        event_type: eventType,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          screen: { width: window.innerWidth, height: window.innerHeight }
        }
      });
      setViolations(prev => [...prev, { eventType, time: new Date() }]);
    } catch (err) {
      console.warn('Failed to dispatch integrity event:', err);
    }
  };

  // Anticheat Telemetry Listeners
  useEffect(() => {
    if (!examSessionStarted || !activeAssessment?.proctoring_enabled) return;

    const rules = typeof activeAssessment.integrity_rules === 'string'
      ? JSON.parse(activeAssessment.integrity_rules)
      : (activeAssessment.integrity_rules || {});

    // 1. Tab Switching & Browser Visibility Listener
    const handleVisibilityChange = () => {
      if (document.hidden && rules.block_tab_switch !== false) {
        setViolationAlert('Focus Alert: Tab switch detected! Event logged to teacher audit trail.');
        logIntegrityEvent('tab_switch', { reason: 'visibility_hidden' });
      }
    };

    // 2. Window Blur Listener (user clicked outside or switched window)
    const handleBlur = () => {
      if (rules.block_tab_switch !== false) {
        setViolationAlert('Focus Alert: Window lost focus! Please stay inside the exam window.');
        logIntegrityEvent('window_blur', { reason: 'window_blur' });
      }
    };

    // 3. Fullscreen Exit Listener
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen && rules.fullscreen !== false) {
        setViolationAlert('Fullscreen Exited: Please return to fullscreen mode.');
        logIntegrityEvent('fullscreen_exit', { reason: 'fullscreen_lost' });
      }
    };

    // 4. Clipboard Interception
    const handlePaste = (e: ClipboardEvent) => {
      if (rules.block_clipboard !== false) {
        e.preventDefault();
        setViolationAlert('Clipboard Paste is restricted during this proctored test.');
        logIntegrityEvent('paste_attempt', { reason: 'paste_blocked' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('paste', handlePaste);
    };
  }, [examSessionStarted, activeAssessment]);

  // Auto-dismiss violation alerts after 5 seconds
  useEffect(() => {
    if (violationAlert) {
      const timer = setTimeout(() => setViolationAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [violationAlert]);

  const concepts = Array.from(new Set(questions.map(q => q.concept)));
  const filteredQuestions = selectedConcept === 'all'
    ? questions
    : questions.filter(q => q.concept === selectedConcept);

  const handleSelectQuestion = (q: any) => {
    setSelectedQuestion(q);
    setSelectedOptionId('');
    setDescriptiveAnswer('');
    setLastResult(null);
  };

  const handleSubmitAttempt = async () => {
    if (!selectedQuestion) return;
    const isDescriptive = selectedQuestion.type === 'descriptive';
    if (!isDescriptive && !selectedOptionId) return;
    if (isDescriptive && !descriptiveAnswer.trim()) return;

    setSubmitting(true);
    try {
      const payload: any = {
        question_id: selectedQuestion.id,
        source: activeAssessment ? 'assessment' : 'practice'
      };

      if (isDescriptive) {
        payload.answer = descriptiveAnswer.trim();
      } else {
        payload.selected_option_ids = [selectedOptionId];
      }

      const res = await axios.post('/api/attempts', payload);
      setLastResult(res.data);
      if (activeAssessment) {
        // Refresh assessment questions
        axios.get(`/api/questions/assessments/${activeAssessment.id}`)
          .then(res => setAssessmentQuestions(res.data.questions || []))
          .catch(console.error);
      } else {
        fetchPracticeQuestions();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Attempt submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const startAssessmentSession = async (assessment: any) => {
    setActiveAssessment(assessment);
    setViolations([]);
    setViolationAlert(null);

    // Fetch questions for this assessment
    try {
      const res = await axios.get(`/api/questions/assessments/${assessment.id}`);
      const qList = res.data.questions || [];
      setAssessmentQuestions(qList);
      if (qList.length > 0) {
        setSelectedQuestion(qList[0]);
      } else {
        setSelectedQuestion(null);
      }
    } catch (err) {
      console.error('Failed to load assessment questions:', err);
    }

    if (assessment.proctoring_enabled) {
      enterFullscreen();
    }
    setExamSessionStarted(true);
  };

  const exitAssessmentSession = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setActiveAssessment(null);
    setExamSessionStarted(false);
    setViolations([]);
    setViolationAlert(null);
    fetchPracticeQuestions();
    fetchAvailableAssessments();
  };

  const parsedOptions = selectedQuestion
    ? (typeof selectedQuestion.options === 'string' ? JSON.parse(selectedQuestion.options) : selectedQuestion.options)
    : [];

  const rules = activeAssessment && typeof activeAssessment.integrity_rules === 'string'
    ? JSON.parse(activeAssessment.integrity_rules)
    : (activeAssessment?.integrity_rules || {});
  const maxViolations = rules.max_violations || 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Top Header Mode Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--panel-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setViewMode('practice'); if (examSessionStarted) exitAssessmentSession(); }}
            className={viewMode === 'practice' && !examSessionStarted ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Target size={13} /> Practice Pool
          </button>
          <button
            onClick={() => { setViewMode('assessments'); if (examSessionStarted) exitAssessmentSession(); }}
            className={viewMode === 'assessments' && !examSessionStarted ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FileText size={13} /> Assigned Assessments ({assessments.length})
          </button>
        </div>

        {/* If an active proctored exam is in session, show HUD */}
        {examSessionStarted && activeAssessment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeAssessment.proctoring_enabled ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                }}
              >
                <Shield size={14} color="#a5b4fc" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a5b4fc' }}>Anticheat Active</span>
                <span
                  className="badge"
                  style={{
                    background: violations.length >= maxViolations ? '#ef4444' : violations.length > 0 ? '#f59e0b' : '#10b981',
                    color: '#fff',
                    fontSize: 10,
                  }}
                >
                  {violations.length} / {maxViolations} Flags
                </span>
                {!isFullscreen && (
                  <button
                    onClick={enterFullscreen}
                    style={{
                      background: '#4f46e5',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 10,
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Maximize size={11} /> Enter Fullscreen
                  </button>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: 11,
                  color: '#6ee7b7',
                }}
              >
                <BookOpen size={13} />
                <span>Open Formative Mode</span>
              </div>
            )}

            <button
              onClick={exitAssessmentSession}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Finish / Exit Test
            </button>
          </div>
        )}
      </div>

      {/* Floating Real-Time Integrity Warning Toast */}
      {violationAlert && (
        <div
          className="t-panel-slide"
          data-open="true"
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="#fff" />
            <span>{violationAlert}</span>
          </div>
          <button
            onClick={() => setViolationAlert(null)}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* VIEW 1: ASSESSMENTS LIST (When not in an active exam session) */}
      {viewMode === 'assessments' && !examSessionStarted && (
        <div className="glass-panel" style={{ borderRadius: 14, padding: 20, flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>Teacher-Assigned Tests & Official Assessments</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Take officially published assessments. Tests with Anticheat enabled will enforce full-screen focus and track window focus.
            </p>
          </div>

          {loadingAssessments ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading assigned assessments...
            </div>
          ) : assessments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No official assessments published right now. Use the Practice Pool for open learning!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {assessments.map((a) => (
                <div
                  key={a.id}
                  className="glass-panel"
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    border: a.proctoring_enabled
                      ? '1px solid rgba(99, 102, 241, 0.4)'
                      : '1px solid var(--card-border)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</span>
                      {a.proctoring_enabled ? (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.5)',
                            fontSize: 10,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Shield size={11} /> Anticheat Active
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#6ee7b7',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontSize: 10,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <BookOpen size={11} /> Formative
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                      {a.question_count || 0} Questions • Published {new Date(a.created_at).toLocaleDateString()}
                    </p>

                    {a.proctoring_enabled && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 8,
                          borderRadius: 8,
                          background: 'rgba(99, 102, 241, 0.08)',
                          fontSize: 11,
                          color: '#c7d2fe',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AlertTriangle size={12} color="#f59e0b" /> Focus Rules: Fullscreen required, tab switching & window blur tracked deterministically.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => startAssessmentSession(a)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{a.proctoring_enabled ? 'Enter Proctored Exam' : 'Begin Assessment'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ACTIVE PRACTICE OR ACTIVE EXAM SESSION */}
      {(viewMode === 'practice' || examSessionStarted) && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar: Questions List */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                {examSessionStarted ? activeAssessment?.title : 'Practice Questions'}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {examSessionStarted ? 'Official Assessment Questions' : 'Teacher + AI Generated Practice Pool'}
              </p>
            </div>

            {/* Concept Filter (in free practice mode only) */}
            {!examSessionStarted && (
              <select
                value={selectedConcept}
                onChange={(e) => setSelectedConcept(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--panel-border)',
                  fontSize: 12,
                  outline: 'none',
                }}
              >
                <option value="all" style={{ background: '#1e293b' }}>All Concepts ({questions.length})</option>
                {concepts.map(c => (
                  <option key={c} value={c} style={{ background: '#1e293b' }}>{c}</option>
                ))}
              </select>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(examSessionStarted ? assessmentQuestions : filteredQuestions).map((q, idx) => {
                const isSelected = selectedQuestion?.id === q.id;
                const attemptsCount = q.student_attempts?.length || 0;
                const lastAttempt = q.student_attempts?.[0];

                return (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuestion(q)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: isSelected ? 'rgba(var(--accent), 0.2)' : 'var(--card-bg)',
                      border: isSelected ? '1px solid rgba(var(--accent), 0.6)' : '1px solid var(--card-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase' }}>
                        {examSessionStarted ? `Q${idx + 1}: ${q.concept}` : q.concept}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {q.source === 'ai' ? <><Bot size={11} /> AI</> : <><UserCheck size={11} /> Teacher</>}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {q.statement}
                    </div>
                    {attemptsCount > 0 && (
                      <div style={{ fontSize: 10, marginTop: 6, color: lastAttempt?.is_correct ? '#34d399' : '#f87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {lastAttempt?.is_correct ? <><Check size={10} /> Solved</> : <><X size={10} /> Weak attempt</>} ({attemptsCount} tries)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Area: Interactive Question & Evaluation */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            {selectedQuestion ? (
              <>
                {/* Question Statement */}
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span className="badge badge-active">{selectedQuestion.concept}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {selectedQuestion.subconcept}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      Bloom: {selectedQuestion.bloom_level} | Difficulty: {selectedQuestion.difficulty}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
                    {selectedQuestion.statement}
                  </h2>
                </div>

                {/* Options (for MCQ) OR Textarea (for Descriptive) */}
                {selectedQuestion.type === 'descriptive' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={13} /> Provide your complete explanation in your own words:
                    </div>
                    <textarea
                      value={descriptiveAnswer}
                      onChange={(e) => setDescriptiveAnswer(e.target.value)}
                      placeholder="Type your structured explanation here (e.g. key mechanism, base cases, state transitions)..."
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--input-bg)',
                        border: '1px solid var(--panel-border)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {parsedOptions.map((opt: any) => {
                      const isChecked = selectedOptionId === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setSelectedOptionId(opt.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: isChecked ? 'rgba(var(--accent), 0.15)' : 'var(--card-bg)',
                            border: isChecked ? '1px solid rgba(var(--accent), 0.7)' : '1px solid var(--panel-border)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="mcq_option"
                            checked={isChecked}
                            onChange={() => setSelectedOptionId(opt.id)}
                          />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Submit Button */}
                <div>
                  <button
                    onClick={handleSubmitAttempt}
                    disabled={submitting || (selectedQuestion.type === 'descriptive' ? !descriptiveAnswer.trim() : !selectedOptionId)}
                    className="btn-primary"
                    style={{ padding: '10px 24px', fontSize: 14 }}
                  >
                    {submitting ? 'Evaluating answer...' : selectedQuestion.type === 'descriptive' ? 'Submit Explanation for Rubric Grading' : 'Submit Attempt'}
                  </button>
                </div>

                {/* Evaluation Result */}
                {lastResult && (
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      background: lastResult.evaluation?.is_correct
                        ? 'rgba(16, 185, 129, 0.15)'
                        : lastResult.evaluation?.verdict === 'partial'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      border: lastResult.evaluation?.is_correct
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : lastResult.evaluation?.verdict === 'partial'
                        ? '1px solid rgba(245, 158, 11, 0.4)'
                        : '1px solid rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {lastResult.evaluation?.is_correct ? (
                          <CheckCircle2 size={20} color="#34d399" />
                        ) : lastResult.evaluation?.verdict === 'partial' ? (
                          <AlertCircle size={20} color="#fbbf24" />
                        ) : (
                          <AlertTriangle size={20} color="#f87171" />
                        )}
                        <div style={{ fontWeight: 800, fontSize: 15 }}>
                          {lastResult.evaluation?.verdict
                            ? `Verdict: ${lastResult.evaluation.verdict.toUpperCase()} (Marks: ${lastResult.evaluation.marks_awarded})`
                            : lastResult.evaluation?.is_correct
                            ? 'Correct Answer! Marks Awarded: ' + lastResult.evaluation.marks_awarded
                            : 'Incorrect. Learning evidence recorded.'}
                        </div>
                      </div>

                      {lastResult.evidence?.source && (
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            background: lastResult.evidence.source === 'ai_graded_descriptive' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            color: lastResult.evidence.source === 'ai_graded_descriptive' ? 'var(--accent-light)' : 'var(--text-secondary)'
                          }}
                        >
                          Source: {lastResult.evidence.source}
                        </span>
                      )}
                    </div>

                    {/* Descriptive Rubric Breakdown (Covered & Missed) */}
                    {lastResult.evaluation?.grading_details && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                        {lastResult.evaluation.grading_details.similarity_score !== undefined && (
                          <div style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <BarChart3 size={13} /> Semantic Similarity: <strong>{(lastResult.evaluation.grading_details.similarity_score * 100).toFixed(1)}%</strong>
                          </div>
                        )}

                        {lastResult.evaluation.grading_details.covered?.length > 0 && (
                          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 10, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ fontWeight: 700, color: '#34d399', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Check size={13} /> Concepts Covered:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {lastResult.evaluation.grading_details.covered.map((c: string, i: number) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {lastResult.evaluation.grading_details.missed?.length > 0 && (
                          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <X size={13} /> Points Missed / To Elaborate:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {lastResult.evaluation.grading_details.missed.map((m: string, i: number) => (
                                <li key={i}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto Attendance Notification */}
                    {lastResult.auto_attendance?.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 11, color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={13} /> Auto-Attendance: Attendance recorded for active session window!
                      </div>
                    )}

                    {/* Gap Formed Signal */}
                    {lastResult.gap_detected?.is_new && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#fbbf24', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={13} /> Note: Repeated incorrect attempts have registered an emerging learning gap in {selectedQuestion.concept}. Your teacher can now run a targeted diagnostic probe.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                Select a question from the left sidebar to begin practice.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

