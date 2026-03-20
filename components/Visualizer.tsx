"use client";

import { motion } from "framer-motion";

import type { AlgorithmCategory, TraceEvent } from "@/lib/types";

type VisualizerProps = {
  category: AlgorithmCategory;
  events: TraceEvent[];
  currentIndex: number;
  emptyLabel: string;
};

function safeArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "number") : [];
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function currentEvent(events: TraceEvent[], index: number): TraceEvent | null {
  if (events.length === 0) return null;
  return events[Math.max(0, Math.min(index, events.length - 1))] ?? null;
}

function SortingVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const kept = safeArray(event?.kept);
  const i = typeof event?.i === "number" ? event.i : -1;
  const j = typeof event?.j === "number" ? event.j : -1;
  const max = arr.length ? Math.max(...arr, 1) : 1;

  if (!arr.length) {
    return <div className="viz-empty">No numeric array in current event.</div>;
  }

  return (
    <div className="bars-wrap">
      {arr.map((value, index) => {
        const inKept = kept.includes(value) && event?.t === "stalin-step";
        const isCompare = event?.t === "compare" && (index === i || index === j);
        const isSwap = event?.t === "swap" && (index === i || index === j);
        const isScanning = event?.t === "stalin-step" && index === i;
        const color = inKept
          ? "#32d74b"
          : isSwap
            ? "#ffd60a"
            : isCompare || isScanning
              ? "#ff453a"
              : "#22d3ee";

        return (
          <motion.div
            key={`${index}-${value}`}
            className="bar"
            layout
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            style={{
              height: `${Math.max((value / max) * 100, 6)}%`,
              background: color
            }}
            title={`${value}`}
          />
        );
      })}
    </div>
  );
}

function SearchVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const left = typeof event?.left === "number" ? event.left : -1;
  const right = typeof event?.right === "number" ? event.right : -1;
  const mid = typeof event?.mid === "number" ? event.mid : -1;
  const target = typeof event?.target === "number" ? event.target : null;
  const max = arr.length ? Math.max(...arr, 1) : 1;

  if (!arr.length) {
    return <div className="viz-empty">No searchable array in current event.</div>;
  }

  return (
    <div className="bars-wrap">
      {arr.map((value, index) => {
        let color = "#9ca3af";
        if (index >= left && index <= right) color = "#22d3ee";
        if (index === mid) color = "#ffd60a";
        if (event?.t === "search-found" && index === mid) color = "#32d74b";

        return (
          <motion.div
            key={`${index}-${value}`}
            className="bar"
            layout
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            style={{
              height: `${Math.max((value / max) * 100, 6)}%`,
              background: color
            }}
            title={`i=${index} value=${value}`}
          />
        );
      })}
      <div className="viz-caption">
        left={left} right={right} mid={mid} {target !== null ? `target=${target}` : ""}
      </div>
    </div>
  );
}

type GraphPoint = { x: number; y: number };

function buildNodePositions(nodes: string[]): Record<string, GraphPoint> {
  const cx = 180;
  const cy = 120;
  const radius = 78;
  const total = Math.max(nodes.length, 1);
  return nodes.reduce(
    (acc, node, index) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      acc[node] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      };
      return acc;
    },
    {} as Record<string, GraphPoint>
  );
}

function GraphVisualizer({ event }: { event: TraceEvent | null }) {
  const nodes = safeStringArray(event?.nodes);
  const edgesRaw = Array.isArray(event?.edges) ? event.edges : [];
  const edges = edgesRaw
    .map((edge) => (Array.isArray(edge) && edge.length === 2 ? [String(edge[0]), String(edge[1])] : null))
    .filter((edge): edge is [string, string] => edge !== null);
  const visited = new Set(safeStringArray(event?.visited));
  const frontier = new Set(safeStringArray(event?.frontier));
  const current = typeof event?.current === "string" ? event.current : null;
  const positions = buildNodePositions(nodes);

  if (!nodes.length) {
    return <div className="viz-empty">No graph data in current event.</div>;
  }

  return (
    <svg className="graph-canvas" viewBox="0 0 360 240" aria-label="graph-visualization">
      {edges.map(([a, b], index) => {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return null;
        return <line key={`${a}-${b}-${index}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#475569" strokeWidth="2" />;
      })}
      {nodes.map((node) => {
        const p = positions[node];
        const isCurrent = current === node;
        const isVisited = visited.has(node);
        const isFrontier = frontier.has(node);
        const fill = isCurrent ? "#ffd60a" : isVisited ? "#32d74b" : isFrontier ? "#22d3ee" : "#64748b";

        return (
          <g key={node}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r="18"
              fill={fill}
              initial={false}
              animate={{ scale: isCurrent ? 1.12 : 1 }}
              transition={{ duration: 0.18 }}
            />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#020617" fontWeight="700" fontSize="14">
              {node}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Visualizer({ category, events, currentIndex, emptyLabel }: VisualizerProps) {
  const event = currentEvent(events, currentIndex);

  if (!event) {
    return <div className="viz-empty">{emptyLabel}</div>;
  }

  if (category === "sorting") {
    return <SortingVisualizer event={event} />;
  }

  if (category === "search") {
    return <SearchVisualizer event={event} />;
  }

  return <GraphVisualizer event={event} />;
}
