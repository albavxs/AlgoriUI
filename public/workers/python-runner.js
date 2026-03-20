const PYODIDE_VERSION = "0.29.3";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise = null;
let runCounter = 0;

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

function ensureDir(fs, targetPath) {
  const parts = String(targetPath).split("/").filter(Boolean);
  let current = "";

  for (const part of parts) {
    current += `/${part}`;
    try {
      fs.mkdir(current);
    } catch {
      // Ignore existing segments.
    }
  }
}

self.onmessage = async (event) => {
  const files = Array.isArray(event.data?.files) ? event.data.files : [];
  const entrypoint = String(event.data?.entrypoint ?? "main.py");
  const input = event.data?.input;
  const events = [];
  const logs = [];

  try {
    const pyodide = await getPyodide();
    const fs = pyodide.FS;
    const projectRoot = `/tmp/algoriui_${runCounter++}`;

    ensureDir(fs, projectRoot);
    for (const file of files) {
      fs.writeFile(`${projectRoot}/${file.name}`, String(file.content ?? ""), {
        encoding: "utf8"
      });
    }

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
    pyodide.globals.set("__project_root", projectRoot);
    pyodide.globals.set("__entrypoint_name", entrypoint);

    const wrapped = `
import builtins
import inspect
import os
import runpy
import sys

if __project_root not in sys.path:
    sys.path.insert(0, __project_root)

try:
    normalized_input = input_data.to_py()
except Exception:
    normalized_input = input_data

builtins.emitStep = emitStep
builtins.input_data = normalized_input

os.chdir(__project_root)
namespace = runpy.run_path(
    os.path.join(__project_root, __entrypoint_name),
    init_globals={"emitStep": emitStep, "input_data": normalized_input}
)

__result = None
if "run" in namespace and callable(namespace["run"]):
    __result = namespace["run"](normalized_input)
elif "main" in namespace and callable(namespace["main"]):
    __result = namespace["main"](normalized_input)
elif "__result" in namespace:
    __result = namespace["__result"]

if inspect.isawaitable(__result):
    __result = await __result

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
