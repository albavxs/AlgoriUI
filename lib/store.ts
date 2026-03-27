import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  canonicalAlgorithmId,
  algorithms,
  createProjectFromTemplate,
  defaultInputText,
  entrypointForLanguage,
  fileExtensionForLanguage,
  legacyEntrypointForLanguage
} from "@/lib/algorithms";
import type {
  AlgorithmId,
  CodeProject,
  Language,
  Locale,
  ProjectFile,
  SoundPreset
} from "@/lib/types";

type ProjectMap = Record<AlgorithmId, Record<Language, CodeProject>>;
type InputMap = Record<AlgorithmId, string>;

type ShareHydratePayload = {
  algorithmId: AlgorithmId;
  language: Language;
  project: CodeProject;
  inputText: string;
  locale: Locale;
  soundPreset: SoundPreset;
};

type LegacyCodeMap = Record<AlgorithmId, Record<Language, string>>;
export type EditorWrapMode = "auto" | "wrap" | "nowrap";
export type EditorFontMode = "sm" | "md" | "lg";

function mergeInputMap(inputMap: Partial<InputMap> | undefined): InputMap {
  const initial = buildInitialInputMap();
  if (!inputMap) {
    return initial;
  }

  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm.id] = inputMap[algorithm.id] ?? initial[algorithm.id];
    return acc;
  }, {} as InputMap);
}

function mergeProjectMap(projectMap: Partial<ProjectMap> | undefined): ProjectMap {
  const initial = buildInitialProjectMap();
  if (!projectMap) {
    return initial;
  }

  return algorithms.reduce((acc, algorithm) => {
    const current = projectMap[algorithm.id];
    acc[algorithm.id] = {
      ts: ensureProjectShape(current?.ts, algorithm.id, "ts"),
      js: ensureProjectShape(current?.js, algorithm.id, "js"),
      python: ensureProjectShape(current?.python, algorithm.id, "python")
    };
    return acc;
  }, {} as ProjectMap);
}

export type AppStore = {
  locale: Locale;
  selectedAlgorithmId: AlgorithmId;
  selectedLanguage: Language;
  speed: number;
  soundPreset: SoundPreset;
  editorWrapMode: EditorWrapMode;
  editorFontMode: EditorFontMode;
  projectMap: ProjectMap;
  inputMap: InputMap;
  setLocale: (locale: Locale) => void;
  setAlgorithm: (algorithmId: AlgorithmId) => void;
  setLanguage: (language: Language) => void;
  setSpeed: (speed: number) => void;
  setSoundPreset: (soundPreset: SoundPreset) => void;
  setEditorWrapMode: (editorWrapMode: EditorWrapMode) => void;
  setEditorFontMode: (editorFontMode: EditorFontMode) => void;
  setInputText: (algorithmId: AlgorithmId, inputText: string) => void;
  setActiveFile: (algorithmId: AlgorithmId, language: Language, fileId: string) => void;
  updateFileContent: (
    algorithmId: AlgorithmId,
    language: Language,
    fileId: string,
    content: string
  ) => void;
  addFile: (algorithmId: AlgorithmId, language: Language) => void;
  removeFile: (algorithmId: AlgorithmId, language: Language, fileId: string) => void;
  hydrateFromShare: (payload: ShareHydratePayload) => void;
};

function cloneProject(project: CodeProject): CodeProject {
  return {
    entrypoint: project.entrypoint,
    activeFileId: project.activeFileId,
    files: project.files.map((file) => ({ ...file }))
  };
}

function buildInitialProjectMap(): ProjectMap {
  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm.id] = {
      ts: createProjectFromTemplate(algorithm.id, "ts"),
      js: createProjectFromTemplate(algorithm.id, "js"),
      python: createProjectFromTemplate(algorithm.id, "python")
    };
    return acc;
  }, {} as ProjectMap);
}

function buildInitialInputMap(): InputMap {
  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm.id] = defaultInputText(algorithm.id);
    return acc;
  }, {} as InputMap);
}

