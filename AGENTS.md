# Repository instructions

This repository is part of the coffee-in-a-row project.

## Coding workflow

Use Ponytail in `full` mode by default when writing, fixing, or refactoring application code or tests. If the Ponytail skill is unavailable in the current session, follow the same approach: reuse existing code and platform APIs, choose the simplest implementation that satisfies the request, and preserve existing behavior outside the requested change. Verify changes with the relevant checks.

## Application version

- The repository owns the first two numbers (major/minor), currently `0.1`. Store them as the valid npm version `0.1.0-local` in `package.json`. The trailing `0-local` is a local placeholder, not a published build number. Keep the root and `packages[""].version` in `package-lock.json` synchronized.
- Change major/minor deliberately for a new release series; do not increment them for every ordinary edit. Preserve the `.0-local` suffix in the repository.
- Pages CI runs `node scripts/set-ci-version.mjs` before building. The published version is exactly `major.minor.GITHUB_RUN_NUMBER`: `0.1.0-local` with run 25 becomes `0.1.25`. Do not add the repository patch or another offset.
- This only modifies the disposable CI checkout. Never commit or push generated version changes from CI. Keep `contents: read`; versioning must not require pulling bot commits.
- Existing workflow run numbers mean the first published number may be higher than 1. Failed/cancelled runs leave gaps. Manual dispatch gets a new number; rerunning the same run keeps its version. Preserve the workflow identity to keep numbering increasing within a release series.
- Settings use the version imported from `package.json`: local `0.1.0-local` is displayed as `0.1 (local build)` (translated), published builds as e.g. `0.1.25`. Never hardcode a separate UI version.
- The Android wrapper has its own native build version. Change it only when rebuilding/releasing the wrapper.
