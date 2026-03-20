import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

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

    const parsed = JSON.parse(raw) as SharePayload;
    if (parsed.version !== 1) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
