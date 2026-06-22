from app.models.llm import LLMProvider


PROVIDER_MODELS: dict[LLMProvider, list[str]] = {
    "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    "anthropic": ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
    "gemini": ["gemini-1.5-flash", "gemini-1.5-pro"],
    "groq": ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"],
    "mistral": ["mistral-small-latest", "mistral-large-latest"],
    "openrouter": ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5"],
}


class UnsupportedProviderError(ValueError):
    pass


class InvalidModelNameError(ValueError):
    pass


def validate_provider_model(provider: LLMProvider, model: str) -> None:
    models = PROVIDER_MODELS.get(provider)
    if models is None:
        raise UnsupportedProviderError("Unsupported LLM provider.")

    if not model.strip():
        raise InvalidModelNameError("Model name is required.")

    if len(model) > 120:
        raise InvalidModelNameError("Model name is too long.")

    if any(character.isspace() for character in model):
        raise InvalidModelNameError("Model name should not contain spaces.")
