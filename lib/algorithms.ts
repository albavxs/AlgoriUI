import type { AlgorithmDefinition, AlgorithmId, CodeProject, Language, ProjectFile } from "@/lib/types";

const bubbleTs = `
function emitArray(arr: number[], meta: Record<string, unknown> = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input: number[]) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      emitArray(arr, { t: "compare", i: j, j: j + 1 });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        emitArray(arr, { t: "swap", i: j, j: j + 1 });
      }
    }
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`;

const bubbleJs = `
function emitArray(arr, meta = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      emitArray(arr, { t: "compare", i: j, j: j + 1 });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        emitArray(arr, { t: "swap", i: j, j: j + 1 });
      }
    }
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`;

const bubblePy = `
def emit_array(arr, meta=None):
    meta = meta or {}
    event = {"t": "array", "arr": list(arr)}
    event.update(meta)
    emitStep(event)

def run(input_data):
    arr = list(input_data)
    emit_array(arr, {"phase": "start"})

    for i in range(len(arr)):
        for j in range(0, len(arr) - i - 1):
            emit_array(arr, {"t": "compare", "i": j, "j": j + 1})
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                emit_array(arr, {"t": "swap", "i": j, "j": j + 1})

    emit_array(arr, {"t": "done"})
    return arr
`;

const stalinTs = `
async function run(input: number[]) {
  const arr = [...input];
  const kept: number[] = [];

  if (arr.length === 0) {
    emitStep({ t: "done", arr: [] });
    return [];
  }

  emitStep({ t: "stalin-start", arr: [...arr], kept: [] });
  let maxSoFar = -Infinity;

  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    const accepted = value >= maxSoFar;

    emitStep({
      t: "stalin-step",
      arr: [...arr],
      kept: [...kept],
      i,
      value,
      maxSoFar,
      accepted
    });

    if (accepted) {
      kept.push(value);
      maxSoFar = value;
    }
  }

  emitStep({ t: "done", arr: [...kept], kept: [...kept] });
  return kept;
}
`;

const stalinJs = `
async function run(input) {
  const arr = [...input];
  const kept = [];

  if (arr.length === 0) {
    emitStep({ t: "done", arr: [] });
    return [];
  }

  emitStep({ t: "stalin-start", arr: [...arr], kept: [] });
  let maxSoFar = -Infinity;

  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    const accepted = value >= maxSoFar;

    emitStep({
      t: "stalin-step",
      arr: [...arr],
      kept: [...kept],
      i,
      value,
      maxSoFar,
      accepted
    });

    if (accepted) {
      kept.push(value);
      maxSoFar = value;
    }
  }

  emitStep({ t: "done", arr: [...kept], kept: [...kept] });
  return kept;
}
`;

const stalinPy = `
def run(input_data):
    arr = list(input_data)
    kept = []

    if len(arr) == 0:
        emitStep({"t": "done", "arr": []})
        return []

    emitStep({"t": "stalin-start", "arr": list(arr), "kept": []})
    max_so_far = float("-inf")

    for i, value in enumerate(arr):
        accepted = value >= max_so_far
        emitStep({
            "t": "stalin-step",
            "arr": list(arr),
            "kept": list(kept),
            "i": i,
            "value": value,
            "maxSoFar": max_so_far,
            "accepted": accepted
        })

        if accepted:
            kept.append(value)
            max_so_far = value

    emitStep({"t": "done", "arr": list(kept), "kept": list(kept)})
    return kept
`;

const selectionTs = `
function emitArray(arr: number[], meta: Record<string, unknown> = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input: number[]) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  for (let i = 0; i < arr.length; i++) {
    let minIndex = i;

    for (let j = i + 1; j < arr.length; j++) {
      emitArray(arr, { t: "compare", i: minIndex, j });
      if (arr[j] < arr[minIndex]) {
        minIndex = j;
      }
    }

    if (minIndex !== i) {
      [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
      emitArray(arr, { t: "swap", i, j: minIndex });
    }
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`;

const selectionJs = `
function emitArray(arr, meta = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  for (let i = 0; i < arr.length; i++) {
    let minIndex = i;

    for (let j = i + 1; j < arr.length; j++) {
      emitArray(arr, { t: "compare", i: minIndex, j });
      if (arr[j] < arr[minIndex]) {
        minIndex = j;
      }
    }

    if (minIndex !== i) {
      [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
      emitArray(arr, { t: "swap", i, j: minIndex });
    }
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`;

