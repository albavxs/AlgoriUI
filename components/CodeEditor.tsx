"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { editor as MonacoEditorApi } from "monaco-editor";

import type { EditorFontMode, EditorWrapMode } from "@/lib/store";
import type { Language } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CodeEditorProps = {
  language: Language;
  value: string;
  path?: string;
  height?: string;
  wrapMode?: EditorWrapMode;
  fontMode?: EditorFontMode;
  onChange: (value: string) => void;
  onMount?: (editor: MonacoEditorApi.IStandaloneCodeEditor) => void;
};

const monacoLanguage: Record<Language, string> = {
  ts: "typescript",
  js: "javascript",
  python: "python"
};

export function CodeEditor({
  language,
  value,
  path,
  height = "360px",
  wrapMode = "auto",
  fontMode = "md",
  onChange,
  onMount
}: CodeEditorProps) {
  const [isCompact, setIsCompact] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = () => {
      setIsCompact(window.innerWidth < 820);
      setIsNarrow(window.innerWidth < 560);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const shouldWrap = wrapMode === "wrap" || (wrapMode === "auto" && isCompact);
  const fontOffset = fontMode === "sm" ? -1 : fontMode === "lg" ? 2 : 0;
  const baseFontSize = isNarrow ? 11 : isCompact ? 12 : 14;
  const fontSize = Math.max(baseFontSize + fontOffset, 10);
  const lineHeight = Math.max((isNarrow ? 18 : isCompact ? 20 : 22) + fontOffset * 2, 16);

  return (
    <div className="editor-shell">
      <MonacoEditor
        height={height}
        path={path}
        defaultLanguage={monacoLanguage[language]}
        language={monacoLanguage[language]}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        onMount={(editor) => {
          editor.layout();
          onMount?.(editor);
        }}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize,
          lineHeight,
          lineNumbers: isNarrow ? "off" : "on",
          lineNumbersMinChars: isCompact ? 2 : 3,
          glyphMargin: false,
          folding: !isCompact,
          automaticLayout: true,
          wordWrap: shouldWrap ? "on" : "off",
          wordWrapColumn: shouldWrap ? (isNarrow ? 44 : isCompact ? 72 : 96) : 140,
          wrappingIndent: "indent",
          wrappingStrategy: "advanced",
          scrollBeyondLastLine: false,
          scrollBeyondLastColumn: 2,
          renderLineHighlight: "none",
          overviewRulerBorder: false,
          lineDecorationsWidth: isNarrow ? 8 : 12,
          padding: {
            top: isCompact ? 10 : 14,
            bottom: isCompact ? 10 : 14
          },
          tabSize: 2
        }}
      />
    </div>
  );
}
