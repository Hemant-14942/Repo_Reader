from dataclasses import dataclass
from typing import Literal


ContextMode = Literal["easy", "full"]


@dataclass(frozen=True)
class ContextModeSettings:
    mode: ContextMode
    label: str
    description: str
    max_traversal_files: int
    max_readable_files: int
    max_file_size_bytes: int
    max_total_content_bytes: int
    max_llm_context_chars: int


CONTEXT_MODE_SETTINGS: dict[ContextMode, ContextModeSettings] = {
    "easy": ContextModeSettings(
        mode="easy",
        label="Easy Mode",
        description="Faster and lower LLM cost. Reads important files up to 1MB each.",
        max_traversal_files=1_000,
        max_readable_files=150,
        max_file_size_bytes=1_000_000,
        max_total_content_bytes=5_000_000,
        max_llm_context_chars=120_000,
    ),
    "full": ContextModeSettings(
        mode="full",
        label="Full Mode",
        description="Deeper analysis with larger files included. Uses more tokens and costs more.",
        max_traversal_files=5_000,
        max_readable_files=800,
        max_file_size_bytes=5_000_000,
        max_total_content_bytes=30_000_000,
        max_llm_context_chars=600_000,
    ),
}


def get_context_mode_settings(mode: ContextMode = "easy") -> ContextModeSettings:
    return CONTEXT_MODE_SETTINGS.get(mode, CONTEXT_MODE_SETTINGS["easy"])
