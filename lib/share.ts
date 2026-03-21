import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import { canonicalAlgorithmId, createProjectFromTemplate, defaultInputText } from "@/lib/algorithms";
import type { SharePayload } from "@/lib/types";

export function encodeShare(payload: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const raw = decompressFromEncodedURIComponent(encoded);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SharePayload> & {
      code?: string;
    };
    if (parsed.version !== 1 || !parsed.algorithmId || !parsed.language || !parsed.locale) {
      return null;
    }

    const rawAlgorithmId = String(parsed.algorithmId);
    const algorithmId = canonicalAlgorithmId(rawAlgorithmId);
    const isLegacyBinarySearch = rawAlgorithmId === "binary-search";

    if (parsed.project && !isLegacyBinarySearch) {
      return {
        version: 1,
        algorithmId,
        language: parsed.language,
        project: parsed.project,
        inputText: parsed.inputText ?? "",
        locale: parsed.locale,
        soundPreset: parsed.soundPreset ?? "punchy"
      };
    }

    if (typeof parsed.code === "string" && !isLegacyBinarySearch) {
      const project = createProjectFromTemplate(algorithmId, parsed.language);
      project.files[0].content = parsed.code;
      return {
        version: 1,
        algorithmId,
        language: parsed.language,
        project,
        inputText: parsed.inputText ?? "",
        locale: parsed.locale,
        soundPreset: "punchy"
      };
    }

    if (isLegacyBinarySearch) {
      return {
        version: 1,
        algorithmId,
        language: parsed.language,
        project: createProjectFromTemplate(algorithmId, parsed.language),
        inputText: defaultInputText(algorithmId),
        locale: parsed.locale,
        soundPreset: parsed.soundPreset ?? "punchy"
      };
    }

    return null;
  } catch {
    return null;
  }
}
