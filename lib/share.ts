import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import { createProjectFromTemplate } from "@/lib/algorithms";
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

    if (parsed.project) {
      return {
        version: 1,
        algorithmId: parsed.algorithmId,
        language: parsed.language,
        project: parsed.project,
        inputText: parsed.inputText ?? "",
        locale: parsed.locale,
        soundPreset: parsed.soundPreset ?? "punchy"
      };
    }

    if (typeof parsed.code === "string") {
      const project = createProjectFromTemplate(parsed.algorithmId, parsed.language);
      project.files[0].content = parsed.code;
      return {
        version: 1,
        algorithmId: parsed.algorithmId,
        language: parsed.language,
        project,
        inputText: parsed.inputText ?? "",
        locale: parsed.locale,
        soundPreset: "punchy"
      };
    }

    return null;
  } catch {
    return null;
  }
}
