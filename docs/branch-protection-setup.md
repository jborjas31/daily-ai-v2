# Enforce CI As a Required Check

This repo uses a GitHub Actions workflow named `CI` with a job id `build-and-test`. To enforce CI before merging to `main`, configure branch protection to require the status check `CI / build-and-test` and require branches to be up to date.

## Option A — GitHub UI (Recommended)

1) Go to GitHub → Your repo → Settings → Branches → Branch protection rules → New rule
2) Branch name pattern: `main`
3) Enable “Require status checks to pass before merging”
4) Click “Select checks” and choose: `CI / build-and-test`
5) Enable “Require branches to be up to date before merging” (strict)
6) Save changes

Notes
- The check name comes from workflow name `CI` and job `build-and-test`.
- You can optionally enable “Require a pull request before merging”, approvals, and conversation resolution.

## Option B — Scripted via GitHub API

Use the provided script to apply the rule via API. Requires repo admin permission.

Prerequisites
- Personal Access Token with `repo` scope in `GITHUB_TOKEN` env var
- Git remote `origin` set to the GitHub repo, or pass `--owner/--repo`

Command
```
GITHUB_TOKEN=ghp_xxx \
  bash .github/scripts/enforce-branch-protection.sh \
  --branch main \
  --context "CI / build-and-test"
```

Optional overrides (if no `origin` remote):
```
GITHUB_TOKEN=ghp_xxx \
  bash .github/scripts/enforce-branch-protection.sh \
  --owner your-org --repo your-repo \
  --branch main --context "CI / build-and-test"
```

Verification
- In GitHub UI under Branch protection rules, confirm `CI / build-and-test` is listed and “Require branches to be up to date” is enabled.
- Or re-run the script; it is idempotent.

## Context

- Workflow file: `.github/workflows/ci.yml`
- Workflow name: `CI`
- Job id: `build-and-test`
- Status check context: `CI / build-and-test`

Once enabled, the checkbox in `docs/MIGRATION_STATUS.md` under “CI → Pipeline required for merge” can be marked complete.
