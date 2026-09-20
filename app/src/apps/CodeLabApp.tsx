import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import {
  Terminal as TerminalIcon,
  Folder,
  FileCode,
  File,
  Play,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Check,
  AlertCircle,
  X,
  Code2,
  Target,
  Sparkles,
  Bot,
  Lightbulb,
  CornerDownLeft,
} from 'lucide-react';

interface SandboxFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  language: string;
  updatedAt: string;
}

interface TerminalEntry {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: string;
}

export default function CodeLabApp() {
  // Mode: 'ide' (Sandboxed File Explorer + Terminal) or 'challenges' (Algorithm practice)
  const [appMode, setAppMode] = useState<'ide' | 'challenges'>('ide');

  // ── IDE State ──
  const [files, setFiles] = useState<SandboxFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [openFiles, setOpenFiles] = useState<{ path: string; content: string; language: string; isDirty: boolean }[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>('main.py');
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New File Modal
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileTemplate, setNewFileTemplate] = useState<'python' | 'cpp' | 'custom'>('python');

  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState<TerminalEntry[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [terminalCwd, setTerminalCwd] = useState('');
  const [executingCommand, setExecutingCommand] = useState(false);
  const [commandHistoryList, setCommandHistoryList] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalLayout, setTerminalLayout] = useState<'split' | 'terminal' | 'editor'>('split');

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // ── Guided Challenges State ──
  const [challenges, setChallenges] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [challengeCode, setChallengeCode] = useState<string>('');
  const [challengeStdin, setChallengeStdin] = useState<string>('');
  const [challengeOutput, setChallengeOutput] = useState<any>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [runningChallenge, setRunningChallenge] = useState(false);
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [explainingChallenge, setExplainingChallenge] = useState(false);
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(new Set());

  const DIFFICULTY_COLOR: Record<string, string> = { easy: '#34d399', medium: '#fbbf24', hard: '#f87171' };

  const challengesByCourse = React.useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const ch of challenges) {
      const key = ch.course_name || 'Other Challenges';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ch);
    }
    return Array.from(groups.entries());
  }, [challenges]);

  const toggleCourseCollapsed = (courseName: string) => {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseName)) next.delete(courseName);
      else next.add(courseName);
      return next;
    });
  };

  // ── AI-Generated Challenges (self-serve, bounded, personalized to weak concepts) ──
  const [generatingChallenges, setGeneratingChallenges] = useState(false);
  const [genChallengeCount, setGenChallengeCount] = useState(3);
  const [genRemaining, setGenRemaining] = useState<number | null>(null);
  const [genTargeted, setGenTargeted] = useState<Array<{ concept: string; subconcept: string; reason: string }>>([]);
  const [genFailedCount, setGenFailedCount] = useState(0);
  const [showChallengeGenerator, setShowChallengeGenerator] = useState(false);

  const handleGenerateChallenges = async () => {
    setGeneratingChallenges(true);
    setGenFailedCount(0);
    try {
      const res = await axios.post('/api/code-lab/generate', { count: genChallengeCount });
      const { generated, failed, remaining, targeted } = res.data;
      setChallenges((prev) => [...generated, ...prev]);
      setGenRemaining(remaining);
      setGenTargeted(targeted || []);
      setGenFailedCount(failed?.length || 0);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setGenRemaining(0);
        alert(err.response.data.error);
      } else {
        alert(err.response?.data?.error || 'Failed to generate challenges');
      }
    } finally {
      setGeneratingChallenges(false);
    }
  };

  // ── 1. Fetch Sandbox Files ──
  const fetchSandboxFiles = async (autoOpenDefault = false) => {
    setLoadingFiles(true);
    try {
      const res = await axios.get('/api/sandbox/files');
      const fileList = res.data.files || [];
      setFiles(fileList);

      if (autoOpenDefault && fileList.length > 0) {
        // Open the first file by default
        const first = fileList.find((f: any) => f.name === 'main.py') || fileList[0];
        openFile(first.path);
      }
    } catch (err) {
      console.error('Failed to load sandbox files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // ── 2. Open File in Editor ──
  const openFile = async (filePath: string) => {
    const existing = openFiles.find((f) => f.path === filePath);
    if (existing) {
      setActiveFilePath(filePath);
      return;
    }

    try {
      const res = await axios.get(`/api/sandbox/file?path=${encodeURIComponent(filePath)}`);
      setOpenFiles((prev) => [
        ...prev,
        {
          path: res.data.path,
          content: res.data.content,
          language: res.data.language,
          isDirty: false,
        },
      ]);
      setActiveFilePath(filePath);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  // ── 3. Save Active File ──
  const saveActiveFile = async () => {
    const current = openFiles.find((f) => f.path === activeFilePath);
    if (!current) return;

    setSavingFile(true);
    try {
      await axios.post('/api/sandbox/file', {
        path: current.path,
        content: current.content,
      });
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === current.path ? { ...f, isDirty: false } : f))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchSandboxFiles(false);
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setSavingFile(false);
    }
  };

  // ── 4. Create New File ──
  const handleCreateFile = async () => {
    let name = newFileName.trim();
    if (!name) {
      name = newFileTemplate === 'python' ? 'script.py' : 'program.cpp';
    }

    // Default template content
    let defaultContent = '';
    if (name.endsWith('.py') || newFileTemplate === 'python') {
      if (!name.endsWith('.py')) name += '.py';
      defaultContent = `# Python Script\ndef main():\n    print("Running ${name}...")\n\nif __name__ == "__main__":\n    main()\n`;
    } else if (name.endsWith('.cpp') || newFileTemplate === 'cpp') {
      if (!name.endsWith('.cpp')) name += '.cpp';
      defaultContent = `// C++ Program\n#include <iostream>\n\nint main() {\n    std::cout << "Running ${name}..." << std::endl;\n    return 0;\n}\n`;
    } else {
      defaultContent = `// File: ${name}\n`;
    }

    try {
      await axios.post('/api/sandbox/file', {
        path: name,
        content: defaultContent,
      });
      setShowNewFileModal(false);
      setNewFileName('');
      await fetchSandboxFiles(false);
      openFile(name);
    } catch (err) {
      alert('Failed to create file');
    }
  };

  // ── 5. Delete File ──
  const handleDeleteFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;

    try {
      await axios.delete(`/api/sandbox/file?path=${encodeURIComponent(filePath)}`);
      setOpenFiles((prev) => prev.filter((f) => f.path !== filePath));
      if (activeFilePath === filePath) {
        const remaining = openFiles.filter((f) => f.path !== filePath);
        if (remaining.length > 0) {
          setActiveFilePath(remaining[0].path);
        } else {
          setActiveFilePath('');
        }
      }
      fetchSandboxFiles(false);
    } catch (err) {
      alert('Failed to delete file');
    }
  };

  // ── 6. Execute Command in Terminal ──
  const runTerminalCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : commandInput).trim();
    if (!cmd) return;

    // Clear command handled directly
    if (cmd === 'clear') {
      setTerminalHistory([]);
      setCommandInput('');
      return;
    }

    setExecutingCommand(true);
    setCommandHistoryList((prev) => [cmd, ...prev.filter((c) => c !== cmd)]);
    setHistoryIndex(-1);

    try {
      const res = await axios.post('/api/sandbox/exec', {
        command: cmd,
        cwd: terminalCwd,
      });

      const newEntry: TerminalEntry = {
        command: cmd,
        cwd: terminalCwd,
        stdout: res.data.stdout || '',
        stderr: res.data.stderr || '',
        exitCode: res.data.exitCode,
        timestamp: new Date().toLocaleTimeString(),
      };

      setTerminalHistory((prev) => [...prev, newEntry]);
      if (res.data.cwd !== undefined) {
        setTerminalCwd(res.data.cwd);
      }
      if (cmdToRun === undefined) {
        setCommandInput('');
      }
      fetchSandboxFiles(false);
    } catch (err: any) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          command: cmd,
          cwd: terminalCwd,
          stdout: '',
          stderr: err.response?.data?.error || err.message,
          exitCode: 1,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setExecutingCommand(false);
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  // Keyboard navigation for terminal command history (Up/Down)
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runTerminalCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistoryList.length > 0) {
        const nextIdx = Math.min(commandHistoryList.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistoryList[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistoryList[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  // Quick Run Active File in Terminal
  const handleQuickRunActiveFile = async () => {
    const current = openFiles.find((f) => f.path === activeFilePath);
    if (!current) return;

    // Auto-save before running
    if (current.isDirty) {
      await saveActiveFile();
    }

    if (current.language === 'python' || current.path.endsWith('.py')) {
      runTerminalCommand(`python3 ${current.path}`);
    } else if (current.language === 'cpp' || current.path.endsWith('.cpp')) {
      const outName = current.path.replace(/\.[^/.]+$/, '');
      runTerminalCommand(`g++ ${current.path} -o ${outName} -std=c++17 && ./${outName}`);
    } else if (current.language === 'c' || current.path.endsWith('.c')) {
      const outName = current.path.replace(/\.[^/.]+$/, '');
      runTerminalCommand(`gcc ${current.path} -o ${outName} && ./${outName}`);
    } else {
      runTerminalCommand(`cat ${current.path}`);
    }
  };

  // Load challenges for Guided Challenges mode
  const fetchChallenges = () => {
    axios
      .get('/api/code-lab/challenges')
      .then((res) => {
        setChallenges(res.data.challenges || []);
        if (res.data.challenges?.length > 0 && !selectedChallenge) {
          selectChallenge(res.data.challenges[0]);
        }
      })
      .catch(console.error);
  };

  const selectChallenge = (ch: any) => {
    setSelectedChallenge(ch);
    setChallengeCode(ch.initial_code || '');
    setChallengeOutput(null);
    setSubmissionResult(null);
    setExplanation(null);
  };

  // Initial load
  useEffect(() => {
    fetchSandboxFiles(true);
    fetchChallenges();

    // Initial greeting in terminal
    setTerminalHistory([
      {
        command: 'echo "Akademiya Sandboxed Cloud IDE v2.0 ready. Compilers: gcc, g++, python3"',
        cwd: '',
        stdout: 'Akademiya Sandboxed Cloud IDE v2.0 ready. Compilers: gcc, g++, python3\nType commands or use quick-actions below.\n',
        stderr: '',
        exitCode: 0,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* ── TOP APP HEADER BAR ── */}
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
            onClick={() => setAppMode('ide')}
            className={appMode === 'ide' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <TerminalIcon size={13} /> Sandboxed Workspace &amp; Terminal
          </button>
          <button
            onClick={() => setAppMode('challenges')}
            className={appMode === 'challenges' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Target size={13} /> Guided Algorithmic Challenges ({challenges.length})
          </button>
        </div>

        {appMode === 'ide' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                fontWeight: 600,
              }}
            >
              Sandboxed: C++ (GCC 16) • Python (3.14)
            </span>

            {/* Layout Mode Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255, 255, 255, 0.06)', borderRadius: 6, padding: 2 }}>
              <button
                onClick={() => setTerminalLayout('split')}
                title="Split Editor & Terminal"
                style={{
                  background: terminalLayout === 'split' ? '#38bdf8' : 'transparent',
                  color: terminalLayout === 'split' ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Split
              </button>
              <button
                onClick={() => setTerminalLayout('editor')}
                title="Maximize Editor"
                style={{
                  background: terminalLayout === 'editor' ? '#38bdf8' : 'transparent',
                  color: terminalLayout === 'editor' ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Editor
              </button>
              <button
                onClick={() => setTerminalLayout('terminal')}
                title="Maximize Terminal"
                style={{
                  background: terminalLayout === 'terminal' ? '#38bdf8' : 'transparent',
                  color: terminalLayout === 'terminal' ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Terminal
              </button>
            </div>

            {activeFile && (
              <button
                onClick={handleQuickRunActiveFile}
                disabled={executingCommand}
                className="btn-primary"
                style={{
                  fontSize: 11,
                  padding: '5px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  fontWeight: 700,
                }}
              >
                <Play size={12} fill="currentColor" /> Run {activeFile.path}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── MODE 1: SANDBOXED FILE EXPLORER & TERMINAL (IDE VIEW) ── */}
      {appMode === 'ide' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 10, flex: 1, minHeight: 0 }}>
          {/* Left Column: Sandboxed File Explorer */}
          <div
            className="glass-panel"
            style={{
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800 }}>
                <Folder size={15} color="#38bdf8" />
                <span>SANDBOX FILES</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setShowNewFileModal(true)}
                  title="Create New File"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: 'var(--text-primary)',
                    borderRadius: 5,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => fetchSandboxFiles(false)}
                  title="Refresh Files"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    borderRadius: 5,
                    padding: '3px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <RefreshCw size={12} className={loadingFiles ? 'pulse-dot' : ''} />
                </button>
              </div>
            </div>

            {/* File List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              {files.map((file) => {
                const isActive = activeFilePath === file.path;
                const isPy = file.name.endsWith('.py');
                const isCpp = file.name.endsWith('.cpp') || file.name.endsWith('.c');

                return (
                  <div
                    key={file.path}
                    onClick={() => openFile(file.path)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 7,
                      background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: isActive ? '#38bdf8' : 'var(--text-primary)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {isPy ? (
                        <FileCode size={14} color="#facc15" />
                      ) : isCpp ? (
                        <FileCode size={14} color="#60a5fa" />
                      ) : (
                        <File size={14} color="var(--text-muted)" />
                      )}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => handleDeleteFile(file.path, e)}
                      title="Delete File"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.6,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Split into Editor (Top) & Terminal (Bottom) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, height: '100%', flex: 1, overflow: 'hidden' }}>
            {/* ── MONACO CODE EDITOR PANE ── */}
            {terminalLayout !== 'terminal' && (
              <div
                className="glass-panel"
                style={{
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: terminalLayout === 'editor' ? '1 1 100%' : '1 1 50%',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Tab Bar & Editor Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderBottom: '1px solid var(--panel-border)',
                    padding: '2px 8px',
                    flexShrink: 0,
                  }}
                >
                  {/* Tabs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
                    {openFiles.map((of) => {
                      const isActive = of.path === activeFilePath;
                      return (
                        <div
                          key={of.path}
                          onClick={() => setActiveFilePath(of.path)}
                          style={{
                            padding: '6px 12px',
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                            background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                            fontSize: 11,
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                          }}
                        >
                          <span>{of.path}</span>
                          {of.isDirty && <span style={{ color: '#f59e0b', fontSize: 10 }}>●</span>}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFiles((prev) => prev.filter((f) => f.path !== of.path));
                              if (activeFilePath === of.path) {
                                const rem = openFiles.filter((f) => f.path !== of.path);
                                if (rem.length > 0) setActiveFilePath(rem[0].path);
                              }
                            }}
                            style={{ opacity: 0.6, marginLeft: 2 }}
                          >
                            <X size={11} />
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Save button & Layout switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activeFile && (
                      <button
                        onClick={saveActiveFile}
                        disabled={savingFile}
                        className="btn-secondary"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {saveSuccess ? <Check size={11} color="#34d399" /> : <Save size={11} />}
                        <span>{savingFile ? 'Saving...' : saveSuccess ? 'Saved' : 'Save'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Editor Component */}
                <div style={{ flex: 1, minHeight: 0 }}>
                  {activeFile ? (
                    <Editor
                      height="100%"
                      language={activeFile.language}
                      theme="vs-dark"
                      value={activeFile.content}
                      onChange={(val) => {
                        setOpenFiles((prev) =>
                          prev.map((f) =>
                            f.path === activeFilePath
                              ? { ...f, content: val || '', isDirty: true }
                              : f
                          )
                        );
                      }}
                      options={{
                        fontSize: 12,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        renderWhitespace: 'selection',
                        automaticLayout: true,
                      }}
                    />
                  ) : (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Select a file from the sidebar or click + to create one.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SANDBOXED INTERACTIVE TERMINAL PANE ── */}
            {terminalLayout !== 'editor' && (
              <div
                className="glass-panel"
                onClick={() => terminalInputRef.current?.focus()}
                style={{
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: terminalLayout === 'terminal' ? '1 1 100%' : '1 1 50%',
                  minHeight: 0,
                  background: '#090d16',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  overflow: 'hidden',
                  fontFamily: 'monospace',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  position: 'relative',
                }}
              >
                {/* Terminal Header & Quick Actions Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: 11,
                    flexShrink: 0,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                    <span style={{ fontWeight: 800, color: '#38bdf8' }}>student@akademiya</span>
                    <span style={{ color: 'var(--text-muted)' }}>:</span>
                    <span style={{ color: '#a78bfa' }}>~/sandbox{terminalCwd ? `/${terminalCwd}` : ''}</span>
                  </div>

                  {/* Quick Action Commands & Layout Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); runTerminalCommand('python3 main.py'); }}
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(250, 204, 21, 0.15)',
                        color: '#facc15',
                        border: '1px solid rgba(250, 204, 21, 0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      python3 main.py
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); runTerminalCommand('g++ solution.cpp -o solution && ./solution'); }}
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(96, 165, 250, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      g++ solution.cpp &amp;&amp; ./solution
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); runTerminalCommand('ls -la'); }}
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--panel-border)',
                        cursor: 'pointer',
                      }}
                    >
                      ls -la
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTerminalHistory([]); }}
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      clear
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); setTerminalLayout(terminalLayout === 'terminal' ? 'split' : 'terminal'); }}
                      title={terminalLayout === 'terminal' ? 'Split View' : 'Maximize Terminal'}
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: terminalLayout === 'terminal' ? '#38bdf8' : 'var(--text-secondary)',
                        border: '1px solid var(--panel-border)',
                        cursor: 'pointer',
                      }}
                    >
                      {terminalLayout === 'terminal' ? 'Split View' : 'Maximize'}
                    </button>
                  </div>
                </div>

                {/* Terminal Logs View */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: 10,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  {terminalHistory.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Command Prompt Line */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                        <span style={{ color: '#34d399' }}>➜</span>
                        <span style={{ color: '#a78bfa' }}>~/sandbox{item.cwd ? `/${item.cwd}` : ''}$</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{item.command}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {item.timestamp}
                        </span>
                      </div>

                      {/* Stdout Output */}
                      {item.stdout && (
                        <pre
                          style={{
                            margin: 0,
                            padding: '2px 0',
                            color: '#e2e8f0',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.stdout}
                        </pre>
                      )}

                      {/* Stderr Output */}
                      {item.stderr && (
                        <pre
                          style={{
                            margin: 0,
                            padding: '2px 0',
                            color: '#f87171',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.stderr}
                        </pre>
                      )}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>

                {/* ── PERMANENTLY PINNED, PROMINENT TERMINAL INPUT BAR ── */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#0c1222',
                    borderTop: '2px solid rgba(56, 189, 248, 0.4)',
                    gap: 10,
                    flexShrink: 0,
                    boxShadow: '0 -4px 14px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ color: '#34d399', fontWeight: 800, fontSize: 13 }}>➜</span>
                    <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 700 }}>~/sandbox{terminalCwd ? `/${terminalCwd}` : ''}$</span>
                  </div>
                  <input
                    ref={terminalInputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={handleTerminalKeyDown}
                    disabled={executingCommand}
                    placeholder={executingCommand ? 'Executing command...' : 'Type bash command (python, g++, gcc, ls, cd, ./...)'}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 6,
                      padding: '7px 12px',
                      outline: 'none',
                      color: '#38bdf8',
                      fontWeight: 600,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                  />
                  <button
                    onClick={() => runTerminalCommand()}
                    disabled={executingCommand || !commandInput.trim()}
                    style={{
                      background: '#38bdf8',
                      color: '#000',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      flexShrink: 0,
                      opacity: executingCommand || !commandInput.trim() ? 0.6 : 1,
                    }}
                  >
                    <CornerDownLeft size={12} strokeWidth={2.5} />
                    <span>RUN</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODE 2: GUIDED ALGORITHM CHALLENGES ── */}
      {appMode === 'challenges' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          {/* Challenges List, grouped by Learn window course */}
          <div className="glass-panel" style={{ borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                Curated Challenges ({challenges.length})
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: 10, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setShowChallengeGenerator((v) => !v)}
              >
                <Sparkles size={11} /> {showChallengeGenerator ? 'Hide' : 'Generate More'}
              </button>
            </div>

            {showChallengeGenerator && (
              <div
                className="fade-in-up"
                style={{
                  background: 'rgba(129, 140, 248, 0.06)',
                  border: '1px solid rgba(129, 140, 248, 0.25)',
                  borderRadius: 10,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Generates new challenges under a separate <strong>Generated</strong> category, personalized to your
                  own weak concepts (from your Academic Graph). Bounded to 10 per login session.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={genRemaining ?? 10}
                    value={genChallengeCount}
                    onChange={(e) => setGenChallengeCount(Math.min(genRemaining ?? 10, Math.max(1, Number(e.target.value) || 1)))}
                    style={{ width: 56, padding: '5px 8px', borderRadius: 6, background: 'var(--input-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', fontSize: 11 }}
                  />
                  <button
                    onClick={handleGenerateChallenges}
                    disabled={generatingChallenges || genRemaining === 0}
                    className="btn-primary"
                    style={{ fontSize: 11, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: generatingChallenges || genRemaining === 0 ? 0.6 : 1 }}
                  >
                    <Bot size={12} /> {generatingChallenges ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                {generatingChallenges && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    This validates each challenge by actually running a reference solution, so it can take up to a minute — please wait.
                  </div>
                )}
                {genRemaining !== null && (
                  <div style={{ fontSize: 10, color: genRemaining === 0 ? '#f87171' : 'var(--text-muted)' }}>
                    {genRemaining} generation{genRemaining === 1 ? '' : 's'} left this session.
                  </div>
                )}
                {genTargeted.length > 0 && (
                  <div style={{ fontSize: 10, color: '#a5b4fc' }}>
                    Targeted: {genTargeted.map((t) => `${t.concept} (${t.reason})`).join('; ')}
                  </div>
                )}
                {genFailedCount > 0 && (
                  <div style={{ fontSize: 10, color: '#f87171' }}>
                    {genFailedCount} challenge{genFailedCount === 1 ? '' : 's'} failed to generate — try again.
                  </div>
                )}
              </div>
            )}

            <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {challengesByCourse.map(([courseName, items]) => {
                const isCollapsed = collapsedCourses.has(courseName);
                return (
                  <div key={courseName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      onClick={() => toggleCourseCollapsed(courseName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: '4px 2px',
                        borderBottom: '1px solid var(--panel-border)',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {courseName} ({items.length})
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isCollapsed ? '▸' : '▾'}</span>
                    </div>

                    {!isCollapsed && items.map((ch) => {
                      const isSelected = selectedChallenge?.id === ch.id;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => selectChallenge(ch)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            border: isSelected ? '1px solid #38bdf8' : '1px solid var(--panel-border)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: isSelected ? '#38bdf8' : 'var(--text-primary)' }}>
                              {ch.title}
                            </span>
                            {ch.difficulty && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '1px 6px',
                                  borderRadius: 8,
                                  color: DIFFICULTY_COLOR[ch.difficulty] || 'var(--text-muted)',
                                  border: `1px solid ${DIFFICULTY_COLOR[ch.difficulty] || 'var(--panel-border)'}`,
                                  flexShrink: 0,
                                }}
                              >
                                {ch.difficulty}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {ch.concept} • {ch.subconcept}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Challenge Workspace */}
          <div className="glass-panel" style={{ borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            {selectedChallenge ? (
              <>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{selectedChallenge.title}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {selectedChallenge.description}
                  </p>
                </div>

                <div style={{ height: 260, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
                  <Editor
                    height="100%"
                    language={selectedChallenge.language || 'python'}
                    theme="vs-dark"
                    value={challengeCode}
                    onChange={(val) => setChallengeCode(val || '')}
                    options={{ fontSize: 12, minimap: { enabled: false } }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={async () => {
                      setRunningChallenge(true);
                      try {
                        const res = await axios.post('/api/code-lab/run', {
                          code: challengeCode,
                          language: selectedChallenge.language || 'python',
                          stdin: challengeStdin,
                        });
                        setChallengeOutput(res.data.result);
                      } finally {
                        setRunningChallenge(false);
                      }
                    }}
                    disabled={runningChallenge}
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Play size={12} fill="currentColor" /> {runningChallenge ? 'Running...' : 'Run Code'}
                  </button>

                  <button
                    onClick={async () => {
                      setSubmittingChallenge(true);
                      try {
                        const res = await axios.post('/api/code-lab/submit', {
                          challenge_id: selectedChallenge.id,
                          code: challengeCode,
                          language: selectedChallenge.language || 'python',
                        });
                        setSubmissionResult(res.data);
                      } finally {
                        setSubmittingChallenge(false);
                      }
                    }}
                    disabled={submittingChallenge}
                    className="btn-primary"
                    style={{ fontSize: 11, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Check size={12} /> {submittingChallenge ? 'Evaluating...' : 'Submit Solution'}
                  </button>
                </div>

                {/* Challenge Execution Output */}
                {challengeOutput && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--panel-border)',
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Execution Output:</div>
                    {challengeOutput.stdout && <pre style={{ margin: 0, color: '#34d399' }}>{challengeOutput.stdout}</pre>}
                    {challengeOutput.stderr && <pre style={{ margin: 0, color: '#f87171' }}>{challengeOutput.stderr}</pre>}
                  </div>
                )}

                {/* Challenge Submission Evaluation */}
                {submissionResult?.evaluation && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: submissionResult.evaluation.is_correct ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: submissionResult.evaluation.is_correct ? '1px solid #10b981' : '1px solid #ef4444',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: submissionResult.evaluation.is_correct ? '#34d399' : '#f87171' }}>
                      {submissionResult.evaluation.is_correct ? '✓ All Test Cases Passed!' : '✗ Some Test Cases Failed'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Score: {submissionResult.evaluation.marks_awarded ?? 0}/10 • Passed:{' '}
                      {(submissionResult.evaluation.visible_cases_passed ?? 0) + (submissionResult.evaluation.hidden_cases_passed ?? 0)}/
                      {(submissionResult.evaluation.visible_cases_total ?? 0) + (submissionResult.evaluation.hidden_cases_total ?? 0)} tests
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ── CREATE NEW FILE MODAL ── */}
      {showNewFileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: 380,
              borderRadius: 14,
              padding: 22,
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Create New Sandboxed File</h4>
              <button
                onClick={() => setShowNewFileModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Template Selector */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setNewFileTemplate('python'); setNewFileName('script.py'); }}
                className={newFileTemplate === 'python' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: 11, padding: '6px 0' }}
              >
                Python (.py)
              </button>
              <button
                onClick={() => { setNewFileTemplate('cpp'); setNewFileName('solution.cpp'); }}
                className={newFileTemplate === 'cpp' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: 11, padding: '6px 0' }}
              >
                C++ (.cpp)
              </button>
              <button
                onClick={() => { setNewFileTemplate('custom'); setNewFileName(''); }}
                className={newFileTemplate === 'custom' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, fontSize: 11, padding: '6px 0' }}
              >
                Custom
              </button>
            </div>

            {/* File Name Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>File Name:</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={newFileTemplate === 'python' ? 'script.py' : 'program.cpp'}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--input-bg)',
                  border: '1px solid var(--panel-border)',
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowNewFileModal(false)}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                className="btn-primary"
                style={{ fontSize: 12, padding: '6px 16px', fontWeight: 700 }}
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
