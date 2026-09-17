#!/usr/bin/env bash
# Safety net if a Netlify git or build-hook job still runs.
# Git branches (develop, prod, main) are not a Netlify git publish.
# Live publishes come from GitHub Actions after a GitHub Release.
set -u
echo "Refusing Netlify git/hook build (CONTEXT=${CONTEXT:-unset} BRANCH=${BRANCH:-unset})."
echo "Git pushes must not publish. Deploy with scripts/deploy_live_site.sh from a GitHub Release."
exit 1
