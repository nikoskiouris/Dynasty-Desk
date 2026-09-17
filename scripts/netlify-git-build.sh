#!/usr/bin/env bash
# Safety net if a Netlify git or build-hook job still runs.
# Those builds follow the production git branch (usually main), which is not a release.
set -u
echo "Refusing Netlify git/hook build (CONTEXT=${CONTEXT:-unset} BRANCH=${BRANCH:-unset})."
echo "Merges must not publish. Deploy with scripts/deploy_live_site.sh from a GitHub Release."
exit 1
