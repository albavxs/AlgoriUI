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

const bfsTs = `
type Input = { nodes: string[]; edges: [string, string][]; start: string };

function adjacency(nodes: string[], edges: [string, string][]) {
  const map = new Map<string, string[]>();
  nodes.forEach((n) => map.set(n, []));
  edges.forEach(([a, b]) => {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  });
  return map;
}

async function run(input: Input) {
  const { nodes, edges, start } = input;
  const adj = adjacency(nodes, edges);
  const visited = new Set<string>();
  const queue: string[] = [start];
  const order: string[] = [];
  visited.add(start);

  emitStep({ t: "graph-start", nodes, edges, frontier: [start], visited: [], order: [], mode: "bfs" });

  while (queue.length) {
    const current = queue.shift()!;
    order.push(current);
    emitStep({
      t: "graph-state",
      nodes,
      edges,
      current,
      frontier: [...queue],
      visited: [...visited],
      order: [...order],
      mode: "bfs"
    });

    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  emitStep({ t: "done", nodes, edges, frontier: [], visited: [...visited], order: [...order], mode: "bfs" });
  return [...visited];
}
`;

const bfsJs = `
function adjacency(nodes, edges) {
  const map = new Map();
  nodes.forEach((n) => map.set(n, []));
  edges.forEach(([a, b]) => {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  });
  return map;
}

async function run(input) {
  const { nodes, edges, start } = input;
  const adj = adjacency(nodes, edges);
  const visited = new Set();
  const queue = [start];
  const order = [];
  visited.add(start);

  emitStep({ t: "graph-start", nodes, edges, frontier: [start], visited: [], order: [], mode: "bfs" });

  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    emitStep({
      t: "graph-state",
      nodes,
      edges,
      current,
      frontier: [...queue],
      visited: [...visited],
      order: [...order],
      mode: "bfs"
    });

    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  emitStep({ t: "done", nodes, edges, frontier: [], visited: [...visited], order: [...order], mode: "bfs" });
  return [...visited];
}
`;

const bfsPy = `
def adjacency(nodes, edges):
    graph = {n: [] for n in nodes}
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)
    return graph

def run(input_data):
    nodes = list(input_data["nodes"])
    edges = [tuple(e) for e in input_data["edges"]]
    start = input_data["start"]

    graph = adjacency(nodes, edges)
    visited = set([start])
    queue = [start]
    order = []

    emitStep({"t": "graph-start", "nodes": nodes, "edges": [list(e) for e in edges], "frontier": [start], "visited": [], "order": [], "mode": "bfs"})

    while queue:
        current = queue.pop(0)
        order.append(current)
        emitStep({
            "t": "graph-state",
            "nodes": nodes,
            "edges": [list(e) for e in edges],
            "current": current,
            "frontier": list(queue),
            "visited": list(visited),
            "order": list(order),
            "mode": "bfs"
        })

        for neighbor in graph.get(current, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    emitStep({"t": "done", "nodes": nodes, "edges": [list(e) for e in edges], "frontier": [], "visited": list(visited), "order": list(order), "mode": "bfs"})
    return list(visited)
`;

const dfsTs = `
type Input = { nodes: string[]; edges: [string, string][]; start: string };

function adjacency(nodes: string[], edges: [string, string][]) {
  const map = new Map<string, string[]>();
  nodes.forEach((n) => map.set(n, []));
  edges.forEach(([a, b]) => {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  });
  return map;
}

async function run(input: Input) {
  const { nodes, edges, start } = input;
  const adj = adjacency(nodes, edges);
  const visited = new Set<string>();
  const stack: string[] = [start];
  const order: string[] = [];

  emitStep({ t: "graph-start", nodes, edges, frontier: [start], visited: [], order: [], mode: "dfs" });

  while (stack.length) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);
    emitStep({
      t: "graph-state",
      nodes,
      edges,
      current,
      frontier: [...stack],
      visited: [...visited],
      order: [...order],
      mode: "dfs"
    });

    const neighbors = [...(adj.get(current) ?? [])].reverse();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  emitStep({ t: "done", nodes, edges, frontier: [], visited: [...visited], order: [...order], mode: "dfs" });
  return [...visited];
}
`;

const dfsJs = `
function adjacency(nodes, edges) {
  const map = new Map();
  nodes.forEach((n) => map.set(n, []));
  edges.forEach(([a, b]) => {
    map.get(a)?.push(b);
    map.get(b)?.push(a);
  });
  return map;
}

async function run(input) {
  const { nodes, edges, start } = input;
  const adj = adjacency(nodes, edges);
  const visited = new Set();
  const stack = [start];
  const order = [];

  emitStep({ t: "graph-start", nodes, edges, frontier: [start], visited: [], order: [], mode: "dfs" });

  while (stack.length) {
    const current = stack.pop();
    if (visited.has(current)) continue;

    visited.add(current);
    order.push(current);
    emitStep({
      t: "graph-state",
      nodes,
      edges,
      current,
      frontier: [...stack],
      visited: [...visited],
      order: [...order],
      mode: "dfs"
    });

    const neighbors = [...(adj.get(current) ?? [])].reverse();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  emitStep({ t: "done", nodes, edges, frontier: [], visited: [...visited], order: [...order], mode: "dfs" });
  return [...visited];
}
`;

const dfsPy = `
def adjacency(nodes, edges):
    graph = {n: [] for n in nodes}
    for a, b in edges:
        graph[a].append(b)
        graph[b].append(a)
    return graph

def run(input_data):
    nodes = list(input_data["nodes"])
    edges = [tuple(e) for e in input_data["edges"]]
    start = input_data["start"]

    graph = adjacency(nodes, edges)
    visited = set()
    stack = [start]
    order = []

    emitStep({"t": "graph-start", "nodes": nodes, "edges": [list(e) for e in edges], "frontier": [start], "visited": [], "order": [], "mode": "dfs"})

    while stack:
        current = stack.pop()
        if current in visited:
            continue

        visited.add(current)
        order.append(current)
        emitStep({
            "t": "graph-state",
            "nodes": nodes,
            "edges": [list(e) for e in edges],
            "current": current,
            "frontier": list(stack),
            "visited": list(visited),
            "order": list(order),
            "mode": "dfs"
        })

        neighbors = list(graph.get(current, []))
        neighbors.reverse()
        for neighbor in neighbors:
            if neighbor not in visited:
                stack.append(neighbor)

    emitStep({"t": "done", "nodes": nodes, "edges": [list(e) for e in edges], "frontier": [], "visited": list(visited), "order": list(order), "mode": "dfs"})
    return list(visited)
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
    id: "bfs",
    category: "graph",
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
      nodes: ["A", "B", "C", "D", "E", "F"],
      edges: [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["B", "E"],
        ["C", "F"]
      ],
      start: "A"
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
      nodes: ["A", "B", "C", "D", "E", "F"],
      edges: [
        ["A", "B"],
        ["A", "C"],
        ["B", "D"],
        ["B", "E"],
        ["C", "F"]
      ],
      start: "A"
    },
    templates: {
      ts: dfsTs,
      js: dfsJs,
      python: dfsPy
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