function ensureProjectShape(
  project: CodeProject | undefined,
  algorithmId: AlgorithmId,
  language: Language
): CodeProject {
  if (!project || !Array.isArray(project.files) || project.files.length === 0) {
    return createProjectFromTemplate(algorithmId, language);
  }

  let files = project.files
    .filter((file): file is ProjectFile => Boolean(file?.id && file?.name))
    .map((file) => ({
      id: file.id,
      name: file.name,
      content: file.content ?? ""
    }));

  if (files.length === 0) {
    return createProjectFromTemplate(algorithmId, language);
  }

  const expectedEntrypoint = entrypointForLanguage(algorithmId, language);
  const legacyEntrypoint = legacyEntrypointForLanguage(language);
  let entrypoint = project.entrypoint || expectedEntrypoint;

  const expectedFile = files.find((file) => file.name === expectedEntrypoint);
  const legacyFile = files.find((file) => file.name === legacyEntrypoint);

  if (!expectedFile && legacyFile && (entrypoint === legacyEntrypoint || project.entrypoint == null)) {
    files = files.map((file) =>
      file.name === legacyEntrypoint ? { ...file, name: expectedEntrypoint } : file
    );
    entrypoint = expectedEntrypoint;
  } else if (expectedFile) {
    entrypoint = expectedEntrypoint;
  }

  const hasEntrypoint = files.some((file) => file.name === entrypoint);
  if (!hasEntrypoint) {
    return createProjectFromTemplate(algorithmId, language);
  }

  const activeFileId = files.some((file) => file.id === project.activeFileId)
    ? project.activeFileId
    : files[0].id;

  return {
    entrypoint,
    activeFileId,
    files
  };
}

function fallbackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return fallbackId();
}

function nextFileName(project: CodeProject, language: Language): string {
  const ext = fileExtensionForLanguage(language);
  const used = new Set(project.files.map((file) => file.name));

  let counter = 1;
  while (used.has(`module_${counter}${ext}`)) {
    counter += 1;
  }

  return `module_${counter}${ext}`;
}

function starterFileContent(language: Language): string {
  if (language === "python") {
    return [
      "def helper():",
      "    return None",
      ""
    ].join("\n");
  }

  return [
    "export function helper() {",
    "  return null;",
    "}",
    ""
  ].join("\n");
}

