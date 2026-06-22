from fastapi import APIRouter, HTTPException, status

from app.models.ingest import FileContent, IngestRequest, IngestResponse, SkippedFile
from app.services.repository import (
    RepositoryCloneError,
    RepositoryProcessingError,
    RepositoryValidationError,
    ingest_repository,
)


router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("", response_model=IngestResponse)
def create_ingestion(request: IngestRequest) -> IngestResponse:
    try:
        result = ingest_repository(request.repo_url, context_mode=request.context_mode)
    except RepositoryValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "validation_error",
                "message": str(error),
            },
        ) from error
    except RepositoryCloneError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "type": error.error_type,
                "message": error.message,
            },
        ) from error
    except RepositoryProcessingError as error:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "type": error.error_type,
                "message": error.message,
            },
        ) from error

    return IngestResponse(
        repository=result.repository,
        status="traversed",
        message="Repository cloned and traversed successfully.",
        tree=result.tree,
        output=result.output,
        file_count=len(result.files),
        files=result.files,
        content_file_count=len(result.file_contents),
        file_contents=[
            FileContent(path=file.path, content=file.content, size_bytes=file.size_bytes)
            for file in result.file_contents
        ],
        skipped_file_count=len(result.skipped_files),
        skipped_files=[
            SkippedFile(path=file.path, reason=file.reason, size_bytes=file.size_bytes)
            for file in result.skipped_files
        ],
        truncated=result.truncated,
        context_mode=result.context_mode,
        context_mode_label=result.context_mode_label,
        context_size_bytes=result.context_size_bytes,
    )
