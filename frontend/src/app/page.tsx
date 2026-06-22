"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import {
  CONTEXT_MODE_OPTIONS,
  resolveContextModeLabel,
} from "@/lib/context-mode";
import { getApiUrl, API_BASE_URL } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { loadRepoContext, saveRepoContext } from "@/lib/repo-context";
import type { ContextMode, IngestResponse } from "@/lib/types";

function explainSkipReason(reason: string) {
  const reasons: Record<string, string> = {
    binary_file: "Binary file",
    readable_file_limit_reached: "Readable file limit reached",
    too_large: "Larger than the selected mode file limit",
    total_content_limit_reached: "Total output size limit reached",
    unsupported_type: "Unsupported or low-value file type",
  };

  return reasons[reason] ?? reason;
}

type IngestErrorDetail = {
  message?: string;
  type?: string;
};

type IngestErrorState = {
  title: string;
  message: string;
  suggestion: string;
  type?: string;
};

function getIngestErrorTitle(type?: string) {
  const titles: Record<string, string> = {
    clone_error: "Could not clone this repository",
    network_error: "Could not reach GitHub",
    processing_error: "Could not process this repository",
    repo_not_found_or_private: "Repository not found or private",
    repo_too_large: "Repository is too large right now",
    validation_error: "Invalid GitHub URL",
  };

  return type ? titles[type] ?? "Could not process repository" : "Could not process repository";
}

function getIngestErrorSuggestion(type?: string) {
  const suggestions: Record<string, string> = {
    clone_error: "Try again, or test with another public GitHub repository.",
    network_error: "Check your internet connection and try again.",
    processing_error: "Try a smaller repository or increase backend processing limits later.",
    repo_not_found_or_private: "Use a valid public GitHub repository URL.",
    repo_too_large: "Try a smaller repository. We can add background jobs and higher limits in a production version.",
    validation_error: "Paste a full URL like https://github.com/owner/repo.",
  };

  return type
    ? suggestions[type] ?? "Please try again with another public GitHub repository."
    : "Please try again with another public GitHub repository.";
}

function parseIngestError(detail: unknown): IngestErrorState {
  if (typeof detail === "string") {
    return {
      title: "Could not process repository",
      message: detail,
      suggestion: "Please try again with another public GitHub repository.",
    };
  }

  if (typeof detail === "object" && detail !== null) {
    const typedDetail = detail as IngestErrorDetail;
    const type = typedDetail.type;

    return {
      title: getIngestErrorTitle(type),
      message: typedDetail.message ?? "Repo Reader could not process this repository.",
      suggestion: getIngestErrorSuggestion(type),
      type,
    };
  }

  return {
    title: "Could not process repository",
    message: "Repo Reader could not process this repository.",
    suggestion: "Please try again with another public GitHub repository.",
  };
}

