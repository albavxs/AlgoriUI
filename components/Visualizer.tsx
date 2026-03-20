"use client";

import { useEffect, useMemo, useState } from "react";
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

function hasGraphData(event: TraceEvent | null): boolean {
  return safeStringArray(event?.nodes).length > 0;
}

function resolveGraphEvent(events: TraceEvent[], index: number): TraceEvent | null {
  const event = currentEvent(events, index);
  if (!event) {
    return null;
  }

  if (hasGraphData(event)) {
    return event;
  }

  for (let cursor = Math.max(0, Math.min(index, events.length - 1)); cursor >= 0; cursor -= 1) {
    const candidate = events[cursor] ?? null;
    if (!hasGraphData(candidate)) {
      continue;
    }

    return {
      ...candidate,
      ...event,
      nodes: candidate.nodes,
      edges: candidate.edges,
      frontier: Array.isArray(event.frontier) ? event.frontier : candidate.frontier,
      current: typeof event.current === "string" ? event.current : candidate.current,
      visited: Array.isArray(event.visited) ? event.visited : candidate.visited
    };
  }

  return event;
}

function resolveGraphCompletionOrder(events: TraceEvent[], index: number, event: TraceEvent | null): string[] {
  const directOrder = safeStringArray(event?.order);
  if (directOrder.length > 0) {
    return directOrder;
  }

  const seen = new Set<string>();
  const order: string[] = [];
  const limit = Math.max(0, Math.min(index, events.length - 1));

  for (let cursor = 0; cursor <= limit; cursor += 1) {
    const candidate = events[cursor] ?? null;
    const current = typeof candidate?.current === "string" ? candidate.current : null;
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    order.push(current);
  }

  return order;
}

function useSequentialCompletion<T extends string | number>(order: T[], enabled: boolean, stepMs = 150) {
  const orderKey = order.join("|");
  const [completionCount, setCompletionCount] = useState(enabled ? 0 : order.length);

  useEffect(() => {
    if (!enabled) {
      setCompletionCount(order.length);
      return;
    }

    setCompletionCount(0);
    const timers = order.map((_, index) =>
      window.setTimeout(() => {
        setCompletionCount(index + 1);
      }, index * stepMs)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled, order.length, orderKey, stepMs]);

  const activeItem = enabled && completionCount > 0 ? order[completionCount - 1] ?? null : null;

  return {
    completionCount,
    activeItem
  };
}

function FinaleGlow() {
  return (
    <motion.div
      className="viz-finale-glow"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.04, 0.2, 0.12] }}
      transition={{ duration: 0.65, ease: "easeOut" }}
    />
  );
}

function SortingVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const kept = safeArray(event?.kept);
  const i = typeof event?.i === "number" ? event.i : -1;
  const j = typeof event?.j === "number" ? event.j : -1;
  const max = arr.length ? Math.max(...arr, 1) : 1;
  const completionOrder = useMemo(
    () => (event?.t === "done" ? arr.map((_, index) => index) : []),
    [arr, event?.t]
  );
  const { completionCount, activeItem } = useSequentialCompletion(completionOrder, event?.t === "done", 120);
  const isCompletionFinished = event?.t === "done" && completionCount >= completionOrder.length;

  if (!arr.length) {
    return <div className="viz-empty">No numeric array in current event.</div>;
  }

  return (
    <div className="bars-wrap">
      {isCompletionFinished ? <FinaleGlow /> : null}
      {arr.map((value, index) => {
        const inKept = kept.includes(value) && event?.t === "stalin-step";
        const isCompare = event?.t === "compare" && (index === i || index === j);
        const isSwap = event?.t === "swap" && (index === i || index === j);
        const isScanning = event?.t === "stalin-step" && index === i;
        const isCompletionPulse = activeItem === index;
        const isCompleted = event?.t === "done" && index < completionCount;
        const color = inKept
          ? "#32d74b"
          : isCompletionPulse
            ? "#a7f7b8"
            : isCompleted
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
            animate={{
              scaleY: isCompletionPulse ? 1.08 : 1,
              opacity: event?.t === "done" && !isCompleted && !isCompletionPulse ? 0.55 : 1
            }}
            style={{
              height: `${Math.max((value / max) * 100, 6)}%`,
              background: color,
              transformOrigin: "center bottom",
              boxShadow: isCompletionPulse
                ? "0 0 28px rgba(50, 215, 75, 0.38), inset 0 0 0 1px rgba(255,255,255,0.12)"
                : undefined
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
  const isTerminal = event?.t === "search-found" || event?.t === "search-miss";
  const completionOrder = useMemo(
    () => (isTerminal ? arr.map((_, index) => index) : []),
    [arr, isTerminal]
  );
  const { completionCount, activeItem } = useSequentialCompletion(completionOrder, isTerminal, 120);
  const isCompletionFinished = isTerminal && completionCount >= completionOrder.length;

  if (!arr.length) {
    return <div className="viz-empty">No searchable array in current event.</div>;
  }

  return (
    <div className="bars-wrap">
      {isCompletionFinished ? <FinaleGlow /> : null}
      {arr.map((value, index) => {
        const isCompletionPulse = activeItem === index;
        const isCompleted = isTerminal && index < completionCount;
        let color = "#9ca3af";
        if (index >= left && index <= right) color = "#22d3ee";
        if (index === mid) color = "#ffd60a";
        if (event?.t === "search-found" && index === mid) color = "#32d74b";
        if (isCompleted) color = "#32d74b";
        if (isCompletionPulse) color = "#b7ffc3";

        return (
          <motion.div
            key={`${index}-${value}`}
            className="bar"
            layout
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
            animate={{
              scaleY: isCompletionPulse ? 1.08 : 1,
              opacity: isTerminal && !isCompleted && !isCompletionPulse ? 0.5 : 1
            }}
            style={{
              height: `${Math.max((value / max) * 100, 6)}%`,
              background: color,
              transformOrigin: "center bottom",
              boxShadow: isCompletionPulse
                ? "0 0 28px rgba(50, 215, 75, 0.34), inset 0 0 0 1px rgba(255,255,255,0.12)"
                : undefined
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

function GraphVisualizer({ event, events, currentIndex }: { event: TraceEvent | null; events: TraceEvent[]; currentIndex: number }) {
  const nodes = safeStringArray(event?.nodes);
  const edgesRaw = Array.isArray(event?.edges) ? event.edges : [];
  const edges = edgesRaw
    .map((edge) => (Array.isArray(edge) && edge.length === 2 ? [String(edge[0]), String(edge[1])] : null))
    .filter((edge): edge is [string, string] => edge !== null);
  const visited = new Set(safeStringArray(event?.visited));
  const frontier = new Set(safeStringArray(event?.frontier));
  const current = typeof event?.current === "string" ? event.current : null;
  const positions = buildNodePositions(nodes);
  const completionOrder = useMemo(
    () => resolveGraphCompletionOrder(events, currentIndex, event),
    [currentIndex, event, events]
  );
  const isCompletionEvent = event?.t === "done" && completionOrder.length > 0;
  const { completionCount, activeItem } = useSequentialCompletion(
    completionOrder,
    isCompletionEvent,
    150
  );
  const isCompletionFinished = isCompletionEvent && completionCount >= completionOrder.length;

  if (!nodes.length) {
    return <div className="viz-empty">No graph data in current event.</div>;
  }

  const activeCompletionNode = isCompletionEvent ? activeItem : null;

  return (
    <div className="graph-stage">
      {isCompletionFinished ? <FinaleGlow /> : null}
      <svg className="graph-canvas" viewBox="0 0 360 240" aria-label="graph-visualization">
        {edges.map(([a, b], index) => {
          const pa = positions[a];
          const pb = positions[b];
          if (!pa || !pb) return null;
          const edgeCompleted =
            isCompletionFinished ||
            (completionOrder.indexOf(a) !== -1 &&
              completionOrder.indexOf(b) !== -1 &&
              completionOrder.indexOf(a) < completionCount &&
              completionOrder.indexOf(b) < completionCount);

          return (
            <line
              key={`${a}-${b}-${index}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={edgeCompleted ? "rgba(50, 215, 75, 0.62)" : "#475569"}
              strokeWidth={edgeCompleted ? "2.6" : "2"}
            />
          );
        })}
        {nodes.map((node) => {
          const p = positions[node];
          const traversalIndex = completionOrder.indexOf(node);
          const isSequenced = traversalIndex !== -1;
          const isCompleted = isCompletionEvent && isSequenced && traversalIndex < completionCount;
          const isCompletionPulse = activeCompletionNode === node;
          const isCurrent = current === node;
          const isVisited = visited.has(node);
          const isFrontier = frontier.has(node);
          const fill = isCompletionEvent
            ? isCompletionPulse
              ? "#b7ffc3"
              : isCompleted || isCompletionFinished
                ? "#32d74b"
                : "#64748b"
            : isCurrent
              ? "#ffd60a"
              : isVisited
                ? "#32d74b"
                : isFrontier
                  ? "#22d3ee"
                  : "#64748b";

          return (
            <g key={node}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r="24"
                fill="rgba(50, 215, 75, 0.12)"
                initial={false}
                animate={{
                  opacity: isCompletionPulse ? [0.05, 0.4, 0.12] : isCompleted ? 0.16 : 0,
                  scale: isCompletionPulse ? [1, 1.4, 1.08] : isCompleted ? 1.08 : 1
                }}
                transition={{
                  duration: isCompletionPulse ? 0.42 : 0.18,
                  ease: "easeOut"
                }}
              />
              <motion.circle
                cx={p.x}
                cy={p.y}
                r="18"
                fill={fill}
                initial={false}
                animate={{
                  scale: isCompletionPulse ? 1.22 : isCurrent ? 1.12 : isCompleted ? 1.08 : 1,
                  opacity: isCompletionEvent && isSequenced && !isCompleted && !isCompletionPulse ? 0.5 : 1
                }}
                transition={{ duration: isCompletionPulse ? 0.4 : 0.18 }}
              />
              <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#020617" fontWeight="700" fontSize="14">
                {node}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Visualizer({ category, events, currentIndex, emptyLabel }: VisualizerProps) {
  const event =
    category === "graph" ? resolveGraphEvent(events, currentIndex) : currentEvent(events, currentIndex);

  if (!event) {
    return <div className="viz-empty">{emptyLabel}</div>;
  }

  if (category === "sorting") {
    return <SortingVisualizer event={event} />;
  }

  if (category === "search") {
    return <SearchVisualizer event={event} />;
  }

  return <GraphVisualizer event={event} events={events} currentIndex={currentIndex} />;
}
