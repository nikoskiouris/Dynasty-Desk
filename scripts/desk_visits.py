#!/usr/bin/env python3
"""Print stored desk traffic as eight unlabeled numbers.

Order: today views, today people, week views, week people,
year views, year people, all-time views, all-time people.

Views increment on every live desk load. People are unique hashed
IP + user-agent values for that period. Bots are skipped.
"""
from __future__ import annotations

import json
import sys
from urllib.error import URLError
from urllib.request import urlopen

API = "https://dynastyticker.com/api/views"
PERIODS = ("today", "week", "year", "all")


def counts(payload: object) -> list[int]:
    data = payload if isinstance(payload, dict) else {}
    rows: list[int] = []
    for period in PERIODS:
        bucket = data.get(period) if isinstance(data.get(period), dict) else {}
        for key in ("views", "people"):
            try:
                value = int(bucket.get(key) or 0)
            except (TypeError, ValueError):
                value = 0
            rows.append(max(0, value))
    return rows


def main() -> int:
    with urlopen(API, timeout=10) as response:
        payload = json.load(response)
    for value in counts(payload):
        print(value)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, URLError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1)
