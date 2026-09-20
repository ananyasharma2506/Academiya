import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * A hand-rolled force-directed "knowledge graph" of one student's academic
 * standing. The student sits at the center; five fixed category anchors
 * (Learning Gaps, Study Topics, Test Violations, Interventions, Progress &
 * Reassessments) always radiate out from it — even at zero items, so the
 * full shape of what's being tracked is visible before any evidence exists.
 * Populated categories then branch further into their real records.
 * No charting library exists in this app yet, so the physics + SVG
 * rendering here are intentionally simple (O(n^2) repulsion is fine at
 * this node count).
 */

type NodeType = 'student' | 'category' | 'concept' | 'evidence' | 'topic' | 'violation' | 'intervention' | 'progress';
type CategoryKey = 'gaps' | 'topics' | 'violations' | 'interventions' | 'progress';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  meta: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  length: number;
}

interface AcademicGraphProps {
  studentName: string;
  gaps: any[];
  topics: any[];
  violations: {
    total_violations: number;
    by_assessment: Array<{ assessment_id: string; assessment_title: string; violation_count: number; event_type_counts: Record<string, number> }>;
  } | null;
  interventions?: any[];
  progress?: any[];
}

const WIDTH = 960;
const HEIGHT = 620;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

const CATEGORY_META: Record<CategoryKey, { label: string }> = {
  gaps: { label: 'Learning Gaps' },
  topics: { label: 'Study Topics' },
  violations: { label: 'Test Violations' },
  interventions: { label: 'Interventions' },
  progress: { label: 'Progress & Reassessments' },
};
const CATEGORY_COLOR: Record<CategoryKey, string> = {
  gaps: '#f59e0b',
  topics: '#38bdf8',
  violations: '#f87171',
  interventions: '#a855f7',
  progress: '#10b981',
};

const GAP_STATUS_COLOR: Record<string, string> = {
  emerging: '#f59e0b',
  confirmed: '#ef4444',
  resolved: '#10b981',
};

const STRUGGLE_COLOR: Record<string, string> = {
  normal: '#64748b',
  moderate_struggle: '#f59e0b',
  high_struggle: '#ef4444',
};

const INTERVENTION_STATUS_COLOR: Record<string, string> = {
  active: '#a855f7',
  completed: '#10b981',
};

function violationColor(count: number) {
  if (count >= 5) return '#dc2626';
  if (count >= 2) return '#f97316';
  return '#fbbf24';
}

function progressColor(gainPct: number | null | undefined) {
  if (gainPct == null) return '#64748b';
  if (gainPct > 0) return '#34d399';
  if (gainPct < 0) return '#f87171';
  return '#94a3b8';
}

/**
 * Interpretive verdicts shown in the hover tooltip — turns raw counts/status
 * strings into a plain-English read of what the number means, e.g. more than
 * 5 test violations reads as "Severe Malpractice Risk" rather than just "8".
 */
interface Verdict { label: string; color: string; }

function violationCountVerdict(count: number): Verdict {
  if (count > 5) return { label: 'Severe Malpractice Risk', color: '#dc2626' };
  if (count >= 3) return { label: 'Moderate Concern', color: '#f97316' };
  if (count >= 1) return { label: 'Minor Flags', color: '#fbbf24' };
  return { label: 'Clean Record', color: '#34d399' };
}

function gapStatusVerdict(status: string): Verdict {
  if (status === 'confirmed') return { label: 'Confirmed Gap — Needs Diagnostic', color: '#ef4444' };
  if (status === 'resolved') return { label: 'Successfully Resolved', color: '#34d399' };
  return { label: 'Early Warning — Recommend Practice', color: '#f59e0b' };
}

function struggleVerdict(level: string): Verdict {
  if (level === 'high_struggle') return { label: 'Significant Difficulty — Recommend Support', color: '#ef4444' };
  if (level === 'moderate_struggle') return { label: 'Some Hesitation Detected', color: '#f59e0b' };
  return { label: 'Comfortable Comprehension', color: '#34d399' };
}

function interventionStatusVerdict(status: string): Verdict {
  if (status === 'completed') return { label: 'Successfully Completed', color: '#34d399' };
  if (status === 'active') return { label: 'Support In Progress', color: '#a855f7' };
  return { label: 'Planned', color: '#94a3b8' };
}

