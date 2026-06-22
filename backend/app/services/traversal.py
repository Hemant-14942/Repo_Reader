from pathlib import Path

import pathspec


DEFAULT_SKIPPED_NAMES = {
    ".git",
    ".idea",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".venv",
    ".vscode",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "venv",
}


def load_gitignore_spec(repo_root: Path) -> pathspec.PathSpec | None:
    gitignore_path = repo_root / ".gitignore"

    if not gitignore_path.exists():
        return None

    patterns = gitignore_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return pathspec.PathSpec.from_lines("gitwildmatch", patterns)


def should_skip_path(path: Path) -> bool:
    return path.name.startswith(".") or path.name in DEFAULT_SKIPPED_NAMES


def collect_file_paths(repo_root: Path, max_files: int = 1_000) -> tuple[list[str], bool]:
    file_paths: list[str] = []
    truncated = False
    gitignore_spec = load_gitignore_spec(repo_root)

    def is_gitignored(path: Path) -> bool:
        if gitignore_spec is None:
            return False

        relative_path = path.relative_to(repo_root).as_posix()
        if path.is_dir():
            relative_path = f"{relative_path}/"

        return gitignore_spec.match_file(relative_path)

    def walk_directory(directory: Path) -> None:
        nonlocal truncated

        if truncated:
            return

        for child in sorted(directory.iterdir(), key=lambda item: item.name.lower()):
            if child.is_symlink():
                continue

            if should_skip_path(child) or is_gitignored(child):
                continue

            if child.is_dir():
                walk_directory(child)
                continue

            if child.is_file():
                file_paths.append(child.relative_to(repo_root).as_posix())

            if len(file_paths) >= max_files:
                truncated = True
                return

    walk_directory(repo_root)
    return file_paths, truncated
