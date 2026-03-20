import type { ExecutionResult, TraceEvent } from "@/lib/types";

type WorkerOkPayload = {
  ok: true;
  events: TraceEvent[];
  stdout?: string;
  result?: unknown;
};

type WorkerErrorPayload = {
  ok: false;
  stderr?: string;
  events?: TraceEvent[];
};

type WorkerResponse = WorkerOkPayload | WorkerErrorPayload;

export async function runInWorker(
  workerUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<ExecutionResult> {
  const started = performance.now();

  return new Promise<ExecutionResult>((resolve) => {
    const worker = new Worker(workerUrl);

    const timeout = window.setTimeout(() => {
      worker.terminate();
      resolve({
        ok: false,
        events: [],
        stderr: `Execution timed out after ${timeoutMs}ms`,
        durationMs: Math.round(performance.now() - started)
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      window.clearTimeout(timeout);
      worker.terminate();

      const durationMs = Math.round(performance.now() - started);
      if (event.data.ok) {
        resolve({
          ok: true,
          events: event.data.events ?? [],
          stdout: event.data.stdout,
          output: event.data.result,
          durationMs
        });
        return;
      }

      resolve({
        ok: false,
        events: event.data.events ?? [],
        stderr: event.data.stderr ?? "Unknown execution error",
        durationMs
      });
    };

    worker.onerror = (err) => {
      window.clearTimeout(timeout);
      worker.terminate();
      resolve({
        ok: false,
        events: [],
        stderr: err.message,
        durationMs: Math.round(performance.now() - started)
      });
    };

    worker.postMessage(payload);
  });
}
