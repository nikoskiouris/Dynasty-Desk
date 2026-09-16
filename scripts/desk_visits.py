#!/usr/bin/env python3
"""Print the stored Dynasty Desk visit total. The website does not show this number."""
from __future__ import annotations

import json
import sys
from urllib.error import URLError
from urllib.request import urlopen

VIEWS_URL = (
    "https://page-views-api.ratneshc.com/api/v1/views"
    "?site=nikoskiouris.github.io&path=/DynastyDesk"
)


def main() -> int:
    with urlopen(VIEWS_URL, timeout=10) as response:
        payload = json.load(response)
    print(payload.get("views", 0))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, URLError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        raise SystemExit(1)
