#!/usr/bin/env python3
"""sources.yaml 에 선언된 모든 소스를 실제로 요청해 살아있는지 확인한다.

피드는 예고 없이 죽는다. 선언된 status 와 실제 응답이 어긋나면 비정상 종료하므로
cron 이나 CI 에 걸어두면 소스가 썩는 걸 알아차릴 수 있다.

    python scripts/check_feeds.py                 # 스코프 내 소스만
    python scripts/check_feeds.py --all           # 스코프 외(보안) 포함
    python scripts/check_feeds.py --report r.json # 결과를 JSON 으로 저장

종료 코드: 0 = 선언과 일치, 1 = 불일치 있음
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
import yaml

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "sources.yaml"

# 스코프 내 계층. --all 이면 out_of_scope_security 도 본다.
IN_SCOPE = ["tier1", "tier2", "tier3", "domestic"]
FAILING = ["dead", "blocked"]

UA = "mediq-feed-checker/0.1 (+https://github.com/fpdhs/mediQ)"
TIMEOUT = 20

# 항목 수 집계는 줄 단위가 아니라 전체 본문에서 센다.
# 한 줄로 직렬화된 XML(DeepMind 등)에서 줄 단위 grep 은 1 을 반환한다.
RE_ITEM = re.compile(r"<item[\s>]")
RE_ENTRY = re.compile(r"<entry[\s>]")


def fetch(url: str) -> dict:
    """URL 하나를 확인한다. requests 는 gzip/deflate 를 기본 처리한다."""
    out = {"url": url, "code": 0, "items": 0, "kind": None, "error": None}
    try:
        r = requests.get(
            url,
            headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"},
            timeout=TIMEOUT,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        out["error"] = type(e).__name__
        return out

    out["code"] = r.status_code
    out["bytes"] = len(r.content)
    if r.status_code != 200:
        return out

    body = r.text
    stripped = body.lstrip()

    if stripped.startswith(("{", "[")):
        try:
            data = json.loads(body)
        except ValueError as e:
            out["kind"] = "json"
            out["error"] = f"JSON 파싱 실패: {e}"
            return out
        out["kind"] = "json"
        if isinstance(data, list):
            out["items"] = len(data)
        elif isinstance(data, dict):
            # CISA KEV 는 {"vulnerabilities": [...]} 형태
            for key in ("vulnerabilities", "items", "results", "data"):
                if isinstance(data.get(key), list):
                    out["items"] = len(data[key])
                    break
            else:
                out["items"] = len(data)
        return out

    items, entries = len(RE_ITEM.findall(body)), len(RE_ENTRY.findall(body))
    if entries > items:
        out["kind"], out["items"] = "atom", entries
    else:
        out["kind"], out["items"] = "rss", items

    if out["items"] == 0:
        out["error"] = "200 이지만 항목이 0건 (포맷 변경 또는 차단 페이지)"
    return out


def collect(doc: dict, include_all: bool) -> list[tuple[str, dict]]:
    """(그룹명, 엔트리) 목록을 만든다."""
    groups = list(IN_SCOPE)
    if include_all:
        groups.append("out_of_scope_security")
    groups += FAILING

    pairs = []
    for g in groups:
        for entry in doc.get(g) or []:
            if entry.get("url"):
                pairs.append((g, entry))
    return pairs


def verdict(group: str, declared: str, res: dict) -> tuple[bool, str]:
    """선언된 status 와 실제 결과가 맞는지 판정한다."""
    alive = res["code"] == 200 and res["items"] > 0 and not res["error"]

    if group in FAILING:
        # 죽었다고 기록된 것이 살아났다면 그것도 알려줄 가치가 있다.
        if alive:
            return False, "살아있음 -> sources.yaml 갱신 필요"
        return True, "여전히 실패 (예상대로)"

    if declared == "ok":
        if alive:
            return True, "정상"
        return False, res["error"] or f"HTTP {res['code']}"

    return True, f"status={declared} (검사 대상 아님)"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--all", action="store_true", help="스코프 외(보안) 소스도 검사")
    ap.add_argument("--report", metavar="PATH", help="결과를 JSON 파일로 저장")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    # Windows 기본 콘솔은 cp949 라서 한글 출력이 UnicodeEncodeError 로 죽는다.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    doc = yaml.safe_load(SOURCES.read_text(encoding="utf-8"))
    print(f"sources.yaml 최종 검증일: {doc.get('meta', {}).get('verified_at', '?')}\n")

    pairs = collect(doc, args.all)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(lambda p: fetch(p[1]["url"]), pairs))

    rows, bad = [], 0
    for (group, entry), res in zip(pairs, results):
        ok, note = verdict(group, entry.get("status", "ok"), res)
        if not ok:
            bad += 1
        mark = "OK  " if ok else "FAIL"
        name = entry.get("id") or entry.get("name") or entry["url"]
        kind = res["kind"] or "-"
        print(
            f"{mark} [{group:<24}] {name:<22} "
            f"{res['code']:>3} {kind:<5} {res['items']:>4}건  {note}"
        )
        rows.append({"group": group, "ok": ok, "note": note, **res})

    total = len(rows)
    print(f"\n{total}건 검사 · 불일치 {bad}건")
    if bad:
        print("→ 위 FAIL 항목을 확인하고 sources.yaml 의 status / url 을 갱신할 것")

    if args.report:
        Path(args.report).write_text(
            json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"리포트 저장: {args.report}")

    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
