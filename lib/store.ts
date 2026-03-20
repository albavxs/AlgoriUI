import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { algorithms, defaultCode, defaultInputText } from "@/lib/algorithms";
import type { AlgorithmId, Language, Locale } from "@/lib/types";

type CodeMap = Record<AlgorithmId, Record<Language, string>>;
type InputMap = Record<AlgorithmId, string>;

export type AppStore = {
  locale: Locale;
  selectedAlgorithmId: AlgorithmId;
  selectedLanguage: Language;
  speed: number;
  codeMap: CodeMap;
  inputMap: InputMap;
  setLocale: (locale: Locale) => void;
  setAlgorithm: (algorithmId: AlgorithmId) => void;
  setLanguage: (language: Language) => void;
  setSpeed: (speed: number) => void;
  setCode: (algorithmId: AlgorithmId, language: Language, code: string) => void;
  setInputText: (algorithmId: AlgorithmId, inputText: string) => void;
  hydrateFromShare: (payload: {
    algorithmId: AlgorithmId;
    language: Language;
    code: string;
    inputText: string;
    locale: Locale;
  }) => void;
};

function buildInitialCodeMap(): CodeMap {
  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm.id] = {
      ts: algorithm.templates.ts,
      js: algorithm.templates.js,
      python: algorithm.templates.python
    };
    return acc;
  }, {} as CodeMap);
}

function buildInitialInputMap(): InputMap {
  return algorithms.reduce((acc, algorithm) => {
    acc[algorithm.id] = defaultInputText(algorithm.id);
    return acc;
  }, {} as InputMap);
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      locale: "pt",
      selectedAlgorithmId: "stalin-sort",
      selectedLanguage: "ts",
      speed: 1,
      codeMap: buildInitialCodeMap(),
      inputMap: buildInitialInputMap(),
      setLocale: (locale) => set({ locale }),
      setAlgorithm: (selectedAlgorithmId) => set({ selectedAlgorithmId }),
      setLanguage: (selectedLanguage) => set({ selectedLanguage }),
      setSpeed: (speed) => set({ speed }),
      setCode: (algorithmId, language, code) =>
        set((state) => ({
          codeMap: {
            ...state.codeMap,
            [algorithmId]: {
              ...state.codeMap[algorithmId],
              [language]: code
            }
          }
        })),
      setInputText: (algorithmId, inputText) =>
        set((state) => ({
          inputMap: {
            ...state.inputMap,
            [algorithmId]: inputText
          }
        })),
      hydrateFromShare: (payload) =>
        set((state) => {
          const codeMap = {
            ...state.codeMap,
            [payload.algorithmId]: {
              ...state.codeMap[payload.algorithmId],
              [payload.language]: payload.code
            }
          };

          const inputMap = {
            ...state.inputMap,
            [payload.algorithmId]: payload.inputText
          };

          return {
            locale: payload.locale,
            selectedAlgorithmId: payload.algorithmId,
            selectedLanguage: payload.language,
            codeMap,
            inputMap
          };
        })
    }),
    {
      name: "algoriui-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        locale: state.locale,
        selectedAlgorithmId: state.selectedAlgorithmId,
        selectedLanguage: state.selectedLanguage,
        speed: state.speed,
        codeMap: state.codeMap,
        inputMap: state.inputMap
      })
    }
  )
);

export function ensureCode(
  codeMap: CodeMap,
  algorithmId: AlgorithmId,
  language: Language
): string {
  return codeMap[algorithmId]?.[language] ?? defaultCode(algorithmId, language);
}

export function ensureInput(inputMap: InputMap, algorithmId: AlgorithmId): string {
  return inputMap[algorithmId] ?? defaultInputText(algorithmId);
}
