import type { IngestResponse } from "./types";
import { resolveContextMode, resolveContextModeLabel, resolveContextSizeBytes } from "./context-mode";

const REPO_CONTEXT_KEY = "repo-reader:last-ingest";

function normalizeIngestResponse(raw: IngestResponse): IngestResponse {
  const contextMode = resolveContextMode(raw);

  return {
    ...raw,
    context_mode: contextMode,
    context_mode_label: resolveContextModeLabel(raw),
    context_size_bytes: resolveContextSizeBytes(raw),
    skipped_files: raw.skipped_files ?? [],
    skipped_file_count: raw.skipped_file_count ?? raw.skipped_files?.length ?? 0,
  };
}

export function saveRepoContext(context: IngestResponse) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(REPO_CONTEXT_KEY, JSON.stringify(context));
}

export function loadRepoContext(): IngestResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawContext = sessionStorage.getItem(REPO_CONTEXT_KEY);

  if (!rawContext) {
    return null;
  }

  try {
    return normalizeIngestResponse(JSON.parse(rawContext) as IngestResponse);
  } catch {
    sessionStorage.removeItem(REPO_CONTEXT_KEY);
    return null;
  }
}
