"use client";

import dynamic from "next/dynamic";

import type { Language } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type CodeEditorProps = {
  language: Language;
  value: string;
  onChange: (value: string) => void;
};

const monacoLanguage: Record<Language, string> = {
  ts: "typescript",
  js: "javascript",
  python: "python"
};

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  return (
    <div className="editor-shell">
      <MonacoEditor
        height="100%"
        defaultLanguage={monacoLanguage[language]}
        language={monacoLanguage[language]}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        theme="vs"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2
        }}
      />
    </div>
  );
}
