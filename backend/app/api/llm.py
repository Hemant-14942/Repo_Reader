from fastapi import APIRouter, HTTPException, status

from app.models.llm import LLMChatRequest, LLMChatResponse
from app.services.llm.client import LLMProviderError, LLMServiceError, chat_with_llm
from app.services.llm.providers import InvalidModelNameError, UnsupportedProviderError


router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/chat", response_model=LLMChatResponse)
def chat_with_repository(request: LLMChatRequest) -> LLMChatResponse:
    try:
        answer = chat_with_llm(
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
            question=request.question,
            repo_context=request.repo_context,
            messages=request.messages,
            context_mode=request.context_mode,
        )
    except (UnsupportedProviderError, InvalidModelNameError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "type": "validation_error",
                "message": str(error),
            },
        ) from error
    except LLMProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "type": error.error_type,
                "message": error.message,
                "provider_status_code": error.status_code,
            },
        ) from error
    except LLMServiceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "type": "service_error",
                "message": str(error),
            },
        ) from error

    return LLMChatResponse(
        provider=request.provider,
        model=request.model,
        answer=answer,
    )
