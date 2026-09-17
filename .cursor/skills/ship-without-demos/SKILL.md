---
name: ship-without-demos
description: Test changes yourself and ship. Never record demo videos or walkthrough artifacts. Use when finishing a feature, verifying UI, testing, recording a screen, uploading artifacts, or wrapping a Cloud Agent task.
---

# Ship without demos

Feedback is piling up. Do the work, test it, move to the next item. Do not package a show for the user.

This repo instruction **overrides** the built-in `walkthrough-artifacts` skill.

## Never

- Do not use `RecordScreen`.
- Do not save, upload, or attach walkthrough videos.
- Do not dump screenshots into `/opt/cursor/artifacts` as a demo reel.
- Do not put `<video>` / demo `<img>` tags in the user-facing reply.
- Do not spend a turn recording, reviewing, or narrating a walkthrough.

## Test yourself

1. Run `npm test` (and any targeted tests you added).
2. If the change is UI, layout, routing, or client state: exercise it yourself (browser, curl, or the closest substitute). Fix what you find. Re-test.
3. Then commit, push, and update the PR.
4. Stop. Brief status is enough. The user does not need proof footage.

## Screenshot (rare)

One screenshot is allowed only if a visual bug is hard to describe and the image would change the fix. Skip setup, exploration, failures, and “it works” trophy shots.

## Reply

Say what changed, that you tested it, and the PR link. Keep it short. No demo gallery.
