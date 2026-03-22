"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import type { AlgorithmId } from "@/lib/types";

// ── Demo data ─────────────────────────────────────────────────────────────────

const SORT_INPUT = [6, 2, 9, 1, 7, 3, 8, 4, 5, 10];

const MINI_MAZE: number[][] = [
  [0, 0, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 1, 0, 1, 0],
  [0, 0, 0, 0, 1, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 0, 1],
  [0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 1, 0],
];
const MINI_START: [number, number] = [0, 0];
const MINI_END: [number, number] = [5, 7];

// ── Soft Web Audio beep ───────────────────────────────────────────────────────

let miniAudioCtx: AudioContext | null = null;

function playMiniBeep(frequency: number) {
  if (typeof window === "undefined") return;
  try {
    if (!miniAudioCtx) miniAudioCtx = new AudioContext();
    const ctx = miniAudioCtx;
    const beep = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(beep);
    } else {
      beep();
    }
  } catch {
    // Audio not available
  }
}

// ── Step types ────────────────────────────────────────────────────────────────

type SortStep   = { kind: "sort";   arr: number[]; hi?: number; hj?: number; keptCount?: number; accepted?: boolean; done?: boolean; };
type HeapStep   = { kind: "heap";   arr: number[]; hi?: number; hj?: number; heapSize: number; done?: boolean; };
type BucketStep = { kind: "bucket"; arr: number[]; buckets: number[][]; activeBucket?: number; done?: boolean; };
type RadixStep  = { kind: "radix";  arr: number[]; pass: number; counts?: number[]; activeIdx?: number; done?: boolean; };
type MazeStep   = { kind: "maze";   row: number; col: number; visited: [number, number][]; path?: [number, number][]; done?: boolean; };

type Step = SortStep | HeapStep | BucketStep | RadixStep | MazeStep;

// ── Sort step generators ──────────────────────────────────────────────────────

function bubbleSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const out: Step[] = [{ kind: "sort", arr: [...a] }];
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      out.push({ kind: "sort", arr: [...a], hi: j, hj: j + 1 });
      if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; out.push({ kind: "sort", arr: [...a], hi: j, hj: j + 1 }); }
    }
  }
  out.push({ kind: "sort", arr: [...a], done: true });
  return out;
}

function cocktailSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const out: Step[] = [{ kind: "sort", arr: [...a] }];
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    for (let j = lo; j < hi; j++) {
      out.push({ kind: "sort", arr: [...a], hi: j, hj: j + 1 });
      if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; out.push({ kind: "sort", arr: [...a], hi: j, hj: j + 1 }); }
    }
    hi--;
    for (let j = hi; j > lo; j--) {
      out.push({ kind: "sort", arr: [...a], hi: j - 1, hj: j });
      if (a[j] < a[j - 1]) { [a[j], a[j - 1]] = [a[j - 1], a[j]]; out.push({ kind: "sort", arr: [...a], hi: j - 1, hj: j }); }
    }
    lo++;
  }
  out.push({ kind: "sort", arr: [...a], done: true });
  return out;
}

function selectionSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const out: Step[] = [{ kind: "sort", arr: [...a] }];
  for (let i = 0; i < a.length - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < a.length; j++) {
      out.push({ kind: "sort", arr: [...a], hi: minIdx, hj: j });
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) { [a[i], a[minIdx]] = [a[minIdx], a[i]]; out.push({ kind: "sort", arr: [...a], hi: i, hj: minIdx }); }
  }
  out.push({ kind: "sort", arr: [...a], done: true });
  return out;
}

function heapSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const out: Step[] = [];
  const n = a.length;
  function heapify(size: number, root: number) {
    let lg = root;
    const l = 2 * root + 1, r = 2 * root + 2;
    if (l < size && a[l] > a[lg]) lg = l;
    if (r < size && a[r] > a[lg]) lg = r;
    out.push({ kind: "heap", arr: [...a], hi: root, hj: lg, heapSize: size });
    if (lg !== root) {
      [a[root], a[lg]] = [a[lg], a[root]];
      out.push({ kind: "heap", arr: [...a], hi: root, hj: lg, heapSize: size });
      heapify(size, lg);
    }
  }
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(n, i);
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]];
    out.push({ kind: "heap", arr: [...a], hi: 0, hj: i, heapSize: i });
    heapify(i, 0);
  }
  out.push({ kind: "heap", arr: [...a], heapSize: 0, done: true });
  return out;
}

function bucketSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const bc = 5;
  const buckets: number[][] = Array.from({ length: bc }, () => []);
  const out: Step[] = [{ kind: "bucket", arr: [...a], buckets: buckets.map((b) => [...b]) }];
  const max = Math.max(...a);
  for (const v of a) {
    const bi = Math.min(Math.floor((v / (max + 1)) * bc), bc - 1);
    buckets[bi].push(v);
    out.push({ kind: "bucket", arr: [...a], buckets: buckets.map((b) => [...b]), activeBucket: bi });
  }
  const sorted: number[] = [];
  for (const b of buckets) { b.sort((x, y) => x - y); sorted.push(...b); }
  for (let i = 0; i < sorted.length; i++) { a[i] = sorted[i]; out.push({ kind: "bucket", arr: [...a], buckets: buckets.map((b) => [...b]) }); }
  out.push({ kind: "bucket", arr: [...a], buckets: buckets.map((b) => [...b]), done: true });
  return out;
}

function radixSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const max = Math.max(...a);
  const out: Step[] = [{ kind: "radix", arr: [...a], pass: 0 }];
  let pass = 0;
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10) {
    const count = new Array(10).fill(0);
    for (const v of a) count[Math.floor(v / exp) % 10]++;
    for (let i = 1; i < 10; i++) count[i] += count[i - 1];
    const countSnapshot = [...count];
    const output = new Array(a.length);
    const workCount = [...count];
    for (let i = a.length - 1; i >= 0; i--) {
      const d = Math.floor(a[i] / exp) % 10;
      output[--workCount[d]] = a[i];
      out.push({ kind: "radix", arr: [...a], pass, counts: [...countSnapshot], activeIdx: i });
    }
    for (let i = 0; i < a.length; i++) a[i] = output[i];
    out.push({ kind: "radix", arr: [...a], pass });
    pass++;
  }
  out.push({ kind: "radix", arr: [...a], pass, done: true });
  return out;
}

function stalinSortSteps(): Step[] {
  const a = [...SORT_INPUT];
  const kept: number[] = [a[0]];
  const out: Step[] = [{ kind: "sort", arr: [...a], keptCount: 0 }];
  for (let i = 1; i < a.length; i++) {
    const accepted = a[i] >= kept[kept.length - 1];
    const displayed = [...kept, ...a.slice(i)];
    out.push({ kind: "sort", arr: displayed, hi: kept.length, keptCount: kept.length, accepted });
    if (accepted) kept.push(a[i]);
  }
  out.push({ kind: "sort", arr: [...kept], done: true });
  return out;
}

// ── Maze step generators ──────────────────────────────────────────────────────

function mazeSteps(mode: "bfs" | "dfs"): Step[] {
  const rows = MINI_MAZE.length;
  const cols = MINI_MAZE[0].length;
  const key = (r: number, c: number) => `${r},${c}`;
  const dirs: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const visited = new Set<string>();
  const visitedList: [number, number][] = [];
  const parent = new Map<string, [number, number] | null>();
  const out: Step[] = [{ kind: "maze", row: -1, col: -1, visited: [] }];
  const startKey = key(MINI_START[0], MINI_START[1]);
  parent.set(startKey, null);

  if (mode === "bfs") {
    visited.add(startKey);
    visitedList.push([...MINI_START]);
    const queue: [number, number][] = [[...MINI_START]];
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      out.push({ kind: "maze", row: r, col: c, visited: visitedList.map((p) => [...p] as [number, number]) });
      if (r === MINI_END[0] && c === MINI_END[1]) {
        const path: [number, number][] = [];
        let cur: [number, number] | null = [r, c];
        while (cur) { path.unshift([...cur] as [number, number]); cur = parent.get(key(cur[0], cur[1])) ?? null; }
        out.push({ kind: "maze", row: -1, col: -1, visited: visitedList.map((p) => [...p] as [number, number]), path, done: true });
        return out;
      }
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        const nk = key(nr, nc);
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && MINI_MAZE[nr][nc] === 0 && !visited.has(nk)) {
          visited.add(nk); visitedList.push([nr, nc]); parent.set(nk, [r, c]); queue.push([nr, nc]);
        }
      }
    }
  } else {
    const stack: [number, number][] = [[...MINI_START]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const k = key(r, c);
      if (visited.has(k)) continue;
      visited.add(k); visitedList.push([r, c]);
      out.push({ kind: "maze", row: r, col: c, visited: visitedList.map((p) => [...p] as [number, number]) });
      if (r === MINI_END[0] && c === MINI_END[1]) {
        const path: [number, number][] = [];
        let cur: [number, number] | null = [r, c];
        while (cur) { path.unshift([...cur] as [number, number]); cur = parent.get(key(cur[0], cur[1])) ?? null; }
        out.push({ kind: "maze", row: -1, col: -1, visited: visitedList.map((p) => [...p] as [number, number]), path, done: true });
        return out;
      }
      for (const [dr, dc] of [...dirs].reverse()) {
        const nr = r + dr, nc = c + dc;
        const nk = key(nr, nc);
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && MINI_MAZE[nr][nc] === 0 && !visited.has(nk)) {
          if (!parent.has(nk)) parent.set(nk, [r, c]);
          stack.push([nr, nc]);
        }
      }
    }
  }
  out.push({ kind: "maze", row: -1, col: -1, visited: visitedList.map((p) => [...p] as [number, number]), done: true });
  return out;
}