const selectionPy = `
def emit_array(arr, meta=None):
    meta = meta or {}
    event = {"t": "array", "arr": list(arr)}
    event.update(meta)
    emitStep(event)

def run(input_data):
    arr = list(input_data)
    emit_array(arr, {"phase": "start"})

    for i in range(len(arr)):
        min_index = i

        for j in range(i + 1, len(arr)):
            emit_array(arr, {"t": "compare", "i": min_index, "j": j})
            if arr[j] < arr[min_index]:
                min_index = j

        if min_index != i:
            arr[i], arr[min_index] = arr[min_index], arr[i]
            emit_array(arr, {"t": "swap", "i": i, "j": min_index})

    emit_array(arr, {"t": "done"})
    return arr
`;

const customTs = `
function run(input: unknown) {
  return input;
}
`;

const customJs = `
function run(input) {
  return input;
}
`;

const customPy = `
def run(input_data):
    return input_data
`;

const bfsTs = `
type Grid = number[][];
type Pos = [number, number];
type Input = { grid: Grid; start: Pos; end: Pos };

async function run(input: Input) {
  const { grid, start, end } = input;
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r: number, c: number) => \`\${r},\${c}\`;
  const dirs: Pos[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  emitStep({ t: "maze-start", grid, start, end });

  const visited = new Set<string>([key(start[0], start[1])]);
  const queue: Pos[] = [[...start] as Pos];
  const parent = new Map<string, Pos | null>([[key(start[0], start[1]), null]]);
  const visitedList: Pos[] = [[...start] as Pos];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    emitStep({ t: "maze-visit", row: r, col: c, visited: visitedList.map((p) => [...p]) });

    if (r === end[0] && c === end[1]) {
      const path: Pos[] = [];
      let cur: Pos | null = [r, c];
      while (cur !== null) {
        path.unshift([...cur] as Pos);
        cur = parent.get(key(cur[0], cur[1])) ?? null;
      }
      emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path, found: true });
      return path;
    }

    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
        grid[nr][nc] === 0 && !visited.has(key(nr, nc))
      ) {
        visited.add(key(nr, nc));
        visitedList.push([nr, nc]);
        parent.set(key(nr, nc), [r, c]);
        queue.push([nr, nc]);
      }
    }
  }

  emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path: [], found: false });
  return [];
}
`;

const bfsJs = `
async function run(input) {
  const { grid, start, end } = input;
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r, c) => \`\${r},\${c}\`;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  emitStep({ t: "maze-start", grid, start, end });

  const visited = new Set([key(start[0], start[1])]);
  const queue = [[...start]];
  const parent = new Map([[key(start[0], start[1]), null]]);
  const visitedList = [[...start]];

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    emitStep({ t: "maze-visit", row: r, col: c, visited: visitedList.map((p) => [...p]) });

    if (r === end[0] && c === end[1]) {
      const path = [];
      let cur = [r, c];
      while (cur !== null) {
        path.unshift([...cur]);
        cur = parent.get(key(cur[0], cur[1])) ?? null;
      }
      emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path, found: true });
      return path;
    }

    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
        grid[nr][nc] === 0 && !visited.has(key(nr, nc))
      ) {
        visited.add(key(nr, nc));
        visitedList.push([nr, nc]);
        parent.set(key(nr, nc), [r, c]);
        queue.push([nr, nc]);
      }
    }
  }

  emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path: [], found: false });
  return [];
}
`;

const bfsPy = `
from collections import deque

def run(input_data):
    grid = input_data["grid"]
    start = tuple(input_data["start"])
    end = tuple(input_data["end"])
    rows = len(grid)
    cols = len(grid[0])
    dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]

    emitStep({"t": "maze-start", "grid": grid, "start": list(start), "end": list(end)})

    visited = {start}
    queue = deque([start])
    parent = {start: None}
    visited_list = [list(start)]

    while queue:
        r, c = queue.popleft()
        emitStep({"t": "maze-visit", "row": r, "col": c, "visited": [list(p) for p in visited_list]})

        if (r, c) == end:
            path = []
            cur = (r, c)
            while cur is not None:
                path.insert(0, list(cur))
                cur = parent[cur]
            emitStep({"t": "done", "visited": [list(p) for p in visited_list], "path": path, "found": True})
            return path

        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0 and (nr, nc) not in visited:
                visited.add((nr, nc))
                visited_list.append([nr, nc])
                parent[(nr, nc)] = (r, c)
                queue.append((nr, nc))

    emitStep({"t": "done", "visited": [list(p) for p in visited_list], "path": [], "found": False})
    return []
`;

