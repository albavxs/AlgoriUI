import ts from "typescript";
import { z } from "zod";

import { runInWorker } from "@/lib/runtime/worker-client";
import type { ExecutionRequest, ExecutionResult, TraceEvent } from "@/lib/types";

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

function normalizeCode({ language, source }: Pick<ExecutionRequest, "language" | "source">): string {
  if (language !== "ts") {
    return source;
  }

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: false
    }
  });

  return compiled.outputText;
}

export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const source = normalizeCode(request);

  const workerUrl =
    request.language === "python" ? "/workers/python-runner.js" : "/workers/js-runner.js";

  const result = await runInWorker(
    workerUrl,
    {
      source,
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
