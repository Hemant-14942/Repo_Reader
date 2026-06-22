"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { CONTEXT_MODE_META, resolveContextMode, resolveContextModeLabel, resolveContextSizeBytes } from "@/lib/context-mode";
import { getApiUrl } from "@/lib/config";
import { formatBytes, formatCharCount } from "@/lib/format";
import { loadRepoContext } from "@/lib/repo-context";
import type { ChatMessage, IngestResponse, LLMProvider } from "@/lib/types";

const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
  gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
  groq: ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
  mistral: ["mistral-small-latest", "mistral-large-latest"],
  openrouter: [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-flash-1.5",
  ],
};

const SUGGESTED_PROMPTS = [
  "Summarize this repository in simple language.",
  "Explain the architecture and main modules.",
  "Which files should I read first and why?",
  "What can I build or learn from this repo?",
];

type LLMErrorDetail = {
  message?: string;
  provider_status_code?: number | null;
  type?: string;
};

type LLMErrorState = {
  title: string;
  message: string;
  type?: string;
  providerStatusCode?: number | null;
};

function formatProvider(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getErrorTitle(type?: string) {
  const titles: Record<string, string> = {
    authentication_error: "API key or permission problem",
    model_or_endpoint_error: "Model name problem",
    network_error: "Provider network problem",
    provider_error: "Provider error",
    rate_limit_error: "Rate limit or quota problem",
    request_error: "Request problem",
    service_error: "Backend service problem",
    timeout: "Provider timed out",
    validation_error: "Invalid AI settings",
  };

  return type ? titles[type] ?? "AI request failed" : "AI request failed";
}

function parseErrorDetail(detail: unknown): LLMErrorState {
  if (typeof detail === "string") {
    return {
      title: "AI request failed",
      message: detail,
    };
  }

  if (typeof detail === "object" && detail !== null) {
    const typedDetail = detail as LLMErrorDetail;
    const type = typedDetail.type;

    return {
      title: getErrorTitle(type),
      message: typedDetail.message ?? "AI request failed.",
      type,
      providerStatusCode: typedDetail.provider_status_code,
    };
  }

  return {
    title: "AI request failed",
    message: "Something went wrong while asking AI.",
  };
}

export default function AskAIPage() {
  const [repoContext] = useState<IngestResponse | null>(() => loadRepoContext());
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [model, setModel] = useState(PROVIDER_MODELS.openai[0]);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<LLMErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const availableModels = useMemo(() => PROVIDER_MODELS[provider], [provider]);
  const contextMode = resolveContextMode(repoContext);
  const contextModeLabel = resolveContextModeLabel(repoContext);
  const contextSizeBytes = resolveContextSizeBytes(repoContext);
  const contextModeMeta = CONTEXT_MODE_META[contextMode];

  function handleProviderChange(nextProvider: LLMProvider) {
    setProvider(nextProvider);
    setModel(PROVIDER_MODELS[nextProvider][0]);
    setIsCustomModel(false);
  }

  function handleModelPresetChange(value: string) {
    if (value === "custom") {
      setIsCustomModel(true);
      setModel("");
      return;
    }

    setIsCustomModel(false);
    setModel(value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!repoContext) {
      setError({
        title: "Repository context missing",
        message: "Ingest a repository before asking AI questions.",
      });
      return;
    }

    setError(null);
    setIsLoading(true);

    const userMessage: ChatMessage = { role: "user", content: question };
    const previousMessages = messages;
    setMessages([...previousMessages, userMessage]);
    setQuestion("");

    try {
      const response = await fetch(getApiUrl("/llm/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          model,
          api_key: apiKey,
          question: userMessage.content,
          repo_context: repoContext.output,
          messages: previousMessages,
          context_mode: contextMode,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(parseErrorDetail(body.detail));
        setMessages(previousMessages);
        return;
      }

      setMessages([
        ...previousMessages,
        userMessage,
        { role: "assistant", content: body.answer },
      ]);
    } catch (caughtError) {
      setError({
        title: "Could not reach Repo Reader backend",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Something went wrong while asking AI.",
      });
      setMessages(previousMessages);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Ask AI
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Chat with your repository context.
            </h1>
            <p className="mt-4 max-w-3xl text-slate-300">
              Bring your own API key, choose a provider, and ask questions about
              the ingested repo. Repo Reader sends the key only with this
              request and does not store it.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            href="/"
          >
            Back to Ingest
          </Link>
        </div>

        {!repoContext ? (
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100">
            No repository context found. Go back, ingest a repository, then open
            this AI workspace.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <aside className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">Repository Context</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      contextMode === "full"
                        ? "bg-violet-300/20 text-violet-100"
                        : "bg-cyan-300/20 text-cyan-100"
                    }`}
                  >
                    {contextModeLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-400">{contextModeMeta.description}</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Repository:</span>{" "}
                    {repoContext.repository}
                  </p>
                  <p>
                    <span className="text-slate-500">Context size:</span>{" "}
                    {formatBytes(contextSizeBytes)}
                  </p>
                  <p>
                    <span className="text-slate-500">Files found:</span>{" "}
                    {repoContext.file_count}
                  </p>
                  <p>
                    <span className="text-slate-500">Files read:</span>{" "}
                    {repoContext.content_file_count}
                  </p>
                  <p>
                    <span className="text-slate-500">Skipped:</span>{" "}
                    {repoContext.skipped_file_count}
                  </p>
                  <p>
                    <span className="text-slate-500">Per-file limit:</span>{" "}
                    {contextModeMeta.maxFileSize}
                  </p>
                </div>
                <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                  AI chat uses up to{" "}
                  <span className="font-semibold text-white">
                    {formatCharCount(contextModeMeta.maxLlmContextChars)}
                  </span>{" "}
                  of ingested file contents in {contextModeLabel.toLowerCase()}.
                </p>
                {repoContext.truncated ? (
                  <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                    This repository was truncated during ingest. Some files were
                    skipped or not fully included, so AI answers may miss parts of
                    the codebase.
                  </p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <h2 className="text-lg font-semibold">Folder Structure</h2>
                <pre className="mt-4 h-[52vh] overflow-auto rounded-2xl bg-black/30 p-4 text-sm leading-7 text-slate-300">
                  {repoContext.tree}
                </pre>
              </section>
            </aside>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Provider</span>
                  <select
                    className="min-h-11 rounded-2xl border border-white/10 bg-slate-950 px-3 text-white"
                    onChange={(event) =>
                      handleProviderChange(event.target.value as LLMProvider)
                    }
                    value={provider}
                  >
                    {(Object.keys(PROVIDER_MODELS) as LLMProvider[]).map(
                      (providerName) => (
                        <option key={providerName} value={providerName}>
                          {formatProvider(providerName)}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">Model</span>
                  {isCustomModel ? (
                    <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                      <input
                        className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-white outline-none"
                        onChange={(event) => setModel(event.target.value)}
                        placeholder="Type custom model name"
                        required
                        value={model}
                      />
                      <button
                        className="px-3 text-xs text-slate-300 transition hover:bg-white/10"
                        onClick={() => {
                          setIsCustomModel(false);
                          setModel(availableModels[0]);
                        }}
                        type="button"
                      >
                        Presets
                      </button>
                    </div>
                  ) : (
                    <select
                      className="min-h-11 rounded-2xl border border-white/10 bg-slate-950 px-3 text-white"
                      onChange={(event) => handleModelPresetChange(event.target.value)}
                      value={model}
                    >
                      {availableModels.map((modelName) => (
                        <option key={modelName} value={modelName}>
                          {modelName}
                        </option>
                      ))}
                      <option value="custom">Custom model...</option>
                    </select>
                  )}
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="text-slate-300">API Key</span>
                  <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                    <input
                      className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-white outline-none"
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Your provider key"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                    />
                    <button
                      className="px-3 text-xs text-slate-300"
                      onClick={() => setShowApiKey((value) => !value)}
                      type="button"
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>
              </div>

              <p className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                Privacy: your API key is sent to the backend only for each chat
                request. It is not saved in browser storage, database, or config
                files. Chat uses the same {contextModeLabel.toLowerCase()} limits
                as your ingest.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
                    key={prompt}
                    onClick={() => setQuestion(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="mt-5 h-[52vh] overflow-auto rounded-2xl bg-black/30 p-4">
                {messages.length ? (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        className={
                          message.role === "user"
                            ? "ml-auto max-w-[85%] rounded-2xl bg-cyan-300 p-4 text-slate-950"
                            : "max-w-[85%] rounded-2xl bg-white/10 p-4 text-slate-100"
                        }
                        key={`${message.role}-${index}`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-7">
                          {message.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-slate-400">
                    Ask a question to start analyzing the repository.
                  </div>
                )}
              </div>

              {error ? (
                <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <span className="block font-semibold">{error.title}</span>
                  <span className="mt-1 block">{error.message}</span>
                  {error.type ? (
                    <span className="mt-1 block text-red-200/70">
                      Type: {error.type}
                    </span>
                  ) : null}
                  {error.providerStatusCode ? (
                    <span className="mt-1 block text-red-200/70">
                      Provider status: {error.providerStatusCode}
                    </span>
                  ) : null}
                </p>
              ) : null}

              <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
                <input
                  className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm text-white outline-none ring-cyan-400/40 transition focus:ring-4"
                  disabled={isLoading}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about architecture, files, learning path, bugs..."
                  required
                  value={question}
                />
                <button
                  className="min-h-12 rounded-2xl bg-cyan-300 px-6 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading || !apiKey}
                  type="submit"
                >
                  {isLoading ? "Asking..." : "Ask AI"}
                </button>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
