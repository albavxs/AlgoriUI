import ts from "typescript";
import { z } from "zod";

import { runInWorker } from "@/lib/runtime/worker-client";
import type { ExecutionRequest, ExecutionResult, ProjectFile, TraceEvent } from "@/lib/types";

const traceEventSchema = z
  .object({
    t: z.string()
  })
  .catchall(z.unknown());

function sanitizeEvents(events: unknown): TraceEvent[] {
  if (!Array.isArray(events)) {
    return [];
  }

  const safeEvents = events
    .map((event) => traceEventSchema.safeParse(event))
    .filter((item) => item.success)
    .map((item) => item.data as TraceEvent);

  return normalizeTrace(safeEvents);
}

function normalizeTrace(events: TraceEvent[]): TraceEvent[] {
  if (events.length === 0) {
    return events;
  }

  const first = events[0];
  const firstType = String(first?.t ?? "");
  const firstArray = Array.isArray(first?.arr) ? first.arr.filter((value) => typeof value === "number") : [];
  const firstNodes = Array.isArray(first?.nodes) ? first.nodes.filter((value) => typeof value === "string") : [];
  const neutralSearchStart =
    firstArray.length > 0
      ? {
          t: "search-start",
          arr: [...firstArray],
          target: first?.target
        }
      : null;

  if (firstType === "stalin-step" && firstArray.length > 0) {
    return [
      {
        t: "stalin-start",
        arr: [...firstArray],
        kept: []
      },
      ...events
    ];
  }

  if (
    firstArray.length > 0 &&
    (firstType === "search-window" || firstType === "search-found" || firstType === "search-miss")
  ) {
    return neutralSearchStart ? [neutralSearchStart, ...events] : events;
  }

  if (firstType === "search-start" && neutralSearchStart) {
    return [neutralSearchStart, ...events.slice(1)];
  }

  if (firstArray.length > 0 && (firstType === "compare" || firstType === "swap" || firstType === "done")) {
    return [
      {
        t: "array-start",
        arr: [...firstArray],
        phase: "start"
      },
      ...events
    ];
  }

  if (firstNodes.length > 0 && (firstType === "graph-state" || firstType === "done")) {
    return [
      {
        t: "graph-start",
        nodes: [...firstNodes],
        edges: Array.isArray(first?.edges) ? first.edges : [],
        frontier: [],
        visited: [],
        order: [],
        mode: first?.mode
      },
      ...events
    ];
  }

  return events;
}

function appendEntrypointShim(source: string): string {
  return [
    source,
    "",
    "try {",
    '  if (typeof module !== "undefined" && module && module.exports) {',
    '    if (typeof module.exports.run !== "function" && typeof run === "function") module.exports.run = run;',
    '    if (typeof module.exports.main !== "function" && typeof main === "function") module.exports.main = main;',
    "  }",
    "} catch {}",
    ""
  ].join("\n");
}

function normalizeScriptFiles(language: ExecutionRequest["language"], files: ProjectFile[]) {
  return files.map((file) => {
    const compiled = ts.transpileModule(file.content, {
      fileName: file.name,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        allowJs: true,
        esModuleInterop: true,
        strict: false
      }
    });

    return {
      name: file.name,
      content: appendEntrypointShim(compiled.outputText),
      language
    };
  });
}

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const workerUrl =
    request.language === "python" ? "/workers/python-runner.js" : "/workers/js-runner.js";

  const files =
    request.language === "python"
      ? request.files
      : normalizeScriptFiles(request.language, request.files);

  const result = await runInWorker(
    workerUrl,
    {
      files,
      entrypoint: request.entrypoint,
      input: request.input,
      language: request.language
    },
    request.timeoutMs
  );

  return {
    ...result,
    events: sanitizeEvents(result.events)
  };
}