const dfsTs = `
type Grid = number[][];
type Pos = [number, number];
type Input = { grid: Grid; start: Pos; end: Pos };

async function run(input: Input) {
  const { grid, start, end } = input;
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r: number, c: number) => \`\${r},\${c}\`;
  const dirs: Pos[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  emitStep({ t: "maze-start", grid, start, end });

  const visited = new Set<string>();
  const visitedList: Pos[] = [];
  const parent = new Map<string, Pos | null>();

  const stack: Pos[] = [[...start] as Pos];
  parent.set(key(start[0], start[1]), null);

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (visited.has(key(r, c))) continue;

    visited.add(key(r, c));
    visitedList.push([r, c]);
    emitStep({ t: "maze-visit", row: r, col: c, visited: visitedList.map((p) => [...p]) });

    if (r === end[0] && c === end[1]) {
      const path: Pos[] = [];
      let cur: Pos | null = [r, c];
      while (cur !== null) {
        path.unshift([...cur] as Pos);
        cur = parent.get(key(cur[0], cur[1])) ?? null;
      }
      emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path, found: true });
      return path;
    }

    for (const [dr, dc] of [...dirs].reverse()) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
        grid[nr][nc] === 0 && !visited.has(key(nr, nc))
      ) {
        if (!parent.has(key(nr, nc))) parent.set(key(nr, nc), [r, c]);
        stack.push([nr, nc]);
      }
    }
  }

  emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path: [], found: false });
  return [];
}
`;

const dfsJs = `
async function run(input) {
  const { grid, start, end } = input;
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (r, c) => \`\${r},\${c}\`;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  emitStep({ t: "maze-start", grid, start, end });

  const visited = new Set();
  const visitedList = [];
  const parent = new Map();

  const stack = [[...start]];
  parent.set(key(start[0], start[1]), null);

  while (stack.length > 0) {
    const [r, c] = stack.pop();
    if (visited.has(key(r, c))) continue;

    visited.add(key(r, c));
    visitedList.push([r, c]);
    emitStep({ t: "maze-visit", row: r, col: c, visited: visitedList.map((p) => [...p]) });

    if (r === end[0] && c === end[1]) {
      const path = [];
      let cur = [r, c];
      while (cur !== null) {
        path.unshift([...cur]);
        cur = parent.get(key(cur[0], cur[1])) ?? null;
      }
      emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path, found: true });
      return path;
    }

    for (const [dr, dc] of [...dirs].reverse()) {
      const nr = r + dr, nc = c + dc;
      if (
        nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
        grid[nr][nc] === 0 && !visited.has(key(nr, nc))
      ) {
        if (!parent.has(key(nr, nc))) parent.set(key(nr, nc), [r, c]);
        stack.push([nr, nc]);
      }
    }
  }

  emitStep({ t: "done", visited: visitedList.map((p) => [...p]), path: [], found: false });
  return [];
}
`;

const dfsPy = `
def run(input_data):
    grid = input_data["grid"]
    start = tuple(input_data["start"])
    end = tuple(input_data["end"])
    rows = len(grid)
    cols = len(grid[0])
    dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]

    emitStep({"t": "maze-start", "grid": grid, "start": list(start), "end": list(end)})

    visited = set()
    visited_list = []
    parent = {start: None}
    stack = [start]

    while stack:
        r, c = stack.pop()
        if (r, c) in visited:
            continue

        visited.add((r, c))
        visited_list.append([r, c])
        emitStep({"t": "maze-visit", "row": r, "col": c, "visited": [list(p) for p in visited_list]})

        if (r, c) == end:
            path = []
            cur = (r, c)
            while cur is not None:
                path.insert(0, list(cur))
                cur = parent.get(cur)
            emitStep({"t": "done", "visited": [list(p) for p in visited_list], "path": path, "found": True})
            return path

        for dr, dc in reversed(dirs):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 0 and (nr, nc) not in visited:
                if (nr, nc) not in parent:
                    parent[(nr, nc)] = (r, c)
                stack.append((nr, nc))

    emitStep({"t": "done", "visited": [list(p) for p in visited_list], "path": [], "found": False})
    return []
`;

