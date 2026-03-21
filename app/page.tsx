"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { type CSSProperties, ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AlgorithmCategory, Language, SharePayload, SoundPreset, TraceEvent } from "@/lib/types";

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

const soundProfiles: Record<SoundPreset, SoundProfile> = {
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

const presetLabelKey: Record<SoundPreset, "presetSoft" | "presetBalanced" | "presetPunchy"> = {
  soft: "presetSoft",
  balanced: "presetBalanced",
  punchy: "presetPunchy"
};

const wrapLabelKey: Record<EditorWrapMode, "wrapAuto" | "wrapOn" | "wrapOff"> = {
  auto: "wrapAuto",
  wrap: "wrapOn",
  nowrap: "wrapOff"
};

const fontModeOrder: EditorFontMode[] = ["sm", "md", "lg"];

type IconProps = {
  className?: string;
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
  const [isEditorMenuOpen, setIsEditorMenuOpen] = useState(false);
  const [visualizerSession, setVisualizerSession] = useState(0);

  const importRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MonacoEditorApi.IStandaloneCodeEditor | null>(null);
  const audioRigRef = useRef<AudioRig | null>(null);
  const shareLoadedRef = useRef(false);
  const lastSoundIndexRef = useRef(-1);
  const executionTokenRef = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const algorithm = useMemo(() => algorithmById(selectedAlgorithmId), [selectedAlgorithmId]);
  const project = useMemo(
    () => ensureProject(projectMap, selectedAlgorithmId, selectedLanguage),
    [projectMap, selectedAlgorithmId, selectedLanguage]
  );
  const activeFile = useMemo(() => findActiveFile(project), [project]);
  const inputText = inputMap[selectedAlgorithmId] ?? "";
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

  useEffect(() => {
    if (shareLoadedRef.current) {
      return;
    }

    const url = new URL(window.location.href);
    const share = url.searchParams.get("share");
    if (!share) {
      shareLoadedRef.current = true;
      return;
    }

    const payload = decodeShare(share);
    if (payload) {
      hydrateFromShare(payload);
      resetPlaybackState(true);
      setStatusNote(t(payload.locale, "loadFromShare"));
    }

    shareLoadedRef.current = true;
  }, [hydrateFromShare, resetPlaybackState]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const frame = window.requestAnimationFrame(() => editor.layout());
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile.id, editorFontMode, editorWrapMode, isCodeCollapsed, selectedAlgorithmId, selectedLanguage]);

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

    const profile = soundProfiles[soundPreset];

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

  async function playEventSound(event: TraceEvent) {
    if (!soundEnabled) {
      return;
    }

    const rig = await ensureAudio();
    if (!rig) {
      return;
    }

    const profile = soundProfiles[soundPreset];
    const eventType = String(event.t ?? "");

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
    if (!parsed.ok) {
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

  const fontModeIndex = fontModeOrder.indexOf(editorFontMode);
  const canDecreaseFont = fontModeIndex > 0;
  const canIncreaseFont = fontModeIndex < fontModeOrder.length - 1;

  return (
    <main className="app-shell" style={ambientStyle}>
      <header className="site-topbar">
        <div className="brand-mark">AlgorUI</div>
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
          category={algorithm.category}
          events={events}
          currentIndex={currentIndex}
          emptyLabel={t(locale, "noEvents")}
        />
      </section>

      <section className={`code-window ${isCodeCollapsed ? "mobile-collapsed" : ""}`}>
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
            </div>
            <div className="editor-toolbar">
              <div className="editor-toolbar-mobile mobile-only">
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
              </div>
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
              <button
                type="button"
                className="editor-tool-chip editor-mobile-action"
                onClick={() => {
                  setIsCodeCollapsed((value) => !value);
                  setIsEditorMenuOpen(false);
                }}
                title={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
                aria-expanded={!isCodeCollapsed}
                aria-label={isCodeCollapsed ? t(locale, "expandCode") : t(locale, "collapseCode")}
              >
                <CollapseCodeIcon className="editor-tool-icon" collapsed={isCodeCollapsed} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!isMobileViewport || !isCodeCollapsed ? (
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
                height="360px"
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

            <label className="control-block compact">
              <span>
                {t(locale, "soundPreset")}: {t(locale, presetLabelKey[soundPreset])}
              </span>
              <select value={soundPreset} onChange={(event) => setSoundPreset(event.target.value as SoundPreset)}>
                <option value="soft">{t(locale, "presetSoft")}</option>
                <option value="balanced">{t(locale, "presetBalanced")}</option>
                <option value="punchy">{t(locale, "presetPunchy")}</option>
              </select>
            </label>

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
          <label>
            <span>{t(locale, "algorithm")}</span>
            <select
              value={selectedAlgorithmId}
              onChange={(event) => {
                setAlgorithm(event.target.value as typeof selectedAlgorithmId);
                resetPlaybackState(true);
              }}
            >
              {algorithms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title[locale]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t(locale, "language")}</span>
            <select
              value={selectedLanguage}
              onChange={(event) => {
                setLanguage(event.target.value as typeof selectedLanguage);
                resetPlaybackState(true);
              }}
            >
              {Object.entries(languageLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Locale</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)}>
              {Object.entries(localeLabel).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
            <span>{t(locale, "input")}</span>
            <textarea
              className="io-textarea"
              value={inputText}
              onChange={(event) => setInputText(selectedAlgorithmId, event.target.value)}
              rows={8}
            />
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
    </main>
  );
}
