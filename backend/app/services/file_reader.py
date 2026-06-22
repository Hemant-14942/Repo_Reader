from dataclasses import dataclass
from pathlib import Path


MAX_FILE_SIZE_BYTES = 1_000_000
MAX_READABLE_FILES = 150
MAX_TOTAL_CONTENT_BYTES = 5_000_000

READABLE_EXTENSIONS = {
    ".bash",
    ".c",
    ".cfg",
    ".cpp",
    ".cs",
    ".css",
    ".csv",
    ".dockerfile",
    ".env.example",
    ".go",
    ".h",
    ".html",
    ".ini",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".md",
    ".php",
    ".py",
    ".rb",
    ".rs",
    ".scss",
    ".sh",
    ".sql",
    ".swift",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
    ".zsh",
}

READABLE_FILENAMES = {
    "dockerfile",
    "makefile",
    "readme",
    "license",
    "requirements.txt",
}

SKIPPED_FILENAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
}


@dataclass(frozen=True)
class ReadFileResult:
    path: str
    content: str
    size_bytes: int


@dataclass(frozen=True)
class SkippedFileResult:
    path: str
    reason: str
    size_bytes: int | None = None


def is_supported_text_file(path: Path) -> bool:
    filename = path.name.lower()

    if filename in SKIPPED_FILENAMES:
        return False

    if filename in READABLE_FILENAMES:
        return True

    suffixes = [suffix.lower() for suffix in path.suffixes]
    return any(suffix in READABLE_EXTENSIONS for suffix in suffixes)


def is_binary_file(path: Path) -> bool:
    chunk = path.read_bytes()[:1024]
    return b"\0" in chunk


def read_source_files(
    repo_root: Path,
    file_paths: list[str],
    max_files: int = MAX_READABLE_FILES,
    max_total_bytes: int = MAX_TOTAL_CONTENT_BYTES,
    max_file_size_bytes: int = MAX_FILE_SIZE_BYTES,
) -> tuple[list[ReadFileResult], list[SkippedFileResult], bool]:
    results: list[ReadFileResult] = []
    skipped_files: list[SkippedFileResult] = []
    total_bytes = 0
    truncated = False

    for relative_path in file_paths:
        path = repo_root / relative_path

        if not path.is_file() or path.is_symlink():
            continue

        size_bytes = path.stat().st_size
        if size_bytes > max_file_size_bytes:
            skipped_files.append(
                SkippedFileResult(
                    path=relative_path,
                    reason="too_large",
                    size_bytes=size_bytes,
                )
            )
            continue

        if not is_supported_text_file(path):
            skipped_files.append(
                SkippedFileResult(
                    path=relative_path,
                    reason="unsupported_type",
                    size_bytes=size_bytes,
                )
            )
            continue

        if is_binary_file(path):
            skipped_files.append(
                SkippedFileResult(
                    path=relative_path,
                    reason="binary_file",
                    size_bytes=size_bytes,
                )
            )
            continue

        if len(results) >= max_files:
            skipped_files.append(
                SkippedFileResult(
                    path=relative_path,
                    reason="readable_file_limit_reached",
                    size_bytes=size_bytes,
                )
            )
            truncated = True
            continue

        if total_bytes + size_bytes > max_total_bytes:
            skipped_files.append(
                SkippedFileResult(
                    path=relative_path,
                    reason="total_content_limit_reached",
                    size_bytes=size_bytes,
                )
            )
            truncated = True
            continue

        content = path.read_text(encoding="utf-8", errors="replace")
        results.append(
            ReadFileResult(
                path=relative_path,
                content=content,
                size_bytes=size_bytes,
            )
        )
        total_bytes += size_bytes

    return results, skipped_files, truncated