function getSteps(id: AlgorithmId): Step[] {
  switch (id) {
    case "bubble-sort":    return bubbleSortSteps();
    case "cocktail-sort":  return cocktailSortSteps();
    case "selection-sort": return selectionSortSteps();
    case "heap-sort":      return heapSortSteps();
    case "bucket-sort":    return bucketSortSteps();
    case "radix-sort":     return radixSortSteps();
    case "stalin-sort":    return stalinSortSteps();
    case "bfs":            return mazeSteps("bfs");
    case "dfs":            return mazeSteps("dfs");
    default:               return [];
  }
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function SortBars({ step }: { step: SortStep }) {
  const max = Math.max(...step.arr, 1);
  return (
    <div className="mini-bars">
      {step.arr.map((v, i) => {
        let bg = "rgba(128,141,170,0.2)";
        if (step.done) bg = "rgba(50,215,75,0.55)";
        else if (step.keptCount !== undefined && i < step.keptCount) bg = "rgba(50,215,75,0.55)";
        else if (i === step.hi) {
          bg = step.accepted === false
            ? "rgba(255,69,58,0.75)"
            : step.accepted
              ? "rgba(50,215,75,0.75)"
              : "var(--cyan)";
        } else if (i === step.hj) bg = "var(--amber)";
        return <div key={i} className="mini-bar" style={{ height: `${(v / max) * 100}%`, background: bg }} />;
      })}
    </div>
  );
}

// Heap: dynamic binary tree matching home page layout
function miniHeapNodePos(i: number, n: number): { x: number; y: number } {
  const levels = Math.max(Math.floor(Math.log2(Math.max(n, 1))) + 1, 1);
  const level = Math.floor(Math.log2(i + 1));
  const posInLevel = i - (Math.pow(2, level) - 1);
  const totalInLevel = Math.pow(2, level);
  const x = ((posInLevel + 0.5) / totalInLevel) * 380 + 10;
  const y = 26 + (level / Math.max(levels - 1, 1)) * 150;
  return { x, y };
}

function MiniHeapView({ step }: { step: HeapStep }) {
  const n = step.arr.length;
  const hs = step.heapSize;
  const max = Math.max(...step.arr, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <svg viewBox="0 0 400 200" className="mini-graph-svg" style={{ flex: 1, minHeight: 0 }}>
        {step.arr.map((_, idx) => {
          if (idx === 0) return null;
          const parent = Math.floor((idx - 1) / 2);
          const pp = miniHeapNodePos(parent, n);
          const cp = miniHeapNodePos(idx, n);
          const inH = idx < hs;
          return (
            <line key={`e${idx}`}
              x1={pp.x} y1={pp.y} x2={cp.x} y2={cp.y}
              stroke={inH ? "rgba(100,116,139,0.4)" : "rgba(100,116,139,0.1)"}
              strokeWidth="1.5"
            />
          );
        })}
        {step.arr.map((val, idx) => {
          const p = miniHeapNodePos(idx, n);
          const inH = idx < hs;
          const isHi = idx === step.hi;
          const isHj = idx === step.hj;
          const fill = step.done
            ? "rgba(50,215,75,0.75)"
            : isHi ? "var(--cyan)"
            : isHj ? "var(--amber)"
            : inH ? "#475569" : "#1e293b";
          return (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="16" fill={fill} opacity={inH || step.done ? 1 : 0.35} />
              <text x={p.x} y={p.y + 4} textAnchor="middle"
                fill={inH || step.done ? "#020617" : "#64748b"} fontSize="11" fontWeight="700">
                {val}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mini-heap-bars">
        {step.arr.map((v, i) => {
          const inH = i < hs;
          const isActive = i === step.hi || i === step.hj;
          let bg = step.done
            ? "rgba(50,215,75,0.55)"
            : isActive ? (i === step.hi ? "var(--cyan)" : "var(--amber)")
            : inH ? "var(--cyan)" : "#334155";
          return (
            <div key={i} className="mini-bar"
              style={{ height: `${Math.max((v / max) * 100, 4)}%`, background: bg, opacity: !inH && !step.done ? 0.3 : 1 }} />
          );
        })}
      </div>
    </div>
  );
}

// Bucket: input bars + bucket grid (matches home page)
function MiniBucketView({ step }: { step: BucketStep }) {
  const max = Math.max(...step.arr, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 6 }}>
      <div className="mini-bucket-input-bars">
        {step.arr.map((v, i) => (
          <div key={i} className="mini-bar"
            style={{ height: `${Math.max((v / max) * 100, 4)}%`, background: step.done ? "rgba(50,215,75,0.55)" : "rgba(34,211,238,0.55)" }} />
        ))}
      </div>
      {!step.done && (
        <div className="mini-bucket-grid" style={{ flex: 1 }}>
          {step.buckets.map((items, bi) => {
            const isActive = bi === step.activeBucket;
            return (
              <div key={bi} className={`mini-bucket-col${isActive ? " active" : ""}`}>
                <div className="mini-bucket-items">
                  {items.map((v, j) => (
                    <div key={j} className="mini-bucket-item" style={{
                      background: isActive ? "rgba(34,211,238,0.3)" : "rgba(100,116,139,0.3)",
                      borderColor: isActive ? "rgba(34,211,238,0.2)" : "rgba(100,116,139,0.2)"
                    }}>{v}</div>
                  ))}
                </div>
                <div className="mini-bucket-label">B{bi}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Radix: bars + pass label + counts row (matches home page)
const PASS_NAMES = ["UNIDADES", "DEZENAS", "CENTENAS"];

function MiniRadixView({ step }: { step: RadixStep }) {
  const max = Math.max(...step.arr, 1);
  return (
    <div className="mini-radix-wrap">
      <div className="mini-bars" style={{ flex: 1 }}>
        {step.arr.map((v, i) => {
          const isActive = i === step.activeIdx;
          let bg = "rgba(34,211,238,0.35)";
          if (step.done) bg = "rgba(50,215,75,0.55)";
          else if (isActive) bg = "var(--amber)";
          return <div key={i} className="mini-bar" style={{ height: `${Math.max((v / max) * 100, 4)}%`, background: bg }} />;
        })}
      </div>
      {!step.done && (
        <div className="mini-radix-pass">{PASS_NAMES[step.pass] ?? `PASS ${step.pass + 1}`}</div>
      )}
      {!step.done && step.counts && (
        <div className="mini-radix-counts">
          {step.counts.slice(0, 10).map((c, d) => (
            <div key={d} className="mini-radix-cell" style={{
              background: c > 0 ? "rgba(34,211,238,0.18)" : "rgba(30,41,59,0.5)",
              borderColor: c > 0 ? "rgba(34,211,238,0.3)" : "rgba(100,116,139,0.2)"
            }}>
              <span className="mini-radix-cell-digit">{d}</span>
              <span className="mini-radix-cell-val">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Maze grid
function MiniMazeGrid({ step }: { step: MazeStep }) {
  const visitedSet = new Set(step.visited.map(([r, c]) => `${r},${c}`));
  const pathSet = step.path ? new Set(step.path.map(([r, c]) => `${r},${c}`)) : new Set<string>();
  const cols = MINI_MAZE[0].length;
  return (
    <div className="mini-maze" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {MINI_MAZE.map((row, r) =>
        row.map((cell, c) => {
          const k = `${r},${c}`;
          const isWall = cell === 1;
          const isStart = r === MINI_START[0] && c === MINI_START[1];
          const isEnd = r === MINI_END[0] && c === MINI_END[1];
          const isCurrent = !step.done && r === step.row && c === step.col;
          const isInPath = step.done && pathSet.has(k);
          const endFound = step.done && pathSet.size > 0;
          let bg: string;
          if (isWall) bg = "rgba(5,6,10,0.95)";
          else if (isStart) bg = "rgba(50,215,75,0.5)";
          else if (isEnd) bg = endFound ? "rgba(34,211,238,0.75)" : "rgba(255,69,58,0.5)";
          else if (isInPath) bg = "rgba(34,211,238,0.55)";
          else if (isCurrent) bg = "rgba(34,211,238,0.45)";
          else if (visitedSet.has(k)) bg = "rgba(255,214,10,0.18)";
          else bg = "rgba(18,22,34,0.6)";
          return <div key={k} className="mini-maze-cell" style={{ background: bg }} />;
        })
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return <svg width="13" height="15" viewBox="0 0 13 15" fill="currentColor"><polygon points="0,0 13,7.5 0,15" /></svg>;
}
function PauseIcon() {
  return <svg width="13" height="14" viewBox="0 0 13 14" fill="currentColor"><rect x="0" y="0" width="4.5" height="14" rx="1.5" /><rect x="8.5" y="0" width="4.5" height="14" rx="1.5" /></svg>;
}
function ReplayIcon() {
  return <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 7.5a6 6 0 1 0 1.2-3.6" /><polyline points="0,3 2,7.5 6.5,6" /></svg>;
}

// ── Sound frequency ───────────────────────────────────────────────────────────

function stepFrequency(step: Step): number {
  if (step.kind === "maze") return step.row < 0 ? 880 : 260 + step.row * 28 + step.col * 14;
  if (step.kind === "heap") {
    const val = step.hi !== undefined ? step.arr[step.hi] : step.arr[0];
    return 200 + ((val ?? 5) / Math.max(...step.arr, 1)) * 500;
  }
  if (step.kind === "radix") {
    const val = step.activeIdx !== undefined ? step.arr[step.activeIdx] : step.arr[5];
    return 220 + ((val ?? 5) / Math.max(...step.arr, 1)) * 460;
  }
  if (step.kind === "bucket") {
    const val = step.activeBucket !== undefined ? (step.arr[step.activeBucket] ?? 5) : 5;
    return 200 + (val / Math.max(...step.arr, 1)) * 500;
  }
  // sort
  const s = step as SortStep;
  const hi = s.hi ?? -1;
  const val = hi >= 0 ? s.arr[hi] : s.arr[Math.floor(s.arr.length / 2)];
  return 200 + ((val ?? 5) / Math.max(...s.arr, 1)) * 500;
}

// ── Main component ────────────────────────────────────────────────────────────

const STEP_MS = 85;

function getStepMs(id: AlgorithmId): number {
  if (id === "stalin-sort") return 180;
  return STEP_MS;
}

export function MiniVisualizer({ algorithmId }: { algorithmId: AlgorithmId }) {
  const stepsRef = useRef<Step[]>([]);
  const posRef = useRef(0);
  const stepMsRef = useRef(STEP_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<"idle" | "playing" | "done">("idle");

  useEffect(() => {
    stepsRef.current = getSteps(algorithmId);
    stepMsRef.current = getStepMs(algorithmId);
    posRef.current = 0;
    setStepIdx(0);
    setStatus("idle");
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [algorithmId]);

  const startFrom = useCallback((startPos: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    // Resume AudioContext before interval so the first tick finds it running
    if (typeof window !== "undefined") {
      if (!miniAudioCtx) miniAudioCtx = new AudioContext();
      if (miniAudioCtx.state === "suspended") miniAudioCtx.resume();
    }
    posRef.current = startPos;
    setStatus("playing");
    timerRef.current = setInterval(() => {
      posRef.current++;
      if (posRef.current >= stepsRef.current.length) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setStatus("done");
        return;
      }
      const s = stepsRef.current[posRef.current];
      if (s) playMiniBeep(stepFrequency(s));
      setStepIdx(posRef.current);
    }, stepMsRef.current);
  }, []);

  const play  = useCallback(() => startFrom(posRef.current), [startFrom]);
  const pause = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setStatus("idle");
  }, []);
  const replay = useCallback(() => { setStepIdx(0); startFrom(0); }, [startFrom]);

  const step = stepsRef.current[stepIdx] ?? stepsRef.current[0];
  if (!step) return null;

  let canvas: React.ReactNode;
  switch (step.kind) {
    case "heap":   canvas = <MiniHeapView   step={step as HeapStep}   />; break;
    case "bucket": canvas = <MiniBucketView step={step as BucketStep} />; break;
    case "radix":  canvas = <MiniRadixView  step={step as RadixStep}  />; break;
    case "maze":   canvas = <MiniMazeGrid   step={step as MazeStep}   />; break;
    default:       canvas = <SortBars       step={step as SortStep}   />; break;
  }

  return (
    <div className="mini-viz">
      <div className="mini-viz-canvas">{canvas}</div>
      <div className="mini-viz-controls">
        {status === "playing" ? (
          <button type="button" className="mini-play-btn" onClick={pause} aria-label="Pausar"><PauseIcon /></button>
        ) : status === "done" ? (
          <button type="button" className="mini-play-btn mini-play-btn--done" onClick={replay} aria-label="Repetir"><ReplayIcon /></button>
        ) : (
          <button type="button" className="mini-play-btn" onClick={play} aria-label="Reproduzir"><PlayIcon /></button>
        )}
      </div>
    </div>
  );
}
