#!/usr/bin/env bash
# Netlify runs this before a git-connected build.
# Exit 0 = skip. Skip every git build (PR previews, branch deploys, merges to main).
# Live publishes come from GitHub Actions on a GitHub Release (and daily refresh of that release).
# Build hooks ignore this script; scripts/netlify-git-build.sh fails those closed.
set -u
echo "Skipping Netlify git build (CONTEXT=${CONTEXT:-unset} BRANCH=${BRANCH:-unset})."
echo "Cut a GitHub Release to publish dynastyticker.com."
exit 0