export const algorithms: AlgorithmDefinition[] = [
  {
    id: "bubble-sort",
    category: "sorting",
    title: {
      pt: "Bubble Sort",
      en: "Bubble Sort"
    },
    subtitle: {
      pt: "Compara pares adjacentes e troca quando necessário.",
      en: "Compares adjacent pairs and swaps when needed."
    },
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [6, 1, 9, 3, 4, 2, 8, 7, 5],
    templates: {
      ts: bubbleTs,
      js: bubbleJs,
      python: bubblePy
    }
  },
  {
    id: "stalin-sort",
    category: "sorting",
    title: {
      pt: "Stalin Sort",
      en: "Stalin Sort"
    },
    subtitle: {
      pt: "Mantém apenas o prefixo não decrescente.",
      en: "Keeps only the non-decreasing prefix."
    },
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: [1, 2, 3, 7, 5, 6, 9, 4, 10],
    templates: {
      ts: stalinTs,
      js: stalinJs,
      python: stalinPy
    }
  },
  {
    id: "selection-sort",
    category: "sorting",
    title: {
      pt: "Selection Sort",
      en: "Selection Sort"
    },
    subtitle: {
      pt: "Seleciona o menor restante e leva para a frente.",
      en: "Selects the smallest remaining value and moves it forward."
    },
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [9, 4, 7, 1, 6, 3, 8, 2, 5],
    templates: {
      ts: selectionTs,
      js: selectionJs,
      python: selectionPy
    }
  },
  {
    id: "custom",
    category: "sorting",
    title: {
      pt: "Algoritmo Custom",
      en: "Custom Algorithm"
    },
    subtitle: {
      pt: "Comece com um template minimo e emita seus proprios eventos.",
      en: "Start from a minimal template and emit your own events."
    },
    complexity: { time: "—", space: "—" },
    defaultInput: [6, 2, 9, 1, 7, 3],
    templates: {
      ts: customTs,
      js: customJs,
      python: customPy
    }
  },
  {
    id: "bfs",
    category: "graph",
    visualizer: "maze" as const,
    title: {
      pt: "Busca em Largura (BFS)",
      en: "Breadth-First Search (BFS)"
    },
    subtitle: {
      pt: "Explora por níveis usando fila.",
      en: "Explores by levels using a queue."
    },
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
      grid: [
        [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0],
        [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0],
        [0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0]
      ],
      start: [0, 0],
      end: [8, 10]
    },
    templates: {
      ts: bfsTs,
      js: bfsJs,
      python: bfsPy
    }
  },
  {
    id: "dfs",
    category: "graph",
    visualizer: "maze" as const,
    title: {
      pt: "Busca em Profundidade (DFS)",
      en: "Depth-First Search (DFS)"
    },
    subtitle: {
      pt: "Explora em profundidade com pilha.",
      en: "Explores depth-first with a stack."
    },
    complexity: { time: "O(V + E)", space: "O(V)" },
    defaultInput: {
      grid: [
        [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        [1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0],
        [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0],
        [0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0]
      ],
      start: [0, 0],
      end: [8, 10]
    },
    templates: {
      ts: dfsTs,
      js: dfsJs,
      python: dfsPy
    }
  },
  {
    id: "cocktail-sort",
    category: "sorting",
    title: { pt: "Cocktail Sort", en: "Cocktail Sort" },
    subtitle: {
      pt: "Bubble Sort bidirecional: varre da esquerda para direita, depois de volta.",
      en: "Bidirectional Bubble Sort: sweeps left-to-right, then right-to-left."
    },
    complexity: { time: "O(n²)", space: "O(1)" },
    defaultInput: [64, 34, 25, 12, 22, 11, 90],
    templates: {
      ts: `
function emitArray(arr: number[], meta: Record<string, unknown> = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input: number[]) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  let start = 0;
  let end = arr.length - 1;
  let swapped = true;

  while (swapped) {
    swapped = false;
    for (let i = start; i < end; i++) {
      emitArray(arr, { t: "compare", i, j: i + 1 });
      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        emitArray(arr, { t: "swap", i, j: i + 1 });
        swapped = true;
      }
    }
    if (!swapped) break;
    swapped = false;
    end--;
    for (let i = end - 1; i >= start; i--) {
      emitArray(arr, { t: "compare", i, j: i + 1 });
      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        emitArray(arr, { t: "swap", i, j: i + 1 });
        swapped = true;
      }
    }
    start++;
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`,
      js: `
function emitArray(arr, meta = {}) {
  emitStep({ t: "array", arr: [...arr], ...meta });
}

async function run(input) {
  const arr = [...input];
  emitArray(arr, { phase: "start" });

  let start = 0;
  let end = arr.length - 1;
  let swapped = true;

  while (swapped) {
    swapped = false;
    for (let i = start; i < end; i++) {
      emitArray(arr, { t: "compare", i, j: i + 1 });
      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        emitArray(arr, { t: "swap", i, j: i + 1 });
        swapped = true;
      }
    }
    if (!swapped) break;
    swapped = false;
    end--;
    for (let i = end - 1; i >= start; i--) {
      emitArray(arr, { t: "compare", i, j: i + 1 });
      if (arr[i] > arr[i + 1]) {
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        emitArray(arr, { t: "swap", i, j: i + 1 });
        swapped = true;
      }
    }
    start++;
  }

  emitArray(arr, { t: "done" });
  return arr;
}
`,
      python: `
def emit_array(arr, meta=None):
    meta = meta or {}
    event = {"t": "array", "arr": list(arr)}
    event.update(meta)
    emitStep(event)

def run(input_data):
    arr = list(input_data)
    emit_array(arr, {"phase": "start"})

    start = 0
    end = len(arr) - 1
    swapped = True

    while swapped:
        swapped = False
        for i in range(start, end):
            emit_array(arr, {"t": "compare", "i": i, "j": i + 1})
            if arr[i] > arr[i + 1]:
                arr[i], arr[i + 1] = arr[i + 1], arr[i]
                emit_array(arr, {"t": "swap", "i": i, "j": i + 1})
                swapped = True
        if not swapped:
            break
        swapped = False
        end -= 1
        for i in range(end - 1, start - 1, -1):
            emit_array(arr, {"t": "compare", "i": i, "j": i + 1})
            if arr[i] > arr[i + 1]:
                arr[i], arr[i + 1] = arr[i + 1], arr[i]
                emit_array(arr, {"t": "swap", "i": i, "j": i + 1})
                swapped = True
        start += 1

    emit_array(arr, {"t": "done"})
    return arr
`
    }
  },
  {
    id: "heap-sort",
    category: "sorting",
    visualizer: "heap",
    title: { pt: "Heap Sort", en: "Heap Sort" },
    subtitle: {
      pt: "Constrói um Max-Heap e extrai o maior elemento repetidamente.",
      en: "Builds a Max-Heap and repeatedly extracts the maximum element."
    },
    complexity: { time: "O(n log n)", space: "O(1)" },
    defaultInput: [4, 10, 3, 5, 1, 7, 9, 2, 6, 8],
    templates: {
      ts: `
function heapify(arr: number[], n: number, i: number): void {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;
  if (left < n && arr[left] > arr[largest]) largest = left;
  if (right < n && arr[right] > arr[largest]) largest = right;
  if (largest !== i) {
    emitStep({ t: "heapify", arr: [...arr], i, j: largest, heapSize: n });
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    emitStep({ t: "swap", arr: [...arr], i, j: largest, heapSize: n });
    heapify(arr, n, largest);
  }
}

async function run(input: number[]) {
  const arr = Array.isArray(input) ? [...input] : [];
  const n = arr.length;
  emitStep({ t: "array", arr: [...arr], heapSize: n });

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(arr, n, i);
  }

  for (let i = n - 1; i > 0; i--) {
    emitStep({ t: "swap", arr: [...arr], i: 0, j: i, heapSize: i + 1 });
    [arr[0], arr[i]] = [arr[i], arr[0]];
    emitStep({ t: "extract", arr: [...arr], i: 0, j: i, heapSize: i });
    heapify(arr, i, 0);
  }

  emitStep({ t: "done", arr: [...arr], heapSize: 0 });
  return arr;
}
`,
      js: `
function heapify(arr, n, i) {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;
  if (left < n && arr[left] > arr[largest]) largest = left;
  if (right < n && arr[right] > arr[largest]) largest = right;
  if (largest !== i) {
    emitStep({ t: "heapify", arr: [...arr], i, j: largest, heapSize: n });
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    emitStep({ t: "swap", arr: [...arr], i, j: largest, heapSize: n });
    heapify(arr, n, largest);
  }
}

async function run(input) {
  const arr = Array.isArray(input) ? [...input] : [];
  const n = arr.length;
  emitStep({ t: "array", arr: [...arr], heapSize: n });

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(arr, n, i);
  }

  for (let i = n - 1; i > 0; i--) {
    emitStep({ t: "swap", arr: [...arr], i: 0, j: i, heapSize: i + 1 });
    [arr[0], arr[i]] = [arr[i], arr[0]];
    emitStep({ t: "extract", arr: [...arr], i: 0, j: i, heapSize: i });
    heapify(arr, i, 0);
  }

  emitStep({ t: "done", arr: [...arr], heapSize: 0 });
  return arr;
}
`,
      python: `
def heapify(arr, n, i):
    largest = i
    left = 2 * i + 1
    right = 2 * i + 2
    if left < n and arr[left] > arr[largest]:
        largest = left
    if right < n and arr[right] > arr[largest]:
        largest = right
    if largest != i:
        emitStep({"t": "heapify", "arr": list(arr), "i": i, "j": largest, "heapSize": n})
        arr[i], arr[largest] = arr[largest], arr[i]
        emitStep({"t": "swap", "arr": list(arr), "i": i, "j": largest, "heapSize": n})
        heapify(arr, n, largest)

def run(input_data):
    arr = list(input_data) if hasattr(input_data, '__iter__') else []
    n = len(arr)
    emitStep({"t": "array", "arr": list(arr), "heapSize": n})

    for i in range(n // 2 - 1, -1, -1):
        heapify(arr, n, i)

    for i in range(n - 1, 0, -1):
        emitStep({"t": "swap", "arr": list(arr), "i": 0, "j": i, "heapSize": i + 1})
        arr[0], arr[i] = arr[i], arr[0]
        emitStep({"t": "extract", "arr": list(arr), "i": 0, "j": i, "heapSize": i})
        heapify(arr, i, 0)

    emitStep({"t": "done", "arr": list(arr), "heapSize": 0})
    return arr
`
    }
  },
  {
    id: "bucket-sort",
    category: "sorting",
    visualizer: "bucket",
    title: { pt: "Bucket Sort", en: "Bucket Sort" },
    subtitle: {
      pt: "Distribui valores em baldes, ordena cada balde e concatena.",
      en: "Distributes values into buckets, sorts each, then concatenates."
    },
    complexity: { time: "O(n+k) médio", space: "O(n+k)" },
    defaultInput: [42, 17, 83, 5, 61, 29, 74, 8, 53, 36],
    templates: {
      ts: `
async function run(input: number[]) {
  const arr = [...input];
  const n = arr.length;
  if (n === 0) { emitStep({ t: "done", arr: [], buckets: [] }); return []; }

  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const bucketCount = 5;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  emitStep({ t: "array", arr: [...arr], buckets: buckets.map(b => [...b]) });

  for (let k = 0; k < arr.length; k++) {
    const val = arr[k];
    const idx = max === min ? 0 : Math.min(
      Math.floor(((val - min) / (max - min)) * bucketCount),
      bucketCount - 1
    );
    buckets[idx].push(val);
    emitStep({ t: "distribute", arr: [...arr], buckets: buckets.map(b => [...b]), activeItem: val, activeBucket: idx });
  }

  for (let b = 0; b < bucketCount; b++) {
    buckets[b].sort((a, c) => a - c);
    emitStep({ t: "sort", arr: [...arr], buckets: buckets.map(bk => [...bk]), activeBucket: b });
  }

  let writeIdx = 0;
  for (let b = 0; b < bucketCount; b++) {
    for (const val of buckets[b]) {
      arr[writeIdx++] = val;
      emitStep({ t: "merge", arr: [...arr], buckets: buckets.map(bk => [...bk]), activeBucket: b, activeItem: val });
    }
  }

  emitStep({ t: "done", arr: [...arr], buckets: [] });
  return arr;
}
`,
      js: `
async function run(input) {
  const arr = [...input];
  const n = arr.length;
  if (n === 0) { emitStep({ t: "done", arr: [], buckets: [] }); return []; }

  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const bucketCount = 5;
  const buckets = Array.from({ length: bucketCount }, () => []);

  emitStep({ t: "array", arr: [...arr], buckets: buckets.map(b => [...b]) });

  for (let k = 0; k < arr.length; k++) {
    const val = arr[k];
    const idx = max === min ? 0 : Math.min(
      Math.floor(((val - min) / (max - min)) * bucketCount),
      bucketCount - 1
    );
    buckets[idx].push(val);
    emitStep({ t: "distribute", arr: [...arr], buckets: buckets.map(b => [...b]), activeItem: val, activeBucket: idx });
  }

  for (let b = 0; b < bucketCount; b++) {
    buckets[b].sort((a, c) => a - c);
    emitStep({ t: "sort", arr: [...arr], buckets: buckets.map(bk => [...bk]), activeBucket: b });
  }

  let writeIdx = 0;
  for (let b = 0; b < bucketCount; b++) {
    for (const val of buckets[b]) {
      arr[writeIdx++] = val;
      emitStep({ t: "merge", arr: [...arr], buckets: buckets.map(bk => [...bk]), activeBucket: b, activeItem: val });
    }
  }

  emitStep({ t: "done", arr: [...arr], buckets: [] });
  return arr;
}
`,
      python: `
def run(input_data):
    arr = list(input_data)
    n = len(arr)
    if n == 0:
        emitStep({"t": "done", "arr": [], "buckets": []})
        return []

    min_val = min(arr)
    max_val = max(arr)
    bucket_count = 5
    buckets = [[] for _ in range(bucket_count)]

    emitStep({"t": "array", "arr": list(arr), "buckets": [list(b) for b in buckets]})

    for val in arr:
        if max_val == min_val:
            idx = 0
        else:
            idx = min(int(((val - min_val) / (max_val - min_val)) * bucket_count), bucket_count - 1)
        buckets[idx].append(val)
        emitStep({"t": "distribute", "arr": list(arr), "buckets": [list(b) for b in buckets], "activeItem": val, "activeBucket": idx})

    for b in range(bucket_count):
        buckets[b].sort()
        emitStep({"t": "sort", "arr": list(arr), "buckets": [list(bk) for bk in buckets], "activeBucket": b})

    write_idx = 0
    for b in range(bucket_count):
        for val in buckets[b]:
            arr[write_idx] = val
            write_idx += 1
            emitStep({"t": "merge", "arr": list(arr), "buckets": [list(bk) for bk in buckets], "activeBucket": b, "activeItem": val})

    emitStep({"t": "done", "arr": list(arr), "buckets": []})
    return arr
`
    }
  },
  {
    id: "radix-sort",
    category: "sorting",
    visualizer: "radix",
    title: { pt: "Radix Sort", en: "Radix Sort" },
    subtitle: {
      pt: "Ordena dígito por dígito, do menos significativo ao mais.",
      en: "Sorts digit by digit, from least to most significant."
    },
    complexity: { time: "O(d·(n+k))", space: "O(n+k)" },
    defaultInput: [392, 132, 263, 174, 436, 307, 348, 219],
    templates: {
      ts: `
async function run(input: number[]) {
  const arr = [...input];
  if (arr.length === 0) { emitStep({ t: "done", arr: [], digit: 0 }); return []; }

  const max = Math.max(...arr);
  emitStep({ t: "array", arr: [...arr], digit: 0 });

  let digit = 0;
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10, digit++) {
    const output = new Array(arr.length).fill(0);
    const counts = new Array(10).fill(0);

    for (let k = 0; k < arr.length; k++) {
      const d = Math.floor(arr[k] / exp) % 10;
      counts[d]++;
      emitStep({ t: "counting", arr: [...arr], digit, counts: [...counts], output: [...output], activeIdx: k });
    }

    for (let d = 1; d < 10; d++) {
      counts[d] += counts[d - 1];
    }

    for (let k = arr.length - 1; k >= 0; k--) {
      const d = Math.floor(arr[k] / exp) % 10;
      output[--counts[d]] = arr[k];
      emitStep({ t: "placing", arr: [...arr], digit, counts: [...counts], output: [...output], activeIdx: k });
    }

    for (let k = 0; k < arr.length; k++) arr[k] = output[k];
  }

  emitStep({ t: "done", arr: [...arr], digit });
  return arr;
}
`,
      js: `
async function run(input) {
  const arr = [...input];
  if (arr.length === 0) { emitStep({ t: "done", arr: [], digit: 0 }); return []; }

  const max = Math.max(...arr);
  emitStep({ t: "array", arr: [...arr], digit: 0 });

  let digit = 0;
  for (let exp = 1; Math.floor(max / exp) > 0; exp *= 10, digit++) {
    const output = new Array(arr.length).fill(0);
    const counts = new Array(10).fill(0);

    for (let k = 0; k < arr.length; k++) {
      const d = Math.floor(arr[k] / exp) % 10;
      counts[d]++;
      emitStep({ t: "counting", arr: [...arr], digit, counts: [...counts], output: [...output], activeIdx: k });
    }

    for (let d = 1; d < 10; d++) {
      counts[d] += counts[d - 1];
    }

    for (let k = arr.length - 1; k >= 0; k--) {
      const d = Math.floor(arr[k] / exp) % 10;
      output[--counts[d]] = arr[k];
      emitStep({ t: "placing", arr: [...arr], digit, counts: [...counts], output: [...output], activeIdx: k });
    }

    for (let k = 0; k < arr.length; k++) arr[k] = output[k];
  }

  emitStep({ t: "done", arr: [...arr], digit });
  return arr;
}
`,
      python: `
def run(input_data):
    arr = list(input_data)
    if not arr:
        emitStep({"t": "done", "arr": [], "digit": 0})
        return []

    max_val = max(arr)
    emitStep({"t": "array", "arr": list(arr), "digit": 0})

    exp = 1
    digit = 0
    while max_val // exp > 0:
        output = [0] * len(arr)
        counts = [0] * 10

        for k in range(len(arr)):
            d = (arr[k] // exp) % 10
            counts[d] += 1
            emitStep({"t": "counting", "arr": list(arr), "digit": digit, "counts": list(counts), "output": list(output), "activeIdx": k})

        for d in range(1, 10):
            counts[d] += counts[d - 1]

        for k in range(len(arr) - 1, -1, -1):
            d = (arr[k] // exp) % 10
            counts[d] -= 1
            output[counts[d]] = arr[k]
            emitStep({"t": "placing", "arr": list(arr), "digit": digit, "counts": list(counts), "output": list(output), "activeIdx": k})

        for k in range(len(arr)):
            arr[k] = output[k]

        exp *= 10
        digit += 1

    emitStep({"t": "done", "arr": list(arr), "digit": digit})
    return arr
`
    }
  }
];