function StyledFolderTree({ tree }: { tree: string }) {
  const lines = tree.split("\n").filter(Boolean);

  return (
    <div className="h-[70vh] min-w-0 overflow-auto rounded-2xl bg-black/30 p-4 font-mono text-sm leading-7">
      {lines.map((line, index) => {
        const branchIndex = line.includes("|-- ") ? line.indexOf("|-- ") : line.indexOf("`-- ");

        if (branchIndex === -1) {
          return (
            <div className="text-slate-300" key={`${line}-${index}`}>
              {line}
            </div>
          );
        }

        const prefix = line.slice(0, branchIndex);
        const connector = line.slice(branchIndex, branchIndex + 4);
        const name = line.slice(branchIndex + 4);
        const nextLine = lines[index + 1] ?? "";
        const nextBranchIndex = nextLine.includes("|-- ")
          ? nextLine.indexOf("|-- ")
          : nextLine.indexOf("`-- ");
        const isFolder = nextBranchIndex > branchIndex;

        return (
          <div className="whitespace-pre" key={`${line}-${index}`}>
            <span className="text-slate-600">{prefix}</span>
            <span className="text-slate-500">{connector}</span>
            <span
              className={
                isFolder
                  ? "font-semibold text-cyan-300"
                  : "text-slate-200"
              }
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [result, setResult] = useState<IngestResponse | null>(() => loadRepoContext());
  const [repoUrl, setRepoUrl] = useState(() =>
    result ? `https://github.com/${result.repository}` : ""
  );
  const [contextMode, setContextMode] = useState<ContextMode>(
    () => result?.context_mode ?? "easy"
  );
  const [error, setError] = useState<IngestErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copyOutputLabel, setCopyOutputLabel] = useState("Copy Files");
  const [copyTreeLabel, setCopyTreeLabel] = useState("Copy");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCopyOutputLabel("Copy Files");
    setCopyTreeLabel("Copy");
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl("/ingest"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo_url: repoUrl, context_mode: contextMode }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(parseIngestError(body.detail));
        return;
      }

      const ingestResult = body as IngestResponse;
      setResult(ingestResult);
      saveRepoContext(ingestResult);
    } catch (caughtError) {
      setError({
        title: "Could not reach Repo Reader backend",
        message:
          caughtError instanceof Error
            ? caughtError.message
            : "Something went wrong while processing the repository.",
        suggestion: `Make sure the Repo Reader backend is reachable at ${API_BASE_URL}.`,
        type: "backend_unreachable",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyTree() {
    if (!result?.tree) {
      return;
    }

    await navigator.clipboard.writeText(result.tree);
    setCopyTreeLabel("Copied");
    window.setTimeout(() => setCopyTreeLabel("Copy"), 1500);
  }

  async function copyOutput() {
    if (!result?.output) {
      return;
    }

    await navigator.clipboard.writeText(result.output);
    setCopyOutputLabel("Copied");
    window.setTimeout(() => setCopyOutputLabel("Copy Files"), 1500);
  }

  const treePreview =
    result?.tree ??
    `|-- README.md
\`-- src
    |-- app
    |   \`-- page.tsx
    \`-- lib
        \`-- api.ts`;

  const outputPreview =
    result?.output ??
    `# Repository: owner/repo

## File Contents

### README.md

\`\`\`text
Project documentation appears here.
\`\`\``;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-950 py-10 text-white">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <div className="max-w-3xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Repo Reader
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Turn a GitHub repo into clean LLM-ready context.
          </h1>
          <p className="text-lg leading-8 text-slate-300">
            Paste a public GitHub repository URL and Repo Reader will generate
            the folder tree, readable source files, and one copy-ready output.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl shadow-cyan-950/40 backdrop-blur">
          <div className="mb-4">
            <p className="text-sm font-semibold text-white">Context Mode</p>
            <p className="mt-1 text-sm text-slate-400">
              Choose how much repository data to include for file reading and AI chat.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONTEXT_MODE_OPTIONS.map((option) => {
              const isSelected = contextMode === option.mode;

              return (
                <button
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-950/20"
                      : "border-white/10 bg-slate-900/70 hover:border-white/20 hover:bg-slate-900"
                  }`}
                  key={option.mode}
                  onClick={() => setContextMode(option.mode)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{option.title}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        isSelected
                          ? "bg-cyan-300 text-slate-950"
                          : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {option.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{option.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{option.details}</p>
                </button>
              );
            })}
          </div>

          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <input
              className="min-h-12 flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white outline-none ring-cyan-400/40 transition focus:ring-4"
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/vercel/next.js"
              required
              type="url"
              value={repoUrl}
            />
            <button
              className="min-h-12 rounded-2xl bg-cyan-300 px-6 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? "Processing..." : "Generate Context"}
            </button>
          </form>
          {error ? (
            <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <p className="font-semibold">{error.title}</p>
              <p className="mt-1">{error.message}</p>
              <p className="mt-2 text-red-100/80">{error.suggestion}</p>
              {error.type ? (
                <p className="mt-2 text-xs text-red-200/60">Error type: {error.type}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              The backend clones, filters, reads, formats, and cleans up the
              repository before returning this result.
            </p>
          )}
        </div>

        {result ? (
          <div className="grid gap-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Repository
              </p>
              <p className="mt-2 font-semibold">{result.repository}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Context Mode
              </p>
              <p className="mt-2 font-semibold">
                {resolveContextModeLabel(result)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Files Found
              </p>
              <p className="mt-2 font-semibold">{result.file_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Files Read
              </p>
              <p className="mt-2 font-semibold">{result.content_file_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Context Size
              </p>
              <p className="mt-2 font-semibold">
                {formatBytes(result.context_size_bytes ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Skipped
              </p>
              <p className="mt-2 font-semibold">{result.skipped_file_count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                Status
              </p>
              <p className="mt-2 font-semibold">
                {result.truncated ? "Truncated" : result.status}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 xl:col-span-7">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                href="/ask-ai"
              >
                Ask AI About This Repo
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-10 grid w-full min-w-0 max-w-[calc(100vw-10rem)] grid-cols-1 gap-5 px-4 sm:px-5 lg:grid-cols-2">
        <article className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Folder Structure</h2>
            <button
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300"
              disabled={!result}
              onClick={copyTree}
              type="button"
            >
              {copyTreeLabel}
            </button>
          </div>
          <StyledFolderTree tree={treePreview} />
        </article>

        <article className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">File Contents</h2>
            <button
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300"
              disabled={!result}
              onClick={copyOutput}
              type="button"
            >
              {copyOutputLabel}
            </button>
          </div>
          <pre className="h-[70vh] min-w-0 overflow-auto rounded-2xl bg-black/30 p-4 text-sm leading-7 whitespace-pre-wrap wrap-break-word text-slate-300">
            {outputPreview}
          </pre>
        </article>
      </section>

      {result?.skipped_files.length ? (
        <section className="mx-auto mt-10 w-full max-w-6xl px-6">
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Skipped Files</h2>
                <p className="mt-1 text-sm text-amber-100/80">
                  These files are still part of the repository, but they were
                  not included in the combined output to keep the page fast and
                  LLM-friendly.
                </p>
              </div>
              <span className="rounded-full bg-amber-200/20 px-3 py-1 text-xs text-amber-100">
                {result.skipped_file_count} skipped
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl bg-black/20">
              {result.skipped_files.map((file) => (
                <div
                  className="grid gap-2 border-b border-white/10 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_220px_100px]"
                  key={`${file.path}-${file.reason}`}
                >
                  <span className="break-all font-mono text-slate-200">
                    {file.path}
                  </span>
                  <span className="text-amber-100">
                    {explainSkipReason(file.reason)}
                  </span>
                  <span className="text-slate-400">
                    {formatBytes(file.size_bytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
