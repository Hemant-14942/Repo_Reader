from typing import Literal

from pydantic import BaseModel, Field


ContextMode = Literal["easy", "full"]


class IngestRequest(BaseModel):
    repo_url: str = Field(
        ...,
        min_length=1,
        examples=["https://github.com/vercel/next.js"],
    )
    context_mode: ContextMode = "easy"


class FileContent(BaseModel):
    path: str
    content: str
    size_bytes: int


class SkippedFile(BaseModel):
    path: str
    reason: str
    size_bytes: int | None = None


class IngestResponse(BaseModel):
    repository: str
    status: str
    message: str
    tree: str
    output: str
    file_count: int
    files: list[str]
    content_file_count: int
    file_contents: list[FileContent]
    skipped_file_count: int
    skipped_files: list[SkippedFile]
    truncated: bool
    context_mode: ContextMode
    context_mode_label: str
    context_size_bytes: int
