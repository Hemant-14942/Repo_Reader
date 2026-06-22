import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.models.llm import ChatMessage, ContextMode, LLMProvider
from app.services.context_mode import get_context_mode_settings
from app.services.llm.providers import validate_provider_model


MAX_HISTORY_MESSAGES = 8
REQUEST_TIMEOUT_SECONDS = 60


class LLMServiceError(RuntimeError):
    pass


class LLMProviderError(RuntimeError):
    def __init__(self, message: str, error_type: str = "provider_error", status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.error_type = error_type
        self.status_code = status_code


def build_system_prompt(repo_context: str, context_mode: ContextMode = "easy") -> str:
    settings = get_context_mode_settings(context_mode)
    trimmed_context = repo_context[: settings.max_llm_context_chars]
    was_trimmed = len(repo_context) > settings.max_llm_context_chars
    trim_note = (
        "\n\nNote: repository context was trimmed to fit model limits. Mention if your answer may be incomplete."
        if was_trimmed
        else ""
    )
    return (
        "You are a senior software engineer helping the user understand a GitHub repository. "
        "Use the repository context below to answer accurately. If the context is incomplete, say so. "
        "Prefer concise, practical explanations and cite file paths when useful.\n\n"
        f"Repository context:\n{trimmed_context}{trim_note}"
    )


def normalize_messages(question: str, messages: list[ChatMessage]) -> list[dict[str, str]]:
    normalized = [
        {"role": message.role, "content": message.content}
        for message in messages[-MAX_HISTORY_MESSAGES:]
    ]
    normalized.append({"role": "user", "content": question})
    return normalized


def post_json(url: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
    request = Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        message = parse_provider_error(error)
        raise LLMProviderError(
            message=message,
            error_type=classify_provider_error(error.code),
            status_code=error.code,
        ) from error
    except URLError as error:
        raise LLMProviderError(
            message="Unable to reach the selected LLM provider. Check your internet connection or provider status.",
            error_type="network_error",
        ) from error
    except TimeoutError as error:
        raise LLMProviderError(
            message="The selected LLM provider timed out. Try again or choose a faster model.",
            error_type="timeout",
        ) from error


def classify_provider_error(status_code: int) -> str:
    if status_code in {401, 403}:
        return "authentication_error"

    if status_code == 404:
        return "model_or_endpoint_error"

    if status_code == 429:
        return "rate_limit_error"

    if 400 <= status_code < 500:
        return "request_error"

    return "provider_error"


def parse_provider_error(error: HTTPError) -> str:
    raw_message = error.read().decode("utf-8", errors="replace")

    try:
        payload = json.loads(raw_message)
    except json.JSONDecodeError:
        payload = {}

    message = extract_error_message(payload) or raw_message.strip()

    if error.code in {401, 403}:
        return "Authentication failed. Check that your API key is correct and has access to this provider/model."

    if error.code == 404:
        return "The provider could not find this model or endpoint. Check the custom model name."

    if error.code == 429:
        return "Rate limit or quota exceeded. Check your provider billing/quota or try again later."

    if message:
        return message[:500]

    return "The selected LLM provider returned an error."


def extract_error_message(payload: dict[str, Any]) -> str | None:
    error = payload.get("error")

    if isinstance(error, dict):
        message = error.get("message")
        if isinstance(message, str):
            return message

    if isinstance(error, str):
        return error

    message = payload.get("message")
    if isinstance(message, str):
        return message

    return None


def chat_with_llm(
    provider: LLMProvider,
    model: str,
    api_key: str,
    question: str,
    repo_context: str,
    messages: list[ChatMessage],
    context_mode: ContextMode = "easy",
) -> str:
    validate_provider_model(provider, model)

    system_prompt = build_system_prompt(repo_context, context_mode)
    chat_messages = normalize_messages(question, messages)

    if provider == "openai":
        return chat_openai(model, api_key, system_prompt, chat_messages)

    if provider == "anthropic":
        return chat_anthropic(model, api_key, system_prompt, chat_messages)

    if provider == "gemini":
        return chat_gemini(model, api_key, system_prompt, chat_messages)

    if provider == "groq":
        return chat_groq(model, api_key, system_prompt, chat_messages)

    if provider == "mistral":
        return chat_mistral(model, api_key, system_prompt, chat_messages)

    if provider == "openrouter":
        return chat_openrouter(model, api_key, system_prompt, chat_messages)

    raise LLMServiceError("Unsupported LLM provider.")


def chat_openai(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    data = post_json(
        "https://api.openai.com/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "temperature": 0.2,
        },
    )
    return data["choices"][0]["message"]["content"]


def chat_anthropic(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    data = post_json(
        "https://api.anthropic.com/v1/messages",
        {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        {
            "model": model,
            "system": system_prompt,
            "messages": messages,
            "max_tokens": 1200,
            "temperature": 0.2,
        },
    )
    return "".join(block.get("text", "") for block in data.get("content", []))


def chat_gemini(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    contents = [
        {
            "role": "user" if message["role"] == "user" else "model",
            "parts": [{"text": message["content"]}],
        }
        for message in messages
    ]
    data = post_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        {},
        {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.2},
        },
    )
    return data["candidates"][0]["content"]["parts"][0]["text"]


def chat_groq(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    data = post_json(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "temperature": 0.2,
        },
    )
    return data["choices"][0]["message"]["content"]


def chat_mistral(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    data = post_json(
        "https://api.mistral.ai/v1/chat/completions",
        {"Authorization": f"Bearer {api_key}"},
        {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "temperature": 0.2,
        },
    )
    return data["choices"][0]["message"]["content"]


def chat_openrouter(model: str, api_key: str, system_prompt: str, messages: list[dict[str, str]]) -> str:
    data = post_json(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Repo Reader",
        },
        {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "temperature": 0.2,
        },
    )
    return data["choices"][0]["message"]["content"]
