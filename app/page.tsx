"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeEditor } from "@/components/CodeEditor";
import { Visualizer } from "@/components/Visualizer";
import { algorithmById, algorithms, languageLabel } from "@/lib/algorithms";
import { localeLabel, t } from "@/lib/i18n";
import { executeCode } from "@/lib/runtime/execute";
import { decodeShare, encodeShare } from "@/lib/share";
import { ensureCode, ensureInput, useAppStore } from "@/lib/store";
import type { Language, SharePayload, TraceEvent } from "@/lib/types";

type AudioRig = {
  context: AudioContext;
  master: GainNode;
  mix: GainNode;
  noiseBuffer: AudioBuffer;
};

const languageMeta: Record<Language, { short: string; ext: string }> = {
  ts: { short: "TS", ext: "ts" },
  js: { short: "JS", ext: "js" },
  python: { short: "PY", ext: "py" }
};

function parseInputJson(raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, message: "invalid-json" };
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

function toCamelStem(id: string): string {
  return id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function createImpulseResponse(context: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const n = Math.random() * 2 - 1;
      channelData[i] = n * Math.pow(1 - i / length, decay);
    }
  }

  return impulse;
}

function createNoiseBuffer(context: AudioContext, duration = 0.08): AudioBuffer {
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
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
    codeMap,
    inputMap,
    setLocale,
    setAlgorithm,
    setLanguage,
    setSpeed,
    setCode,
    setInputText,
    hydrateFromShare
  } = useAppStore();

  const algorithm = useMemo(() => algorithmById(selectedAlgorithmId), [selectedAlgorithmId]);
  const code = ensureCode(codeMap, selectedAlgorithmId, selectedLanguage);
  const inputText = ensureInput(inputMap, selectedAlgorithmId);

  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [outputText, setOutputText] = useState("");
  const [stderrText, setStderrText] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.34);

  const importRef = useRef<HTMLInputElement>(null);
  const shareLoadedRef = useRef(false);
  const audioRigRef = useRef<AudioRig | null>(null);
  const lastSoundIndexRef = useRef(-1);
  const lastSoundAtRef = useRef(0);

  const fileName = `${toCamelStem(selectedAlgorithmId)}.${languageMeta[selectedLanguage].ext}`;

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;

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

      convolver.buffer = createImpulseResponse(context, 1.1, 2.5);
      dry.gain.value = 0.95;
      wet.gain.value = 0.12;
      master.gain.value = soundVolume;

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
        mix,
        noiseBuffer: createNoiseBuffer(context)
      };
    }

    audioRigRef.current.master.gain.value = soundVolume;

    if (audioRigRef.current.context.state === "suspended") {
      await audioRigRef.current.context.resume();
    }

    return audioRigRef.current;
  }, [soundVolume]);

  const playOsc = useCallback(
    (
      rig: AudioRig,
      opts: {
        frequency: number;
        when?: number;
        duration?: number;
        gain?: number;
        type?: OscillatorType;
        detune?: number;
      }
    ) => {
      const { context, mix } = rig;
      const when = context.currentTime + (opts.when ?? 0);
      const duration = opts.duration ?? 0.06;
      const gain = opts.gain ?? 0.08;
      const osc = context.createOscillator();
      const amp = context.createGain();

      osc.type = opts.type ?? "sine";
      osc.frequency.setValueAtTime(opts.frequency, when);
      if (opts.detune) {
        osc.detune.setValueAtTime(opts.detune, when);
      }

      amp.gain.setValueAtTime(0.0001, when);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      osc.connect(amp);
      amp.connect(mix);
      osc.start(when);
      osc.stop(when + duration + 0.02);
    },
    []
  );

  const playNoise = useCallback(
    (
      rig: AudioRig,
      opts: {
        when?: number;
        duration?: number;
        gain?: number;
        highpass?: number;
      }
    ) => {
      const { context, mix, noiseBuffer } = rig;
      const when = context.currentTime + (opts.when ?? 0);
      const duration = opts.duration ?? 0.04;
      const gain = opts.gain ?? 0.018;
      const highpass = opts.highpass ?? 1800;

      const src = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const amp = context.createGain();

      src.buffer = noiseBuffer;
      filter.type = "highpass";
      filter.frequency.setValueAtTime(highpass, when);

      amp.gain.setValueAtTime(0.0001, when);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

      src.connect(filter);
      filter.connect(amp);
      amp.connect(mix);

      src.start(when);
      src.stop(when + duration + 0.02);
    },
    []
  );

  const playEventSound = useCallback(
    async (event: TraceEvent) => {
      if (!soundEnabled) return;

      const rig = await ensureAudio();
      if (!rig) return;

      const type = String(event.t ?? "");

      if (type === "compare" || type === "search-window") {
        playOsc(rig, { frequency: 720, type: "triangle", duration: 0.045, gain: 0.05 });
        playNoise(rig, { duration: 0.028, gain: 0.012, highpass: 2400 });
        return;
      }

      if (type === "swap" || type === "search-found") {
        playOsc(rig, { frequency: 560, type: "triangle", duration: 0.065, gain: 0.08 });
        playOsc(rig, { frequency: 780, when: 0.045, type: "sine", duration: 0.07, gain: 0.07 });
        playNoise(rig, { duration: 0.035, gain: 0.02, highpass: 1800 });
        return;
      }

      if (type === "stalin-step") {
        const accepted = Boolean(event.accepted);
        if (accepted) {
          playOsc(rig, { frequency: 640, type: "triangle", duration: 0.05, gain: 0.055 });
        } else {
          playOsc(rig, { frequency: 280, type: "sine", duration: 0.085, gain: 0.08 });
          playNoise(rig, { duration: 0.045, gain: 0.018, highpass: 900 });
        }
        return;
      }

      if (type === "graph-state") {
        const current = typeof event.current === "string" ? event.current.charCodeAt(0) : 0;
        const frequency = 360 + (current % 8) * 28;
        playOsc(rig, { frequency, type: "triangle", duration: 0.05, gain: 0.06 });
        return;
      }

      if (type === "done") {
        playOsc(rig, { frequency: 520, type: "sine", duration: 0.07, gain: 0.06 });
        playOsc(rig, { frequency: 680, when: 0.055, type: "sine", duration: 0.07, gain: 0.06 });
        playOsc(rig, { frequency: 860, when: 0.11, type: "sine", duration: 0.08, gain: 0.06 });
      }
    },
    [ensureAudio, playNoise, playOsc, soundEnabled]
  );

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

    const decoded = decodeShare(share);
    if (decoded) {
      hydrateFromShare(decoded);
      setStatusNote(t(decoded.locale, "loadFromShare"));
    }

    shareLoadedRef.current = true;
  }, [hydrateFromShare]);

  useEffect(() => {
    if (!isPlaying || events.length < 2) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= events.length - 1) return prev;
        return prev + 1;
      });
    }, Math.max(60, 340 / speed));

    return () => window.clearInterval(interval);
  }, [events.length, isPlaying, speed]);

  useEffect(() => {
    if (isPlaying && currentIndex >= events.length - 1) {
      setIsPlaying(false);
    }
  }, [currentIndex, events.length, isPlaying]);

  useEffect(() => {
    if (!soundEnabled || events.length === 0) return;
    if (currentIndex < 0 || currentIndex >= events.length) return;

    if (lastSoundIndexRef.current === currentIndex) return;

    const now = performance.now();
    if (now - lastSoundAtRef.current < 18) {
      return;
    }

    lastSoundIndexRef.current = currentIndex;
    lastSoundAtRef.current = now;
    void playEventSound(events[currentIndex]);
  }, [currentIndex, events, playEventSound, soundEnabled]);

  useEffect(() => {
    return () => {
      audioRigRef.current?.context.close();
      audioRigRef.current = null;
    };
  }, []);

  const currentEventPreview = useMemo(() => {
    if (!events.length) return "";
    const chosen = events[Math.min(currentIndex, events.length - 1)];
    return safeStringify(chosen);
  }, [currentIndex, events]);

  async function runCode() {
    const parsed = parseInputJson(inputText);
    if (!parsed.ok) {
      setStderrText(t(locale, "invalidInput"));
      return;
    }

    if (soundEnabled) {
      void ensureAudio();
    }

    setIsRunning(true);
    setIsPlaying(false);
    setStatusNote("");
    setStderrText("");
    lastSoundIndexRef.current = -1;

    const result = await executeCode({
      language: selectedLanguage,
      source: code,
      input: parsed.value,
      timeoutMs: selectedLanguage === "python" ? 20000 : 7000
    });

    setIsRunning(false);
    setEvents(result.events);
    setCurrentIndex(0);
    setIsPlaying(result.ok && result.events.length > 1);

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
      code,
      inputText,
      locale
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
      code,
      inputText,
      locale
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `algoriui-${selectedAlgorithmId}-${selectedLanguage}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function openImport() {
    importRef.current?.click();
  }

  function onImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as SharePayload;
        if (parsed.version !== 1) {
          throw new Error("Invalid file version");
        }
        hydrateFromShare(parsed);
        setStatusNote(t(parsed.locale, "loadFromShare"));
      })
      .catch(() => {
        setStatusNote(t(locale, "invalidInput"));
      })
      .finally(() => {
        event.target.value = "";
      });
  }

  return (
    <main className="reel-shell">
      <section className="hero-card">
        <div className="algo-title-wrap">
          <div className="app-dot">{t(locale, "appTitle")}</div>
          <h1 className="algo-title">{algorithm.title[locale]}</h1>
          <p className="algo-subtitle">{algorithm.subtitle[locale]}</p>
          <div className="formula-row">
            <span>Time: {algorithm.complexity.time}</span>
            <span>Space: {algorithm.complexity.space}</span>
          </div>
        </div>

        <Visualizer
          category={algorithm.category}
          events={events}
          currentIndex={currentIndex}
          emptyLabel={t(locale, "noEvents")}
        />
      </section>

      <section className="code-card">
        <div className="code-strip">
          <span className={`lang-icon ${selectedLanguage}`}>{languageMeta[selectedLanguage].short}</span>
          <span className="code-file">{fileName}</span>
        </div>
        <CodeEditor
          language={selectedLanguage}
          value={code}
          onChange={(value) => setCode(selectedAlgorithmId, selectedLanguage, value)}
        />
      </section>

      <section className="controls-card">
        <div className="playback-row" aria-label={t(locale, "controls")}>
          <button className="primary" onClick={runCode} disabled={isRunning}>
            {isRunning ? t(locale, "running") : t(locale, "run")}
          </button>
          <button onClick={() => setIsPlaying((state) => !state)} disabled={events.length < 2}>
            {isPlaying ? t(locale, "pause") : t(locale, "resume")}
          </button>
          <button
            onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
            disabled={!events.length}
          >
            {t(locale, "stepBack")}
          </button>
          <button
            onClick={() => setCurrentIndex((value) => Math.min(events.length - 1, value + 1))}
            disabled={!events.length}
          >
            {t(locale, "stepForward")}
          </button>
          <button
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

        <div className="sliders-grid">
          <label className="control-item">
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

          <label className="control-item">
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

          <div className="sound-card">
            <div className="sound-head">
              <span>
                {t(locale, "sound")}: {soundEnabled ? t(locale, "soundOn") : t(locale, "soundOff")}
              </span>
              <button
                className={`switch ${soundEnabled ? "on" : "off"}`}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) {
                    void ensureAudio();
                  }
                }}
                type="button"
              >
                <span />
              </button>
            </div>
            <label className="control-item compact">
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

      <section className="feature-card">
        <div className="selectors-grid">
          <label>
            <span>{t(locale, "algorithm")}</span>
            <select
              value={selectedAlgorithmId}
              onChange={(event) => {
                setAlgorithm(event.target.value as typeof selectedAlgorithmId);
                setEvents([]);
                setCurrentIndex(0);
                setOutputText("");
                setStderrText("");
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
              onChange={(event) => setLanguage(event.target.value as typeof selectedLanguage)}
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
          <button onClick={copyShareLink}>{t(locale, "copyShare")}</button>
          <button onClick={exportProject}>{t(locale, "exportJson")}</button>
          <button onClick={openImport}>{t(locale, "importJson")}</button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            onChange={onImportFile}
            hidden
          />
        </div>
      </section>

      <section className="io-card">
        <div className="io-grid">
          <label>
            <span>{t(locale, "input")}</span>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(selectedAlgorithmId, event.target.value)}
              rows={8}
            />
          </label>

          <label>
            <span>{t(locale, "output")}</span>
            <textarea value={outputText || stderrText} readOnly rows={8} />
          </label>
        </div>
      </section>

      <details className="event-card">
        <summary>{t(locale, "advanced")}</summary>
        <pre>{currentEventPreview || "{}"}</pre>
      </details>

      <footer className="status-line">{statusNote}</footer>
    </main>
  );
}
