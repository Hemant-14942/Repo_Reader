from typing import Literal

from pydantic import BaseModel, Field


LLMProvider = Literal["openai", "anthropic", "gemini", "groq", "mistral", "openrouter"]
ChatRole = Literal["user", "assistant"]
ContextMode = Literal["easy", "full"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(..., min_length=1)


class LLMChatRequest(BaseModel):
    provider: LLMProvider
    model: str = Field(..., min_length=1, max_length=120)
    api_key: str = Field(..., min_length=1, max_length=500)
    question: str = Field(..., min_length=1)
    repo_context: str = Field(..., min_length=1)
    context_mode: ContextMode = "easy"
    messages: list[ChatMessage] = Field(default_factory=list)


class LLMChatResponse(BaseModel):
    provider: LLMProvider
    model: str
    answer: str
