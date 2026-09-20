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
  Lock,
  Play,
  RotateCcw,
  Keyboard,
  Clock,
  Activity,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOSStore } from '../os/store/useOSStore';

export default function PracticeLabApp() {
  const { user } = useAuth();
  const windows = useOSStore((state) => state.windows);
  const focusedWindowId = useOSStore((state) => state.focusedWindowId);

  // Retrieve appProps if passed from MyLearningApp or desktop
  const currentWin = windows.find((w) => w.appType === 'practice-lab');
  const initialAssessmentId = (currentWin?.appProps as any)?.assessmentId as string | undefined;

  const [viewMode, setViewMode] = useState<'practice' | 'assessments'>('assessments');

  // Practice Pool state
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string>('all');
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [descriptiveAnswer, setDescriptiveAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── AI-Generated Targeted Practice (self-serve, bounded, all 6 Bloom levels) ──
  const [genConcept, setGenConcept] = useState('');
  const [genSubconcept, setGenSubconcept] = useState('');
  const [genCount, setGenCount] = useState(6);
  const [genIncludeDescriptive, setGenIncludeDescriptive] = useState(true);
  const [genAutoTarget, setGenAutoTarget] = useState(true);
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [genCapability, setGenCapability] = useState<{ accuracy: number | null } | null>(null);
  const [genTargetedConcept, setGenTargetedConcept] = useState<{ concept: string; subconcept: string; reason: string } | null>(null);
  const [genRemaining, setGenRemaining] = useState<number | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  // Assigned Assessments state
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [examSessionStarted, setExamSessionStarted] = useState(false);
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, any>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);

  // ── Anticheat & 3-Warning Flag State ──
  const [violations, setViolations] = useState<any[]>([]);
  const [violationAlert, setViolationAlert] = useState<{ title: string; desc: string; count: number } | null>(null);
  const [isTestLocked, setIsTestLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Typing Speed Telemetry ──
  const [typingSpeedWpm, setTypingSpeedWpm] = useState(0);
  const keystrokeCountRef = useRef(0);
  const typingStartTimeRef = useRef<number | null>(null);
  const lastAnswerLengthRef = useRef(0);

  const activeAssessmentRef = useRef<any>(null);
  activeAssessmentRef.current = activeAssessment;
  const examSessionStartedRef = useRef(false);
  examSessionStartedRef.current = examSessionStarted;
  const isTestLockedRef = useRef(false);
  isTestLockedRef.current = isTestLocked;

  // Max violation limit: 3 warning flags
  const MAX_VIOLATION_FLAGS = 3;

  // Fetch standard practice questions
  const fetchPracticeQuestions = () => {
    if (!user) return;
    setLoading(true);
    axios.get(`/api/practice/${user.id}`)
      .then(res => {
        setQuestions(res.data.questions || []);
        if (res.data.questions?.length > 0 && !selectedQuestion) {
          setSelectedQuestion(res.data.questions[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Fetch available published assessments
  const fetchAvailableAssessments = () => {
    setLoadingAssessments(true);
    axios.get('/api/practice/assessments/available')
      .then(res => {
        const list = res.data.assessments || [];
        setAssessments(list);

        // If an initial assessment ID was passed from another app, auto-open it
        if (initialAssessmentId && !examSessionStarted) {
          const match = list.find((a: any) => a.id === initialAssessmentId);
          if (match) {
            startAssessmentSession(match);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingAssessments(false));
  };

  useEffect(() => {
    fetchPracticeQuestions();
    fetchAvailableAssessments();
  }, [user]);

  // Self-serve bounded AI generation: student requests more targeted practice on a
  // concept. The server always personalizes the Bloom-level mix to this student's
  // own evidence (weak concepts skew toward Remember/Understand/Apply, strong ones
  // toward Analyze/Evaluate/Create), and covers all six levels across the batch.
  const handleGeneratePractice = async () => {
    if (!genAutoTarget && (!genConcept.trim() || !genSubconcept.trim())) {
      alert('Enter a concept and subconcept, or enable "Target my weakest concept".');
      return;
    }
    setGeneratingPractice(true);
    setGenProgress({ current: 0, total: genCount });
    setGenCapability(null);
    setGenTargetedConcept(null);

    try {
      const typeMix = genIncludeDescriptive
        ? {
            mcq_single: Math.max(1, Math.round(genCount * 0.6)),
            descriptive: Math.max(0, genCount - Math.round(genCount * 0.6)),
          }
        : { mcq_single: genCount };

      const jobRes = await axios.post('/api/generation-jobs', {
        ...(genAutoTarget
          ? { auto_target: true }
          : { concept: genConcept.trim(), subconcept: genSubconcept.trim() }),
        requested_count: genCount,
        type_mix: typeMix,
      });

      setGenCapability(jobRes.data.capability_basis || null);
      setGenTargetedConcept(jobRes.data.targeted_concept || null);
      const newJobId = jobRes.data.job_id;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => socket.send(JSON.stringify({ subscribe: newJobId }));
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'generation.progress') {
            setGenProgress({ current: data.current, total: data.total });
          } else if (data.type === 'question.generated' && data.question) {
            setQuestions((prev) => [data.question, ...prev]);
          } else if (data.type === 'generation.completed' || data.type === 'generation.cancelled') {
            setGeneratingPractice(false);
            if (typeof data.session_remaining === 'number') setGenRemaining(data.session_remaining);
            socket.close();
            fetchPracticeQuestions();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
      socket.onerror = () => setGeneratingPractice(false);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setGenRemaining(0);
      }
      alert(err.response?.data?.error || 'Failed to start practice generation');
      setGeneratingPractice(false);
    }
  };

  // Dispatch forensic integrity violation event to backend
  const logIntegrityEvent = async (eventType: string, metadata: any = {}) => {
    const currentAssess = activeAssessmentRef.current;
    if (!currentAssess || !currentAssess.proctoring_enabled || isTestLockedRef.current) return;

    try {
      await axios.post(`/api/questions/assessments/${currentAssess.id}/integrity-event`, {
        event_type: eventType,
        metadata: {
          ...metadata,
          flag_number: violations.length + 1,
          timestamp: new Date().toISOString(),
          typing_wpm: typingSpeedWpm,
          screen: { width: window.innerWidth, height: window.innerHeight }
        }
      });
    } catch (err) {
      console.warn('Failed to dispatch integrity event:', err);
    }

    const newViolations = [...violations, { eventType, metadata, time: new Date() }];
    setViolations(newViolations);

    const flagNum = newViolations.length;

    // Trigger Warning Alert
    if (flagNum < MAX_VIOLATION_FLAGS) {
      setViolationAlert({
        title: `WARNING FLAG ${flagNum} OF ${MAX_VIOLATION_FLAGS}`,
        desc: `${getViolationTitle(eventType)}! You have ${MAX_VIOLATION_FLAGS - flagNum} warning(s) remaining before test lock.`,
        count: flagNum,
      });
    } else {
      // 3RD FLAG: AUTO-LOCK TEST
      setIsTestLocked(true);
      setViolationAlert({
        title: `🚨 TEST LOCKED: 3 WARNING FLAGS EXCEEDED`,
        desc: `Maximum integrity violations reached (${getViolationTitle(eventType)}). Examination has been locked and submitted for instructor forensic audit.`,
        count: 3,
      });

      // Dispatch threshold exceeded event
      try {
        await axios.post(`/api/questions/assessments/${currentAssess.id}/integrity-event`, {
          event_type: 'flag_threshold_exceeded',
          metadata: {
            reason: 'three_warning_flags_reached',
            final_violation: eventType,
            total_violations: newViolations.length,
          }
        });
      } catch (err) {
        console.error(err);
      }

      // Auto-submit current exam answers
      handleAutoSubmitOnLock();
    }
  };

  const getViolationTitle = (type: string) => {
    switch (type) {
      case 'tab_switch': return 'Browser Tab Switch';
      case 'window_blur': return 'Window Lost Focus / Switched Application';
      case 'copy_attempt': return 'Clipboard Copy Attempt';
      case 'paste_attempt': return 'Clipboard Paste Attempt';
      case 'ctrl_c_attempt': return 'Ctrl+C / Cmd+C Keyboard Shortcut';
      case 'ctrl_v_attempt': return 'Ctrl+V / Cmd+V Keyboard Shortcut';
      case 'typing_anomaly': return 'Unnatural Text Influx (Bulk Insertion)';
      case 'fullscreen_exit': return 'Fullscreen Mode Exited';
      case 'context_menu': return 'Right-Click Context Menu';
      default: return 'Security Protocol Breach';
    }
  };

  // ── Anticheat Telemetry Listeners ──
  useEffect(() => {
    if (!examSessionStarted || !activeAssessment?.proctoring_enabled || isTestLocked) return;

    // 1. Tab Switch / Browser Visibility Listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logIntegrityEvent('tab_switch', { reason: 'visibility_hidden' });
      }
    };

    // 2. Window Blur Listener (user clicks out of browser or switches apps)
    const handleBlur = () => {
      logIntegrityEvent('window_blur', { reason: 'window_blur' });
    };

    // 3. Fullscreen Exit Listener
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        logIntegrityEvent('fullscreen_exit', { reason: 'fullscreen_lost' });
      }
    };

    // 4. Clipboard Copy & Paste Interception
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logIntegrityEvent('copy_attempt', { reason: 'clipboard_copy_blocked' });
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logIntegrityEvent('paste_attempt', { reason: 'clipboard_paste_blocked' });
    };

    // 5. Context Menu Right Click Interception
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logIntegrityEvent('context_menu', { reason: 'right_click_blocked' });
    };

    // 6. Keyboard Shortcuts: Ctrl+C, Ctrl+V, Cmd+C, Cmd+V
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrlOrCmd && key === 'c') {
        e.preventDefault();
        logIntegrityEvent('ctrl_c_attempt', { key: 'Ctrl+C' });
      } else if (isCtrlOrCmd && key === 'v') {
        e.preventDefault();
        logIntegrityEvent('ctrl_v_attempt', { key: 'Ctrl+V' });
      } else if (isCtrlOrCmd && (key === 'x' || key === 'a' || key === 'insert')) {
        e.preventDefault();
        logIntegrityEvent('copy_attempt', { key: `Shortcut: ${key}` });
      }

      // Track keystroke count for live typing speed
      if (!isCtrlOrCmd && e.key.length === 1) {
        if (!typingStartTimeRef.current) {
          typingStartTimeRef.current = Date.now();
        }
        keystrokeCountRef.current += 1;
        const elapsedMins = Math.max(0.1, (Date.now() - typingStartTimeRef.current) / 60000);
        const wpm = Math.round((keystrokeCountRef.current / 5) / elapsedMins);
        setTypingSpeedWpm(wpm);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [examSessionStarted, activeAssessment, violations.length, isTestLocked]);

  // Dismiss non-locking alerts after 6 seconds
  useEffect(() => {
    if (violationAlert && violationAlert.count < MAX_VIOLATION_FLAGS) {
      const timer = setTimeout(() => setViolationAlert(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [violationAlert]);

  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const startAssessmentSession = async (assessment: any) => {
    setActiveAssessment(assessment);
    setViolations([]);
    setViolationAlert(null);
    setIsTestLocked(false);
    setExamSubmitted(false);
    setExamAnswers({});
    setActiveQuestionIndex(0);
    keystrokeCountRef.current = 0;
    typingStartTimeRef.current = null;
    setTypingSpeedWpm(0);

    try {
      const res = await axios.get(`/api/questions/assessments/${assessment.id}`);
      const qList = res.data.questions || [];
      setAssessmentQuestions(qList);
      if (qList.length > 0) {
        setSelectedQuestion(qList[0]);
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
    setIsTestLocked(false);
    setExamSubmitted(false);
    fetchAvailableAssessments();
  };

  // Typing change handler with bulk insertion anomaly check
  const handleTypingChange = (qId: string, value: string) => {
    if (isTestLocked) return;
    const prevLen = lastAnswerLengthRef.current;
    const delta = value.length - prevLen;

    // If more than 80 chars appeared in a single change event without typing
    if (delta > 80) {
      logIntegrityEvent('typing_anomaly', {
        chars_inserted: delta,
        reason: 'unnatural_bulk_character_influx',
      });
    }

    lastAnswerLengthRef.current = value.length;
    setExamAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleAutoSubmitOnLock = async () => {
    // Attempt submitting all answered questions
    for (const q of assessmentQuestions) {
      const ans = examAnswers[q.id];
      if (ans) {
        try {
          const payload: any = { question_id: q.id, source: 'assessment' };
          if (q.type === 'descriptive') {
            payload.answer = ans;
          } else {
            payload.selected_option_ids = [ans];
          }
          await axios.post('/api/attempts', payload);
        } catch {}
      }
    }
    setExamSubmitted(true);
  };

  const handleManualExamSubmit = async () => {
    if (isTestLocked) return;
    setSubmitting(true);
    try {
      for (const q of assessmentQuestions) {
        const ans = examAnswers[q.id];
        if (ans) {
          const payload: any = { question_id: q.id, source: 'assessment' };
          if (q.type === 'descriptive') {
            payload.answer = ans;
          } else {
            payload.selected_option_ids = [ans];
          }
          await axios.post('/api/attempts', payload);
        }
      }
      setExamSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit examination');
    } finally {
      setSubmitting(false);
    }
  };

  const currentAssessmentQuestion = assessmentQuestions[activeQuestionIndex] || selectedQuestion;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* ── TOP HEADER / HUD BAR ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderRadius: 10,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--panel-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setViewMode('assessments'); if (examSessionStarted) exitAssessmentSession(); }}
            className={viewMode === 'assessments' && !examSessionStarted ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Shield size={13} /> Official Proctored Tests ({assessments.length})
          </button>
          <button
            onClick={() => { setViewMode('practice'); if (examSessionStarted) exitAssessmentSession(); }}
            className={viewMode === 'practice' && !examSessionStarted ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Target size={13} /> Open Practice Pool
          </button>
        </div>

        {/* PROCTORING HUD (Visible during active test session) */}
        {examSessionStarted && activeAssessment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {activeAssessment.proctoring_enabled && (
              <>
                {/* Typing Speed Indicator */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--panel-border)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Keyboard size={13} color="#38bdf8" />
                  <span>Cadence: <strong>{typingSpeedWpm} WPM</strong></span>
                </div>

                {/* ── 3-WARNING FLAG HUD ── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 12px',
                    borderRadius: 8,
                    background: violations.length >= 3 ? 'rgba(239, 68, 68, 0.2)' : violations.length > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                    border: violations.length >= 3 ? '1px solid #ef4444' : violations.length > 0 ? '1px solid #f59e0b' : '1px solid #10b981',
                  }}
                >
                  <Shield size={14} color={violations.length >= 3 ? '#ef4444' : violations.length > 0 ? '#f59e0b' : '#34d399'} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>
                    3-Warning Baseline:
                  </span>

                  {/* 3 Flags Visual Tracker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[1, 2, 3].map((f) => {
                      const isTriggered = violations.length >= f;
                      return (
                        <span
                          key={f}
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 6,
                            background: isTriggered ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                            color: isTriggered ? '#fff' : 'var(--text-muted)',
                            border: isTriggered ? '1px solid #b91c1c' : '1px solid var(--panel-border)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          {isTriggered ? <AlertTriangle size={9} /> : <Check size={9} />}
                          Flag {f}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {!isFullscreen && !isTestLocked && (
                  <button
                    onClick={enterFullscreen}
                    style={{
                      background: '#4f46e5',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Maximize size={12} /> Fullscreen
                  </button>
                )}
              </>
            )}

            <button
              onClick={exitAssessmentSession}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              Exit Test
            </button>
          </div>
        )}
      </div>

      {/* ── REAL-TIME VIOLATION WARNING BANNER / TOAST ── */}
      {violationAlert && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 10,
            background: violationAlert.count >= 3
              ? 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)'
              : 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={22} color="#fff" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.02em' }}>
                {violationAlert.title}
              </div>
              <div style={{ fontSize: 12, opacity: 0.95, marginTop: 2 }}>
                {violationAlert.desc}
              </div>
            </div>
          </div>

          {violationAlert.count < MAX_VIOLATION_FLAGS && (
            <button
              onClick={() => setViolationAlert(null)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* ── VIEW 1: ASSESSMENTS LIST (DEFAULT) ── */}
      {viewMode === 'assessments' && !examSessionStarted && (
        <div className="glass-panel" style={{ borderRadius: 14, padding: 22, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="#6366f1" />
              <span>Published Proctored Assessments</span>
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Officially published tests assigned by your teacher. Proctored exams enforce full anti-cheat telemetry and the 3-warning flag baseline.
            </p>
          </div>

          {loadingAssessments ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading assigned assessments...
            </div>
          ) : assessments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No official assessments published right now. Use Open Practice Pool to test your concepts.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {assessments.map((a) => (
                <div
                  key={a.id}
                  className="glass-panel"
                  style={{
                    borderRadius: 14,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    background: 'rgba(15, 23, 42, 0.6)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{a.title}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: 'rgba(99, 102, 241, 0.25)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.5)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Shield size={11} /> Proctored
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Questions: <strong>{a.question_count || 0} questions</strong> • Published by Instructor
                    </div>

                    {/* Anti-cheat baseline badge list */}
                    <div
                      style={{
                        borderRadius: 8,
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--panel-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertTriangle size={12} /> 3-Warning Integrity Protocol Enforced:
                      </span>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                        <li>Tab switch &amp; window focus monitoring</li>
                        <li>Ctrl+C, Ctrl+V &amp; clipboard copy/paste blocked</li>
                        <li>Live typing speed &amp; bulk insertion anomaly tracking</li>
                        <li>Auto-lock &amp; submission on 3rd violation flag</li>
                      </ul>
                    </div>
                  </div>

                  <button
                    onClick={() => startAssessmentSession(a)}
                    className="btn-primary"
                    style={{
                      padding: '8px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    }}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Begin Secure Proctored Examination</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: ACTIVE PROCTORED EXAM SESSION ── */}
      {examSessionStarted && activeAssessment && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          {/* Left Panel: Question Navigator & Integrity Audit Trail */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Assessment Questions
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
                {assessmentQuestions.map((q, idx) => {
                  const isAnswered = Boolean(examAnswers[q.id]);
                  const isActive = idx === activeQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setActiveQuestionIndex(idx);
                        setSelectedQuestion(q);
                      }}
                      style={{
                        padding: '6px 0',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: isActive ? '2px solid #38bdf8' : '1px solid var(--panel-border)',
                        background: isActive ? 'rgba(56, 189, 248, 0.2)' : isAnswered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? '#38bdf8' : isAnswered ? '#34d399' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Flag History */}
            <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: violations.length > 0 ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Activity size={12} />
                <span>Forensic Integrity Trail ({violations.length}/3 Flags)</span>
              </div>

              {violations.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  No security flags registered. Focus remains clean.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {violations.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                      }}
                    >
                      <strong>Flag {i + 1}:</strong> {getViolationTitle(v.eventType)}
                      <div style={{ fontSize: 9, opacity: 0.8 }}>
                        {new Date(v.time).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Main Stage: Current Question & Answer Panel */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
            {isTestLocked ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Lock size={48} color="#ef4444" />
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f87171' }}>
                  Examination Terminated &amp; Locked
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460 }}>
                  You have accumulated 3 security violation flags during this session. In accordance with the institution's anti-cheat baseline, your examination has been locked and your responses have been auto-submitted with a complete forensic audit log.
                </p>
                <button onClick={exitAssessmentSession} className="btn-secondary" style={{ marginTop: 10 }}>
                  Return to Dashboard
                </button>
              </div>
            ) : examSubmitted ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <CheckCircle2 size={48} color="#34d399" />
                <h3 style={{ fontSize: 20, fontWeight: 800 }}>Examination Submitted Successfully</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440 }}>
                  Your answers have been registered and scored. Results have been incorporated into your learning evidence loop.
                </p>
                <button onClick={exitAssessmentSession} className="btn-primary" style={{ marginTop: 10 }}>
                  Finish &amp; Close Examination
                </button>
              </div>
            ) : currentAssessmentQuestion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Question Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                    Question {activeQuestionIndex + 1} of {assessmentQuestions.length}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Concept: {currentAssessmentQuestion.concept}
                  </span>
                </div>

                {/* Statement */}
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
                  {currentAssessmentQuestion.statement}
                </div>

                {/* Options for MCQ */}
                {currentAssessmentQuestion.type !== 'descriptive' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(() => {
                      const opts = typeof currentAssessmentQuestion.options === 'string'
                        ? JSON.parse(currentAssessmentQuestion.options)
                        : (currentAssessmentQuestion.options || []);
                      return opts.map((opt: any, optIdx: number) => {
                        const optId = opt.id || String(optIdx);
                        const isSelected = examAnswers[currentAssessmentQuestion.id] === optId;
                        return (
                          <div
                            key={optId}
                            onClick={() => {
                              if (!isTestLocked) {
                                setExamAnswers((prev) => ({ ...prev, [currentAssessmentQuestion.id]: optId }));
                              }
                            }}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 10,
                              background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                              border: isSelected ? '1px solid #38bdf8' : '1px solid var(--panel-border)',
                              cursor: isTestLocked ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              fontSize: 13,
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <span
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                border: isSelected ? '2px solid #38bdf8' : '1px solid var(--panel-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 11,
                                fontWeight: 700,
                                background: isSelected ? '#38bdf8' : 'transparent',
                                color: isSelected ? '#000' : 'var(--text-muted)',
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt.text || opt}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  /* Descriptive / Code input */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>Type your comprehensive answer below (Copy/paste is restricted):</span>
                      <span>Typing Speed: {typingSpeedWpm} WPM</span>
                    </div>
                    <textarea
                      value={examAnswers[currentAssessmentQuestion.id] || ''}
                      onChange={(e) => handleTypingChange(currentAssessmentQuestion.id, e.target.value)}
                      placeholder="Write your explanation or code solution here..."
                      disabled={isTestLocked}
                      rows={8}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 8,
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--panel-border)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                )}

                {/* Bottom Navigation & Submission Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                  <button
                    disabled={activeQuestionIndex === 0}
                    onClick={() => setActiveQuestionIndex((prev) => prev - 1)}
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '6px 14px' }}
                  >
                    ← Previous Question
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {activeQuestionIndex < assessmentQuestions.length - 1 ? (
                      <button
                        onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '6px 14px' }}
                      >
                        Next Question →
                      </button>
                    ) : (
                      <button
                        onClick={handleManualExamSubmit}
                        disabled={submitting || isTestLocked}
                        className="btn-primary"
                        style={{
                          fontSize: 12,
                          padding: '7px 18px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          fontWeight: 700,
                        }}
                      >
                        <Send size={13} />
                        <span>{submitting ? 'Submitting Examination...' : 'Submit Completed Test'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── VIEW 3: PRACTICE POOL (OPEN FORMATIVE PRACTICE) ── */}
      {viewMode === 'practice' && !examSessionStarted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
          {/* AI-Generated Targeted Practice (self-serve, bounded, all 6 Bloom levels) */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                <Bot size={15} color="#818cf8" /> Generate Targeted Practice
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 11, padding: '5px 12px' }}
                onClick={() => setShowGenerator((v) => !v)}
              >
                {showGenerator ? 'Hide' : 'New Practice Set'}
              </button>
            </div>

            {showGenerator && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  AI generates a bounded set of practice questions across all six Bloom levels, personalized to your
                  own recent accuracy — covering MCQ and, optionally, descriptive (free-text) questions. Bounded to 10
                  self-generated questions per login session.
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={genAutoTarget}
                    onChange={(e) => setGenAutoTarget(e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  Target my weakest concept automatically (from my Academic Graph)
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: genAutoTarget ? '100px' : '1fr 1fr 100px', gap: 8 }}>
                  {!genAutoTarget && (
                    <>
                      <input
                        type="text"
                        placeholder="Concept (e.g. Recursion)"
                        value={genConcept}
                        onChange={(e) => setGenConcept(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                      <input
                        type="text"
                        placeholder="Subconcept (e.g. Base Case Termination)"
                        value={genSubconcept}
                        onChange={(e) => setGenSubconcept(e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', fontSize: 12 }}
                      />
                    </>
                  )}
                  <input
                    type="number"
                    min={1}
                    max={genRemaining ?? 10}
                    value={genCount}
                    onChange={(e) => setGenCount(Math.min(genRemaining ?? 10, Math.max(1, Number(e.target.value) || 1)))}
                    title="Question count (max 10 per session)"
                    style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', fontSize: 12 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={genIncludeDescriptive}
                      onChange={(e) => setGenIncludeDescriptive(e.target.checked)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    Include descriptive questions
                  </label>
                  <button
                    onClick={handleGeneratePractice}
                    disabled={generatingPractice || genRemaining === 0}
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: generatingPractice || genRemaining === 0 ? 0.6 : 1 }}
                  >
                    <Zap size={13} /> {generatingPractice ? 'Generating...' : `Generate ${genCount} Questions`}
                  </button>
                </div>

                {genRemaining !== null && (
                  <div style={{ fontSize: 10, color: genRemaining === 0 ? '#f87171' : 'var(--text-muted)' }}>
                    {genRemaining} generation{genRemaining === 1 ? '' : 's'} left this session.
                  </div>
                )}

                {genTargetedConcept && (
                  <div style={{ fontSize: 11, color: '#a5b4fc' }}>
                    Targeted: {genTargetedConcept.concept} — {genTargetedConcept.subconcept} ({genTargetedConcept.reason})
                  </div>
                )}

                {genCapability && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Structured from your recent accuracy on this concept:{' '}
                    {genCapability.accuracy === null ? 'no prior evidence yet (even spread across all levels)' : `${Math.round(genCapability.accuracy * 100)}%`}.
                  </div>
                )}

                {generatingPractice && genProgress && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span>Streaming generation...</span>
                      <span>{genProgress.current} / {genProgress.total}</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${genProgress.total ? Math.round((genProgress.current / genProgress.total) * 100) : 0}%`,
                          background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          {/* Question List */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
              Open Practice Questions ({questions.length})
            </span>
            <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {questions.map((q) => {
                const isSelected = selectedQuestion?.id === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setSelectedQuestion(q);
                      setSelectedOptionId('');
                      setDescriptiveAnswer('');
                      setLastResult(null);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid var(--panel-border)',
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: isSelected ? '#38bdf8' : 'var(--text-primary)' }}>
                        {q.concept}
                      </span>
                      {q.bloom_level && (
                        <span style={{ fontSize: 9, textTransform: 'capitalize', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 4 }}>
                          {q.bloom_level}
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10 }}>
                      {q.statement}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Stage: Practice Reader */}
          <div className="glass-panel" style={{ borderRadius: 14, padding: 20, overflowY: 'auto' }}>
            {selectedQuestion ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                  Concept: {selectedQuestion.concept} • {selectedQuestion.subconcept}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {selectedQuestion.statement}
                </div>

                {/* MCQ Options or Descriptive free-text answer */}
                {selectedQuestion.type !== 'descriptive' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(() => {
                      const opts = typeof selectedQuestion.options === 'string'
                        ? JSON.parse(selectedQuestion.options)
                        : (selectedQuestion.options || []);
                      return opts.map((opt: any, idx: number) => {
                        const optId = opt.id || String(idx);
                        const isSel = selectedOptionId === optId;
                        return (
                          <div
                            key={optId}
                            onClick={() => setSelectedOptionId(optId)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 8,
                              background: isSel ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                              border: isSel ? '1px solid #38bdf8' : '1px solid var(--panel-border)',
                              cursor: 'pointer',
                              fontSize: 12,
                            }}
                          >
                            {opt.text || opt}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <textarea
                    value={descriptiveAnswer}
                    onChange={(e) => setDescriptiveAnswer(e.target.value)}
                    placeholder="Write your explanation in your own words..."
                    rows={7}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--panel-border)',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                )}

                <button
                  disabled={submitting || (selectedQuestion.type === 'descriptive' ? !descriptiveAnswer.trim() : !selectedOptionId)}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const payload =
                        selectedQuestion.type === 'descriptive'
                          ? { question_id: selectedQuestion.id, answer: descriptiveAnswer, source: 'practice' }
                          : { question_id: selectedQuestion.id, selected_option_ids: [selectedOptionId], source: 'practice' };
                      const res = await axios.post('/api/attempts', payload);
                      setLastResult(res.data);
                    } catch (err: any) {
                      alert(err.response?.data?.error || 'Submission failed');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', fontSize: 12, padding: '6px 14px' }}
                >
                  Submit Practice Attempt
                </button>

                {lastResult && selectedQuestion.type === 'descriptive' && lastResult.evaluation?.grading_details && (
                  <div
                    className="scale-in"
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: lastResult.evaluation.is_correct ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${lastResult.evaluation.is_correct ? '#10b981' : '#ef4444'}`,
                      fontSize: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 700, color: lastResult.evaluation.is_correct ? '#34d399' : '#f87171', textTransform: 'capitalize' }}>
                      Verdict: {lastResult.evaluation.grading_details.verdict}
                    </div>
                    {lastResult.evaluation.grading_details.covered?.length > 0 && (
                      <div>
                        <span style={{ color: '#34d399' }}>Covered:</span>{' '}
                        {lastResult.evaluation.grading_details.covered.join('; ')}
                      </div>
                    )}
                    {lastResult.evaluation.grading_details.missed?.length > 0 && (
                      <div>
                        <span style={{ color: '#f87171' }}>Missed:</span>{' '}
                        {lastResult.evaluation.grading_details.missed.join('; ')}
                      </div>
                    )}
                  </div>
                )}

                {lastResult && selectedQuestion.type !== 'descriptive' && (
                  <div
                    className="scale-in"
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: lastResult.evaluation?.is_correct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: lastResult.evaluation?.is_correct ? '1px solid #10b981' : '1px solid #ef4444',
                      color: lastResult.evaluation?.is_correct ? '#34d399' : '#f87171',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {lastResult.evaluation?.is_correct ? '✓ Correct Answer!' : '✗ Incorrect Answer. Keep practicing!'}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                Select a practice question from the left sidebar.
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
