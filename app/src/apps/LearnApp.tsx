import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  ExternalLink,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  Code2,
  Database,
  Network,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
} from 'lucide-react';
import { CS_CURRICULUM, CourseSubject, CourseModule, PracticeQuestion } from './learn/learnCoursesData';
import LearnDiagrams from './learn/LearnDiagrams';
import { useLearningTelemetry } from './learn/useLearningTelemetry';

export default function LearnApp() {
  const [selectedYear, setSelectedYear] = useState<'All' | '1st Year' | '2nd Year' | '3rd Year'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string>(CS_CURRICULUM[0].id);
  const [activeModuleId, setActiveModuleId] = useState<string>(CS_CURRICULUM[0].modules[0].id);
  const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Set<string>>(new Set());

  // Filter subjects by year
  const filteredSubjects = useMemo(() => {
    return CS_CURRICULUM.filter((subj) => {
      if (selectedYear !== 'All' && subj.year !== selectedYear) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchSubject = subj.subjectName.toLowerCase().includes(q) || subj.description.toLowerCase().includes(q);
      const matchModule = subj.modules.some(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.practiceQuestions.some((pq) => pq.title.toLowerCase().includes(q))
      );
      return matchSubject || matchModule;
    });
  }, [selectedYear, searchQuery]);

  // Ensure an active subject is selected
  const currentSubject: CourseSubject = useMemo(() => {
    const found = filteredSubjects.find((s) => s.id === activeSubjectId);
    return found || filteredSubjects[0] || CS_CURRICULUM[0];
  }, [filteredSubjects, activeSubjectId]);

  // Ensure an active module is selected
  const currentModule: CourseModule = useMemo(() => {
    const found = currentSubject.modules.find((m) => m.id === activeModuleId);
    return found || currentSubject.modules[0] || CS_CURRICULUM[0].modules[0];
  }, [currentSubject, activeModuleId]);

  // Telemetry ref for tracking active reading, scroll metrics and idle state
  const readerContainerRef = useRef<HTMLDivElement>(null);

  useLearningTelemetry({
    subjectId: currentSubject.id,
    subjectName: currentSubject.subjectName,
    moduleId: currentModule.id,
    moduleTitle: currentModule.title,
    readTimeStr: currentModule.readTime,
    containerRef: readerContainerRef,
  });

  const toggleModuleCompletion = (id: string) => {
    setCompletedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleQuestionExpanded = (id: string) => {
    setExpandedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSubjectIcon = (iconName: string) => {
    switch (iconName) {
      case 'Code2':
        return <Code2 size={16} />;
      case 'Database':
        return <Database size={16} />;
      case 'Network':
        return <Network size={16} />;
      default:
        return <BookOpen size={16} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 12, overflow: 'hidden' }}>
      {/* Top Controls Bar: Year Filters & Search */}
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
          gap: 12,
        }}
      >
        {/* Year Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(['All', '1st Year', '2nd Year', '3rd Year'] as const).map((yr) => {
            const isActive = selectedYear === yr;
            return (
              <button
                key={yr}
                onClick={() => {
                  setSelectedYear(yr);
                  const firstMatching = CS_CURRICULUM.find((s) => yr === 'All' || s.year === yr);
                  if (firstMatching) {
                    setActiveSubjectId(firstMatching.id);
                    setActiveModuleId(firstMatching.modules[0].id);
                  }
                }}
                className={isActive ? 'btn-primary' : 'btn-secondary'}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 7,
                }}
              >
                {yr === 'All' && <Layers size={12} />}
                {yr === '1st Year' && <Code2 size={12} />}
                {yr === '2nd Year' && <Database size={12} />}
                {yr === '3rd Year' && <Network size={12} />}
                <span>{yr}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            maxWidth: 320,
            width: '100%',
          }}
        >
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search DSA, DBMS, Networks, Questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 10px 5px 30px',
              borderRadius: 8,
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--panel-border)',
              fontSize: 11,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Main 2-Column Split: Curriculum Navigation Sidebar & Course Reader */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 14, flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        {/* Left Sidebar: Subjects & Modules */}
        <div
          className="glass-panel custom-scrollbar"
          style={{
            borderRadius: 14,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            minHeight: 0,
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
              <GraduationCap size={16} color="#38bdf8" />
              <span>Syllabus Modules</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {completedModuleIds.size} completed
            </span>
          </div>

          <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredSubjects.map((subject) => {
              const isSubjectActive = subject.id === currentSubject.id;
              return (
                <div key={subject.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Subject Header Card */}
                  <div
                    onClick={() => {
                      setActiveSubjectId(subject.id);
                      setActiveModuleId(subject.modules[0].id);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 9,
                      background: isSubjectActive ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSubjectActive
                        ? `1px solid ${subject.badgeColor}`
                        : '1px solid var(--panel-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: `${subject.badgeColor}22`,
                          color: subject.badgeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {getSubjectIcon(subject.iconName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subject.subjectName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {subject.year} • {subject.code}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modules List under Subject */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 6 }}>
                    {subject.modules.map((mod) => {
                      const isModActive = mod.id === currentModule.id && isSubjectActive;
                      const isDone = completedModuleIds.has(mod.id);

                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            setActiveSubjectId(subject.id);
                            setActiveModuleId(mod.id);
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 7,
                            background: isModActive
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'transparent',
                            border: isModActive
                              ? '1px solid rgba(56, 189, 248, 0.4)'
                              : '1px solid transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            color: isModActive ? '#38bdf8' : 'var(--text-secondary)',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: isModActive ? 600 : 500,
                            }}
                          >
                            {mod.title}
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleModuleCompletion(mod.id);
                            }}
                            title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                            style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 4 }}
                          >
                            {isDone ? (
                              <CheckCircle2 size={13} color="#22c55e" />
                            ) : (
                              <Circle size={13} color="var(--text-muted)" />
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Main Stage: Course Topic Reader */}
        <div
          ref={readerContainerRef}
          className="glass-panel custom-scrollbar"
          style={{
            borderRadius: 14,
            padding: 24,
            overflowY: 'auto',
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {/* Module Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderBottom: '1px solid var(--panel-border)',
              paddingBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: `${currentSubject.badgeColor}25`,
                  color: currentSubject.badgeColor,
                  border: `1px solid ${currentSubject.badgeColor}50`,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                }}
              >
                {currentSubject.year}
              </span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {currentSubject.code}: {currentSubject.subjectName}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginLeft: 'auto',
                }}
              >
                <Clock size={12} /> {currentModule.readTime}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                {currentModule.title}
              </h1>
              <button
                onClick={() => toggleModuleCompletion(currentModule.id)}
                className={completedModuleIds.has(currentModule.id) ? 'btn-primary' : 'btn-secondary'}
                style={{
                  fontSize: 11,
                  padding: '5px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                {completedModuleIds.has(currentModule.id) ? (
                  <>
                    <CheckCircle2 size={13} color="#22c55e" /> Completed
                  </>
                ) : (
                  <>
                    <Circle size={13} /> Mark Done
                  </>
                )}
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {currentModule.summary}
            </p>
          </div>

          {/* Curated YouTube Video Resources Bar */}
          {currentModule.videoResources && currentModule.videoResources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={14} fill="#f87171" color="#f87171" />
                <span>Curated Video Lectures &amp; Explanations</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {currentModule.videoResources.map((v, idx) => (
                  <a
                    key={idx}
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      textDecoration: 'none',
                      color: 'var(--text-primary)',
                      transition: 'transform 0.15s ease, background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.title}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {v.channel} • {v.duration}
                      </span>
                    </div>
                    <ExternalLink size={14} color="#f87171" style={{ flexShrink: 0, marginLeft: 8 }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* In-Depth Pedagogical Text Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={15} />
              <span>Core Conceptual Foundations</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {currentModule.conceptNotes.map((note, idx) => (
                <p key={idx} style={{ margin: 0 }}>
                  {note}
                </p>
              ))}
            </div>
          </div>

          {/* Visual Schematic Diagram */}
          {currentModule.diagramType && (
            <LearnDiagrams type={currentModule.diagramType} />
          )}

          {/* Key Takeaways Highlight Box */}
          {currentModule.keyTakeaways && currentModule.keyTakeaways.length > 0 && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 12,
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Key Architectural Takeaways
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {currentModule.keyTakeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Code Snippets Section */}
          {currentModule.codeSnippets && currentModule.codeSnippets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentModule.codeSnippets.map((snippet, idx) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: 12,
                    background: '#090d16',
                    border: '1px solid var(--panel-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--accent-light)',
                    }}
                  >
                    <span>{snippet.title}</span>
                    <span style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: 10 }}>
                      {snippet.language}
                    </span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '14px 16px',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: '#e2e8f0',
                      overflowX: 'auto',
                    }}
                  >
                    <code>{snippet.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Practice Questions & Exercises */}
          {currentModule.practiceQuestions && currentModule.practiceQuestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code2 size={16} />
                <span>Curated Practice Questions ({currentModule.practiceQuestions.length})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentModule.practiceQuestions.map((q: PracticeQuestion) => {
                  const isExpanded = expandedQuestionIds.has(q.id);
                  const diffColor =
                    q.difficulty === 'Easy' ? '#22c55e' : q.difficulty === 'Medium' ? '#f59e0b' : '#ef4444';

                  return (
                    <div
                      key={q.id}
                      style={{
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.025)',
                        border: '1px solid var(--panel-border)',
                        overflow: 'hidden',
                        transition: 'border 0.15s ease',
                      }}
                    >
                      {/* Question Header Accordion Toggle */}
                      <div
                        onClick={() => toggleQuestionExpanded(q.id)}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 5,
                              background: `${diffColor}22`,
                              color: diffColor,
                            }}
                          >
                            {q.difficulty}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {q.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                          <span style={{ fontSize: 11 }}>{isExpanded ? 'Hide Solution' : 'View Solution'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Question Body & Collapsible Solution */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '0 16px 16px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            paddingTop: 12,
                          }}
                        >
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            {q.description}
                          </p>

                          {q.example && (
                            <div
                              style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'rgba(0, 0, 0, 0.3)',
                                fontSize: 11,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: '#94a3b8',
                              }}
                            >
                              {q.example}
                            </div>
                          )}

                          {/* Approach */}
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Optimal Approach: </strong>
                            {q.approach}
                          </div>

                          {/* Code Solution if present */}
                          {q.solutionCode && (
                            <div
                              style={{
                                borderRadius: 8,
                                background: '#090d16',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 12px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                }}
                              >
                                <span>Reference Implementation</span>
                                {q.timeComplexity && (
                                  <span>
                                    Time: {q.timeComplexity} | Space: {q.spaceComplexity}
                                  </span>
                                )}
                              </div>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '12px',
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: 11,
                                  lineHeight: 1.45,
                                  color: '#34d399',
                                  overflowX: 'auto',
                                }}
                              >
                                <code>{q.solutionCode}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