export const languageLabel: Record<Language, string> = {
  ts: "TypeScript",
  js: "JavaScript",
  python: "Python"
};

export function canonicalAlgorithmId(id: string): AlgorithmId {
  if (id === "binary-search") {
    return "selection-sort";
  }

  return (algorithms.find((algorithm) => algorithm.id === id)?.id ?? algorithms[0].id) as AlgorithmId;
}

export function algorithmById(id: AlgorithmId): AlgorithmDefinition {
  return algorithms.find((algorithm) => algorithm.id === id) ?? algorithms[0];
}

export function defaultInputText(id: AlgorithmId): string {
  if (id === "custom") {
    return "";
  }

  const found = algorithmById(id);
  return JSON.stringify(found.defaultInput, null, 2);
}

function algorithmFileStem(id: AlgorithmId): string {
  return id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function legacyEntrypointForLanguage(language: Language): string {
  if (language === "python") {
    return "main.py";
  }

  if (language === "js") {
    return "main.js";
  }

  return "main.ts";
}

export function fileExtensionForLanguage(language: Language): string {
  if (language === "python") {
    return ".py";
  }

  if (language === "js") {
    return ".js";
  }

  return ".ts";
}

export function entrypointForLanguage(id: AlgorithmId, language: Language): string {
  return `${algorithmFileStem(id)}${fileExtensionForLanguage(language)}`;
}

export function createProjectFromTemplate(id: AlgorithmId, language: Language): CodeProject {
  const entrypoint = entrypointForLanguage(id, language);
  const file: ProjectFile = {
    id: `${id}-${language}-entrypoint`,
    name: entrypoint,
    content: algorithmById(id).templates[language].trimStart()
  };

  return {
    files: [file],
    activeFileId: file.id,
    entrypoint
  };
}
