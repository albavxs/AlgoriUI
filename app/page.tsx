"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import {
  type CSSProperties,
  ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import type { editor as MonacoEditorApi } from "monaco-editor";

import { CodeEditor } from "@/components/CodeEditor";
import { Visualizer } from "@/components/Visualizer";
import { algorithmById, algorithms, languageLabel } from "@/lib/algorithms";
import { localeLabel, t } from "@/lib/i18n";
import { executeCode } from "@/lib/runtime/execute";
import { decodeShare, encodeShare } from "@/lib/share";
import {
  type EditorFontMode,
  type EditorWrapMode,
  canRemoveFile,
  ensureProject,
  findActiveFile,
  useAppStore
} from "@/lib/store";
import type {
  AlgorithmCategory,
  Language,
  Locale,
  SharePayload,
  SoundPreset,
  TraceEvent,
  VisualizerType
} from "@/lib/types";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  wet: GainNode;
  mix: GainNode;
  noiseBuffer: AudioBuffer;
};

type SoundProfile = {
  volumeScale: number;
  reverb: number;
  compareGain: number;
  compareNoise: number;
  swapGain: number;
  swapNoise: number;
  rejectGain: number;
  doneGain: number;
};

const soundProfiles: Record<Exclude<SoundPreset, "piano">, SoundProfile> = {
  soft: {
    volumeScale: 0.72,
    reverb: 0.08,
    compareGain: 0.03,
    compareNoise: 0.008,
    swapGain: 0.05,
    swapNoise: 0.012,
    rejectGain: 0.045,
    doneGain: 0.05
  },
  balanced: {
    volumeScale: 0.9,
    reverb: 0.11,
    compareGain: 0.05,
    compareNoise: 0.012,
    swapGain: 0.075,
    swapNoise: 0.018,
    rejectGain: 0.07,
    doneGain: 0.065
  },
  punchy: {
    volumeScale: 1,
    reverb: 0.16,
    compareGain: 0.065,
    compareNoise: 0.017,
    swapGain: 0.095,
    swapNoise: 0.025,
    rejectGain: 0.09,
    doneGain: 0.082
  }
};

const languageMeta: Record<Language, { badge: string }> = {
  ts: { badge: "TS" },
  js: { badge: "JS" },
  python: { badge: "PY" }
};

const presetLabelKey: Record<SoundPreset, "presetSoft" | "presetBalanced" | "presetPunchy" | "presetPiano"> = {
  soft: "presetSoft",
  balanced: "presetBalanced",
  punchy: "presetPunchy",
  piano: "presetPiano"
};

const wrapLabelKey: Record<EditorWrapMode, "wrapAuto" | "wrapOn" | "wrapOff"> = {
  auto: "wrapAuto",
  wrap: "wrapOn",
  nowrap: "wrapOff"
};

const fontModeOrder: EditorFontMode[] = ["sm", "md", "lg"];

type MobilePickerName = "soundPreset" | "algorithm" | "language" | "locale";

type PickerOption = {
  value: string;
  label: string;
};

type IconProps = {
  className?: string;
};

type AdaptivePickerFieldProps = {
  compact?: boolean;
  dialogId: string;
  label: string;
  mobile: boolean;
  open: boolean;
  options: readonly PickerOption[];
  value: string;
  valueLabel: string;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onNativeChange: (value: string) => void;
};

