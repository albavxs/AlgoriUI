"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeEditor } from "@/components/CodeEditor";
import { Visualizer } from "@/components/Visualizer";
import { algorithmById, algorithms, languageLabel } from "@/lib/algorithms";
import { localeLabel, t } from "@/lib/i18n";
import { executeCode } from "@/lib/runtime/execute";
import { decodeShare, encodeShare } from "@/lib/share";
import { ensureCode, ensureInput, useAppStore } from "@/lib/store";
import type { SharePayload, TraceEvent } from "@/lib/types";

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
  const [soundVolume, setSoundVolume] = useState(0.32);

  const importRef = useRef<HTMLInputElement>(null);
  const shareLoadedRef = useRef(false);
  const lastSoundIndexRef = useRef(-1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const ensureAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;

    if (!audioContextRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) {
        return null;
      }

      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = soundVolume;
      master.connect(ctx.destination);

      audioContextRef.current = ctx;
      masterGainRef.current = master;
    }

    if (masterGainRef.current) {
      masterGainRef.current.gain.value = soundVolume;
    }

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, [soundVolume]);

  const playTone = useCallback(
    async (
      frequency: number,
      duration = 0.06,
      type: OscillatorType = "sine",
      peak = 0.17
    ) => {
      const ctx = await ensureAudio();
      if (!ctx || !masterGainRef.current) return;

      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(amp);
      amp.connect(masterGainRef.current);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    [ensureAudio]
  );

  const playEventSound = useCallback(
    async (event: TraceEvent) => {
      if (!soundEnabled) return;

      const eventType = String(event.t ?? "");
      if (eventType === "compare" || eventType === "search-window") {
        await playTone(480, 0.045, "triangle", 0.08);
        return;
      }

      if (eventType === "swap" || eventType === "search-found") {
        await playTone(660, 0.07, "sine", 0.14);
        window.setTimeout(() => {
          void playTone(820, 0.06, "sine", 0.12);
        }, 45);
        return;
      }

      if (eventType === "graph-state") {
        await playTone(360, 0.05, "triangle", 0.09);
        return;
      }

      if (eventType === "done") {
        await playTone(540, 0.06, "sine", 0.1);
        window.setTimeout(() => {
          void playTone(720, 0.08, "sine", 0.1);
        }, 55);
      }
    },
    [playTone, soundEnabled]
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
        if (prev >= events.length - 1) {
          return prev;
        }
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
    if (!soundEnabled || events.length === 0) {
      return;
    }

    if (currentIndex < 0 || currentIndex >= events.length) {
      return;
    }

    if (lastSoundIndexRef.current === currentIndex) {
      return;
    }

    lastSoundIndexRef.current = currentIndex;
    void playEventSound(events[currentIndex]);
  }, [currentIndex, events, playEventSound, soundEnabled]);

  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
      audioContextRef.current = null;
      masterGainRef.current = null;
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
    <main className="ios-shell">
      <section className="ios-card ios-topbar">
        <div className="top-title">
          <div className="brand-chip">{t(locale, "appTitle")}</div>
          <h1>{algorithm.title[locale]}</h1>
          <p>{algorithm.subtitle[locale]}</p>
        </div>
        <div className="top-controls">
          <label className="field">
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

          <label className="field">
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

          <label className="field">
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
      </section>

      <section className="ios-card stage-card">
        <div className="meta-pills">
          <span>Time {algorithm.complexity.time}</span>
          <span>Space {algorithm.complexity.space}</span>
        </div>

        <Visualizer
          category={algorithm.category}
          events={events}
          currentIndex={currentIndex}
          emptyLabel={t(locale, "noEvents")}
        />

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

        <div className="slider-grid">
          <label className="field compact">
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

          <label className="field compact">
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

          <div className="sound-block">
            <label className="switch-row">
              <span>
                {t(locale, "sound")}: {soundEnabled ? t(locale, "soundOn") : t(locale, "soundOff")}
              </span>
              <button
                className={`switch ${soundEnabled ? "on" : "off"}`}
                onClick={() => {
                  setSoundEnabled((value) => !value);
                  if (!soundEnabled) {
                    void ensureAudio();
                  }
                }}
                type="button"
              >
                <span />
              </button>
            </label>
            <label className="field compact">
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

      <section className="ios-card code-card">
        <div className="panel-head">
          <strong>
            {t(locale, "editor")} • {languageLabel[selectedLanguage]}
          </strong>
          <div className="panel-actions">
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
        </div>
        <CodeEditor
          language={selectedLanguage}
          value={code}
          onChange={(value) => setCode(selectedAlgorithmId, selectedLanguage, value)}
        />
      </section>

      <section className="ios-card io-card">
        <div className="io-grid">
          <label className="field">
            <span>{t(locale, "input")}</span>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(selectedAlgorithmId, event.target.value)}
              rows={7}
            />
          </label>
          <label className="field">
            <span>{t(locale, "output")}</span>
            <textarea value={outputText || stderrText} readOnly rows={7} />
          </label>
        </div>
      </section>

      <details className="ios-card event-card">
        <summary>{t(locale, "advanced")}</summary>
        <div className="event-inner">
          <div className="section-title">{t(locale, "event")}</div>
          <pre>{currentEventPreview || "{}"}</pre>
        </div>
      </details>

      <footer className="status-line">{statusNote}</footer>
    </main>
  );
}
