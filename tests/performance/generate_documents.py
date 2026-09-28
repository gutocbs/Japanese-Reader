"""Generate deterministic Japanese corpora for large-document measurements."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path
from typing import Iterable


DEFAULT_SIZES = (10_000, 50_000, 100_000, 250_000)
SEED_TEXT = (
    "昨日、日本語の長い文章を読みました。語彙と文脈を確認します。"
    "𠮷野家でお茶🍵を飲み、次の段落へ進みます。\n"
)


@dataclass(frozen=True)
class CorpusManifestEntry:
    code_points: int
    utf8_bytes: int
    sha256: str
    file: str


def generate_document(code_points: int) -> str:
    """Return exactly ``code_points`` Unicode code points from a fixed seed."""

    if code_points <= 0:
        raise ValueError("code_points must be greater than zero")
    repetitions = (code_points + len(SEED_TEXT) - 1) // len(SEED_TEXT)
    content = (SEED_TEXT * repetitions)[:code_points]
    if len(content) != code_points:
        raise AssertionError("generated corpus has an unexpected code-point count")
    return content


def describe_document(content: str, file_name: str) -> CorpusManifestEntry:
    encoded = content.encode("utf-8")
    return CorpusManifestEntry(
        code_points=len(content),
        utf8_bytes=len(encoded),
        sha256=sha256(encoded).hexdigest(),
        file=file_name,
    )


def write_corpora(
    output_directory: Path,
    sizes: Iterable[int] = DEFAULT_SIZES,
) -> tuple[CorpusManifestEntry, ...]:
    output_directory.mkdir(parents=True, exist_ok=True)
    manifest: list[CorpusManifestEntry] = []
    for size in sizes:
        content = generate_document(size)
        file_name = f"japanese-{size}.txt"
        (output_directory / file_name).write_text(content, encoding="utf-8", newline="")
        manifest.append(describe_document(content, file_name))

    entries = tuple(manifest)
    (output_directory / "manifest.json").write_text(
        json.dumps([asdict(entry) for entry in entries], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return entries


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(".dev/performance/corpora"),
        help="directory for generated text files and manifest (default: %(default)s)",
    )
    parser.add_argument(
        "--sizes",
        type=int,
        nargs="+",
        default=DEFAULT_SIZES,
        help="exact Unicode code-point counts",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    entries = write_corpora(args.output_dir, args.sizes)
    print(json.dumps([asdict(entry) for entry in entries], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
