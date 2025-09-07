#!/usr/bin/env bash
set -euo pipefail

# Enforce GitHub branch protection for requiring CI to pass before merge.
# - Requires: env var GITHUB_TOKEN with 'repo' scope (admin on repo)
# - Defaults: branch=main, check context="CI / build-and-test"
# - Usage: GITHUB_TOKEN=... .github/scripts/enforce-branch-protection.sh [--owner OWNER] [--repo REPO] [--branch main] [--context "CI / build-and-test"]

OWNER=""
REPO=""
BRANCH="main"
CONTEXT="CI / build-and-test"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="$2"; shift 2;;
    --repo)
      REPO="$2"; shift 2;;
    --branch)
      BRANCH="$2"; shift 2;;
    --context)
      CONTEXT="$2"; shift 2;;
    -h|--help)
      echo "Usage: GITHUB_TOKEN=... $0 [--owner OWNER] [--repo REPO] [--branch main] [--context 'CI / build-and-test']";
      exit 0;;
    *)
      echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: GITHUB_TOKEN is required (token with repo admin permissions)." >&2
  exit 1
fi

# Derive OWNER/REPO from git remote if not provided
if [[ -z "$OWNER" || -z "$REPO" ]]; then
  origin_url=$(git config --get remote.origin.url 2>/dev/null || true)
  if [[ -z "$origin_url" ]]; then
    echo "Error: Could not derive repo from git remote. Pass --owner and --repo." >&2
    exit 1
  fi
  if [[ "$origin_url" =~ ^git@([^:]+):([^/]+)/([^\.]+)(\.git)?$ ]]; then
    OWNER="${BASH_REMATCH[2]}"
    REPO="${BASH_REMATCH[3]}"
  elif [[ "$origin_url" =~ ^https?://[^/]+/([^/]+)/([^\.]+)(\.git)?$ ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
  else
    echo "Error: Could not parse origin URL: $origin_url" >&2
    exit 1
  fi
fi

API_URL="https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"

echo "Applying branch protection on ${OWNER}/${REPO}@${BRANCH} to require: '${CONTEXT}' (strict up-to-date)."

payload=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "${CONTEXT}" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
)

http_code=$(curl -sS -o /tmp/branch_protection_resp.json -w "%{http_code}" \
  -X PUT "$API_URL" \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$payload")

if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
  echo "Error: API returned HTTP $http_code" >&2
  cat /tmp/branch_protection_resp.json >&2 || true
  exit 1
fi

echo "Branch protection updated. Verifying..."
verify_json=$(curl -sS \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "$API_URL")

echo "$verify_json" | grep -q '"strict": true' || { echo "Strict up-to-date not enabled" >&2; exit 1; }
echo "$verify_json" | grep -q "${CONTEXT}" || { echo "Required check context not found: ${CONTEXT}" >&2; exit 1; }

echo "Success: '${CONTEXT}' is required and branches must be up to date before merge."

