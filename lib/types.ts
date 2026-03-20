export type Language = "ts" | "js" | "python";

export type Locale = "pt" | "en";

export type AlgorithmCategory = "sorting" | "search" | "graph";

export type AlgorithmId =
  | "bubble-sort"
  | "stalin-sort"
  | "binary-search"
  | "bfs"
  | "dfs";

export type TraceEvent = {
  t: string;
  [key: string]: unknown;
};

export type ExecutionRequest = {
  language: Language;
  source: string;
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
  code: string;
  inputText: string;
  locale: Locale;
};