type MobilePickerSheetProps = {
  closeLabel: string;
  dialogId: string;
  label: string;
  options: readonly PickerOption[];
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

function WrapAutoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10H11C12.9 10 14 11.1 14 13V14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.2 12.5L14 14.3L15.8 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WrapOnIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10H12C13.7 10 14.8 11 14.8 12.8V13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.8 12L14.8 14L16.8 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WrapOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 13.5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FontSmallIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7.2 14L9.4 8L11.6 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.1 11.4H10.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.4 14H16.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FontLargeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.8 14.5L8 5.5L11.2 14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.1 10.8H9.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.3 10V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11.8 12.5H16.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EditorMenuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 14H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="6" r="1.1" fill="currentColor" />
      <circle cx="13" cy="10" r="1.1" fill="currentColor" />
      <circle cx="9.5" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FullscreenIcon({ className, active }: IconProps & { active: boolean }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {active ? (
        <>
          <path d="M8 4.5V7.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 4.5V7.5H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 15.5V12.5H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 15.5V12.5H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M5 4.5H8V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4.5H12V7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 15.5H8V12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 15.5H12V12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function FullscreenBackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M11 4L5.5 10L11 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseCodeIcon({ className, collapsed }: IconProps & { collapsed: boolean }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="12" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
      {collapsed ? (
        <path d="M8 11L10 9L12 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M8 9L10 11L12 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function AddFileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7 4.8H11.8L15 8V14.2C15 15.1 14.3 15.8 13.4 15.8H7C6.1 15.8 5.4 15.1 5.4 14.2V6.4C5.4 5.5 6.1 4.8 7 4.8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M11.4 4.9V8.1H14.6" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M10 10.2V13.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M8.2 12H11.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function RunAnimationIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7.2 5.7L14 10L7.2 14.3V5.7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SiteMenuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 6H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 10H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 14H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BrandLogo() {
  return (
    <svg className="brand-logo" viewBox="0 0 168 32" fill="none" role="img" aria-label="AlgoriUI">
      <title>AlgoriUI</title>
      <defs>
        <linearGradient id="brand-logo-gradient" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#32D74B" />
          <stop offset="0.55" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#FFD60A" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="10" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(184, 194, 218, 0.2)" />
      <path
        d="M8 21.4L12.1 10.3C12.4 9.5 13.6 9.5 13.9 10.3L18 21.4"
        stroke="url(#brand-logo-gradient)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.2 16.6H15.8" stroke="url(#brand-logo-gradient)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23.2" cy="11.2" r="2.3" fill="#22D3EE" />
      <circle cx="23.2" cy="20.8" r="2.3" fill="#FFD60A" />
      <path d="M23.2 13.8V18.2" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1.5" strokeLinecap="round" />
      <text
        x="40"
        y="20.6"
        fill="#F5F7FB"
        fontSize="16"
        fontWeight="700"
        letterSpacing="-0.04em"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        AlgoriUI
      </text>
    </svg>
  );
}

function AdaptivePickerField({
  compact = false,
  dialogId,
  label,
  mobile,
  open,
  options,
  value,
  valueLabel,
  onOpen,
  onNativeChange
}: AdaptivePickerFieldProps) {
  return (
    <label className={`control-block${compact ? " compact" : ""}`}>
      <span>{label}</span>
      {mobile ? (
        <button
          type="button"
          className={`mobile-picker-trigger ${open ? "open" : ""}`}
          onClick={onOpen}
          aria-controls={open ? dialogId : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="mobile-picker-value">{valueLabel}</span>
          <span className="mobile-picker-chevron" aria-hidden="true" />
        </button>
      ) : (
        <select value={value} onChange={(event) => onNativeChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function MobilePickerSheet({
  closeLabel,
  dialogId,
  label,
  options,
  value,
  onClose,
  onSelect
}: MobilePickerSheetProps) {
  const titleId = useId();

  return (
    <motion.div className="mobile-picker-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.button
        type="button"
        className="mobile-picker-backdrop"
        onClick={onClose}
        aria-label={closeLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mobile-picker-sheet"
        initial={{ opacity: 0, y: 28, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.99 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="mobile-picker-grabber" aria-hidden="true" />
        <div className="mobile-picker-header">
          <h2 id={titleId} className="mobile-picker-title">
            {label}
          </h2>
          <button type="button" className="mobile-picker-close" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        <div className="mobile-picker-options">
          {options.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`mobile-picker-option ${active ? "active" : ""}`}
                onClick={() => onSelect(option.value)}
              >
                <span className="mobile-picker-option-label">{option.label}</span>
                <span className="mobile-picker-option-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function safeGraphOrder(event: TraceEvent): string[] {
  const direct = Array.isArray(event.order) ? event.order.filter((item) => typeof item === "string") : [];
  if (direct.length > 0) {
    return direct;
  }

  return Array.isArray(event.visited) ? event.visited.filter((item) => typeof item === "string") : [];
}

function safeArrayValues(event: TraceEvent): number[] {
  return Array.isArray(event.arr) ? event.arr.filter((item) => typeof item === "number") : [];
}

function buildCustomAutoArrayInput(): number[] {
  return [6, 2, 9, 1, 7, 3];
}

function buildCustomAutoMazeInput() {
  return {
    grid: [
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      [1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0],
      [0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0]
    ],
    start: [0, 0],
    end: [8, 10]
  };
}

function stringifyInputValue(value: unknown): string {
  return Array.isArray(value) ? JSON.stringify(value) : JSON.stringify(value, null, 2);
}

function inferCustomInputValue(source: string): unknown {
  const normalized = source.toLowerCase();
  const readsGridField = /(input|input_data)\s*(?:\.\s*grid|\[\s*["']grid["']\s*\])/.test(normalized);
  const destructuresMazeInput = /\{\s*[^}]*\bgrid\b[^}]*\bstart\b[^}]*\bend\b[^}]*\}\s*=\s*(input|input_data)/.test(normalized);
  const looksLikeMazeModel =
    /\bgrid\b/.test(normalized) &&
    /\bstart\b/.test(normalized) &&
    /\bend\b/.test(normalized) &&
    (/\bvisited\b/.test(normalized) || /\bpath\b/.test(normalized));

  if (readsGridField || destructuresMazeInput || looksLikeMazeModel) {
    return buildCustomAutoMazeInput();
  }

  return buildCustomAutoArrayInput();
}

function resolveVisualizerMode(
  selectedAlgorithmId: string,
  algorithm: { category: AlgorithmCategory; visualizer?: VisualizerType },
  events: TraceEvent[]
): VisualizerType {
  if (selectedAlgorithmId !== "custom") {
    return algorithm.visualizer ?? (algorithm.category === "graph" ? "graph" : "sorting");
  }

  if (events.some((event) => event?.t === "maze-start" || Array.isArray(event?.grid))) {
    return "maze";
  }

  if (events.some((event) => event?.t === "graph-state" || Array.isArray(event?.nodes))) {
    return "graph";
  }

  if (events.some((event) => Array.isArray(event?.buckets))) {
    return "bucket";
  }

  if (events.some((event) => typeof event?.heapSize === "number" || event?.t === "heapify" || event?.t === "extract")) {
    return "heap";
  }

  if (events.some((event) => typeof event?.digit === "number" || Array.isArray(event?.counts) || Array.isArray(event?.output))) {
    return "radix";
  }

  return "sorting";
}

type AmbientPalette = {
  bodyA: string;
  bodyB: string;
  bodyC: string;
  heroA: string;
  heroB: string;
  heroC: string;
};

function resolveAmbientPalette(category: AlgorithmCategory, event: TraceEvent | null): AmbientPalette {
  const eventType = String(event?.t ?? "");

  const defaults: Record<AlgorithmCategory, AmbientPalette> = {
    sorting: {
      bodyA: "rgba(255, 69, 58, 0.12)",
      bodyB: "rgba(34, 211, 238, 0.08)",
      bodyC: "rgba(50, 215, 75, 0.05)",
      heroA: "rgba(255, 69, 58, 0.16)",
      heroB: "rgba(34, 211, 238, 0.1)",
      heroC: "rgba(50, 215, 75, 0.06)"
    },
    search: {
      bodyA: "rgba(34, 211, 238, 0.1)",
      bodyB: "rgba(255, 214, 10, 0.07)",
      bodyC: "rgba(255, 69, 58, 0.04)",
      heroA: "rgba(34, 211, 238, 0.14)",
      heroB: "rgba(255, 214, 10, 0.09)",
      heroC: "rgba(255, 69, 58, 0.05)"
    },
    graph: {
      bodyA: "rgba(50, 215, 75, 0.08)",
      bodyB: "rgba(34, 211, 238, 0.07)",
      bodyC: "rgba(255, 214, 10, 0.05)",
      heroA: "rgba(50, 215, 75, 0.12)",
      heroB: "rgba(34, 211, 238, 0.08)",
      heroC: "rgba(255, 214, 10, 0.06)"
    }
  };

  if (eventType === "swap") {
    return {
      bodyA: "rgba(255, 214, 10, 0.12)",
      bodyB: "rgba(34, 211, 238, 0.08)",
      bodyC: "rgba(255, 255, 255, 0.03)",
      heroA: "rgba(255, 214, 10, 0.18)",
      heroB: "rgba(34, 211, 238, 0.12)",
      heroC: "rgba(255, 255, 255, 0.04)"
    };
  }

  if (eventType === "compare" || eventType === "search-window") {
    return {
      bodyA: "rgba(34, 211, 238, 0.12)",
      bodyB: "rgba(255, 69, 58, 0.08)",
      bodyC: "rgba(255, 255, 255, 0.025)",
      heroA: "rgba(34, 211, 238, 0.16)",
      heroB: "rgba(255, 69, 58, 0.1)",
      heroC: "rgba(255, 255, 255, 0.04)"
    };
  }

  if (eventType === "search-found" || eventType === "done") {
    return {
      bodyA: "rgba(50, 215, 75, 0.12)",
      bodyB: "rgba(34, 211, 238, 0.07)",
      bodyC: "rgba(255, 255, 255, 0.025)",
      heroA: "rgba(50, 215, 75, 0.16)",
      heroB: "rgba(34, 211, 238, 0.1)",
      heroC: "rgba(255, 255, 255, 0.04)"
    };
  }

  if (eventType === "search-miss") {
    return {
      bodyA: "rgba(255, 69, 58, 0.12)",
      bodyB: "rgba(255, 214, 10, 0.06)",
      bodyC: "rgba(255, 255, 255, 0.025)",
      heroA: "rgba(255, 69, 58, 0.16)",
      heroB: "rgba(255, 214, 10, 0.08)",
      heroC: "rgba(255, 255, 255, 0.04)"
    };
  }

  if (eventType === "stalin-step") {
    const accepted = Boolean(event?.accepted);
    return accepted
      ? {
          bodyA: "rgba(50, 215, 75, 0.11)",
          bodyB: "rgba(34, 211, 238, 0.07)",
          bodyC: "rgba(255, 255, 255, 0.02)",
          heroA: "rgba(50, 215, 75, 0.15)",
          heroB: "rgba(34, 211, 238, 0.09)",
          heroC: "rgba(255, 255, 255, 0.03)"
        }
      : {
          bodyA: "rgba(255, 69, 58, 0.13)",
          bodyB: "rgba(89, 96, 112, 0.05)",
          bodyC: "rgba(255, 255, 255, 0.02)",
          heroA: "rgba(255, 69, 58, 0.18)",
          heroB: "rgba(89, 96, 112, 0.07)",
          heroC: "rgba(255, 255, 255, 0.03)"
        };
  }

  if (eventType === "maze-start" || eventType === "maze-visit") {
    return {
      bodyA: "rgba(50, 215, 75, 0.1)",
      bodyB: "rgba(34, 211, 238, 0.08)",
      bodyC: "rgba(255, 214, 10, 0.04)",
      heroA: "rgba(50, 215, 75, 0.15)",
      heroB: "rgba(34, 211, 238, 0.12)",
      heroC: "rgba(255, 214, 10, 0.07)"
    };
  }

  if (eventType === "graph-state") {
    return {
      bodyA: "rgba(50, 215, 75, 0.1)",
      bodyB: "rgba(34, 211, 238, 0.08)",
      bodyC: "rgba(255, 214, 10, 0.05)",
      heroA: "rgba(50, 215, 75, 0.13)",
      heroB: "rgba(34, 211, 238, 0.1)",
      heroC: "rgba(255, 214, 10, 0.07)"
    };
  }

  return defaults[category];
}

function parseInputJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function safeStringify(value: unknown): string {
  if (value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createImpulseResponse(context: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const value = Math.random() * 2 - 1;
      data[i] = value * Math.pow(1 - i / length, decay);
    }
  }

  return impulse;
}

function createNoiseBuffer(context: AudioContext, duration = 0.08): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  return buffer;
}

export default function HomePage() {
  const {
    locale,
    selectedAlgorithmId,
    selectedLanguage,
    speed,
    soundPreset,
    editorWrapMode,
    editorFontMode,
    projectMap,
    inputMap,
    setLocale,
    setAlgorithm,
    setLanguage,
    setSpeed,
    setSoundPreset,
    setEditorWrapMode,
    setEditorFontMode,
    setInputText,
    setActiveFile,
    updateFileContent,
    addFile,
    removeFile,
    hydrateFromShare
  } = useAppStore();

  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.4);
  const [outputText, setOutputText] = useState("");
  const [stderrText, setStderrText] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [autoPlayPending, setAutoPlayPending] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCodeCollapsed, setIsCodeCollapsed] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);
  const [activeMobilePicker, setActiveMobilePicker] = useState<MobilePickerName | null>(null);
  const [visualizerSession, setVisualizerSession] = useState(0);

  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);
  const audioRigRef = useRef<AudioRig | null>(null);
  const shareLoadedRef = useRef(false);
  const lastSoundIndexRef = useRef(-1);
  const executionTokenRef = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const mobilePickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  const algorithm = useMemo(() => algorithmById(selectedAlgorithmId), [selectedAlgorithmId]);
  const project = useMemo(
    () => ensureProject(projectMap, selectedAlgorithmId, selectedLanguage),
    [projectMap, selectedAlgorithmId, selectedLanguage]
  );
  const activeFile = useMemo(() => findActiveFile(project), [project]);
  const inputText = inputMap[selectedAlgorithmId] ?? "";
  const isCustomAlgorithm = selectedAlgorithmId === "custom";
  const currentTraceEvent = useMemo(() => {
    if (!events.length) {
      return null;
    }

    return events[Math.max(0, Math.min(currentIndex, events.length - 1))] ?? null;
  }, [currentIndex, events]);
  const ambientPalette = useMemo(
    () => resolveAmbientPalette(algorithm.category, currentTraceEvent),
    [algorithm.category, currentTraceEvent]
  );
  const visualizerMode = useMemo(
    () => resolveVisualizerMode(selectedAlgorithmId, algorithm, events),
    [algorithm, events, selectedAlgorithmId]
  );
  const ambientStyle = useMemo(
    () =>
      ({
        "--ambient-body-a": ambientPalette.bodyA,
        "--ambient-body-b": ambientPalette.bodyB,
        "--ambient-body-c": ambientPalette.bodyC,
        "--ambient-hero-a": ambientPalette.heroA,
        "--ambient-hero-b": ambientPalette.heroB,
        "--ambient-hero-c": ambientPalette.heroC
      }) as CSSProperties,
    [ambientPalette]
  );
  const soundPresetOptions = useMemo<PickerOption[]>(
    () => [
      { value: "soft", label: t(locale, "presetSoft") },
      { value: "balanced", label: t(locale, "presetBalanced") },
      { value: "punchy", label: t(locale, "presetPunchy") },
      { value: "piano", label: t(locale, "presetPiano") }
    ],
    [locale]
  );
  const algorithmOptions = useMemo<PickerOption[]>(
    () =>
      [...algorithms]
        .sort((a, b) => a.title[locale].localeCompare(b.title[locale], locale))
        .map((item) => ({
          value: item.id,
          label: item.title[locale]
        })),
    [locale]
  );
  const languageOptions = useMemo<PickerOption[]>(
    () =>
      (Object.entries(languageLabel) as Array<[Language, string]>).map(([key, label]) => ({
        value: key,
        label
      })),
    []
  );
  const localeOptions = useMemo<PickerOption[]>(
    () =>
      (Object.entries(localeLabel) as Array<[Locale, string]>).map(([key, label]) => ({
        value: key,
        label
      })),
    []
  );

  const resetPlaybackState = useCallback((clearOutput = false) => {
    executionTokenRef.current += 1;
    setEvents([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setIsRunning(false);
    setAutoPlayPending(false);
    setStatusNote("");
    lastSoundIndexRef.current = -1;
    setVisualizerSession((value) => value + 1);

    if (clearOutput) {
      setOutputText("");
      setStderrText("");
    }
  }, []);

  const closeMobilePicker = useCallback((restoreFocus = true) => {
    setActiveMobilePicker(null);

    if (restoreFocus && typeof window !== "undefined") {
      window.setTimeout(() => {
        mobilePickerTriggerRef.current?.focus();
      }, 0);
    }
  }, []);

  const openMobilePicker = useCallback((picker: MobilePickerName, event: MouseEvent<HTMLButtonElement>) => {
    mobilePickerTriggerRef.current = event.currentTarget;
    setIsSiteMenuOpen(false);
    setIsEditorMenuOpen(false);
    setActiveMobilePicker(picker);
  }, []);

  useEffect(() => {
    if (shareLoadedRef.current) {
      return;
    }

    const url = new URL(window.location.href);
    const share = url.searchParams.get("share");
    if (share) {
      const payload = decodeShare(share);
      if (payload) {
        hydrateFromShare(payload);
        resetPlaybackState(true);
        setStatusNote(t(payload.locale, "loadFromShare"));
      }
    }

    // Deep-link from /aprenda page: ?algorithm=heap-sort etc.
    const algorithmParam = url.searchParams.get("algorithm");
    if (algorithmParam && !share) {
      const algo = algorithms.find((a) => a.id === algorithmParam);
      if (algo) {
        setAlgorithm(algo.id as typeof selectedAlgorithmId);
      }
    }

    shareLoadedRef.current = true;
  }, [hydrateFromShare, resetPlaybackState, setAlgorithm, selectedAlgorithmId]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const frame = window.requestAnimationFrame(() => editor.layout());
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile.id, editorFontMode, editorWrapMode, isCodeCollapsed, isEditorFullscreen, selectedAlgorithmId, selectedLanguage]);

  useEffect(() => {
    if (!isEditorFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsEditorFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isEditorFullscreen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = tabsRef.current;
      const activeTab = activeTabRef.current;
      if (!container || !activeTab) {
        return;
      }

      const padding = isMobileViewport ? 12 : 18;
      const containerLeft = container.scrollLeft;
      const containerRight = containerLeft + container.clientWidth;
      const tabLeft = activeTab.offsetLeft;
      const tabRight = tabLeft + activeTab.offsetWidth;

      if (tabLeft < containerLeft + padding) {
        container.scrollTo({
          left: Math.max(tabLeft - padding, 0),
          behavior: "smooth"
        });
        return;
      }

      if (tabRight > containerRight - padding) {
        container.scrollTo({
          left: Math.max(tabRight - container.clientWidth + padding, 0),
          behavior: "smooth"
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeFile.id, isMobileViewport, project.files.length, selectedAlgorithmId, selectedLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = () => {
      const isMobile = window.innerWidth <= 640;
      setIsMobileViewport(isMobile);
      if (!isMobile) {
        setIsCodeCollapsed(false);
        setIsEditorMenuOpen(false);
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!activeMobilePicker) {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [activeMobilePicker]);

  useEffect(() => {
    if (!activeMobilePicker) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeMobilePicker();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMobilePicker, closeMobilePicker]);

  useEffect(() => {
    if (!isMobileViewport && activeMobilePicker) {
      closeMobilePicker(false);
    }
  }, [activeMobilePicker, closeMobilePicker, isMobileViewport]);

  useEffect(() => {
    if (!isPlaying || events.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= events.length - 1) {
          return previous;
        }

        return previous + 1;
      });
    }, Math.max(60, 340 / speed));

    return () => window.clearInterval(timer);
  }, [events.length, isPlaying, speed]);

  useEffect(() => {
    if (isPlaying && currentIndex >= events.length - 1) {
      setIsPlaying(false);
    }
  }, [currentIndex, events.length, isPlaying]);

  useEffect(() => {
    if (!autoPlayPending || events.length < 2 || currentIndex !== 0) {
      return;
    }

    const initialDelay = algorithm.category === "search" ? 450 : 260;
    const timer = window.setTimeout(() => {
      setIsPlaying(true);
      setAutoPlayPending(false);
    }, initialDelay);

    return () => window.clearTimeout(timer);
  }, [algorithm.category, autoPlayPending, currentIndex, events.length]);

  async function ensureAudio() {
    if (typeof window === "undefined") {
      return null;
    }

    const profilePreset = soundPreset === "piano" ? "balanced" : soundPreset;
    const profile = soundProfiles[profilePreset];

    if (!audioRigRef.current) {
      const AudioCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtor) {
        return null;
      }

      const context = new AudioCtor();
      const master = context.createGain();
      const compressor = context.createDynamicsCompressor();
      const mix = context.createGain();
      const dry = context.createGain();
      const wet = context.createGain();
      const convolver = context.createConvolver();

      compressor.threshold.value = -24;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;

      convolver.buffer = createImpulseResponse(context, 1.05, 2.4);
      dry.gain.value = 0.94;
      wet.gain.value = profile.reverb;
      master.gain.value = soundVolume * profile.volumeScale;

      mix.connect(dry);
      dry.connect(compressor);
      mix.connect(convolver);
      convolver.connect(wet);
      wet.connect(compressor);
      compressor.connect(master);
      master.connect(context.destination);

      audioRigRef.current = {
        context,
        master,
        wet,
        mix,
        noiseBuffer: createNoiseBuffer(context)
      };
    }

    audioRigRef.current.master.gain.value = soundVolume * profile.volumeScale;
    audioRigRef.current.wet.gain.value = profile.reverb;

    if (audioRigRef.current.context.state === "suspended") {
      await audioRigRef.current.context.resume();
    }

    return audioRigRef.current;
  }

  function playOsc(
    rig: AudioRig,
    options: {
      frequency: number;
      when?: number;
      duration?: number;
      gain?: number;
      type?: OscillatorType;
    }
  ) {
    const when = rig.context.currentTime + (options.when ?? 0);
    const duration = options.duration ?? 0.06;
    const gain = options.gain ?? 0.06;
    const osc = rig.context.createOscillator();
    const amp = rig.context.createGain();

    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(options.frequency, when);

    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), when + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(amp);
    amp.connect(rig.mix);

    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function playNoise(
    rig: AudioRig,
    options: {
      when?: number;
      duration?: number;
      gain?: number;
      highpass?: number;
    }
  ) {
    const when = rig.context.currentTime + (options.when ?? 0);
    const duration = options.duration ?? 0.04;
    const gain = options.gain ?? 0.015;
    const filter = rig.context.createBiquadFilter();
    const amp = rig.context.createGain();
    const source = rig.context.createBufferSource();

    source.buffer = rig.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(options.highpass ?? 1800, when);

    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), when + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(rig.mix);

    source.start(when);
    source.stop(when + duration + 0.02);
  }

  function playCompletionSequence<T>(
    rig: AudioRig,
    profile: SoundProfile,
    items: readonly T[],
    resolveFrequency: (item: T, index: number) => number,
    options: {
      finaleFrequency: number;
      highpass: number;
      stepMs?: number;
      finaleGain?: number;
    }
  ) {
    const limitedItems = items.slice(0, 12);
    const stepSeconds = (options.stepMs ?? 80) / 1000;

    limitedItems.forEach((item, index) => {
      playOsc(rig, {
        frequency: resolveFrequency(item, index),
        when: index * stepSeconds,
        type: "triangle",
        duration: 0.09,
        gain: Math.max(profile.doneGain - index * 0.003, 0.04)
      });
    });

    playOsc(rig, {
      frequency: options.finaleFrequency,
      when: limitedItems.length * stepSeconds + 0.02,
      type: "sine",
      duration: 0.12,
      gain: options.finaleGain ?? profile.doneGain
    });
    playNoise(rig, {
      when: limitedItems.length * stepSeconds + 0.01,
      duration: 0.05,
      gain: Math.max(profile.swapNoise - 0.006, 0.01),
      highpass: options.highpass
    });
  }

  function playPianoFrequency(
    rig: AudioRig,
    frequency: number,
    when = 0,
    options?: {
      duration?: number;
      gain?: number;
    }
  ) {
    const duration = options?.duration ?? 0.52;
    const peakGain = options?.gain ?? soundVolume * 0.14;
    const t = rig.context.currentTime + when;

    // Fundamental — clean sine
    const osc1 = rig.context.createOscillator();
    const g1 = rig.context.createGain();
    osc1.type = "sine";
    osc1.frequency.value = frequency;
    osc1.connect(g1);
    g1.connect(rig.master);
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(peakGain, t + 0.006);
    g1.gain.exponentialRampToValueAtTime(peakGain * 0.35, t + 0.12);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc1.start(t);
    osc1.stop(t + duration + 0.04);

    // 2nd harmonic — adds brightness
    const osc2 = rig.context.createOscillator();
    const g2 = rig.context.createGain();
    osc2.type = "sine";
    osc2.frequency.value = frequency * 2;
    osc2.connect(g2);
    g2.connect(rig.master);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(peakGain * 0.3, t + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.5);
    osc2.start(t);
    osc2.stop(t + duration * 0.5 + 0.04);

    // 3rd harmonic — subtle warmth
    const osc3 = rig.context.createOscillator();
    const g3 = rig.context.createGain();
    osc3.type = "sine";
    osc3.frequency.value = frequency * 3;
    osc3.connect(g3);
    g3.connect(rig.master);
    g3.gain.setValueAtTime(0, t);
    g3.gain.linearRampToValueAtTime(peakGain * 0.1, t + 0.003);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.25);
    osc3.start(t);
    osc3.stop(t + duration * 0.25 + 0.04);
  }

  function playPianoNote(rig: AudioRig, value: number, maxValue: number, when = 0) {
    const minFreq = 130.81; // C3
    const maxFreq = 1046.5; // C6
    const ratio = Math.max(0, Math.min(1, value / Math.max(maxValue, 1)));
    const freq = minFreq * Math.pow(maxFreq / minFreq, ratio);
    playPianoFrequency(rig, freq, when);
  }

  function playPositionalEventSound(rig: AudioRig, event: TraceEvent, eventType: string): boolean {
    if (eventType === "maze-start") {
      const start = Array.isArray(event.start) ? event.start : [];
      const row = typeof start[0] === "number" ? start[0] : 0;
      const col = typeof start[1] === "number" ? start[1] : 0;
      const frequency = 220 + row * 24 + col * 12;

      if (soundPreset === "piano") {
        playPianoFrequency(rig, frequency, 0, {
          duration: 0.22,
          gain: soundVolume * 0.09
        });
      } else {
        const profile = soundProfiles[soundPreset];
        playOsc(rig, {
          frequency,
          type: "triangle",
          duration: 0.05,
          gain: Math.max(profile.compareGain - 0.01, 0.02)
        });
      }

      return true;
    }

    if (eventType === "maze-visit") {
      const row = typeof event.row === "number" ? event.row : 0;
      const col = typeof event.col === "number" ? event.col : 0;
      const frequency = 260 + row * 28 + col * 14;

      if (soundPreset === "piano") {
        playPianoFrequency(rig, frequency, 0, {
          duration: 0.22,
          gain: soundVolume * 0.1
        });
      } else {
        const profile = soundProfiles[soundPreset];
        playOsc(rig, {
          frequency,
          type: "triangle",
          duration: 0.04,
          gain: Math.max(profile.compareGain, 0.03)
        });
      }

      return true;
    }

    return false;
  }

  async function playEventSound(event: TraceEvent) {
    if (!soundEnabled) {
      return;
    }

    const rig = await ensureAudio();
    if (!rig) {
      return;
    }

    const eventType = String(event.t ?? "");

    if (playPositionalEventSound(rig, event, eventType)) {
      return;
    }

    // Piano preset — pitched notes mapped to array values
    if (soundPreset === "piano") {
      const arr = Array.isArray(event.arr) ? (event.arr as number[]) : [];
      const maxVal = arr.length ? Math.max(...arr, 1) : 1;
      if (eventType === "compare" || eventType === "heapify") {
        const i = typeof event.i === "number" ? event.i : 0;
        playPianoNote(rig, arr[i] ?? maxVal / 2, maxVal);
        return;
      }
      if (eventType === "swap" || eventType === "extract") {
        const i = typeof event.i === "number" ? event.i : 0;
        const j = typeof event.j === "number" ? event.j : 0;
        playPianoNote(rig, arr[i] ?? maxVal / 2, maxVal);
        playPianoNote(rig, arr[j] ?? maxVal / 2, maxVal, 0.09);
        return;
      }
      if (eventType === "distribute" || eventType === "counting" || eventType === "placing") {
        const activeIdx = typeof event.activeIdx === "number" ? event.activeIdx : (typeof event.i === "number" ? event.i : 0);
        playPianoNote(rig, arr[activeIdx] ?? maxVal / 2, maxVal);
        return;
      }
      if (eventType === "done" && arr.length > 0) {
        arr.slice(0, 12).forEach((val, idx) => {
          playPianoNote(rig, val, maxVal, idx * 0.07);
        });
        return;
      }
      return;
    }

    // soundPreset is narrowed to Exclude<SoundPreset, "piano"> here (piano handled above)
    const profile = soundProfiles[soundPreset];

    if (eventType === "compare" || eventType === "search-window") {
      playOsc(rig, {
        frequency: 720,
        type: "triangle",
        duration: 0.045,
        gain: profile.compareGain
      });
      playNoise(rig, { duration: 0.028, gain: profile.compareNoise, highpass: 2400 });
      return;
    }

    if (eventType === "swap") {
      playOsc(rig, { frequency: 560, type: "triangle", duration: 0.065, gain: profile.swapGain });
      playOsc(rig, {
        frequency: 820,
        when: 0.04,
        type: "sine",
        duration: 0.07,
        gain: Math.max(profile.swapGain - 0.015, 0.03)
      });
      playNoise(rig, { duration: 0.035, gain: profile.swapNoise, highpass: 1800 });
      return;
    }

    if (eventType === "search-found" || eventType === "search-miss") {
      const values = safeArrayValues(event);
      if (values.length > 0) {
        const isFound = eventType === "search-found";
        playCompletionSequence(
          rig,
          profile,
          values,
          (value, index) =>
            (isFound ? 380 : 300) + index * (isFound ? 34 : 26) + (Math.abs(value) % 7) * 9,
          {
            finaleFrequency: isFound ? 860 : 620,
            highpass: isFound ? 2200 : 1500,
            finaleGain: isFound ? profile.doneGain : Math.max(profile.doneGain - 0.012, 0.04)
          }
        );
        return;
      }
    }

    if (eventType === "stalin-step") {
      if (event.accepted) {
        playOsc(rig, {
          frequency: 640,
          type: "triangle",
          duration: 0.05,
          gain: Math.max(profile.compareGain, 0.04)
        });
      } else {
        playOsc(rig, {
          frequency: 280,
          type: "sine",
          duration: 0.09,
          gain: profile.rejectGain
        });
        playNoise(rig, { duration: 0.045, gain: profile.swapNoise, highpass: 900 });
      }
      return;
    }

    if (eventType === "distribute" || eventType === "counting" || eventType === "placing") {
      const arr = Array.isArray(event.arr) ? (event.arr as number[]) : [];
      const maxVal = arr.length ? Math.max(...arr, 1) : 1;
      const activeIdx = typeof event.activeIdx === "number" ? event.activeIdx : (typeof event.i === "number" ? event.i : 0);
      const val = arr[activeIdx] ?? maxVal / 2;
      playOsc(rig, {
        frequency: 300 + (val / maxVal) * 420,
        type: "triangle",
        duration: 0.04,
        gain: profile.compareGain
      });
      return;
    }

    if (eventType === "merge") {
      playOsc(rig, {
        frequency: 580,
        type: "sine",
        duration: 0.05,
        gain: Math.max(profile.compareGain, 0.035)
      });
      return;
    }

    if (eventType === "graph-state") {
      const current = typeof event.current === "string" ? event.current.charCodeAt(0) : 0;
      playOsc(rig, {
        frequency: 360 + (current % 8) * 28,
        type: "triangle",
        duration: 0.05,
        gain: Math.max(profile.compareGain, 0.035)
      });
      return;
    }

    if (eventType === "done") {
      const values = safeArrayValues(event);
      if (values.length > 0) {
        playCompletionSequence(
          rig,
          profile,
          values,
          (value, index) => 400 + index * 36 + (Math.abs(value) % 6) * 10,
          {
            finaleFrequency: 900,
            highpass: 2200
          }
        );
        return;
      }

      const graphOrder = safeGraphOrder(event);
      if (graphOrder.length > 0 && typeof event.mode === "string") {
        playCompletionSequence(
          rig,
          profile,
          graphOrder,
          (node, index) => {
            const seed = typeof node === "string" ? node.charCodeAt(0) % 6 : 0;
            return 420 + index * 42 + seed * 14;
          },
          {
            finaleFrequency: 920,
            highpass: 2200
          }
        );
        return;
      }

      playOsc(rig, { frequency: 520, duration: 0.07, gain: profile.doneGain });
      playOsc(rig, { frequency: 680, when: 0.055, duration: 0.07, gain: profile.doneGain });
      playOsc(rig, { frequency: 860, when: 0.11, duration: 0.08, gain: profile.doneGain });
    }
  }

  useEffect(() => {
    if (!soundEnabled || events.length === 0) {
      return;
    }

    if (lastSoundIndexRef.current === currentIndex) {
      return;
    }

    if (!events[currentIndex]) {
      return;
    }

    lastSoundIndexRef.current = currentIndex;
    void playEventSound(events[currentIndex]);
  }, [currentIndex, events, soundEnabled, soundPreset]);

  useEffect(() => {
    return () => {
      audioRigRef.current?.context.close();
      audioRigRef.current = null;
    };
  }, []);

  async function runCode() {
    const parsed = parseInputJson(inputText);
    if (!parsed.ok || parsed.value == null || typeof parsed.value !== "object") {
      setStderrText(t(locale, "invalidInput"));
      return;
    }

    if (soundEnabled) {
      void ensureAudio();
    }

    resetPlaybackState(true);
    setIsRunning(true);
    const executionToken = executionTokenRef.current;

    const result = await executeCode({
      language: selectedLanguage,
      files: project.files,
      entrypoint: project.entrypoint,
      input: parsed.value,
      timeoutMs: selectedLanguage === "python" ? 20000 : 7000
    });

    if (executionToken !== executionTokenRef.current) {
      return;
    }

    setIsRunning(false);
    setEvents(result.events);
    setCurrentIndex(0);
    setIsPlaying(false);
    setAutoPlayPending(result.ok && result.events.length > 1);

    const composedOutput = [result.stdout, safeStringify(result.output)].filter(Boolean).join("\n");
    setOutputText(composedOutput);

    if (!result.ok) {
      setStderrText(`${t(locale, "executionError")}: ${result.stderr ?? "Unknown error"}`);
    } else {
      setStderrText("");
      setStatusNote(`${t(locale, "idle")} • ${result.durationMs}ms • ${result.events.length} events`);
    }
  }

  function autoFillInput() {
    const source = project.files.map((file) => file.content).join("\n\n");
    const inferred = inferCustomInputValue(source);
    setInputText(selectedAlgorithmId, stringifyInputValue(inferred));
    setStatusNote(t(locale, Array.isArray(inferred) ? "autoInputArrayReady" : "autoInputMazeReady"));
  }

  function copyShareLink() {
    const payload: SharePayload = {
      version: 1,
      algorithmId: selectedAlgorithmId,
      language: selectedLanguage,
      project,
      inputText,
      locale,
      soundPreset
    };

    const encoded = encodeShare(payload);
    const url = new URL(window.location.href);
    url.searchParams.set("share", encoded);

    navigator.clipboard
      .writeText(url.toString())
      .then(() => setStatusNote(t(locale, "copied")))
      .catch(() => setStatusNote(t(locale, "copiedFail")));
  }

  function exportProject() {
    const payload: SharePayload = {
      version: 1,
      algorithmId: selectedAlgorithmId,
      language: selectedLanguage,
      project,
      inputText,
      locale,
      soundPreset
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `algorui-${selectedAlgorithmId}-${selectedLanguage}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        const payload = JSON.parse(text) as SharePayload;
        if (payload.version !== 1) {
          throw new Error("Invalid payload");
        }
        hydrateFromShare(payload);
        resetPlaybackState(true);
        setStatusNote(t(payload.locale, "loadFromShare"));
      })
      .catch(() => {
        setStatusNote(t(locale, "invalidInput"));
      })
      .finally(() => {
        event.target.value = "";
      });
  }

  const currentEventPreview = useMemo(() => {
    if (!currentTraceEvent) {
      return "";
    }

    return safeStringify(currentTraceEvent);
  }, [currentTraceEvent]);
  const activeMobilePickerConfig = useMemo(() => {
    switch (activeMobilePicker) {
      case "soundPreset":
        return {
          dialogId: "mobile-picker-sound-preset",
          label: t(locale, "soundPreset"),
          value: soundPreset,
          options: soundPresetOptions,
          onSelect: (nextValue: string) => {
            if (nextValue !== soundPreset) {
              setSoundPreset(nextValue as SoundPreset);
            }
          }
        };
      case "algorithm":
        return {
          dialogId: "mobile-picker-algorithm",
          label: t(locale, "algorithm"),
          value: selectedAlgorithmId,
          options: algorithmOptions,
          onSelect: (nextValue: string) => {
            if (nextValue !== selectedAlgorithmId) {
              setAlgorithm(nextValue as typeof selectedAlgorithmId);
              resetPlaybackState(true);
            }
          }
        };
      case "language":
        return {
          dialogId: "mobile-picker-language",
          label: t(locale, "language"),
          value: selectedLanguage,
          options: languageOptions,
          onSelect: (nextValue: string) => {
            if (nextValue !== selectedLanguage) {
              setLanguage(nextValue as typeof selectedLanguage);
              resetPlaybackState(true);
            }
          }
        };
      case "locale":
        return {
          dialogId: "mobile-picker-locale",
          label: "Locale",
          value: locale,
          options: localeOptions,
          onSelect: (nextValue: string) => {
            if (nextValue !== locale) {
              setLocale(nextValue as typeof locale);
            }
          }
        };
      default:
        return null;
    }
  }, [
    activeMobilePicker,
    algorithmOptions,
    languageOptions,
    locale,
    localeOptions,
    resetPlaybackState,
    selectedAlgorithmId,
    selectedLanguage,
    setAlgorithm,
    setLanguage,
    setLocale,
    setSoundPreset,
    soundPreset,
    soundPresetOptions
  ]);
  const handleMobilePickerSelect = useCallback(
    (nextValue: string) => {
      if (!activeMobilePickerConfig) {
        return;
      }

      activeMobilePickerConfig.onSelect(nextValue);
      closeMobilePicker();
    },
    [activeMobilePickerConfig, closeMobilePicker]
  );

  const fontModeIndex = fontModeOrder.indexOf(editorFontMode);
  const canDecreaseFont = fontModeIndex > 0;
  const canIncreaseFont = fontModeIndex < fontModeOrder.length - 1;

  return (
    <main className="app-shell" style={ambientStyle}>
      <header className="site-topbar">
        <BrandLogo />
        <div className="topbar-right">
          <a
            href="https://github.com/albavxs/AlgoriUI"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            aria-label="GitHub"
          >
            <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
          <Link href="/aprenda" className="topbar-learn-link" onClick={() => setIsSiteMenuOpen(false)}>
            <span>{locale === "pt" ? "Aprenda" : "Learn"}</span>
            <span className="topbar-learn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <div className="site-menu-wrap">
          <button
            type="button"
            className={`site-menu-trigger ${isSiteMenuOpen ? "active" : ""}`}
            onClick={() => setIsSiteMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={isSiteMenuOpen}
          >
            <SiteMenuIcon className="editor-tool-icon" />
          </button>
          <AnimatePresence>
            {isSiteMenuOpen && (
              <motion.div
                key="site-menu-dropdown"
                className="site-menu-dropdown"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className="site-menu-locale">
                  {(["pt", "en"] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      className={`locale-pill ${locale === loc ? "active" : ""}`}
                      onClick={() => setLocale(loc)}
                    >
                      {localeLabel[loc]}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </header>

      <section className="hero-stage">
        <div className="hero-copy">
          <h1>{algorithm.title[locale]}</h1>
          <p>{algorithm.subtitle[locale]}</p>
          <div className="formula-row">
            <span>Time: {algorithm.complexity.time}</span>
            <span>Space: {algorithm.complexity.space}</span>
          </div>
        </div>

        <Visualizer
          key={`${selectedAlgorithmId}-${selectedLanguage}-${visualizerSession}`}
          visualizer={visualizerMode}
          events={events}
          currentIndex={currentIndex}
          emptyLabel={t(locale, "noEvents")}
        />
      </section>

      <section className={`code-window ${isCodeCollapsed ? "mobile-collapsed" : ""} ${isEditorFullscreen ? "editor-fullscreen" : ""}`}>
        <LayoutGroup id="file-window-tabs">
          <div className="window-header">
            <div ref={tabsRef} className="window-tabs" role="tablist" aria-label={t(locale, "fileWindow")}>
              <AnimatePresence initial={false}>
                {project.files.map((file) => {
                  const removable = canRemoveFile(project, file.id);
                  const active = file.id === activeFile.id;

                  return (
                    <motion.button
                      key={file.id}
                      layout
                      initial={{ opacity: 0, y: 6, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      ref={active ? activeTabRef : null}
                      className={`file-tab ${active ? "active" : ""}`}
                      onClick={() => setActiveFile(selectedAlgorithmId, selectedLanguage, file.id)}
                      title={file.name}
                    >
                      {active ? (
                        <motion.span
                          layoutId="active-file-pill"
                          className="file-tab-pill"
                          transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        />
                      ) : null}
                      <span className="file-tab-inner">
                        <span className={`lang-badge ${selectedLanguage}`}>
                          {languageMeta[selectedLanguage].badge}
                        </span>
                        <span className="file-name">{file.name}</span>
                        {removable ? (
                          <span
                            className="file-close"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeFile(selectedAlgorithmId, selectedLanguage, file.id);
                            }}
                          >
                            x
                          </span>
                        ) : (
                          <span className="file-lock" title={t(locale, "lockedFile")}>
                            *
                          </span>
                        )}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              <motion.button
                layout
                whileTap={{ scale: 0.96 }}
                type="button"
                className="file-add file-add-inline"
                onClick={() => addFile(selectedAlgorithmId, selectedLanguage)}
                aria-label={t(locale, "addFile")}
                title={t(locale, "addFile")}
              >
                <AddFileIcon className="file-add-icon" />
              </motion.button>
              <button
                type="button"
                className="editor-tool-chip file-add-inline"
                onClick={() => setIsCodeCollapsed((value) => !value)}
                title={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
                aria-expanded={!isCodeCollapsed}
                aria-label={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
              >
                <CollapseCodeIcon className="editor-tool-icon" collapsed={isCodeCollapsed} />
              </button>
            </div>
            <div className="editor-toolbar">
              <div className="editor-toolbar-mobile mobile-only">
                {isEditorFullscreen ? (
                  <button
                    type="button"
                    className="editor-tool-chip editor-fullscreen-back"
                    onClick={() => setIsEditorFullscreen(false)}
                    aria-label={t(locale, "exitFullscreen")}
                    title={t(locale, "exitFullscreen")}
                  >
                    <FullscreenBackIcon className="editor-tool-icon" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="file-add"
                      onClick={() => addFile(selectedAlgorithmId, selectedLanguage)}
                      aria-label={t(locale, "addFile")}
                      title={t(locale, "addFile")}
                    >
                      <AddFileIcon className="file-add-icon" />
                    </button>
                    <button
                      type="button"
                      className="editor-tool-chip"
                      onClick={() => setIsCodeCollapsed((value) => !value)}
                      title={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
                      aria-expanded={!isCodeCollapsed}
                      aria-label={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
                    >
                      <CollapseCodeIcon className="editor-tool-icon" collapsed={isCodeCollapsed} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="editor-tool-chip editor-run-button"
                  onClick={runCode}
                  disabled={isRunning}
                  aria-label={isRunning ? t(locale, "running") : t(locale, "run")}
                  title={isRunning ? t(locale, "running") : t(locale, "run")}
                >
                  <RunAnimationIcon className="editor-tool-icon" />
                </button>
              </div>
              <div className="editor-toolbar-desktop">
                <button
                  type="button"
                  className="editor-tool-chip editor-run-button"
                  onClick={runCode}
                  disabled={isRunning}
                  aria-label={isRunning ? t(locale, "running") : t(locale, "run")}
                  title={isRunning ? t(locale, "running") : t(locale, "run")}
                >
                  <RunAnimationIcon className="editor-tool-icon" />
                </button>
                <div className="editor-tool-group" aria-label={t(locale, "wrapMode")}>
                  {(["auto", "wrap", "nowrap"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`editor-tool-chip ${editorWrapMode === mode ? "active" : ""}`}
                      onClick={() => setEditorWrapMode(mode)}
                      aria-label={t(locale, wrapLabelKey[mode])}
                      title={`${t(locale, "wrapMode")}: ${t(locale, wrapLabelKey[mode])}`}
                    >
                      {mode === "auto" ? (
                        <WrapAutoIcon className="editor-tool-icon" />
                      ) : mode === "wrap" ? (
                        <WrapOnIcon className="editor-tool-icon" />
                      ) : (
                        <WrapOffIcon className="editor-tool-icon" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="editor-tool-group editor-font-group" aria-label={t(locale, "fontSize")}>
                  <button
                    type="button"
                    className="editor-tool-chip"
                    onClick={() => setEditorFontMode(fontModeOrder[fontModeIndex - 1] ?? "sm")}
                    disabled={!canDecreaseFont}
                    aria-label={t(locale, "fontDecrease")}
                    title={t(locale, "fontDecrease")}
                  >
                    <FontSmallIcon className="editor-tool-icon" />
                  </button>
                  <button
                    type="button"
                    className="editor-tool-chip"
                    onClick={() => setEditorFontMode(fontModeOrder[fontModeIndex + 1] ?? "lg")}
                    disabled={!canIncreaseFont}
                    aria-label={t(locale, "fontIncrease")}
                    title={t(locale, "fontIncrease")}
                  >
                    <FontLargeIcon className="editor-tool-icon" />
                  </button>
                </div>
                <button
                  type="button"
                  className={`editor-tool-chip ${isEditorFullscreen ? "active" : ""}`}
                  onClick={() => setIsEditorFullscreen((v) => !v)}
                  aria-label={isEditorFullscreen ? t(locale, "exitFullscreen") : t(locale, "fullscreen")}
                  title={isEditorFullscreen ? t(locale, "exitFullscreen") : t(locale, "fullscreen")}
                >
                  <FullscreenIcon className="editor-tool-icon" active={isEditorFullscreen} />
                </button>
              </div>
              <button
                type="button"
                className={`editor-tool-chip mobile-only ${isEditorFullscreen ? "active" : ""}`}
                onClick={() => setIsEditorFullscreen((v) => !v)}
                aria-label={isEditorFullscreen ? t(locale, "exitFullscreen") : t(locale, "fullscreen")}
                title={isEditorFullscreen ? t(locale, "exitFullscreen") : t(locale, "fullscreen")}
              >
                <FullscreenIcon className="editor-tool-icon" active={isEditorFullscreen} />
              </button>
              <button
                type="button"
                className={`editor-tool-chip editor-menu-button mobile-only ${isEditorMenuOpen ? "active" : ""}`}
                onClick={() => setIsEditorMenuOpen((value) => !value)}
                aria-expanded={isEditorMenuOpen}
                aria-label={t(locale, "editor")}
                title={t(locale, "editor")}
              >
                <EditorMenuIcon className="editor-tool-icon" />
              </button>
            </div>
          </div>
        </LayoutGroup>

        <AnimatePresence initial={false}>
          {isMobileViewport && isEditorMenuOpen ? (
            <motion.div
              key="editor-mobile-menu"
              className="editor-mobile-panel"
              initial={{ opacity: 0, y: -10, scale: 0.96, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, scale: 0.98, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="editor-tool-group" aria-label={t(locale, "wrapMode")}>
                {(["auto", "wrap", "nowrap"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`editor-tool-chip ${editorWrapMode === mode ? "active" : ""}`}
                    onClick={() => setEditorWrapMode(mode)}
                    aria-label={t(locale, wrapLabelKey[mode])}
                    title={`${t(locale, "wrapMode")}: ${t(locale, wrapLabelKey[mode])}`}
                  >
                    {mode === "auto" ? (
                      <WrapAutoIcon className="editor-tool-icon" />
                    ) : mode === "wrap" ? (
                      <WrapOnIcon className="editor-tool-icon" />
                    ) : (
                      <WrapOffIcon className="editor-tool-icon" />
                    )}
                  </button>
                ))}
              </div>
              <div className="editor-tool-group editor-font-group" aria-label={t(locale, "fontSize")}>
                <button
                  type="button"
                  className="editor-tool-chip"
                  onClick={() => setEditorFontMode(fontModeOrder[fontModeIndex - 1] ?? "sm")}
                  disabled={!canDecreaseFont}
                  aria-label={t(locale, "fontDecrease")}
                  title={t(locale, "fontDecrease")}
                >
                  <FontSmallIcon className="editor-tool-icon" />
                </button>
                <button
                  type="button"
                  className="editor-tool-chip"
                  onClick={() => setEditorFontMode(fontModeOrder[fontModeIndex + 1] ?? "lg")}
                  disabled={!canIncreaseFont}
                  aria-label={t(locale, "fontIncrease")}
                  title={t(locale, "fontIncrease")}
                >
                  <FontLargeIcon className="editor-tool-icon" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isEditorFullscreen || !isMobileViewport || !isCodeCollapsed ? (
            <motion.div
              key="editor-panel"
              className="editor-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <CodeEditor
                language={selectedLanguage}
                path={activeFile.name}
                value={activeFile.content}
                height={isEditorFullscreen ? "100%" : "360px"}
                wrapMode={editorWrapMode}
                fontMode={editorFontMode}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                onChange={(value) =>
                  updateFileContent(selectedAlgorithmId, selectedLanguage, activeFile.id, value)
                }
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <section className="panel-card controls-panel">
        <div className="controls-row">
          <button className="control-button primary" onClick={runCode} disabled={isRunning}>
            {isRunning ? t(locale, "running") : t(locale, "run")}
          </button>
          <button
            className="control-button"
            onClick={() => setIsPlaying((value) => !value)}
            disabled={events.length < 2}
          >
            {isPlaying ? t(locale, "pause") : t(locale, "resume")}
          </button>
          <button
            className="control-button"
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
            disabled={!events.length}
          >
            {t(locale, "stepBack")}
          </button>
          <button
            className="control-button"
            onClick={() => setCurrentIndex((value) => Math.min(events.length - 1, value + 1))}
            disabled={!events.length}
          >
            {t(locale, "stepForward")}
          </button>
          <button
            className="control-button"
            onClick={() => {
              setCurrentIndex(0);
              setIsPlaying(false);
              lastSoundIndexRef.current = -1;
            }}
            disabled={!events.length}
          >
            {t(locale, "reset")}
          </button>
        </div>

        <div className="controls-grid">
          <label className="control-block">
            <span>
              {t(locale, "timeline")} {events.length ? `${currentIndex + 1}/${events.length}` : "0/0"}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(events.length - 1, 0)}
              value={events.length ? currentIndex : 0}
              onChange={(event) => setCurrentIndex(Number(event.target.value))}
              disabled={!events.length}
            />
          </label>

          <label className="control-block">
            <span>
              {t(locale, "speed")}: {speed.toFixed(2)}x
            </span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.25}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>

          <div className="sound-panel">
            <div className="sound-toggle">
              <span>
                {t(locale, "sound")}: {soundEnabled ? t(locale, "soundOn") : t(locale, "soundOff")}
              </span>
              <button
                type="button"
                className={`switch ${soundEnabled ? "on" : "off"}`}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) {
                    void ensureAudio();
                  }
                }}
              >
                <span />
              </button>
            </div>

            <AdaptivePickerField
              compact
              dialogId="mobile-picker-sound-preset"
              label={t(locale, "soundPreset")}
              mobile={isMobileViewport}
              open={activeMobilePicker === "soundPreset"}
              options={soundPresetOptions}
              value={soundPreset}
              valueLabel={t(locale, presetLabelKey[soundPreset])}
              onOpen={(event) => openMobilePicker("soundPreset", event)}
              onNativeChange={(value) => setSoundPreset(value as SoundPreset)}
            />

            <label className="control-block compact">
              <span>
                {t(locale, "volume")}: {Math.round(soundVolume * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={soundVolume}
                onChange={(event) => setSoundVolume(Number(event.target.value))}
                disabled={!soundEnabled}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="panel-card feature-panel">
        <div className="selectors-grid">
          <AdaptivePickerField
            dialogId="mobile-picker-algorithm"
            label={t(locale, "algorithm")}
            mobile={isMobileViewport}
            open={activeMobilePicker === "algorithm"}
            options={algorithmOptions}
            value={selectedAlgorithmId}
            valueLabel={algorithm.title[locale]}
            onOpen={(event) => openMobilePicker("algorithm", event)}
            onNativeChange={(value) => {
              setAlgorithm(value as typeof selectedAlgorithmId);
              resetPlaybackState(true);
            }}
          />

          <AdaptivePickerField
            dialogId="mobile-picker-language"
            label={t(locale, "language")}
            mobile={isMobileViewport}
            open={activeMobilePicker === "language"}
            options={languageOptions}
            value={selectedLanguage}
            valueLabel={languageLabel[selectedLanguage]}
            onOpen={(event) => openMobilePicker("language", event)}
            onNativeChange={(value) => {
              setLanguage(value as typeof selectedLanguage);
              resetPlaybackState(true);
            }}
          />

          <AdaptivePickerField
            dialogId="mobile-picker-locale"
            label="Locale"
            mobile={isMobileViewport}
            open={activeMobilePicker === "locale"}
            options={localeOptions}
            value={locale}
            valueLabel={localeLabel[locale]}
            onOpen={(event) => openMobilePicker("locale", event)}
            onNativeChange={(value) => setLocale(value as typeof locale)}
          />
        </div>

        <div className="actions-row">
          <button className="action-button" onClick={copyShareLink}>
            {t(locale, "copyShare")}
          </button>
          <button className="action-button" onClick={exportProject}>
            {t(locale, "exportJson")}
          </button>
          <button className="action-button" onClick={() => importRef.current?.click()}>
            {t(locale, "importJson")}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            onChange={onImportFile}
            hidden
          />
        </div>
      </section>

      <section className="panel-card io-panel">
        <div className="io-grid">
          <label className="io-field">
            <div className="io-field-head">
              <span>{t(locale, "input")}</span>
              {isCustomAlgorithm ? (
                <button type="button" className="action-button io-auto-button" onClick={autoFillInput}>
                  {t(locale, "autoInput")}
                </button>
              ) : null}
            </div>
            <textarea
              className="io-textarea"
              value={inputText}
              onChange={(event) => setInputText(selectedAlgorithmId, event.target.value)}
              placeholder={isCustomAlgorithm ? t(locale, "customInputPlaceholder") : undefined}
              rows={8}
            />
            {isCustomAlgorithm ? <small className="io-field-hint">{t(locale, "autoInputHint")}</small> : null}
          </label>

          <label className="io-field">
            <span>{t(locale, "output")}</span>
            <textarea className="io-textarea io-output" value={outputText || stderrText} readOnly rows={8} />
          </label>
        </div>
      </section>

      <details className="event-panel">
        <summary>{t(locale, "advanced")}</summary>
        <pre>{currentEventPreview || "{}"}</pre>
      </details>

      <footer className="status-line">{statusNote}</footer>

      <AnimatePresence>
        {isMobileViewport && activeMobilePickerConfig ? (
          <MobilePickerSheet
            closeLabel={t(locale, "close")}
            dialogId={activeMobilePickerConfig.dialogId}
            label={activeMobilePickerConfig.label}
            options={activeMobilePickerConfig.options}
            value={activeMobilePickerConfig.value}
            onClose={() => closeMobilePicker()}
            onSelect={handleMobilePickerSelect}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}