function migrateLegacyCodeMap(codeMap: LegacyCodeMap | undefined): ProjectMap {
  const initial = buildInitialProjectMap();
  if (!codeMap) {
    return initial;
  }

  for (const algorithm of algorithms) {
    for (const language of ["ts", "js", "python"] as const) {
      const legacyCode = codeMap[algorithm.id]?.[language];
      if (!legacyCode) {
        continue;
      }

      const project = createProjectFromTemplate(algorithm.id, language);
      project.files[0].content = legacyCode;
      initial[algorithm.id][language] = project;
    }
  }

  return initial;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      locale: "en",
      selectedAlgorithmId: "stalin-sort",
      selectedLanguage: "ts",
      speed: 1,
      soundPreset: "punchy",
      editorWrapMode: "auto",
      editorFontMode: "md",
      projectMap: buildInitialProjectMap(),
      inputMap: buildInitialInputMap(),
      setLocale: (locale) => set({ locale }),
      setAlgorithm: (selectedAlgorithmId) => set({ selectedAlgorithmId }),
      setLanguage: (selectedLanguage) => set({ selectedLanguage }),
      setSpeed: (speed) => set({ speed }),
      setSoundPreset: (soundPreset) => set({ soundPreset }),
      setEditorWrapMode: (editorWrapMode) => set({ editorWrapMode }),
      setEditorFontMode: (editorFontMode) => set({ editorFontMode }),
      setInputText: (algorithmId, inputText) =>
        set((state) => ({
          inputMap: {
            ...state.inputMap,
            [algorithmId]: inputText
          }
        })),
      setActiveFile: (algorithmId, language, fileId) =>
        set((state) => {
          const project = ensureProjectShape(state.projectMap[algorithmId]?.[language], algorithmId, language);
          if (!project.files.some((file) => file.id === fileId)) {
            return {};
          }

          return {
            projectMap: {
              ...state.projectMap,
              [algorithmId]: {
                ...state.projectMap[algorithmId],
                [language]: {
                  ...project,
                  activeFileId: fileId
                }
              }
            }
          };
        }),
      updateFileContent: (algorithmId, language, fileId, content) =>
        set((state) => {
          const project = ensureProjectShape(state.projectMap[algorithmId]?.[language], algorithmId, language);

          return {
            projectMap: {
              ...state.projectMap,
              [algorithmId]: {
                ...state.projectMap[algorithmId],
                [language]: {
                  ...project,
                  files: project.files.map((file) =>
                    file.id === fileId ? { ...file, content } : file
                  )
                }
              }
            }
          };
        }),
      addFile: (algorithmId, language) =>
        set((state) => {
          const project = ensureProjectShape(state.projectMap[algorithmId]?.[language], algorithmId, language);
          const file: ProjectFile = {
            id: generateFileId(),
            name: nextFileName(project, language),
            content: starterFileContent(language)
          };

          return {
            projectMap: {
              ...state.projectMap,
              [algorithmId]: {
                ...state.projectMap[algorithmId],
                [language]: {
                  ...project,
                  activeFileId: file.id,
                  files: [...project.files, file]
                }
              }
            }
          };
        }),
      removeFile: (algorithmId, language, fileId) =>
        set((state) => {
          const project = ensureProjectShape(state.projectMap[algorithmId]?.[language], algorithmId, language);
          const fileToRemove = project.files.find((file) => file.id === fileId);

          if (!fileToRemove || fileToRemove.name === project.entrypoint) {
            return {};
          }

          const nextFiles = project.files.filter((file) => file.id !== fileId);
          if (nextFiles.length === 0) {
            return {};
          }

          const nextActiveFileId =
            project.activeFileId === fileId ? nextFiles[0].id : project.activeFileId;

          return {
            projectMap: {
              ...state.projectMap,
              [algorithmId]: {
                ...state.projectMap[algorithmId],
                [language]: {
                  ...project,
                  activeFileId: nextActiveFileId,
                  files: nextFiles
                }
              }
            }
          };
        }),
      hydrateFromShare: (payload) =>
        set((state) => {
          const algorithmId = canonicalAlgorithmId(String(payload.algorithmId));
          const isLegacyBinarySearch = String(payload.algorithmId) === "binary-search";
          const project = isLegacyBinarySearch
            ? createProjectFromTemplate(algorithmId, payload.language)
            : ensureProjectShape(cloneProject(payload.project), algorithmId, payload.language);

          return {
            locale: payload.locale,
            selectedAlgorithmId: algorithmId,
            selectedLanguage: payload.language,
            soundPreset: payload.soundPreset,
            projectMap: {
              ...state.projectMap,
              [algorithmId]: {
                ...state.projectMap[algorithmId],
                [payload.language]: project
              }
            },
            inputMap: {
              ...state.inputMap,
              [algorithmId]: isLegacyBinarySearch ? defaultInputText(algorithmId) : payload.inputText
            }
          };
        })
    }),
    {
      name: "algoriui-store",
      version: 6,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        locale: state.locale,
        selectedAlgorithmId: state.selectedAlgorithmId,
        selectedLanguage: state.selectedLanguage,
        speed: state.speed,
        soundPreset: state.soundPreset,
        editorWrapMode: state.editorWrapMode,
        editorFontMode: state.editorFontMode,
        projectMap: state.projectMap,
        inputMap: state.inputMap
      }),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<AppStore> & {
          codeMap?: LegacyCodeMap;
          selectedAlgorithmId?: string;
          inputMap?: Partial<InputMap> & Record<string, string>;
          projectMap?: Partial<ProjectMap> & Record<string, unknown>;
        };

        const selectedAlgorithmId = canonicalAlgorithmId(state.selectedAlgorithmId ?? "stalin-sort");

        // v5: BFS/DFS migrated from graph to maze format — reset their code and inputs
        const projectMapBase = state.projectMap ? { ...state.projectMap } : undefined;
        if (projectMapBase) {
          delete (projectMapBase as Record<string, unknown>)["bfs"];
          delete (projectMapBase as Record<string, unknown>)["dfs"];
        }
        const projectMap = projectMapBase
          ? mergeProjectMap(projectMapBase as Partial<ProjectMap>)
          : migrateLegacyCodeMap(state.codeMap);

        const inputMapBase: Partial<InputMap> & Record<string, string> = state.inputMap
          ? { ...state.inputMap }
          : {};
        delete (inputMapBase as Record<string, unknown>)["bfs"];
        delete (inputMapBase as Record<string, unknown>)["dfs"];

        return {
          locale: state.locale ?? "pt",
          selectedAlgorithmId,
          selectedLanguage: state.selectedLanguage ?? "ts",
          speed: state.speed ?? 1,
          soundPreset: state.soundPreset ?? "punchy",
          editorWrapMode: state.editorWrapMode ?? "auto",
          editorFontMode: state.editorFontMode ?? "md",
          inputMap: mergeInputMap(inputMapBase),
          projectMap
        };
      }
    }
  )
);

export function ensureProject(
  projectMap: ProjectMap,
  algorithmId: AlgorithmId,
  language: Language
): CodeProject {
  return ensureProjectShape(projectMap[algorithmId]?.[language], algorithmId, language);
}

export function findActiveFile(project: CodeProject): ProjectFile {
  return project.files.find((file) => file.id === project.activeFileId) ?? project.files[0];
}

export function canRemoveFile(project: CodeProject, fileId: string): boolean {
  const file = project.files.find((entry) => entry.id === fileId);
  return Boolean(file && file.name !== project.entrypoint);
}
