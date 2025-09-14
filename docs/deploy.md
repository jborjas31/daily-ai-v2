# Deploy Runbook (Firebase Hosting, CI/CD via GitHub + Workload Identity)

This project deploys a static export of Next.js to Firebase Hosting. CI builds on GitHub Actions and deploys either a live site (pushes to `main`) or a preview channel (pull requests).

## Overview

- Hosting: Firebase Hosting (`firebase.json` → `public: out`)
- Build: `next build` with static export (`output: 'export'`)
- Auth: Google Cloud Workload Identity Federation (WIF) — no long‑lived tokens
- Client env vars: `NEXT_PUBLIC_*` provided at build time (Actions Variables)

## One‑Time Setup

1) Google Cloud Service Account + Roles
- Create a service account, e.g., `firebase-deployer@<PROJECT_ID>.iam.gserviceaccount.com`.
- Grant role: `Firebase Hosting Admin` (and `Viewer` if desired).

2) Workload Identity Federation
- In Google Cloud: create a Workload Identity Pool and Provider for GitHub.
- Allow your GitHub org/repo to impersonate the service account above.
- Collect these two values for GitHub Secrets:
  - `GCP_WORKLOAD_IDENTITY_PROVIDER` (resource name, e.g., `projects/<NUM>/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>`)
  - `GCP_SERVICE_ACCOUNT` (email of the service account)

3) GitHub repository configuration
- Settings → Secrets and variables → Actions
  - Secrets:
    - `GCP_WORKLOAD_IDENTITY_PROVIDER`
    - `GCP_SERVICE_ACCOUNT`
  - Variables (non‑secret, used at build time):
    - `NEXT_PUBLIC_FIREBASE_API_KEY`
    - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    - `NEXT_PUBLIC_FIREBASE_APP_ID`

## Workflows

- `.github/workflows/deploy.yml`
  - Push to `main`: builds and deploys to live Hosting
  - Pull request to `main`: builds and deploys to a preview channel (expires in 7 days)
  - Uses `google-github-actions/auth@v2` with WIF; no tokens needed
  - Build step passes `NEXT_PUBLIC_*` variables to Next.js

## Local Deploy (optional)

1) Node 20+
- `nvm use 20` (see `.nvmrc`)

2) Env vars
- Create `.env.local` with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

3) Build & Deploy
```
npm ci
npm run build
firebase deploy --only hosting --project daily-ai-v2
```

## Troubleshooting

- `auth/invalid-api-key` in console
  - Ensure `NEXT_PUBLIC_*` vars are set in Actions Variables and available during the Build step, or in `.env.local` for local builds.
- Firebase CLI incompatible with Node 18
  - Use Node 20+ (`.nvmrc`), or run an older `firebase-tools` temporarily.
- Deploy fails with authentication error in Actions
  - Ensure `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets are set and correct, and that the service account has `Firebase Hosting Admin`.