function progressVerdict(gainPct: number | null | undefined, passed: boolean | null | undefined): Verdict {
  if (gainPct == null) return { label: 'No Data', color: '#64748b' };
  if (gainPct < 0) return { label: 'Regression — Needs Attention', color: '#ef4444' };
  if (gainPct === 0) return { label: 'No Change Yet', color: '#94a3b8' };
  if (gainPct > 50) return { label: 'Major Improvement', color: '#34d399' };
  return { label: passed ? 'Modest Improvement — Passed' : 'Modest Improvement', color: '#a3e635' };
}

function evidenceVerdict(result: string): Verdict {
  return result === 'correct'
    ? { label: 'Demonstrates Mastery', color: '#34d399' }
    : { label: 'Reveals Knowledge Gap', color: '#f87171' };
}

function gapsCategoryVerdict(items: any[]): Verdict {
  if (items.length === 0) return { label: 'No Learning Gaps — Strong Standing', color: '#34d399' };
  if (items.some(g => g.status === 'confirmed')) return { label: 'Confirmed Gaps Need Diagnosis', color: '#ef4444' };
  if (items.every(g => g.status === 'resolved')) return { label: 'All Gaps Resolved', color: '#34d399' };
  return { label: 'Emerging Concerns — Monitor Closely', color: '#f59e0b' };
}

function topicsCategoryVerdict(items: any[]): Verdict {
  if (items.length === 0) return { label: 'No Reading Activity Yet', color: '#64748b' };
  if (items.some(t => t.struggle_level === 'high_struggle')) return { label: 'Significant Comprehension Difficulty', color: '#ef4444' };
  if (items.some(t => t.struggle_level === 'moderate_struggle')) return { label: 'Some Hesitation Detected', color: '#f59e0b' };
  return { label: 'Healthy Reading Comprehension', color: '#34d399' };
}

function interventionsCategoryVerdict(items: any[]): Verdict {
  if (items.length === 0) return { label: 'No Interventions Yet', color: '#64748b' };
  if (items.some(iv => iv.status === 'active')) return { label: 'Support Actively In Progress', color: '#a855f7' };
  return { label: 'All Interventions Completed', color: '#34d399' };
}

function progressCategoryVerdict(items: any[]): Verdict {
  if (items.length === 0) return { label: 'No Reassessments Yet', color: '#64748b' };
  const anyRegression = items.some(p => Number((p.delta || {}).accuracy_gain_pct) < 0);
  if (anyRegression) return { label: 'Regression Detected — Review Needed', color: '#ef4444' };
  const allPassed = items.every(p => (p.delta || {}).reassessment_passed);
  return allPassed
    ? { label: 'All Reassessments Passed', color: '#34d399' }
    : { label: 'Needs Further Reassessment', color: '#f59e0b' };
}

function studentOverallVerdict(gaps: any[], topics: any[], totalViolations: number, progress: any[]): Verdict {
  const hasData = gaps.length > 0 || topics.length > 0 || totalViolations > 0 || progress.length > 0;
  if (!hasData) return { label: 'No Data Yet', color: '#64748b' };

  const severe =
    gaps.some(g => g.status === 'confirmed') ||
    totalViolations > 5 ||
    topics.some(t => t.struggle_level === 'high_struggle') ||
    progress.some(p => Number((p.delta || {}).accuracy_gain_pct) < 0);
  if (severe) return { label: 'Needs Attention', color: '#ef4444' };

  const moderate =
    gaps.some(g => g.status === 'emerging') ||
    totalViolations >= 1 ||
    topics.some(t => t.struggle_level === 'moderate_struggle');
  if (moderate) return { label: 'Developing Well — Some Areas to Watch', color: '#f59e0b' };

  return { label: 'Strong Academic Standing', color: '#34d399' };
}

/** Point at radius `r` from `base`, spread evenly among `total` siblings at index `i`. */
function ringPoint(base: { x: number; y: number }, i: number, total: number, r: number) {
  const angle = (i / Math.max(1, total)) * Math.PI * 2;
  return { x: base.x + Math.cos(angle) * r, y: base.y + Math.sin(angle) * r };
}

