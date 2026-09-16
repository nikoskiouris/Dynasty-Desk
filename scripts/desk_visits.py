#!/usr/bin/env python3
"""Print stored visit totals as four unlabeled numbers: today, week, year, all-time."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

SITE = "dynastydesk.com"
BASE = ""
API = "https://page-views-api.ratneshc.com/api/v1/views"


def period_keys(now: datetime) -> tuple[str, str, str]:
    iso = now.isocalendar()
    day = now.strftime("%Y-%m-%d")
    week = f"{iso.year}-W{iso.week:02d}"
    year = str(now.year)
    return day, week, year


def views(path: str) -> int:
    query = urlencode({"site": SITE, "path": path})
    with urlopen(f"{API}?{query}", timeout=10) as response:
        payload = json.load(response)
    try:
        value = int(payload.get("views") or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, value)


def main() -> int:
    now = datetime.now(timezone.utc)
    day, week, year = period_keys(now)
    for path in (f"{BASE}/d/{day}", f"{BASE}/w/{week}", f"{BASE}/y/{year}", BASE or "/"):
        print(views(path))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, URLError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1)
