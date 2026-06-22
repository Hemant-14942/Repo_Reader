import type { ContextMode, IngestResponse } from "./types";

export type ContextModeOption = {
  mode: ContextMode;
  title: string;
  badge: string;
  description: string;
  details: string;
};

export const CONTEXT_MODE_OPTIONS: ContextModeOption[] = [
  {
    mode: "easy",
    title: "Easy Mode",
    badge: "Recommended",
    description: "Faster and lower LLM cost.",
    details: "Reads important files up to 1MB each.",
  },
  {
    mode: "full",
    title: "Full Mode",
    badge: "More context",
    description: "Deeper repo analysis with larger files.",
    details: "Includes files up to 5MB. Uses more tokens and costs more.",
  },
];

export const CONTEXT_MODE_META: Record<
  ContextMode,
  {
    label: string;
    description: string;
    maxFileSize: string;
    maxLlmContextChars: number;
  }
> = {
  easy: {
    label: "Easy Mode",
    description: "Faster responses and lower token cost.",
    maxFileSize: "1 MB",
    maxLlmContextChars: 120_000,
  },
  full: {
    label: "Full Mode",
    description: "More files and larger sources for deeper answers.",
    maxFileSize: "5 MB",
    maxLlmContextChars: 600_000,
  },
};

export function resolveContextMode(context: Pick<IngestResponse, "context_mode"> | null): ContextMode {
  return context?.context_mode === "full" ? "full" : "easy";
}

export function resolveContextModeLabel(context: IngestResponse | null) {
  if (context?.context_mode_label) {
    return context.context_mode_label;
  }

  return CONTEXT_MODE_META[resolveContextMode(context)].label;
}

export function resolveContextSizeBytes(context: IngestResponse | null) {
  if (typeof context?.context_size_bytes === "number") {
    return context.context_size_bytes;
  }

  return context?.output?.length ?? 0;
}
