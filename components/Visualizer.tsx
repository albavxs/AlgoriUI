"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import type { TraceEvent, VisualizerType } from "@/lib/types";

type VisualizerProps = {
  visualizer: VisualizerType;
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

function hasArrayData(event: TraceEvent | null): boolean {
  return safeArray(event?.arr).length > 0;
}

function findPreviousArrayEvent(events: TraceEvent[], index: number): TraceEvent | null {
  if (index < 0 || events.length === 0) {
    return null;
  }

  for (let cursor = Math.max(0, Math.min(index, events.length - 1)); cursor >= 0; cursor -= 1) {
    const candidate = events[cursor] ?? null;
    if (hasArrayData(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveSortingEvent(events: TraceEvent[], index: number): TraceEvent | null {
  const event = currentEvent(events, index);
  if (!event) {
    return null;
  }

  const arr = safeArray(event.arr);
  const kept = safeArray(event.kept);
  const previous = findPreviousArrayEvent(events, index - 1);
  const previousArr = safeArray(previous?.arr);

  if (event.t === "done" && kept.length > 0) {
    return {
      ...event,
      arr: kept
    };
  }

  if (!arr.length && previousArr.length > 0) {
    return {
      ...previous,
      ...event,
      arr: previousArr
    };
  }

  return event;
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
  const rawArr = safeArray(event?.arr);
  const kept = safeArray(event?.kept);
  const rawI = typeof event?.i === "number" ? event.i : -1;
  const rawJ = typeof event?.j === "number" ? event.j : -1;
  const isStalinStep = event?.t === "stalin-step";
  const arr = useMemo(
    () => (isStalinStep && rawI >= 0 ? [...kept, ...rawArr.slice(rawI)] : rawArr),
    [isStalinStep, kept, rawArr, rawI]
  );
  const i = isStalinStep && rawI >= 0 ? kept.length : rawI;
  const j = rawJ;
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
        const inKept = isStalinStep && index < kept.length;
        const isCompare = event?.t === "compare" && (index === i || index === j);
        const isSwap = event?.t === "swap" && (index === i || index === j);
        const isScanning = isStalinStep && index === i;
        const isAcceptedCurrent = isStalinStep && index === i && Boolean(event?.accepted);
        const isRejectedCurrent = isStalinStep && index === i && !Boolean(event?.accepted);
        const isCompletionPulse = activeItem === index;
        const isCompleted = event?.t === "done" && index < completionCount;
        const color = isCompletionPulse
          ? "#a7f7b8"
          : isCompleted
            ? "#32d74b"
            : isSwap
              ? "#ffd60a"
              : isCompare
                ? "#ff453a"
                : isAcceptedCurrent
                  ? "#32d74b"
                  : isRejectedCurrent
                    ? "#ff453a"
                    : inKept
                      ? "#32d74b"
                      : isScanning
                        ? "#22d3ee"
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
  const max = arr.length ? Math.max(...arr, 1) : 1;
  const isInitialFrame = event?.t === "search-start";
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
        if (!isInitialFrame) {
          if (index >= left && index <= right) color = "#22d3ee";
          if (mid >= 0 && index === mid) color = "#ffd60a";
          if (event?.t === "search-found" && index === mid) color = "#32d74b";
          if (isCompleted) color = "#32d74b";
          if (isCompletionPulse) color = "#b7ffc3";
        }

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

// ── Maze Visualizer ───────────────────────────────────────────────────────────

function resolveMazeContext(events: TraceEvent[], index: number): {
  grid: number[][];
  startPos: [number, number];
  endPos: [number, number];
} | null {
  for (let i = 0; i <= Math.min(index, events.length - 1); i++) {
    const e = events[i];
    if (e?.t === "maze-start" && Array.isArray(e.grid)) {
      return {
        grid: e.grid as number[][],
        startPos: (Array.isArray(e.start) ? e.start : [0, 0]) as [number, number],
        endPos: (Array.isArray(e.end) ? e.end : [0, 0]) as [number, number]
      };
    }
  }
  return null;
}

function MazeVisualizer({ event, events, currentIndex }: { event: TraceEvent | null; events: TraceEvent[]; currentIndex: number }) {
  const ctx = useMemo(() => resolveMazeContext(events, currentIndex), [events, currentIndex]);

  const visitedSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(event?.visited)) {
      for (const p of event.visited as [number, number][]) set.add(`${p[0]},${p[1]}`);
    }
    return set;
  }, [event?.visited]);

  const pathOrder = useMemo(() => {
    if (event?.t === "done" && Array.isArray(event.path)) return event.path as [number, number][];
    return [];
  }, [event]);

  const pathIndices = useMemo(() => pathOrder.map((_, i) => i), [pathOrder]);
  const { completionCount, activeItem: activePathIdx } = useSequentialCompletion(
    pathIndices,
    event?.t === "done" && pathOrder.length > 0,
    70
  );
  const isPathDone = event?.t === "done" && completionCount >= pathIndices.length;

  if (!ctx || !event) return <div className="viz-empty">No maze data in current event.</div>;

  const { grid, startPos, endPos } = ctx;
  const cols = grid[0]?.length ?? 1;
  const isDone = event.t === "done";
  const currRow = typeof event.row === "number" ? event.row : -1;
  const currCol = typeof event.col === "number" ? event.col : -1;

  return (
    <div className="maze-stage">
      {isPathDone ? <FinaleGlow /> : null}
      <div className="maze-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isWall = cell === 1;
            const isStart = r === startPos[0] && c === startPos[1];
            const isEnd = r === endPos[0] && c === endPos[1];
            const isCurrent = !isDone && r === currRow && c === currCol;
            const isVisited = visitedSet.has(`${r},${c}`);
            const pathIdx = isDone ? pathOrder.findIndex(([pr, pc]) => pr === r && pc === c) : -1;
            const isPathPulse = isDone && activePathIdx === pathIdx && pathIdx !== -1;
            const isPathCompleted = isDone && pathIdx !== -1 && pathIdx < completionCount;
            const endFound = isDone && pathOrder.length > 0;

            let cls = "maze-cell";
            if (isWall) cls += " maze-cell--wall";
            else if (isStart) cls += " maze-cell--start";
            else if (isEnd) cls += endFound ? " maze-cell--end-found" : " maze-cell--end";
            else if (isPathPulse) cls += " maze-cell--path-pulse";
            else if (isPathCompleted) cls += " maze-cell--path";
            else if (isCurrent) cls += " maze-cell--current";
            else if (isVisited) cls += " maze-cell--visited";
            else cls += " maze-cell--open";

            return <div key={`${r}-${c}`} className={cls} />;
          })
        )}
      </div>
    </div>
  );
}

