export function formatBytes(sizeBytes: number | null) {
  if (sizeBytes === null) {
    return "Unknown size";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCharCount(count: number) {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M chars`;
  }

  if (count >= 1_000) {
    return `${Math.round(count / 1_000)}K chars`;
  }

  return `${count} chars`;
}
