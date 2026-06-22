from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse

from git import GitCommandError, Repo

from app.services.context_mode import ContextMode, get_context_mode_settings
from app.services.file_reader import ReadFileResult, SkippedFileResult, read_source_files
from app.services.formatter import format_repository_output
from app.services.traversal import collect_file_paths
from app.services.tree import format_tree


class RepositoryValidationError(ValueError):
    pass


class RepositoryCloneError(RuntimeError):
    def __init__(self, message: str, error_type: str = "clone_error") -> None:
        super().__init__(message)
        self.message = message
        self.error_type = error_type


class RepositoryProcessingError(RuntimeError):
    def __init__(self, message: str, error_type: str = "processing_error") -> None:
        super().__init__(message)
        self.message = message
        self.error_type = error_type


@dataclass(frozen=True)
class RepositoryIngestResult:
    repository: str
    files: list[str]
    tree: str
    output: str
    file_contents: list[ReadFileResult]
    skipped_files: list[SkippedFileResult]
    truncated: bool
    context_mode: ContextMode
    context_mode_label: str
    context_size_bytes: int


def normalize_github_url(repo_url: str) -> str:
    parsed_url = urlparse(repo_url.strip())

    if parsed_url.scheme != "https":
        raise RepositoryValidationError("Repository URL must use https.")

    if parsed_url.netloc.lower() != "github.com":
        raise RepositoryValidationError("Only github.com repository URLs are supported.")

    path_parts = [part for part in parsed_url.path.strip("/").split("/") if part]
    if len(path_parts) < 2:
        raise RepositoryValidationError("Repository URL must include an owner and repository name.")

    owner, repository = path_parts[0], path_parts[1].removesuffix(".git")
    if not owner or not repository:
        raise RepositoryValidationError("Repository URL must include an owner and repository name.")

    return f"https://github.com/{owner}/{repository}.git"


def classify_clone_error(error: GitCommandError) -> RepositoryCloneError:
    raw_message = f"{error.stdout or ''}\n{error.stderr or ''}\n{error}".lower()

    if any(text in raw_message for text in ["repository not found", "not found", "authentication failed"]):
        return RepositoryCloneError(
            "We could not access this repository. Make sure the URL is correct and the repo is public.",
            "repo_not_found_or_private",
        )

    if any(text in raw_message for text in ["early eof", "index-pack failed", "out of memory", "no space left"]):
        return RepositoryCloneError(
            "This repository looks too large to process right now. Try a smaller repository, or increase the processing limits later.",
            "repo_too_large",
        )

    if any(text in raw_message for text in ["timed out", "could not resolve host", "failed to connect"]):
        return RepositoryCloneError(
            "We could not reach GitHub while cloning. Check your connection and try again.",
            "network_error",
        )

    return RepositoryCloneError(
        "We could not clone this repository. Try another public GitHub repo or try again later.",
        "clone_error",
    )


def ingest_repository(repo_url: str, context_mode: ContextMode = "easy") -> RepositoryIngestResult:
    normalized_url = normalize_github_url(repo_url)
    settings = get_context_mode_settings(context_mode)

    with TemporaryDirectory(prefix="repo-reader-") as temp_dir:
        clone_path = Path(temp_dir) / "repository"

        try:
            Repo.clone_from(normalized_url, clone_path, depth=1)
        except GitCommandError as error:
            raise classify_clone_error(error) from error

        try:
            repository = normalized_url.removeprefix("https://github.com/").removesuffix(".git")
            files, path_truncated = collect_file_paths(
                clone_path,
                max_files=settings.max_traversal_files,
            )
            tree = format_tree(files)
            file_contents, skipped_files, content_truncated = read_source_files(
                clone_path,
                files,
                max_files=settings.max_readable_files,
                max_total_bytes=settings.max_total_content_bytes,
                max_file_size_bytes=settings.max_file_size_bytes,
            )
            output = format_repository_output(repository, tree, file_contents)
            context_size_bytes = sum(file.size_bytes for file in file_contents)
            return RepositoryIngestResult(
                repository=repository,
                files=files,
                tree=tree,
                output=output,
                file_contents=file_contents,
                skipped_files=skipped_files,
                truncated=path_truncated or content_truncated,
                context_mode=settings.mode,
                context_mode_label=settings.label,
                context_size_bytes=context_size_bytes,
            )
        except OSError as error:
            raise RepositoryProcessingError(
                "We cloned the repo, but it was too large or complex to read safely. Try a smaller repo or increase processing limits later.",
                "repo_too_large",
            ) from error
