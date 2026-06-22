from app.services.file_reader import ReadFileResult


def format_repository_output(
    repository: str,
    tree: str,
    file_contents: list[ReadFileResult],
) -> str:
    sections = [
        f"# Repository: {repository}",
        "",
        "## File Contents",
    ]

    if not file_contents:
        sections.extend(["", "No readable source files found."])
        return "\n".join(sections)

    for file in file_contents:
        sections.extend(
            [
                "",
                f"### {file.path}",
                "",
                "```text",
                file.content.rstrip(),
                "```",
            ]
        )

    return "\n".join(sections)
