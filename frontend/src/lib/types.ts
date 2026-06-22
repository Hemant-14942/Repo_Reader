export type ContextMode = "easy" | "full";

export type FileContent = {
  path: string;
  content: string;
  size_bytes: number;
};

export type SkippedFile = {
  path: string;
  reason: string;
  size_bytes: number | null;
};

export type IngestResponse = {
  repository: string;
  status: string;
  message: string;
  tree: string;
  output: string;
  file_count: number;
  files: string[];
  content_file_count: number;
  file_contents: FileContent[];
  skipped_file_count: number;
  skipped_files: SkippedFile[];
  truncated: boolean;
  context_mode: ContextMode;
  context_mode_label: string;
  context_size_bytes: number;
};

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "mistral"
  | "openrouter";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
