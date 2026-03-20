function stringifyLogPart(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizePath(path) {
  const segments = [];
  for (const segment of String(path).replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function dirname(path) {
  const normalized = normalizePath(path);
  const segments = normalized.split("/");
  segments.pop();
  return segments.join("/");
}

function joinPath(base, specifier) {
  return normalizePath([base, specifier].filter(Boolean).join("/"));
}

function createResolver(files) {
  const fileMap = new Map(files.map((file) => [normalizePath(file.name), String(file.content ?? "")]));

  function resolveFrom(basePath, specifier) {
    const normalizedSpecifier = String(specifier);
    const baseDir = dirname(basePath);
    const rootCandidate = normalizedSpecifier.startsWith(".")
      ? joinPath(baseDir, normalizedSpecifier)
      : normalizePath(normalizedSpecifier);

    const candidates = [
      rootCandidate,
      `${rootCandidate}.js`,
      `${rootCandidate}.ts`,
      `${rootCandidate}/index.js`,
      `${rootCandidate}/index.ts`
    ];

    for (const candidate of candidates) {
      if (fileMap.has(candidate)) {
        return candidate;
      }
    }

    throw new Error(`Module not found: ${normalizedSpecifier}`);
  }

  return {
    fileMap,
    resolveFrom
  };
}

self.onmessage = async (event) => {
  const files = Array.isArray(event.data?.files) ? event.data.files : [];
  const entrypoint = String(event.data?.entrypoint ?? "");
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
    const { fileMap, resolveFrom } = createResolver(files);
    const cache = new Map();

    const loadModule = (moduleName) => {
      const normalizedName = normalizePath(moduleName);
      if (cache.has(normalizedName)) {
        return cache.get(normalizedName).exports;
      }

      const source = fileMap.get(normalizedName);
      if (typeof source !== "string") {
        throw new Error(`Unknown module: ${normalizedName}`);
      }

      const module = { exports: {} };
      cache.set(normalizedName, module);

      const localRequire = (specifier) => {
        const resolved = resolveFrom(normalizedName, specifier);
        return loadModule(resolved);
      };

      const runner = new Function(
        "require",
        "module",
        "exports",
        "emitStep",
        "input",
        "console",
        `"use strict";\n${source}`
      );

      runner(localRequire, module, module.exports, emitStep, input, sandboxConsole);
      return module.exports;
    };

    const entryExports = loadModule(entrypoint);
    let result = null;

    if (typeof entryExports.run === "function") {
      result = await entryExports.run(input);
    } else if (typeof entryExports.main === "function") {
      result = await entryExports.main(input);
    }

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
