const PYODIDE_VERSION = "0.29.3";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;

async function getPyodide() {
  if (!pyodidePromise) {
    importScripts(`${PYODIDE_INDEX}pyodide.js`);
    pyodidePromise = self.loadPyodide({ indexURL: PYODIDE_INDEX });
  }
  return pyodidePromise;
}

function toPlainObject(value) {
  if (!value) return value;

  if (typeof value.toJs === "function") {
    try {
      return value.toJs({ dict_converter: Object.fromEntries });
    } catch {
      return value.toJs();
    }
  }

  return value;
}

self.onmessage = async (event) => {
  const source = String(event.data?.source ?? "");
  const input = event.data?.input;
  const events = [];
  const logs = [];

  try {
    const pyodide = await getPyodide();

    pyodide.setStdout({
      batched: (text) => logs.push(String(text))
    });
    pyodide.setStderr({
      batched: (text) => logs.push(String(text))
    });

    const emitStep = (payload) => {
      const normalized = toPlainObject(payload);
      if (!normalized || typeof normalized !== "object") return;
      if (!("t" in normalized)) return;
      events.push(normalized);
    };

    pyodide.globals.set("emitStep", emitStep);
    pyodide.globals.set("input_data", input);

    const wrapped = `
from js import emitStep, input_data
${source}
__result = None
if 'run' in globals():
    __result = run(input_data)
elif 'main' in globals():
    __result = main(input_data)
__result
`;

    let result = await pyodide.runPythonAsync(wrapped);
    result = toPlainObject(result);

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
