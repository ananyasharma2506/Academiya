import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  X,
  Zap,
  PenTool,
  BookOpen,
  Radio,
  Shield,
  CheckCircle2,
  Save,
  AlertTriangle,
  Search,
  Eye,
  Maximize,
  Clipboard,
  Check,
} from 'lucide-react';

interface AssessmentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AssessmentStudioModal({ isOpen, onClose, onSuccess }: AssessmentStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'list'>('ai');

  // AI Generator state
  const [testTitle, setTestTitle] = useState('Recursion Mastery Assessment');
  const [concept, setConcept] = useState('Recursion');
  const [subconcept, setSubconcept] = useState('Base Case Termination');
  const [requestedCount, setRequestedCount] = useState(6);
  const [difficulty, setDifficulty] = useState('medium');

  // Bloom's Taxonomy spectrum + question-type mix controls
  const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
  const distributeEven = (count: number, n: number) => {
    const base = Math.floor(count / n);
    const remainder = count % n;
    return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
  };
  const [structureMode, setStructureMode] = useState<'class_capability' | 'manual'>('class_capability');
  const [bloomCounts, setBloomCounts] = useState<Record<string, number>>(() =>
    BLOOM_LEVELS.reduce((acc, level, i) => ({ ...acc, [level]: distributeEven(6, 6)[i] }), {})
  );
  const [includeDescriptive, setIncludeDescriptive] = useState(true);
  const [descriptivePercent, setDescriptivePercent] = useState(30);

  const handleRequestedCountChange = (value: number) => {
    const clamped = Math.min(20, Math.max(1, value || 1));
    setRequestedCount(clamped);
    const evenSplit = distributeEven(clamped, BLOOM_LEVELS.length);
    setBloomCounts(BLOOM_LEVELS.reduce((acc, level, i) => ({ ...acc, [level]: evenSplit[i] }), {}));
  };

  const bloomCountSum = Object.values(bloomCounts).reduce((a, b) => a + Number(b || 0), 0);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; pct: number } | null>(null);
  const [streamedQuestions, setStreamedQuestions] = useState<any[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  // Manual Seeder state
  const [manualTitle, setManualTitle] = useState('');
  const [manualConcept, setManualConcept] = useState('Recursion');
  const [manualSubconcept, setManualSubconcept] = useState('Call Stack Progression');
  const [manualStatement, setManualStatement] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [opt3, setOpt3] = useState('');
  const [opt4, setOpt4] = useState('');
  const [correctOpt, setCorrectOpt] = useState('opt_1');
  const [seeding, setSeeding] = useState(false);
  const [seedSuccessMsg, setSeedSuccessMsg] = useState('');

  // Assessments list
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Anticheat & Exam Focus Mode configuration
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [integrityRules, setIntegrityRules] = useState({
    fullscreen: true,
    block_tab_switch: true,
    block_clipboard: true,
    max_violations: 3,
  });

  // Forensic Audit Log Modal state
  const [selectedReportAssessment, setSelectedReportAssessment] = useState<any>(null);
  const [reportEvents, setReportEvents] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      fetchAssessments();
    }
  }, [isOpen, activeTab]);

  const fetchAssessments = () => {
    setLoadingList(true);
    axios.get('/api/questions/assessments')
      .then(res => setAssessments(res.data.assessments || []))
      .catch(console.error)
      .finally(() => setLoadingList(false));
  };

  const openIntegrityReport = async (assessment: any) => {
    setSelectedReportAssessment(assessment);
    setLoadingReport(true);
    try {
      const res = await axios.get(`/api/questions/assessments/${assessment.id}/integrity-report`);
      setReportEvents(res.data.events || []);
    } catch (err) {
      console.error('Failed to load integrity report:', err);
      setReportEvents([]);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleStartAIGeneration = async () => {
    setGenerating(true);
    setStreamedQuestions([]);
    setGenerationProgress({ current: 0, total: requestedCount, pct: 0 });

    try {
      // 1. Create Assessment container
      const assessRes = await axios.post('/api/questions/assessments', {
        title: testTitle || `${concept} AI Assessment`,
        status: 'published',
        proctoring_enabled: proctoringEnabled,
        integrity_rules: integrityRules,
      });
      const newAssessmentId = assessRes.data.assessment.id;

      // 2. Launch Generation Job with assessment_id
      const typeMix = includeDescriptive
        ? {
            mcq_single: Math.max(1, Math.round(requestedCount * (1 - descriptivePercent / 100))),
            descriptive: Math.max(0, Math.round(requestedCount * (descriptivePercent / 100))),
          }
        : { mcq_single: requestedCount };

      const jobRes = await axios.post('/api/generation-jobs', {
        concept,
        subconcept,
        requested_count: Number(requestedCount),
        difficulty,
        assessment_id: newAssessmentId,
        type_mix: typeMix,
        // Manual mode sends the teacher's exact per-level counts; otherwise the
        // server structures the mix itself from class-wide accuracy on this concept.
        ...(structureMode === 'manual'
          ? { bloom_distribution: bloomCounts }
          : { use_class_capability: true }),
      });
      const newJobId = jobRes.data.job_id;
      setJobId(newJobId);

      // 3. Connect to WebSocket stream
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket.send(JSON.stringify({ subscribe: newJobId }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'generation.progress') {
            setGenerationProgress({
              current: data.current,
              total: data.total,
              pct: Math.round((data.current / data.total) * 100)
            });
          } else if (data.type === 'question.generated' && data.question) {
            setStreamedQuestions(prev => [...prev, data.question]);
          } else if (data.type === 'generation.completed') {
            setGenerating(false);
            socket.close();
            if (onSuccess) onSuccess();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      socket.onerror = () => {
        setGenerating(false);
      };
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to start generation job');
      setGenerating(false);
    }
  };

  const handleManualSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStatement || !opt1 || !opt2) {
      alert('Please fill in the question statement and at least two options.');
      return;
    }
    setSeeding(true);
    setSeedSuccessMsg('');

    try {
      // 1. Create Assessment
      const assessRes = await axios.post('/api/questions/assessments', {
        title: manualTitle || `${manualConcept} Test`,
        status: 'published',
        proctoring_enabled: proctoringEnabled,
        integrity_rules: integrityRules,
      });


      // 2. Seed question
      const options = [
        { id: 'opt_1', text: opt1 },
        { id: 'opt_2', text: opt2 },
      ];
      if (opt3) options.push({ id: 'opt_3', text: opt3 });
      if (opt4) options.push({ id: 'opt_4', text: opt4 });

      await axios.post('/api/questions/seed', {
        assessment_id: assessRes.data.assessment.id,
        concept: manualConcept,
        subconcept: manualSubconcept,
        statement: manualStatement,
        options,
        correct_option_ids: [correctOpt],
        bloom_level: 'apply',
        difficulty: 'medium'
      });

      setSeedSuccessMsg('Test & Question successfully seeded and published to student practice pool!');
      setManualStatement('');
      setOpt1('');
      setOpt2('');
      setOpt3('');
      setOpt4('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to seed question');
    } finally {
      setSeeding(false);
    }
  };

  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, 150); // --modal-close-dur
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 15, 0.75)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        opacity: isClosing ? 0 : 1,
        transition: `opacity ${isClosing ? '150ms' : '250ms'} cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      <div
        role="dialog"
        className={`glass-panel t-modal ${isClosing ? 'is-closing' : 'is-open'}`}
        style={{
          width: 800,
          maxHeight: '90vh',
          borderRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
          border: '1px solid var(--panel-border)',
          overflow: 'hidden',
        }}
      >


        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid var(--panel-border)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>Assessment Studio & Test Authoring</h2>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Create structured MCQs or stream AI-generated assessments directly into the learning loop.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              width: 28,
              height: 28,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 22px',
            borderBottom: '1px solid var(--panel-border)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={() => setActiveTab('ai')}
            className={activeTab === 'ai' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Zap size={13} strokeWidth={2.2} /> AI Test Generator (Streamed)
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={activeTab === 'manual' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PenTool size={13} strokeWidth={2.2} /> Manual Question Authoring
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <BookOpen size={13} strokeWidth={2.2} /> Published Assessments ({assessments.length})
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: AI GENERATOR */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Assessment Title
                  </label>
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="e.g. Recursion Mastery Assessment"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Target Concept
                  </label>
                  <select
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <option value="Recursion" style={{ background: '#1e293b' }}>Recursion</option>
                    <option value="Arrays" style={{ background: '#1e293b' }}>Arrays</option>
                    <option value="Binary Search Trees" style={{ background: '#1e293b' }}>Binary Search Trees</option>
                    <option value="Dynamic Programming" style={{ background: '#1e293b' }}>Dynamic Programming</option>
                    <option value="Graph Theory" style={{ background: '#1e293b' }}>Graph Theory</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Subconcept Focus
                  </label>
                  <input
                    type="text"
                    value={subconcept}
                    onChange={(e) => setSubconcept(e.target.value)}
                    placeholder="e.g. Base Case Termination"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Question Count (1 - 20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={requestedCount}
                    onChange={(e) => handleRequestedCountChange(Number(e.target.value))}
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Difficulty Tier
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <option value="easy" style={{ background: '#1e293b' }}>Easy</option>
                    <option value="medium" style={{ background: '#1e293b' }}>Medium</option>
                    <option value="hard" style={{ background: '#1e293b' }}>Hard</option>
                  </select>
                </div>
              </div>

              {/* Bloom's Taxonomy structuring + question type mix */}
              <div
                style={{
                  background: 'rgba(129, 140, 248, 0.06)',
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  borderRadius: 12,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Bloom's Taxonomy Structuring (all 6 levels)</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setStructureMode('class_capability')}
                      className={structureMode === 'class_capability' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 11, padding: '5px 10px' }}
                    >
                      Structure from Class Performance
                    </button>
                    <button
                      type="button"
                      onClick={() => setStructureMode('manual')}
                      className={structureMode === 'manual' ? 'btn-primary' : 'btn-secondary'}
                      style={{ fontSize: 11, padding: '5px 10px' }}
                    >
                      Manual Distribution
                    </button>
                  </div>
                </div>

                {structureMode === 'class_capability' ? (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    The test is generated across all six Bloom levels (Remember → Create), weighted by this class's
                    recent accuracy on <strong>{concept} — {subconcept || 'this subconcept'}</strong>. Weaker
                    performance shifts more questions toward Remember/Understand/Apply; stronger performance shifts
                    more toward Analyze/Evaluate/Create.
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: 8,
                      }}
                    >
                      {BLOOM_LEVELS.map((level) => (
                        <div key={level}>
                          <label style={{ fontSize: 10, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                            {level}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={bloomCounts[level]}
                            onChange={(e) =>
                              setBloomCounts((prev) => ({ ...prev, [level]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                            style={{
                              width: '100%',
                              marginTop: 4,
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: 'var(--input-bg)',
                              border: '1px solid var(--panel-border)',
                              color: 'var(--text-primary)',
                              fontSize: 12,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: bloomCountSum === requestedCount ? 'var(--text-muted)' : '#f87171',
                      }}
                    >
                      Bloom counts total {bloomCountSum} / {requestedCount} question{requestedCount === 1 ? '' : 's'}
                      {bloomCountSum !== requestedCount && ' — will be proportionally rescaled to match the count.'}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={includeDescriptive}
                      onChange={(e) => setIncludeDescriptive(e.target.checked)}
                      style={{ accentColor: '#6366f1' }}
                    />
                    Include descriptive (free-text) questions
                  </label>
                  {includeDescriptive && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                      Descriptive share:
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={descriptivePercent}
                        onChange={(e) => setDescriptivePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        style={{ width: 60, padding: '4px 6px', borderRadius: 6, background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', fontSize: 11 }}
                      />
                      %
                    </label>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {generating && generationProgress && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#38bdf8', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Radio size={13} className="animate-pulse" /> Streaming Question Generation over WebSocket...
                    </span>
                    <span>
                      {generationProgress.current} / {generationProgress.total} ({generationProgress.pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${generationProgress.pct}%`,
                        background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Anticheat & Exam Focus Mode Controls */}
              <div
                className="t-resize"
                style={{
                  background: proctoringEnabled ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: proctoringEnabled ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--panel-border)',
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 6,
                }}
              >

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={20} color="#818cf8" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Anticheat & Exam Focus Mode
                        <span
                          className="badge"
                          style={{
                            background: proctoringEnabled ? '#4f46e5' : '#334155',
                            color: '#fff',
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {proctoringEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Enforces fullscreen, flags tab switching/window blur, and logs paste events to a deterministic audit trail.
                      </div>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={proctoringEnabled}
                      onChange={(e) => setProctoringEnabled(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Enable Anticheat</span>
                  </label>
                </div>

                {proctoringEnabled && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.fullscreen}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, fullscreen: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Enforce Fullscreen</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.block_tab_switch}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, block_tab_switch: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Track Tab / Blur</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.block_clipboard}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, block_clipboard: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Block Paste Action</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span>Max Warnings:</span>
                      <select
                        value={integrityRules.max_violations}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, max_violations: Number(e.target.value) }))}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 11 }}
                      >
                        <option value={1}>1 Warning</option>
                        <option value={3}>3 Warnings</option>
                        <option value={5}>5 Warnings</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={handleStartAIGeneration}
                  disabled={generating}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 13, opacity: generating ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {generating ? 'Generating Test...' : <><Zap size={14} /> Launch AI Test Generation</>}
                </button>
              </div>

              {/* Streamed Questions Preview */}
              {streamedQuestions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#34d399" /> Generated Questions ({streamedQuestions.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto' }}>
                    {streamedQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          {q.bloom_level && (
                            <span className="badge" style={{ background: '#4338ca', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 5, textTransform: 'capitalize' }}>
                              {q.bloom_level}
                            </span>
                          )}
                          <span className="badge" style={{ background: '#334155', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 5 }}>
                            {q.type === 'descriptive' ? 'Descriptive' : 'MCQ'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                          {idx + 1}. {q.statement}
                        </div>
                        {q.type === 'descriptive' ? (
                          <div
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#34d399',
                              fontSize: 11,
                            }}
                          >
                            Reference answer: {q.reference_answer}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {q.options && (typeof q.options === 'string' ? JSON.parse(q.options) : q.options).map((opt: any) => {
                              const correctIds = typeof q.correct_option_ids === 'string' ? JSON.parse(q.correct_option_ids) : q.correct_option_ids;
                              const isCorrect = Array.isArray(correctIds) && correctIds.includes(opt.id);
                              return (
                                <div
                                  key={opt.id}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.05)'}`,
                                    color: isCorrect ? '#34d399' : 'var(--text-secondary)',
                                    fontSize: 11,
                                  }}
                                >
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {isCorrect ? <Check size={11} /> : '•'} {opt.text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL MCQ SEEDER */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSeed} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {seedSuccessMsg && (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: 12 }}>
                  {seedSuccessMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Assessment Title
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="e.g. CS101 Midterm Quiz"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Concept
                  </label>
                  <input
                    type="text"
                    value={manualConcept}
                    onChange={(e) => setManualConcept(e.target.value)}
                    placeholder="e.g. Recursion"
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--input-bg)',
                      border: '1px solid var(--panel-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Subconcept
                </label>
                <input
                  type="text"
                  value={manualSubconcept}
                  onChange={(e) => setManualSubconcept(e.target.value)}
                  placeholder="e.g. Call Stack Progression"
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Question Statement
                </label>
                <textarea
                  rows={3}
                  value={manualStatement}
                  onChange={(e) => setManualStatement(e.target.value)}
                  placeholder="Enter the MCQ question text..."
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    resize: 'none',
                  }}
                />
              </div>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Options (select radio for correct answer)
                </label>
                {[
                  { id: 'opt_1', val: opt1, setter: setOpt1, label: 'Option A' },
                  { id: 'opt_2', val: opt2, setter: setOpt2, label: 'Option B' },
                  { id: 'opt_3', val: opt3, setter: setOpt3, label: 'Option C (optional)' },
                  { id: 'opt_4', val: opt4, setter: setOpt4, label: 'Option D (optional)' },
                ].map((opt) => (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="correct_option"
                      checked={correctOpt === opt.id}
                      onChange={() => setCorrectOpt(opt.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={opt.val}
                      onChange={(e) => opt.setter(e.target.value)}
                      placeholder={opt.label}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: 6,
                        background: 'var(--input-bg)',
                        border: '1px solid var(--panel-border)',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Anticheat & Exam Focus Mode Controls */}
              <div
                className="t-resize"
                style={{
                  background: proctoringEnabled ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: proctoringEnabled ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--panel-border)',
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 6,
                }}
              >

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={20} color="#818cf8" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Anticheat & Exam Focus Mode
                        <span
                          className="badge"
                          style={{
                            background: proctoringEnabled ? '#4f46e5' : '#334155',
                            color: '#fff',
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {proctoringEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Enforces fullscreen, flags tab switching/window blur, and logs paste events to a deterministic audit trail.
                      </div>
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={proctoringEnabled}
                      onChange={(e) => setProctoringEnabled(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Enable Anticheat</span>
                  </label>
                </div>

                {proctoringEnabled && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.fullscreen}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, fullscreen: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Enforce Fullscreen</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.block_tab_switch}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, block_tab_switch: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Track Tab / Blur</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={integrityRules.block_clipboard}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, block_clipboard: e.target.checked }))}
                        style={{ accentColor: '#6366f1' }}
                      />
                      <span>Block Paste Action</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span>Max Warnings:</span>
                      <select
                        value={integrityRules.max_violations}
                        onChange={(e) => setIntegrityRules(prev => ({ ...prev, max_violations: Number(e.target.value) }))}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: '#fff', borderRadius: 6, padding: '2px 6px', fontSize: 11 }}
                      >
                        <option value={1}>1 Warning</option>
                        <option value={3}>3 Warnings</option>
                        <option value={5}>5 Warnings</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="submit"
                  disabled={seeding}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {seeding ? 'Saving...' : <><Save size={14} /> Seed & Publish Question</>}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ASSESSMENTS LIST */}
          {activeTab === 'list' && (
            <div>
              {loadingList ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
                  Loading assessments...
                </div>
              ) : assessments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                  No assessments created yet. Use the AI Generator or Manual Authoring tabs to create tests.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {assessments.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 14,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--panel-border)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.title}
                          {a.proctoring_enabled ? (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                fontSize: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Shield size={11} /> Proctored Focus Mode
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
                              <BookOpen size={11} /> Open Formative
                            </span>
                          )}

                          {Number(a.violation_count) > 0 && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#fca5a5',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                fontSize: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <AlertTriangle size={11} /> {a.violation_count} Incident{Number(a.violation_count) > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Status: <span className="badge badge-resolved">{a.status}</span> | Created: {new Date(a.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                          {a.question_count || 0} Questions
                        </span>

                        {a.proctoring_enabled && (
                          <button
                            onClick={() => openIntegrityReport(a)}
                            className="btn-secondary"
                            style={{ fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Search size={12} />
                            <span>Audit Trail</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Forensic Audit Log Modal / Drawer */}
              {selectedReportAssessment && (
                <div
                  className="t-panel-slide"
                  data-open="true"
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(99, 102, 241, 0.5)',
                  }}
                >

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} color="#818cf8" />
                        <span>Forensic Audit Trail:</span>
                        <span style={{ color: '#818cf8' }}>{selectedReportAssessment.title}</span>
                      </h4>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Verifiable timestamped focus logs (tab switches, blur, and clipboard events).
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedReportAssessment(null)}
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <X size={12} /> Close Report
                    </button>
                  </div>

                  {loadingReport ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                      Loading forensic incident logs...
                    </div>
                  ) : reportEvents.length === 0 ? (
                    <div
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        fontSize: 12,
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.06)',
                        borderRadius: 8,
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <CheckCircle2 size={16} /> Immaculate Integrity: No focus violations or suspicious events recorded for this assessment.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                      {reportEvents.map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{evt.student_name} ({evt.student_email})</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Recorded: {new Date(evt.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              className="badge"
                              style={{
                                background: evt.event_type.includes('blur') || evt.event_type.includes('tab')
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(239, 68, 68, 0.2)',
                                color: evt.event_type.includes('blur') || evt.event_type.includes('tab')
                                  ? '#fbbf24'
                                  : '#f87171',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {evt.event_type === 'tab_switch' && <><AlertTriangle size={12} /> Tab Switched / Left Exam</>}
                              {evt.event_type === 'window_blur' && <><Eye size={12} /> Window Focus Lost</>}
                              {evt.event_type === 'fullscreen_exit' && <><Maximize size={12} /> Fullscreen Exited</>}
                              {evt.event_type === 'paste_attempt' && <><Clipboard size={12} /> Clipboard Paste Blocked</>}
                              {!['tab_switch', 'window_blur', 'fullscreen_exit', 'paste_attempt'].includes(evt.event_type) && evt.event_type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
