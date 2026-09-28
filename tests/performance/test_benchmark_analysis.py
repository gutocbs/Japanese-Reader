from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from hashlib import sha256
import sys

import pytest

from tests.performance import benchmark_analysis
from tests.performance.benchmark_analysis import resident_set_bytes, validate_analysis
from tests.performance.generate_documents import describe_document, generate_document


def valid_analysis_payload() -> tuple[dict[str, object], str, str]:
    content = "A𠮷 B\n猫"
    content_hash = sha256(content.encode("utf-8")).hexdigest()
    return (
        {
            "contentHash": content_hash,
            "blocks": [
                {
                    "startOffset": 0,
                    "endOffset": 5,
                    "tokens": [
                        {"startOffset": 0, "endOffset": 2, "surface": "A𠮷"},
                        {"startOffset": 3, "endOffset": 4, "surface": "B"},
                    ],
                },
                {
                    "startOffset": 5,
                    "endOffset": 6,
                    "tokens": [
                        {"startOffset": 5, "endOffset": 6, "surface": "猫"},
                    ],
                },
            ],
        },
        content,
        content_hash,
    )


def test_validate_analysis_accepts_ordered_blocks_tokens_and_original_gaps():
    payload, content, content_hash = valid_analysis_payload()

    validate_analysis(payload, content, content_hash)


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload["blocks"][0].update(startOffset=1), "block coverage"),
        (lambda payload: payload["blocks"][0].update(endOffset=7), "block bounds"),
        (lambda payload: payload["blocks"][1].update(startOffset=4), "block coverage"),
        (lambda payload: payload["blocks"][1].update(endOffset=5), "block bounds"),
        (
            lambda payload: payload["blocks"][0]["tokens"][0].update(startOffset=-1),
            "token bounds",
        ),
        (
            lambda payload: payload["blocks"][0]["tokens"][1].update(startOffset=1),
            "token order",
        ),
        (
            lambda payload: payload["blocks"][0]["tokens"][1].update(endOffset=6),
            "token bounds",
        ),
        (
            lambda payload: payload["blocks"][0]["tokens"][0].update(surface="wrong"),
            "token surface",
        ),
    ],
)
def test_validate_analysis_rejects_invalid_offsets_and_reconstruction(mutate, message):
    payload, content, content_hash = valid_analysis_payload()
    invalid = deepcopy(payload)
    mutate(invalid)

    with pytest.raises(AssertionError, match=message):
        validate_analysis(invalid, content, content_hash)


def test_corpus_hashes_match_the_documented_manifest():
    expected = {
        10_000: "ec761d9726a707bb282e42a9fe26c87c2a2932b86aef60afeb58952e58cf70a5",
        50_000: "461f24f414ebdad896d96694a5830fa36c89193e6419fab4fabb25b853f2b8a7",
        100_000: "cc78befca7c605dc3aeecb106357dfa9dc63d61631e06185db940f86cf600568",
        250_000: "e655081d0c72d6cdeab498f784a540d0e9db4230daff0266e5023ba4451039c3",
    }

    for code_points, expected_hash in expected.items():
        content = generate_document(code_points)
        assert describe_document(content, "unused.txt").sha256 == expected_hash


def test_resident_set_sampler_is_thread_safe():
    with ThreadPoolExecutor(max_workers=8) as executor:
        values = list(executor.map(lambda _: resident_set_bytes(), range(1_000)))

    assert all(isinstance(value, int) and value > 0 for value in values)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows implementation only")
def test_windows_rss_reader_is_initialized_once():
    reader = benchmark_analysis._WINDOWS_RSS_READER

    assert reader is not None
    assert resident_set_bytes() > 0
    assert benchmark_analysis._WINDOWS_RSS_READER is reader
