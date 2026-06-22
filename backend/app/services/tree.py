TreeNode = dict[str, "TreeNode"]


def build_tree(file_paths: list[str]) -> TreeNode:
    root: TreeNode = {}

    for file_path in file_paths:
        current = root
        for part in file_path.split("/"):
            current = current.setdefault(part, {})

    return root


def format_tree(file_paths: list[str]) -> str:
    tree = build_tree(file_paths)
    lines: list[str] = []

    def walk(node: TreeNode, prefix: str = "") -> None:
        items = sorted(node.items(), key=lambda item: item[0].lower())

        for index, (name, children) in enumerate(items):
            is_last = index == len(items) - 1
            connector = "`-- " if is_last else "|-- "
            lines.append(f"{prefix}{connector}{name}")

            if children:
                extension = "    " if is_last else "|   "
                walk(children, f"{prefix}{extension}")

    walk(tree)
    return "\n".join(lines)
