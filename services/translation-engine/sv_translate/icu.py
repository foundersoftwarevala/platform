"""A small ICU MessageFormat reader and writer.

Enough of the syntax for interface strings: simple arguments ({name},
{count, number}), plural, selectordinal and select blocks with nested messages,
`#` inside plural branches, `offset:n`, and '' as an escaped apostrophe.
"""

from __future__ import annotations

from dataclasses import dataclass, field

COMPLEX = {"plural", "selectordinal", "select"}


@dataclass
class Arg:
    """A simple argument, kept verbatim ("{name}", "{n, number, integer}")."""

    raw: str


@dataclass
class Block:
    name: str
    kind: str  # plural | selectordinal | select
    offset: int = 0
    options: dict[str, list["Node"]] = field(default_factory=dict)


@dataclass
class Pound:
    """The number inside a plural branch."""


Node = str | Arg | Block | Pound


class MessageError(ValueError):
    pass


def has_complex(message: str) -> bool:
    try:
        return any(isinstance(n, Block) for n in parse(message))
    except MessageError:
        return False


def parse(message: str) -> list[Node]:
    nodes, index = _parse_message(message, 0, in_plural=False, depth=0)
    if index != len(message):
        raise MessageError(f"unexpected '}}' at {index}")
    return nodes


def _parse_message(s: str, i: int, in_plural: bool, depth: int) -> tuple[list[Node], int]:
    if depth > 8:
        raise MessageError("message nested too deeply")
    nodes: list[Node] = []
    buf: list[str] = []

    def flush() -> None:
        if buf:
            nodes.append("".join(buf))
            buf.clear()

    while i < len(s):
        ch = s[i]
        if ch == "'" and i + 1 < len(s) and s[i + 1] == "'":
            buf.append("'")
            i += 2
        elif ch == "{":
            flush()
            node, i = _parse_argument(s, i, depth)
            nodes.append(node)
        elif ch == "}":
            break
        elif ch == "#" and in_plural:
            flush()
            nodes.append(Pound())
            i += 1
        else:
            buf.append(ch)
            i += 1
    flush()
    return nodes, i


def _parse_argument(s: str, start: int, depth: int) -> tuple[Node, int]:
    close = _find_simple_close(s, start)
    header_end = _header_end(s, start)
    header = s[start + 1 : header_end]
    parts = [p.strip() for p in header.split(",")]
    if len(parts) >= 2 and parts[1] in COMPLEX:
        return _parse_block(s, start, header_end, parts, depth)
    if close is None:
        raise MessageError(f"unclosed argument at {start}")
    return Arg(s[start : close + 1]), close + 1


def _header_end(s: str, start: int) -> int:
    """Index of the end of `{name, kind,` (the second comma) or of the argument."""
    commas = 0
    i = start + 1
    while i < len(s):
        if s[i] == ",":
            commas += 1
            if commas == 2:
                return i
        elif s[i] in "{}":
            return i
        i += 1
    raise MessageError(f"unclosed argument at {start}")


def _find_simple_close(s: str, start: int) -> int | None:
    i = start + 1
    while i < len(s):
        if s[i] == "}":
            return i
        if s[i] == "{":
            return None
        i += 1
    return None


def _parse_block(s: str, start: int, header_end: int, parts: list[str], depth: int) -> tuple[Block, int]:
    name, kind = parts[0], parts[1]
    if not name:
        raise MessageError(f"argument without a name at {start}")
    block = Block(name=name, kind=kind)
    i = header_end + 1
    while True:
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s):
            raise MessageError(f"unclosed {kind} at {start}")
        if s[i] == "}":
            if "other" not in block.options:
                raise MessageError(f"{kind} without an 'other' branch at {start}")
            return block, i + 1
        key_start = i
        while i < len(s) and not s[i].isspace() and s[i] != "{":
            i += 1
        key = s[key_start:i]
        if key.startswith("offset:"):
            if kind != "plural":
                raise MessageError("offset outside plural")
            block.offset = int(key[len("offset:") :])
            continue
        while i < len(s) and s[i].isspace():
            i += 1
        if i >= len(s) or s[i] != "{":
            raise MessageError(f"branch '{key}' has no message at {i}")
        branch, i = _parse_message(s, i + 1, in_plural=kind != "select", depth=depth + 1)
        if i >= len(s) or s[i] != "}":
            raise MessageError(f"branch '{key}' is not closed")
        block.options[key] = branch
        i += 1


def serialize(nodes: list[Node]) -> str:
    out: list[str] = []
    for node in nodes:
        if isinstance(node, str):
            # The reader turns '' into '; a literal '' has to be written as ''''.
            out.append(node.replace("''", "''''"))
        elif isinstance(node, Arg):
            out.append(node.raw)
        elif isinstance(node, Pound):
            out.append("#")
        else:
            head = f"{{{node.name}, {node.kind},"
            if node.offset:
                head += f" offset:{node.offset}"
            branches = " ".join(f"{key} {{{serialize(msg)}}}" for key, msg in node.options.items())
            out.append(f"{head} {branches}}}")
    return "".join(out)
