# Agent instructions

## Cursor Cloud specific instructions

- Test changes yourself.
- After tests pass, commit, push, update the PR, and keep moving.

## Live site releases

- Merging to `main` must **not** publish [dynastyticker.com](https://dynastyticker.com/). Netlify git builds are skipped; leftover hooks fail closed.
- Keep opening and merging PRs. Do not trigger a production deploy unless the user explicitly asks to cut a release.
- A release is a published GitHub Release. That runs `.github/workflows/deploy-release.yml`, which calls `scripts/deploy_live_site.sh`.
- The daily job refreshes market files from the **last release tag**, not from `main`.
- Local check: `npm run serve` (or `npm test`). Do not burn Netlify credits for preview deploys.
