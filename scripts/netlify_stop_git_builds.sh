#!/usr/bin/env bash
# Stop Netlify git-connected builds for this site.
# Ignore scripts still start a canceled deploy. stop_builds=true means a Git
# push never creates a job. CLI uploads (deploy_live_site.sh) still work.
set -euo pipefail

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" || -z "${NETLIFY_SITE_ID:-}" ]]; then
  echo "Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID." >&2
  echo "GitHub → Settings → Secrets and variables → Actions:" >&2
  echo "  NETLIFY_AUTH_TOKEN  Netlify user access token" >&2
  echo "  NETLIFY_SITE_ID     Site API ID from Netlify → Site configuration" >&2
  exit 1
fi

if [[ "${NETLIFY_STOP_BUILDS_DRY_RUN:-}" == "1" ]]; then
  echo "Would stop Netlify git builds for site $NETLIFY_SITE_ID"
  exit 0
fi

python3 - <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

token = os.environ["NETLIFY_AUTH_TOKEN"]
site = os.environ["NETLIFY_SITE_ID"]
url = f"https://api.netlify.com/api/v1/sites/{site}"
payload = json.dumps({"build_settings": {"stop_builds": True}}).encode()
request = urllib.request.Request(
    url,
    data=payload,
    method="PATCH",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "dynasty-ticker-stop-git-builds",
    },
)
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        body = json.load(response)
except urllib.error.HTTPError as error:
    detail = error.read().decode("utf-8", "replace")
    print(f"Netlify API {error.code}: {detail}", file=sys.stderr)
    raise SystemExit(1) from error
except urllib.error.URLError as error:
    print(f"Netlify API request failed: {error}", file=sys.stderr)
    raise SystemExit(1) from error

stopped = (body.get("build_settings") or {}).get("stop_builds")
if stopped is not True:
    print(
        f"Netlify did not stop git builds. build_settings.stop_builds={stopped!r}",
        file=sys.stderr,
    )
    raise SystemExit(1)

name = body.get("name") or site
print(f"Netlify git builds stopped for {name}. Git pushes will not start deploys.")
PY