function buildGraph(
  studentName: string,
  gaps: any[],
  topics: any[],
  violations: AcademicGraphProps['violations'],
  interventions: any[],
  progress: any[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const studentId = 'student-root';
  nodes.push({
    id: studentId,
    type: 'student',
    label: studentName || 'Student',
    color: '#818cf8',
    radius: 30,
    x: CENTER.x,
    y: CENTER.y,
    vx: 0,
    vy: 0,
    meta: { kind: 'Student', verdict: studentOverallVerdict(gaps || [], topics || [], violations?.total_violations || 0, progress || []) },
  });

  const categories: { key: CategoryKey; items: any[] }[] = [
    { key: 'gaps', items: gaps || [] },
    { key: 'topics', items: topics || [] },
    { key: 'violations', items: violations?.by_assessment || [] },
    { key: 'interventions', items: interventions || [] },
    { key: 'progress', items: progress || [] },
  ];

  categories.forEach((cat, ci) => {
    const meta = CATEGORY_META[cat.key];
    const color = CATEGORY_COLOR[cat.key];
    const count = cat.items.length;
    const catPos = ringPoint(CENTER, ci, categories.length, 190);
    const catId = `category-${cat.key}`;

    const categoryVerdict: Verdict =
      cat.key === 'gaps' ? gapsCategoryVerdict(cat.items) :
      cat.key === 'topics' ? topicsCategoryVerdict(cat.items) :
      cat.key === 'violations' ? violationCountVerdict(violations?.total_violations || 0) :
      cat.key === 'interventions' ? interventionsCategoryVerdict(cat.items) :
      progressCategoryVerdict(cat.items);

    // The category anchor ALWAYS renders — even at zero items — so the full
    // shape of what's tracked is visible before any evidence exists.
    nodes.push({
      id: catId,
      type: 'category',
      label: `${meta.label} (${count})`,
      color,
      radius: 22,
      x: catPos.x,
      y: catPos.y,
      vx: 0,
      vy: 0,
      meta: { kind: 'Category', name: meta.label, count, empty: count === 0, verdict: categoryVerdict },
    });
    edges.push({ source: studentId, target: catId, length: 190 });

    if (cat.key === 'gaps') {
      cat.items.forEach((gap: any, gi: number) => {
        const conceptId = `concept-${gap.id}`;
        const pos = ringPoint(catPos, gi, cat.items.length, 110);
        const evidenceCount = gap.evidence?.length || 0;
        nodes.push({
          id: conceptId,
          type: 'concept',
          label: gap.concept,
          color: GAP_STATUS_COLOR[gap.status] || '#94a3b8',
          radius: 14 + Math.min(10, evidenceCount),
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          meta: { kind: 'Learning Gap', concept: gap.concept, subconcept: gap.subconcept, status: gap.status, evidenceCount, verdict: gapStatusVerdict(gap.status) },
        });
        edges.push({ source: catId, target: conceptId, length: 110 });

        (gap.evidence || []).forEach((ev: any, ei: number) => {
          const evId = `evidence-${gap.id}-${ev.id || ei}`;
          const epos = ringPoint(pos, ei, Math.max(5, gap.evidence.length), 55);
          nodes.push({
            id: evId,
            type: 'evidence',
            label: ev.result === 'correct' ? 'Correct' : 'Incorrect',
            color: ev.result === 'correct' ? '#34d399' : '#f87171',
            radius: 6,
            x: epos.x,
            y: epos.y,
            vx: 0,
            vy: 0,
            meta: {
              kind: 'Attempt Evidence',
              statement: ev.statement,
              result: ev.result,
              source: ev.attempt_source,
              marks: ev.marks_awarded,
              when: ev.created_at,
              verdict: evidenceVerdict(ev.result),
            },
          });
          edges.push({ source: conceptId, target: evId, length: 50 });
        });
      });
    }

    if (cat.key === 'topics') {
      cat.items.forEach((topic: any, ti: number) => {
        const topicId = `topic-${topic.id || topic.topic_id || ti}`;
        const pos = ringPoint(catPos, ti, cat.items.length, 100);
        nodes.push({
          id: topicId,
          type: 'topic',
          label: topic.topic_title || topic.topic_label || 'Topic',
          color: STRUGGLE_COLOR[topic.struggle_level] || STRUGGLE_COLOR.normal,
          radius: 10 + Math.min(8, Number(topic.struggle_score) || 0),
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          meta: {
            kind: 'Reading Activity',
            topic: topic.topic_title,
            subject: topic.subject_name,
            struggleLevel: topic.struggle_level,
            struggleScore: topic.struggle_score,
            struggleReason: topic.struggle_reason,
            hours: topic.hours_studied_str,
            verified: topic.is_considered_read,
            verdict: struggleVerdict(topic.struggle_level),
          },
        });
        edges.push({ source: catId, target: topicId, length: 100 });
      });
    }

    if (cat.key === 'violations') {
      cat.items.forEach((v: any, vi: number) => {
        const violationId = `violation-${v.assessment_id}`;
        const pos = ringPoint(catPos, vi, cat.items.length, 100);
        nodes.push({
          id: violationId,
          type: 'violation',
          label: v.assessment_title,
          color: violationColor(v.violation_count),
          radius: 12 + Math.min(12, v.violation_count),
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          meta: {
            kind: 'Test Integrity Violations',
            assessment: v.assessment_title,
            count: v.violation_count,
            breakdown: v.event_type_counts,
            verdict: violationCountVerdict(v.violation_count),
          },
        });
        edges.push({ source: catId, target: violationId, length: 100 });
      });
    }

    if (cat.key === 'interventions') {
      cat.items.forEach((iv: any, ii: number) => {
        const ivId = `intervention-${iv.id}`;
        const pos = ringPoint(catPos, ii, cat.items.length, 100);
        let planSteps = 0;
        try {
          const plan = typeof iv.plan === 'string' ? JSON.parse(iv.plan) : iv.plan;
          planSteps = plan?.steps?.length || 0;
        } catch { /* ignore malformed plan JSON */ }
        nodes.push({
          id: ivId,
          type: 'intervention',
          label: iv.target_concept || iv.concept || 'Intervention',
          color: INTERVENTION_STATUS_COLOR[iv.status] || '#94a3b8',
          radius: 12 + Math.min(8, planSteps),
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          meta: {
            kind: 'Intervention Plan',
            concept: iv.target_concept || iv.concept,
            subconcept: iv.subconcept,
            status: iv.status,
            gapStatus: iv.gap_status,
            planSteps,
            when: iv.created_at,
            verdict: interventionStatusVerdict(iv.status),
          },
        });
        edges.push({ source: catId, target: ivId, length: 100 });
      });
    }

    if (cat.key === 'progress') {
      cat.items.forEach((p: any, pi: number) => {
        const pId = `progress-${p.id}`;
        const pos = ringPoint(catPos, pi, cat.items.length, 100);
        const delta = p.delta || {};
        nodes.push({
          id: pId,
          type: 'progress',
          label: p.concept || 'Reassessment',
          color: progressColor(delta.accuracy_gain_pct),
          radius: 12 + Math.min(10, Math.abs(Number(delta.accuracy_gain_pct) || 0) / 10),
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          meta: {
            kind: 'Progress / Reassessment',
            concept: p.concept,
            beforeAccuracy: delta.before_accuracy_pct,
            beforeTotal: delta.before_total,
            afterAccuracy: delta.after_accuracy_pct,
            afterTotal: delta.after_total,
            gain: delta.accuracy_gain_pct,
            passed: delta.reassessment_passed,
            when: p.created_at,
            verdict: progressVerdict(delta.accuracy_gain_pct, delta.reassessment_passed),
          },
        });
        edges.push({ source: catId, target: pId, length: 100 });
      });
    }
  });

  return { nodes, edges };
}

export default function StudentAcademicGraph({ studentName, gaps, topics, violations, interventions = [], progress = [] }: AcademicGraphProps) {
  const graphData = useMemo(
    () => buildGraph(studentName, gaps, topics, violations, interventions, progress),
    [studentName, gaps, topics, violations, interventions, progress]
  );
  const nodesRef = useRef<GraphNode[]>(graphData.nodes);
  const edgesRef = useRef<GraphEdge[]>(graphData.edges);
  const alphaRef = useRef(1);
  const draggingRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, forceTick] = useState(0);
  const [hovered, setHovered] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  useEffect(() => {
    nodesRef.current = graphData.nodes;
    edgesRef.current = graphData.edges;
    alphaRef.current = 1;
  }, [graphData]);

  useEffect(() => {
    let raf: number;
    const step = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const alpha = alphaRef.current;

      if (alpha > 0.002) {
        // Repulsion between every pair of nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let distSq = dx * dx + dy * dy;
            if (distSq < 1) distSq = 1;
            const dist = Math.sqrt(distSq);
            const force = (2600 * alpha) / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
            if (b.fx == null) { b.vx += fx; b.vy += fy; }
          }
        }

        // Spring attraction along edges
        for (const edge of edges) {
          const a = nodes.find(n => n.id === edge.source);
          const b = nodes.find(n => n.id === edge.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const displacement = (dist - edge.length) * 0.06 * alpha;
          const fx = (dx / dist) * displacement;
          const fy = (dy / dist) * displacement;
          if (a.fx == null) { a.vx += fx; a.vy += fy; }
          if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
        }

        // Gentle centering pull + integrate + damping
        for (const n of nodes) {
          if (n.fx != null && n.fy != null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          // Scaled by alpha like every other force, so centering fades out in
          // lockstep with repulsion/springs instead of becoming the sole
          // surviving force and slowly dragging the whole graph back to a
          // point once alpha gets small (the earlier "eventual convergence" bug).
          n.vx += (CENTER.x - n.x) * 0.002 * alpha;
          n.vy += (CENTER.y - n.y) * 0.002 * alpha;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
          n.x = Math.max(n.radius, Math.min(WIDTH - n.radius, n.x));
          n.y = Math.max(n.radius, Math.min(HEIGHT - n.radius, n.y));
        }

        alphaRef.current *= 0.985;
        forceTick(t => t + 1);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const handlePointerDown = (nodeId: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    draggingRef.current = nodeId;
    alphaRef.current = 1;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dragId = draggingRef.current;
    if (dragId) {
      const node = nodesRef.current.find(n => n.id === dragId);
      if (node) {
        const p = toSvgPoint(e.clientX, e.clientY);
        node.fx = p.x;
        node.fy = p.y;
        forceTick(t => t + 1);
      }
    }
  };

  const handlePointerUp = () => {
    if (draggingRef.current) {
      const node = nodesRef.current.find(n => n.id === draggingRef.current);
      if (node) { node.fx = null; node.fy = null; }
    }
    draggingRef.current = null;
  };

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const totalItems = gaps.length + topics.length + (violations?.by_assessment.length || 0) + interventions.length + progress.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
        <Info size={13} />
        <span>
          Drag nodes to explore. Hover a node for details. All five tracking categories are always shown, even before any evidence exists.
        </span>
      </div>

      {totalItems === 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', fontSize: 11, color: 'var(--text-muted)' }}>
          No academic evidence recorded yet for {studentName || 'this student'} — the five tracking categories below are shown empty. They will populate as practice, tests, interventions, and reassessments accumulate.
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: 'var(--text-secondary)' }}>
        <LegendDot color="#818cf8" label="Student" />
        <LegendDot color={CATEGORY_COLOR.gaps} label="Learning Gaps" />
        <LegendDot color={CATEGORY_COLOR.topics} label="Study Topics" />
        <LegendDot color={CATEGORY_COLOR.violations} label="Test Violations" />
        <LegendDot color={CATEGORY_COLOR.interventions} label="Interventions" />
        <LegendDot color={CATEGORY_COLOR.progress} label="Progress & Reassessments" />
        <LegendDot color="#34d399" label="Correct / Positive" />
        <LegendDot color="#f87171" label="Incorrect / Negative" />
      </div>

      <div
        className="glass-panel"
        style={{ borderRadius: 14, padding: 4, position: 'relative', overflow: 'hidden' }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 580, touchAction: 'none', cursor: draggingRef.current ? 'grabbing' : 'default' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {edges.map((edge, i) => {
            const a = nodes.find(n => n.id === edge.source);
            const b = nodes.find(n => n.id === edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1.2}
              />
            );
          })}

          {nodes.map((n) => {
            const isEmptyCategory = n.type === 'category' && n.meta.empty;
            const labelLimit = n.type === 'category' ? 30 : 26;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onPointerDown={handlePointerDown(n.id)}
                onMouseEnter={(e) => setHovered({ node: n, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHovered(h => (h && h.node.id === n.id ? { node: n, x: e.clientX, y: e.clientY } : h))}
                onMouseLeave={() => setHovered(h => (h && h.node.id === n.id ? null : h))}
                style={{ cursor: 'grab' }}
              >
                <circle
                  r={n.radius}
                  fill={n.color}
                  fillOpacity={n.type === 'evidence' ? 0.85 : isEmptyCategory ? 0.06 : n.type === 'category' ? 0.22 : 0.28}
                  stroke={n.color}
                  strokeWidth={n.type === 'student' ? 3 : n.type === 'category' ? 2.4 : 2}
                  strokeDasharray={isEmptyCategory ? '4,3' : undefined}
                />
                {n.type !== 'evidence' && (
                  <text
                    y={n.radius + 14}
                    textAnchor="middle"
                    fontSize={n.type === 'student' ? 12 : n.type === 'category' ? 11 : 10}
                    fontWeight={n.type === 'student' || n.type === 'category' ? 800 : 600}
                    fill={isEmptyCategory ? 'var(--text-muted)' : 'var(--text-primary)'}
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.55)', strokeWidth: 3 }}
                  >
                    {n.label.length > labelLimit ? `${n.label.slice(0, labelLimit - 2)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <NodeTooltip node={hovered.node} />
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function NodeTooltip({ node }: { node: GraphNode }) {
  const { meta } = node;
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        maxWidth: 300,
        background: 'rgba(15, 23, 42, 0.95)',
        border: `1px solid ${node.color}`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 11,
        color: '#e2e8f0',
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontWeight: 800, color: node.color, marginBottom: 4, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>
        {meta.kind}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{node.label}</div>
      {meta.verdict && (
        <div
          style={{
            display: 'inline-block',
            fontWeight: 800,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: meta.verdict.color,
            background: `${meta.verdict.color}22`,
            border: `1px solid ${meta.verdict.color}`,
            borderRadius: 6,
            padding: '2px 7px',
            marginBottom: 6,
          }}
        >
          {meta.verdict.label}
        </div>
      )}
      {node.type === 'category' && (
        <div>
          {meta.empty ? 'No records yet in this category.' : `${meta.count} record(s) tracked.`}
        </div>
      )}
      {node.type === 'concept' && (
        <div>Status: {meta.status} · {meta.evidenceCount} evidence item(s)</div>
      )}
      {node.type === 'evidence' && (
        <>
          <div>{meta.statement}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {meta.source} · {meta.marks} pts · {meta.when ? new Date(meta.when).toLocaleString() : ''}
          </div>
        </>
      )}
      {node.type === 'topic' && (
        <>
          <div>{meta.subject}</div>
          <div>Struggle: {meta.struggleLevel} ({meta.struggleScore}/10)</div>
          {meta.struggleReason && <div style={{ color: 'var(--text-muted)' }}>{meta.struggleReason}</div>}
          <div>Time spent: {meta.hours}</div>
        </>
      )}
      {node.type === 'violation' && (
        <>
          <div>{meta.count} violation(s) recorded</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            {Object.entries(meta.breakdown || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
          </div>
        </>
      )}
      {node.type === 'intervention' && (
        <>
          <div>Status: {meta.status}{meta.gapStatus ? ` (gap: ${meta.gapStatus})` : ''}</div>
          <div>{meta.planSteps} plan step(s)</div>
          {meta.subconcept && <div style={{ color: 'var(--text-muted)' }}>{meta.subconcept}</div>}
          {meta.when && <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{new Date(meta.when).toLocaleString()}</div>}
        </>
      )}
      {node.type === 'progress' && (
        <>
          <div>Before: {meta.beforeAccuracy != null ? `${meta.beforeAccuracy}%` : 'N/A'} ({meta.beforeTotal || 0} attempts)</div>
          <div>After: {meta.afterAccuracy != null ? `${meta.afterAccuracy}%` : 'N/A'} ({meta.afterTotal || 0} attempts)</div>
          <div style={{ fontWeight: 700, color: node.color }}>
            Gain: {meta.gain != null ? `${meta.gain > 0 ? '+' : ''}${meta.gain}%` : 'N/A'}
          </div>
          {meta.passed != null && <div style={{ color: 'var(--text-muted)' }}>Reassessment {meta.passed ? 'passed' : 'not yet passed'}</div>}
        </>
      )}
    </div>
  );
}
