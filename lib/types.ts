export type Language = "ts" | "js" | "python";

export type Locale = "pt" | "en";

export type AlgorithmCategory = "sorting" | "search" | "graph";

export type AlgorithmId =
  | "bubble-sort"
  | "stalin-sort"
  | "selection-sort"
  | "bfs"
  | "dfs";

export type TraceEvent = {
  t: string;
  [key: string]: unknown;
};

export type ProjectFile = {
  id: string;
  name: string;
  content: string;
};

export type CodeProject = {
  files: ProjectFile[];
  activeFileId: string;
  entrypoint: string;
};

export type SoundPreset = "soft" | "balanced" | "punchy";

export type ExecutionRequest = {
  language: Language;
  files: ProjectFile[];
  entrypoint: string;
  input: unknown;
  timeoutMs: number;
};

export type ExecutionResult = {
  ok: boolean;
  events: TraceEvent[];
  stdout?: string;
  stderr?: string;
  durationMs: number;
  output?: unknown;
};

export type AlgorithmDefinition = {
  id: AlgorithmId;
  category: AlgorithmCategory;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  complexity: {
    time: string;
    space: string;
  };
  defaultInput: unknown;
  templates: Record<Language, string>;
};

export type SharePayload = {
  version: 1;
  algorithmId: AlgorithmId;
  language: Language;
  project: CodeProject;
  inputText: string;
  locale: Locale;
  soundPreset: SoundPreset;
};
