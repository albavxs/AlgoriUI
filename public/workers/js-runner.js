function stringifyLogPart(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

self.onmessage = async (event) => {
  const source = String(event.data?.source ?? "");
  const input = event.data?.input;
  const events = [];
  const logs = [];

  const emitStep = (payload) => {
    if (!payload || typeof payload !== "object") return;
    if (!("t" in payload)) return;
    events.push(payload);
  };

  const sandboxConsole = {
    log: (...args) => logs.push(args.map(stringifyLogPart).join(" ")),
    warn: (...args) => logs.push(args.map(stringifyLogPart).join(" ")),
    error: (...args) => logs.push(args.map(stringifyLogPart).join(" "))
  };

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const runner = new AsyncFunction(
      "emitStep",
      "input",
      "console",
      `"use strict";\n${source}\nif (typeof run === "function") return await run(input);\nif (typeof main === "function") return await main(input);\nreturn null;`
    );

    const result = await runner(emitStep, input, sandboxConsole);
    self.postMessage({
      ok: true,
      events,
      stdout: logs.join("\n"),
      result
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      events,
      stderr: String(error?.stack ?? error)
    });
  }
};
