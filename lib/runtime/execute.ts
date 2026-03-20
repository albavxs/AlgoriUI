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

  return events
    .map((event) => traceEventSchema.safeParse(event))
    .filter((item) => item.success)
    .map((item) => item.data as TraceEvent);
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

