import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X } from 'lucide-react';

export interface DebugLogItem {
  id: string;
  time: string;
  type: 'http-req' | 'http-res' | 'http-err' | 'ws' | 'system';
  title: string;
  details?: any;
}

export default function ConsoleDebugger({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<DebugLogItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'http' | 'ws' | 'errors'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLog = (e: any) => {
      const item: DebugLogItem = e.detail;
      setLogs((prev) => [...prev.slice(-200), item]);
    };

    window.addEventListener('akademiya-debug-log', handleLog);
    return () => window.removeEventListener('akademiya-debug-log', handleLog);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'http' && !l.type.startsWith('http')) return false;
    if (filter === 'ws' && l.type !== 'ws') return false;
    if (filter === 'errors' && l.type !== 'http-err') return false;
    if (searchTerm) {
      const match = l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    JSON.stringify(l.details || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  return (
    <div
      className="t-panel-slide"
      data-open={isOpen ? "true" : "false"}
      style={{
        position: 'fixed',
        bottom: 72,
        right: 20,
        width: 600,
        height: 380,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        borderRadius: 14,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >

      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'rgba(30, 41, 59, 0.9)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={14} color="#38bdf8" />
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>Akademiya Live Terminal & Console Debugger</span>
          <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: 4 }}>
            {logs.length} events
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setLogs([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Clear
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          fontSize: 11,
        }}
      >
        {(['all', 'http', 'ws', 'errors'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
              color: filter === f ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {f}
          </button>
        ))}
        <input
          type="text"
          placeholder="Filter logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            marginLeft: 'auto',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
            padding: '2px 8px',
            color: '#fff',
            fontSize: 11,
            outline: 'none',
            width: 140,
          }}
        />
      </div>

      {/* Log items container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', marginTop: 40, fontSize: 11 }}>
            No logs captured yet. Perform actions or make API calls to view live stream.
          </div>
        ) : (
          filteredLogs.map((log) => {
            let badgeBg = '#334155';
            let badgeColor = '#94a3b8';
            if (log.type === 'http-req') {
              badgeBg = '#0369a1';
              badgeColor = '#bae6fd';
            } else if (log.type === 'http-res') {
              badgeBg = '#047857';
              badgeColor = '#a7f3d0';
            } else if (log.type === 'http-err') {
              badgeBg = '#b91c1c';
              badgeColor = '#fecaca';
            } else if (log.type === 'ws') {
              badgeBg = '#6d28d9';
              badgeColor = '#ddd6fe';
            }

            return (
              <div
                key={log.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(148, 163, 184, 0.1)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 10 }}>{log.time}</span>
                  <span
                    style={{
                      background: badgeBg,
                      color: badgeColor,
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {log.type}
                  </span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{log.title}</span>
                </div>
                {log.details && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '4px 6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 4,
                      color: '#94a3b8',
                      fontSize: 10,
                      overflowX: 'auto',
                      maxHeight: 120,
                    }}
                  >
                    {typeof log.details === 'string'
                      ? log.details
                      : JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
