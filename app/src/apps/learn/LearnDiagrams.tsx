import React from 'react';

interface LearnDiagramProps {
  type: 'sliding-window' | 'linked-list' | 'binary-tree' | 'sql-joins' | 'b-tree' | 'tcp-handshake' | 'subnetting' | 'dns-flow';
}

export default function LearnDiagrams({ type }: LearnDiagramProps) {
  switch (type) {
    case 'sliding-window':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: Dynamic Sliding Window Invariant
          </div>
          <svg viewBox="0 0 600 130" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Array Boxes */}
            {[
              { val: 'a', idx: 0, inWin: false },
              { val: 'b', idx: 1, inWin: true, isL: true },
              { val: 'c', idx: 2, inWin: true },
              { val: 'a', idx: 3, inWin: true },
              { val: 'b', idx: 4, inWin: true, isR: true },
              { val: 'c', idx: 5, inWin: false },
              { val: 'b', idx: 6, inWin: false },
              { val: 'b', idx: 7, inWin: false },
            ].map((box, i) => (
              <g key={i} transform={`translate(${40 + i * 65}, 35)`}>
                <rect
                  width="55"
                  height="45"
                  rx="8"
                  fill={box.inWin ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)'}
                  stroke={box.inWin ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'}
                  strokeWidth={box.inWin ? '2' : '1'}
                />
                <text x="27.5" y="28" fill="#fff" fontSize="16" fontWeight="700" textAnchor="middle">
                  {box.val}
                </text>
                <text x="27.5" y="60" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                  [{box.idx}]
                </text>
                {box.isL && (
                  <g transform="translate(15, -22)">
                    <text x="12" y="10" fill="#38bdf8" fontSize="11" fontWeight="800" textAnchor="middle">
                      L (Left)
                    </text>
                    <path d="M 12 14 L 12 24 M 8 20 L 12 24 L 16 20" stroke="#38bdf8" strokeWidth="2" fill="none" />
                  </g>
                )}
                {box.isR && (
                  <g transform="translate(15, -22)">
                    <text x="12" y="10" fill="#a855f7" fontSize="11" fontWeight="800" textAnchor="middle">
                      R (Right)
                    </text>
                    <path d="M 12 14 L 12 24 M 8 20 L 12 24 L 16 20" stroke="#a855f7" strokeWidth="2" fill="none" />
                  </g>
                )}
              </g>
            ))}
            {/* Window Highlight Bracket */}
            <path
              d="M 105 92 L 105 102 L 365 102 L 365 92"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <text x="235" y="120" fill="#38bdf8" fontSize="11" fontWeight="600" textAnchor="middle">
              Active Window: Substring &quot;b a b&quot; (Unique Set maintained in O(1))
            </text>
          </svg>
        </div>
      );

    case 'linked-list':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: Singly Linked Chain with Pointers
          </div>
          <svg viewBox="0 0 600 110" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[10, 24, 38, 52].map((v, i) => (
              <g key={i} transform={`translate(${40 + i * 140}, 25)`}>
                {/* Node box: Data and Next Pointer */}
                <rect width="50" height="42" rx="6" fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth="1.5" />
                <rect x="50" width="30" height="42" rx="0" fill="rgba(255, 255, 255, 0.08)" stroke="#6366f1" strokeWidth="1.5" />
                <text x="25" y="26" fill="#fff" fontSize="14" fontWeight="700" textAnchor="middle">{v}</text>
                <circle cx="65" cy="21" r="4" fill="#a5b4fc" />
                
                {/* Arrow to next */}
                {i < 3 ? (
                  <path d="M 80 21 L 132 21 M 125 16 L 132 21 L 125 26" fill="none" stroke="#a5b4fc" strokeWidth="2" />
                ) : (
                  <g transform="translate(85, 14)">
                    <text x="20" y="12" fill="#ef4444" fontSize="12" fontWeight="700">NULL</text>
                  </g>
                )}
                <text x="40" y="58" fill="var(--text-muted)" fontSize="10" textAnchor="middle">Node #{i + 1}</text>
              </g>
            ))}
          </svg>
        </div>
      );

    case 'binary-tree':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: Binary Search Tree Invariant (Left &lt; Root &lt; Right)
          </div>
          <svg viewBox="0 0 500 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Edges */}
            <line x1="250" y1="35" x2="150" y2="85" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            <line x1="250" y1="35" x2="350" y2="85" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            <line x1="150" y1="85" x2="100" y2="135" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            <line x1="150" y1="85" x2="200" y2="135" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            <line x1="350" y1="85" x2="400" y2="135" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />

            {/* Root */}
            <circle cx="250" cy="35" r="20" fill="rgba(168, 85, 247, 0.3)" stroke="#a855f7" strokeWidth="2" />
            <text x="250" y="40" fill="#fff" fontSize="13" fontWeight="800" textAnchor="middle">20</text>
            
            {/* Level 1 */}
            <circle cx="150" cy="85" r="18" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="2" />
            <text x="150" y="90" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">10</text>
            
            <circle cx="350" cy="85" r="18" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="2" />
            <text x="350" y="90" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">30</text>

            {/* Level 2 */}
            <circle cx="100" cy="135" r="16" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
            <text x="100" y="140" fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">5</text>

            <circle cx="200" cy="135" r="16" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
            <text x="200" y="140" fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">15</text>

            <circle cx="400" cy="135" r="16" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
            <text x="400" y="140" fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">40</text>
          </svg>
        </div>
      );

    case 'sql-joins':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: Relational SQL Joins (Venn Intersection Model)
          </div>
          <svg viewBox="0 0 500 130" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <g transform="translate(40, 20)">
              {/* Inner Join */}
              <circle cx="60" cy="45" r="36" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="1.5" />
              <circle cx="105" cy="45" r="36" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" strokeWidth="1.5" />
              {/* Intersection path */}
              <path d="M 82 22 A 36 36 0 0 1 82 68 A 36 36 0 0 1 82 22" fill="#38bdf8" opacity="0.65" />
              <text x="40" y="49" fill="#fff" fontSize="10" fontWeight="700">Table A</text>
              <text x="110" y="49" fill="#fff" fontSize="10" fontWeight="700">Table B</text>
              <text x="82.5" y="100" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="middle">INNER JOIN</text>
            </g>

            <g transform="translate(280, 20)">
              {/* Left Join */}
              <circle cx="60" cy="45" r="36" fill="rgba(56, 189, 248, 0.55)" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="105" cy="45" r="36" fill="transparent" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="45" y="49" fill="#fff" fontSize="10" fontWeight="700">All A</text>
              <text x="110" y="49" fill="var(--text-muted)" fontSize="10">Match B</text>
              <text x="82.5" y="100" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="middle">LEFT OUTER JOIN</text>
            </g>
          </svg>
        </div>
      );

    case 'b-tree':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: B+ Tree Multilevel Index Architecture
          </div>
          <svg viewBox="0 0 560 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Root Node */}
            <g transform="translate(210, 10)">
              <rect width="140" height="30" rx="6" fill="rgba(168, 85, 247, 0.3)" stroke="#a855f7" strokeWidth="1.5" />
              <text x="70" y="20" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">Root: [ Key: 50 ]</text>
            </g>

            {/* Connecting lines */}
            <line x1="240" y1="40" x2="130" y2="75" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            <line x1="320" y1="40" x2="430" y2="75" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

            {/* Intermediate Internal Nodes */}
            <g transform="translate(60, 75)">
              <rect width="140" height="26" rx="5" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="70" y="18" fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">[ 20 | 35 ]</text>
            </g>
            <g transform="translate(360, 75)">
              <rect width="140" height="26" rx="5" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="70" y="18" fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">[ 70 | 85 ]</text>
            </g>

            {/* Leaf Nodes (Linked List of data pages) */}
            {[
              { x: 20, keys: '5, 12, 18' },
              { x: 155, keys: '22, 28, 33' },
              { x: 290, keys: '52, 61, 68' },
              { x: 425, keys: '74, 88, 95' }
            ].map((leaf, idx) => (
              <g key={idx} transform={`translate(${leaf.x}, 125)`}>
                <rect width="115" height="26" rx="4" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="1.5" />
                <text x="57" y="17" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">{leaf.keys}</text>
                {/* Pointer arrow to next sibling leaf */}
                {idx < 3 && (
                  <path d="M 115 13 L 133 13 M 128 9 L 133 13 L 128 17" fill="none" stroke="#22c55e" strokeWidth="1.5" />
                )}
              </g>
            ))}
          </svg>
        </div>
      );

    case 'tcp-handshake':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: TCP 3-Way Handshake Connection Protocol
          </div>
          <svg viewBox="0 0 540 180" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Lifelines */}
            <line x1="120" y1="30" x2="120" y2="170" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="420" y1="30" x2="420" y2="170" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 4" />

            {/* Headers */}
            <rect x="70" y="8" width="100" height="24" rx="6" fill="#4f46e5" />
            <text x="120" y="24" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">Client</text>
            <rect x="370" y="8" width="100" height="24" rx="6" fill="#059669" />
            <text x="420" y="24" fill="#fff" fontSize="12" fontWeight="700" textAnchor="middle">Server</text>

            {/* Step 1: SYN */}
            <path d="M 120 55 L 420 85 M 410 79 L 420 85 L 410 89" fill="none" stroke="#38bdf8" strokeWidth="2" />
            <rect x="210" y="55" width="120" height="18" rx="4" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" />
            <text x="270" y="68" fill="#38bdf8" fontSize="10" fontWeight="700" textAnchor="middle">1. SYN (Seq = x)</text>

            {/* Step 2: SYN-ACK */}
            <path d="M 420 95 L 120 125 M 130 119 L 120 125 L 130 129" fill="none" stroke="#22c55e" strokeWidth="2" />
            <rect x="180" y="98" width="180" height="18" rx="4" fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" />
            <text x="270" y="111" fill="#22c55e" fontSize="10" fontWeight="700" textAnchor="middle">2. SYN-ACK (Seq = y, Ack = x+1)</text>

            {/* Step 3: ACK */}
            <path d="M 120 135 L 420 165 M 410 159 L 420 165 L 410 169" fill="none" stroke="#a855f7" strokeWidth="2" />
            <rect x="190" y="138" width="160" height="18" rx="4" fill="rgba(168, 85, 247, 0.25)" stroke="#a855f7" />
            <text x="270" y="151" fill="#a855f7" fontSize="10" fontWeight="700" textAnchor="middle">3. ACK (Seq = x+1, Ack = y+1)</text>
          </svg>
        </div>
      );

    case 'subnetting':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: IPv4 32-Bit Address Anatomy (/27 CIDR Prefix)
          </div>
          <svg viewBox="0 0 520 110" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* Network Bits (27 bits) */}
            <rect x="30" y="25" width="340" height="38" rx="6" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="200" y="49" fill="#38bdf8" fontSize="13" fontWeight="700" textAnchor="middle">
              Network Prefix: 27 Bits (Route Routing ID)
            </text>

            {/* Host Bits (5 bits) */}
            <rect x="375" y="25" width="115" height="38" rx="6" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="432" y="49" fill="#f59e0b" fontSize="12" fontWeight="700" textAnchor="middle">
              Hosts: 5 Bits
            </text>

            <text x="200" y="85" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">
              27 Network Bits = Fixed subnet boundary
            </text>
            <text x="432" y="85" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">
              2⁵ = 32 IPs (30 usable)
            </text>
          </svg>
        </div>
      );

    case 'dns-flow':
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--panel-border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 10 }}>
            Visual Schematic: Recursive DNS Resolution Journey
          </div>
          <svg viewBox="0 0 540 120" style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[
              { title: 'Browser Client', color: '#6366f1' },
              { title: 'ISP Resolver', color: '#38bdf8' },
              { title: 'Root DNS (.)', color: '#a855f7' },
              { title: 'TLD (.org)', color: '#ec4899' },
              { title: 'Authoritative', color: '#22c55e' }
            ].map((node, i) => (
              <g key={i} transform={`translate(${20 + i * 105}, 35)`}>
                <rect width="90" height="42" rx="6" fill={`rgba(255,255,255,0.06)`} stroke={node.color} strokeWidth="1.5" />
                <text x="45" y="25" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">{node.title}</text>
                {i < 4 && (
                  <path d="M 90 21 L 105 21" stroke={node.color} strokeWidth="2" strokeDasharray="2 2" />
                )}
              </g>
            ))}
            <text x="270" y="105" fill="var(--text-secondary)" fontSize="11" textAnchor="middle">
              Recursive iteration queries downward until Authoritative IP is cached and returned
            </text>
          </svg>
        </div>
      );

    default:
      return null;
  }
}
