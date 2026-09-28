"""Benchmark cold analysis and SQLite cache transport through the FastAPI API."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from importlib.metadata import version
import gc
import json
import os
from pathlib import Path
import platform
from statistics import median
import sys
from tempfile import TemporaryDirectory
from threading import Event, Thread
from time import perf_counter
from typing import Callable

from fastapi.testclient import TestClient


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from backend.app.main import create_app  # noqa: E402
from tests.performance.generate_documents import (  # noqa: E402
    DEFAULT_SIZES,
    describe_document,
    generate_document,
)


MEBIBYTE = 1024 * 1024


if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _ProcessMemoryCounters(ctypes.Structure):
        _fields_ = [
            ("cb", wintypes.DWORD),
            ("PageFaultCount", wintypes.DWORD),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
        ]

    class _WindowsRssReader:
        """Own stable ctypes signatures; each call only allocates its counter."""

        def __init__(self) -> None:
            self._get_current_process = ctypes.windll.kernel32.GetCurrentProcess
            self._get_current_process.argtypes = []
            self._get_current_process.restype = wintypes.HANDLE
            self._get_memory_info = ctypes.windll.psapi.GetProcessMemoryInfo
            self._get_memory_info.argtypes = [
                wintypes.HANDLE,
                wintypes.LPVOID,
                wintypes.DWORD,
            ]
            self._get_memory_info.restype = wintypes.BOOL

        def __call__(self) -> int:
            counters = _ProcessMemoryCounters()
            counters.cb = ctypes.sizeof(counters)
            if not self._get_memory_info(
                self._get_current_process(), ctypes.byref(counters), counters.cb
            ):
                raise OSError("GetProcessMemoryInfo failed")
            return int(counters.WorkingSetSize)

    _WINDOWS_RSS_READER: Callable[[], int] | None = _WindowsRssReader()
else:
    _WINDOWS_RSS_READER = None


@dataclass(frozen=True)
class RequestMeasurement:
    duration_ms: float
    peak_rss_mib: float
    peak_rss_delta_mib: float
    response_bytes: int


class PeakRssSampler:
    """Sample resident memory without adding a benchmark dependency."""

    def __init__(self, interval_seconds: float = 0.005) -> None:
        self._interval_seconds = interval_seconds
        self._stop = Event()
        self._thread = Thread(target=self._sample, daemon=True)
        self.initial_bytes = resident_set_bytes()
        self.peak_bytes = self.initial_bytes

    def _sample(self) -> None:
        while not self._stop.wait(self._interval_seconds):
            self.peak_bytes = max(self.peak_bytes, resident_set_bytes())

    def start(self) -> None:
        self._thread.start()

    def finish(self) -> None:
        self.peak_bytes = max(self.peak_bytes, resident_set_bytes())
        self._stop.set()
        self._thread.join()


def resident_set_bytes() -> int:
    if _WINDOWS_RSS_READER is not None:
        return _WINDOWS_RSS_READER()

    status = Path("/proc/self/statm")
    if status.exists():
        resident_pages = int(status.read_text(encoding="ascii").split()[1])
        return resident_pages * os.sysconf("SC_PAGE_SIZE")

    import resource

    maximum = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(maximum if sys.platform == "darwin" else maximum * 1024)


def measure_request(request: Callable[[], object]) -> tuple[RequestMeasurement, object]:
    gc.collect()
    sampler = PeakRssSampler()
    sampler.start()
    started = perf_counter()
    response = request()
    duration_ms = (perf_counter() - started) * 1000
    sampler.finish()
    content = getattr(response, "content")
    return (
        RequestMeasurement(
            duration_ms=round(duration_ms, 3),
            peak_rss_mib=round(sampler.peak_bytes / MEBIBYTE, 3),
            peak_rss_delta_mib=round(
                max(0, sampler.peak_bytes - sampler.initial_bytes) / MEBIBYTE,
                3,
            ),
            response_bytes=len(content),
        ),
        response,
    )


def validate_analysis(payload: dict[str, object], content: str, expected_hash: str) -> None:
    if payload["contentHash"] != expected_hash:
        raise AssertionError("analysis content hash does not match the corpus")
    code_points = list(content)
    blocks = payload["blocks"]
    if not isinstance(blocks, list) or not blocks:
        raise AssertionError("analysis returned no blocks")
    cursor = 0
    reconstructed: list[str] = []
    for block_index, block in enumerate(blocks):
        block_start = block["startOffset"]
        block_end = block["endOffset"]
        if not 0 <= block_start < block_end <= len(code_points):
            raise AssertionError(
                f"block bounds invalid at index {block_index}: "
                f"[{block_start}, {block_end})"
            )
        if block_start != cursor:
            raise AssertionError(
                f"block coverage mismatch at index {block_index}: "
                f"expected {cursor}, got {block_start}"
            )

        token_cursor = block_start
        for token in block["tokens"]:
            start = token["startOffset"]
            end = token["endOffset"]
            if not block_start <= start < end <= block_end:
                raise AssertionError(
                    f"token bounds invalid in block {block_index}: [{start}, {end})"
                )
            if start < token_cursor:
                raise AssertionError(
                    f"token order overlap in block {block_index}: "
                    f"previous end {token_cursor}, next start {start}"
                )
            reconstructed.extend(code_points[token_cursor:start])
            if "".join(code_points[start:end]) != token["surface"]:
                raise AssertionError(f"token surface mismatch at [{start}, {end})")
            reconstructed.append(token["surface"])
            token_cursor = end
        reconstructed.extend(code_points[token_cursor:block_end])
        cursor = block_end

    if cursor != len(code_points):
        raise AssertionError(
            f"block coverage mismatch at document end: expected {len(code_points)}, got {cursor}"
        )
    if "".join(reconstructed) != content:
        raise AssertionError("analysis reconstruction does not equal canonical content")


def run_once(code_points: int) -> dict[str, object]:
    content = generate_document(code_points)
    corpus = describe_document(content, f"japanese-{code_points}.txt")
    with TemporaryDirectory(prefix="japanese-reader-performance-") as directory:
        app = create_app(Path(directory) / "benchmark.db")
        with TestClient(app) as client:
            created = client.post(
                "/api/documents",
                json={"title": f"Benchmark {code_points}", "content": content},
            )
            created.raise_for_status()
            document_id = created.json()["id"]
            del created

            cold, cold_response = measure_request(
                lambda: client.post(f"/api/documents/{document_id}/analysis")
            )
            cold_response.raise_for_status()
            cold_payload = cold_response.json()
            validate_analysis(cold_payload, content, corpus.sha256)
            block_count = len(cold_payload["blocks"])
            token_count = sum(len(block["tokens"]) for block in cold_payload["blocks"])
            del cold_payload, cold_response

            cached, cached_response = measure_request(
                lambda: client.post(f"/api/documents/{document_id}/analysis")
            )
            cached_response.raise_for_status()
            if cached.response_bytes != cold.response_bytes:
                raise AssertionError("cold and cached transport payload sizes differ")
            validate_analysis(cached_response.json(), content, corpus.sha256)
            del cached_response

    return {
        "corpus": asdict(corpus),
        "blocks": block_count,
        "tokens": token_count,
        "cold": asdict(cold),
        "cache": asdict(cached),
    }


def summarize(samples: list[dict[str, object]]) -> dict[str, object]:
    first = samples[0]

    def values(kind: str, metric: str) -> list[float]:
        return [float(sample[kind][metric]) for sample in samples]

    def metric(kind: str, name: str) -> dict[str, object]:
        entries = values(kind, name)
        return {"median": round(median(entries), 3), "samples": entries}

    return {
        "corpus": first["corpus"],
        "blocks": first["blocks"],
        "tokens": first["tokens"],
        "responseBytes": first["cold"]["response_bytes"],
        "coldAnalysisMs": metric("cold", "duration_ms"),
        "coldPeakRssMiB": metric("cold", "peak_rss_mib"),
        "coldPeakRssDeltaMiB": metric("cold", "peak_rss_delta_mib"),
        "cacheReadMs": metric("cache", "duration_ms"),
        "cachePeakRssMiB": metric("cache", "peak_rss_mib"),
        "cachePeakRssDeltaMiB": metric("cache", "peak_rss_delta_mib"),
    }


def benchmark(sizes: list[int], runs: int) -> dict[str, object]:
    if runs < 3:
        raise ValueError("runs must be at least 3")
    results: list[dict[str, object]] = []
    for size in sizes:
        samples = [run_once(size) for _ in range(runs)]
        results.append(summarize(samples))
    return {
        "environment": {
            "platform": platform.platform(),
            "processor": platform.processor() or "unknown",
            "logicalCpuCount": os.cpu_count(),
            "python": platform.python_version(),
            "sudachiPy": version("SudachiPy"),
            "sudachiDictCore": version("SudachiDict-core"),
            "measurement": "FastAPI TestClient + SQLite file; 5 ms process RSS sampling",
        },
        "runsPerSize": runs,
        "results": results,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", type=int, nargs="+", default=DEFAULT_SIZES)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = benchmark(args.sizes, args.runs)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8", newline="\n")
    print(rendered, end="")


if __name__ == "__main__":
    main()