// ── Heap Visualizer ───────────────────────────────────────────────────────────

function heapNodePos(i: number, totalNodes: number): { x: number; y: number } {
  const levels = Math.max(Math.floor(Math.log2(Math.max(totalNodes, 1))) + 1, 1);
  const level = Math.floor(Math.log2(i + 1));
  const posInLevel = i - (Math.pow(2, level) - 1);
  const totalInLevel = Math.pow(2, level);
  const x = ((posInLevel + 0.5) / totalInLevel) * 380 + 10;
  const y = 26 + (level / Math.max(levels - 1, 1)) * 150;
  return { x, y };
}

function HeapVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const heapSize = typeof event?.heapSize === "number" ? event.heapSize : arr.length;
  const hi = typeof event?.i === "number" ? event.i : -1;
  const hj = typeof event?.j === "number" ? event.j : -1;
  const isDone = event?.t === "done";
  const maxVal = arr.length ? Math.max(...arr, 1) : 1;
  // Show at most 15 nodes in tree (4 full levels)
  const treeNodes = arr.slice(0, Math.min(arr.length, 15));

  const completionOrder = useMemo(
    () => (isDone ? arr.map((_, idx) => idx) : []),
    [arr, isDone]
  );
  const { completionCount, activeItem } = useSequentialCompletion(completionOrder, isDone, 100);
  const isCompletionFinished = isDone && completionCount >= completionOrder.length;

  if (!arr.length) {
    return <div className="viz-empty">No heap data in current event.</div>;
  }

  return (
    <div className="heap-wrap">
      {isCompletionFinished ? <FinaleGlow /> : null}
      {/* Binary tree SVG */}
      <svg className="heap-svg" viewBox="0 0 400 200" aria-label="heap-tree">
        {/* Edges */}
        {treeNodes.map((_, idx) => {
          if (idx === 0) return null;
          const parent = Math.floor((idx - 1) / 2);
          const pp = heapNodePos(parent, treeNodes.length);
          const cp = heapNodePos(idx, treeNodes.length);
          const inHeap = idx < heapSize;
          return (
            <line
              key={`edge-${idx}`}
              x1={pp.x} y1={pp.y}
              x2={cp.x} y2={cp.y}
              stroke={inHeap ? "rgba(100,116,139,0.5)" : "rgba(100,116,139,0.15)"}
              strokeWidth="1.5"
            />
          );
        })}
        {/* Nodes */}
        {treeNodes.map((val, idx) => {
          const p = heapNodePos(idx, treeNodes.length);
          const inHeap = idx < heapSize;
          const isHighlighted = idx === hi || idx === hj;
          const isSwapNode = event?.t === "swap" && isHighlighted;
          const isHeapify = event?.t === "heapify" && isHighlighted;
          const isExtracted = !inHeap;
          const isCompletionPulse = activeItem === idx;
          const isCompleted = isDone && idx < completionCount;
          const fill = isCompletionPulse
            ? "#a7f7b8"
            : isCompleted
              ? "#32d74b"
              : isSwapNode
                ? "#ffd60a"
                : isHeapify
                  ? "#22d3ee"
                  : isExtracted
                    ? "#334155"
                    : "#475569";

          return (
            <g key={`node-${idx}`}>
              <motion.circle
                cx={p.x} cy={p.y} r="16"
                fill={fill}
                animate={{ scale: isHighlighted ? 1.18 : isCompletionPulse ? 1.22 : 1 }}
                transition={{ duration: 0.18 }}
                opacity={isExtracted && !isCompleted ? 0.4 : 1}
              />
              <text
                x={p.x} y={p.y + 4}
                textAnchor="middle"
                fill={isExtracted ? "#64748b" : "#020617"}
                fontWeight="700"
                fontSize="11"
              >
                {val}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Mini bar chart */}
      <div className="heap-bars">
        {arr.map((value, index) => {
          const inHeap = index < heapSize;
          const isActive = index === hi || index === hj;
          const isCompletionPulse = activeItem === index;
          const isCompleted = isDone && index < completionCount;
          const color = isCompletionPulse
            ? "#a7f7b8"
            : isCompleted
              ? "#32d74b"
              : isActive
                ? (event?.t === "swap" ? "#ffd60a" : "#22d3ee")
                : inHeap
                  ? "#22d3ee"
                  : "#334155";
          return (
            <motion.div
              key={`bar-${index}`}
              className="bar"
              animate={{ opacity: !inHeap && !isCompleted ? 0.3 : 1 }}
              style={{
                height: `${Math.max((value / maxVal) * 100, 6)}%`,
                background: color,
                transformOrigin: "center bottom"
              }}
              title={`[${index}] = ${value}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Bucket Visualizer ─────────────────────────────────────────────────────────

function BucketVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const bucketsRaw = Array.isArray(event?.buckets) ? event.buckets : [];
  const buckets: number[][] = bucketsRaw.map((b) => (Array.isArray(b) ? b.filter((v) => typeof v === "number") : []));
  const activeBucket = typeof event?.activeBucket === "number" ? event.activeBucket : -1;
  const activeItem = typeof event?.activeItem === "number" ? event.activeItem : null;
  const isDone = event?.t === "done";
  const isMerge = event?.t === "merge";
  const maxVal = arr.length ? Math.max(...arr, 1) : 1;

  const completionOrder = useMemo(
    () => (isDone ? arr.map((_, idx) => idx) : []),
    [arr, isDone]
  );
  const { completionCount, activeItem: completionPulse } = useSequentialCompletion(completionOrder, isDone, 100);
  const isCompletionFinished = isDone && completionCount >= completionOrder.length;

  if (!arr.length && !buckets.some((b) => b.length > 0)) {
    return <div className="viz-empty">No bucket data in current event.</div>;
  }

  const bucketCount = Math.max(buckets.length, 5);

  return (
    <div className="bucket-wrap">
      {isCompletionFinished ? <FinaleGlow /> : null}
      {/* Input array bars (compact) */}
      {arr.length > 0 && (
        <div className="bucket-input-bars">
          {arr.map((value, index) => {
            const isCompletionPulse = completionPulse === index;
            const isCompleted = isDone && index < completionCount;
            const isMerged = isMerge && index < arr.indexOf(0) + 1;
            const color = isCompletionPulse ? "#a7f7b8" : isCompleted || isMerge ? "#32d74b" : "#22d3ee";
            return (
              <motion.div
                key={`input-${index}`}
                className="bar"
                animate={{ opacity: isDone && !isCompleted && !isCompletionPulse ? 0.5 : 1 }}
                style={{
                  height: `${Math.max((value / maxVal) * 100, 6)}%`,
                  background: color,
                  transformOrigin: "center bottom"
                }}
                title={`${value}`}
              />
            );
          })}
        </div>
      )}
      {/* Bucket columns */}
      {!isDone && (
        <div className="bucket-grid" style={{ gridTemplateColumns: `repeat(${bucketCount}, 1fr)` }}>
          {Array.from({ length: bucketCount }, (_, b) => {
            const isActive = b === activeBucket;
            const items = buckets[b] ?? [];
            return (
              <div key={`bucket-${b}`} className={`bucket-col ${isActive ? "active" : ""}`}>
                <div className="bucket-label">B{b}</div>
                <div className="bucket-items">
                  {items.map((val, idx) => {
                    const isActiveItem = isActive && val === activeItem;
                    return (
                      <motion.div
                        key={`${b}-${idx}-${val}`}
                        className="bucket-item"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: isActiveItem ? 1.1 : 1 }}
                        transition={{ duration: 0.18 }}
                        style={{
                          background: isActiveItem ? "#22d3ee" : isActive ? "rgba(34,211,238,0.3)" : "rgba(100,116,139,0.3)",
                          borderColor: isActiveItem ? "rgba(34,211,238,0.6)" : isActive ? "rgba(34,211,238,0.2)" : "rgba(100,116,139,0.2)"
                        }}
                      >
                        {val}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Radix Visualizer ──────────────────────────────────────────────────────────

const DIGIT_NAMES_PT = ["Unidades", "Dezenas", "Centenas", "Milhares"];
const DIGIT_NAMES_EN = ["Units", "Tens", "Hundreds", "Thousands"];

function RadixVisualizer({ event }: { event: TraceEvent | null }) {
  const arr = safeArray(event?.arr);
  const counts = safeArray(event?.counts);
  const output = safeArray(event?.output);
  const digit = typeof event?.digit === "number" ? event.digit : 0;
  const activeIdx = typeof event?.activeIdx === "number" ? event.activeIdx : -1;
  const isDone = event?.t === "done";
  const isCounting = event?.t === "counting";
  const isPlacing = event?.t === "placing";
  const maxVal = arr.length ? Math.max(...arr, 1) : 1;

  const completionOrder = useMemo(
    () => (isDone ? arr.map((_, idx) => idx) : []),
    [arr, isDone]
  );
  const { completionCount, activeItem: completionPulse } = useSequentialCompletion(completionOrder, isDone, 100);
  const isCompletionFinished = isDone && completionCount >= completionOrder.length;

  if (!arr.length) {
    return <div className="viz-empty">No radix data in current event.</div>;
  }

  const maxCount = counts.length ? Math.max(...counts, 1) : 1;
  const digitLabel = DIGIT_NAMES_PT[digit] ?? `×${Math.pow(10, digit)}`;

  return (
    <div className="radix-wrap">
      {isCompletionFinished ? <FinaleGlow /> : null}
      {/* Main bars */}
      <div className="radix-bars">
        {arr.map((value, index) => {
          const isActive = index === activeIdx;
          const isCompletionPulse = completionPulse === index;
          const isCompleted = isDone && index < completionCount;
          const color = isCompletionPulse
            ? "#a7f7b8"
            : isCompleted
              ? "#32d74b"
              : isActive
                ? "#ffd60a"
                : "#22d3ee";
          return (
            <motion.div
              key={`rbar-${index}`}
              className="bar"
              animate={{
                opacity: isDone && !isCompleted && !isCompletionPulse ? 0.5 : 1,
                scaleY: isActive ? 1.08 : 1
              }}
              style={{
                height: `${Math.max((value / maxVal) * 100, 6)}%`,
                background: color,
                transformOrigin: "center bottom"
              }}
              title={`${value}`}
            />
          );
        })}
      </div>
      {/* Digit label */}
      {!isDone && (
        <div className="radix-digit-label">
          {digitLabel}
        </div>
      )}
      {/* Counts row */}
      {!isDone && counts.length > 0 && (
        <div className="radix-row">
          <span className="radix-row-label">Count</span>
          <div className="radix-cells">
            {counts.slice(0, 10).map((count, d) => (
              <div key={`count-${d}`} className="radix-cell">
                <div className="radix-cell-digit">{d}</div>
                <motion.div
                  className="radix-cell-value"
                  animate={{ background: count > 0 ? "rgba(34,211,238,0.18)" : "rgba(30,41,59,0.5)" }}
                  style={{ borderColor: count > 0 ? "rgba(34,211,238,0.3)" : "rgba(100,116,139,0.2)" }}
                >
                  {count}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Output row */}
      {!isDone && output.length > 0 && (
        <div className="radix-row">
          <span className="radix-row-label">Out</span>
          <div className="radix-out-cells">
            {output.map((val, idx) => (
              <motion.div
                key={`out-${idx}`}
                className="radix-out-cell"
                animate={{
                  background: val !== 0 ? "rgba(50,215,75,0.14)" : "rgba(30,41,59,0.4)",
                  borderColor: val !== 0 ? "rgba(50,215,75,0.3)" : "rgba(100,116,139,0.15)"
                }}
              >
                {val !== 0 ? val : ""}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Visualizer ───────────────────────────────────────────────────────────

export function Visualizer({ visualizer, events, currentIndex, emptyLabel }: VisualizerProps) {
  const event = useMemo(() => {
    if (visualizer === "graph") return resolveGraphEvent(events, currentIndex);
    if (visualizer === "sorting" || visualizer === "heap") return resolveSortingEvent(events, currentIndex);
    return currentEvent(events, currentIndex);
  }, [visualizer, events, currentIndex]);

  if (visualizer === "maze") {
    return <MazeVisualizer event={event} events={events} currentIndex={currentIndex} />;
  }

  if (!event) {
    return <div className="viz-empty">{emptyLabel}</div>;
  }

  if (visualizer === "heap") {
    return <HeapVisualizer event={event} />;
  }

  if (visualizer === "bucket") {
    return <BucketVisualizer event={event} />;
  }

  if (visualizer === "radix") {
    return <RadixVisualizer event={event} />;
  }

  if (visualizer === "graph") {
    return <GraphVisualizer event={event} events={events} currentIndex={currentIndex} />;
  }

  if (visualizer === "sorting") {
    return <SortingVisualizer event={event} />;
  }

  return <SearchVisualizer event={event} />;
}
