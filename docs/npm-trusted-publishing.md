# npm Trusted Publishing (my-pi)

This fork publishes `@shawnma/*` packages with **npm Trusted Publishing** (OIDC via GitHub Actions).

- No long-lived `NPM_TOKEN` in GitHub Secrets
- No “bypass 2FA” automation token
- Workflow: [`.github/workflows/publish-npm.yml`](../.github/workflows/publish-npm.yml)
- Publish script: [`scripts/publish.mjs`](../scripts/publish.mjs) (already uses `--provenance`)

## What you configure once

### 1. GitHub repository

Repo: `ShawnMa123/my-pi`

1. **Actions enabled** for the repo.
2. Optional but recommended: **Settings → Environments → New environment → `npm-publish`**
   - No secrets required for trusted publishing
   - You may add required reviewers if you want a manual approve step before publish

### 2. npmjs.com Trusted Publisher (each package)

Do this while logged in as `shawnma`.

For **each** public package name below, open (or create) the package’s **Trusted Publisher** settings and add GitHub Actions:

| Package |
|---------|
| `@shawnma/pi-tui` |
| `@shawnma/pi-telemetry` |
| `@shawnma/pi-ai` |
| `@shawnma/pi-agent-core` |
| `@shawnma/pi-session-backend-sqlite-node` |
| `@shawnma/pi-protocol` |
| `@shawnma/pi-client` |
| `@shawnma/pi-coding-agent` |
| `@shawnma/pi-server` (optional; published if not private) |
| other public workspace packages returned by `node scripts/release-packages.mjs` |

Publisher fields:

| Field | Value |
|-------|--------|
| Organization or user | `ShawnMa123` |
| Repository | `my-pi` |
| Workflow filename | `publish-npm.yml` |
| Environment | `npm-publish` (must match the workflow `environment:`) |

Notes:

- Workflow filename is **only** the file name, not a path (`publish-npm.yml`).
- If npm UI allows configuring a trusted publisher **before** the package exists, prefer that for the first release.
- If a package must exist first, publish a one-time placeholder from your laptop with OTP, then attach Trusted Publisher and use Actions afterwards.
- `package.json` `repository.url` must stay `git+https://github.com/ShawnMa123/my-pi.git` (already set for the renamed packages).

Official docs: [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers/)

## How to release

### A. Tag-based (normal)

On the commit you want to publish (versions already bumped / lockstep, e.g. `0.84.2`):

```bash
git checkout dev   # or main
git pull
git tag v0.84.2
git push origin v0.84.2
```

Pushing `v*` starts **Publish npm packages**.

### B. Manual dispatch

GitHub → **Actions** → **Publish npm packages** → **Run workflow**

- Optional `tag`: e.g. `v0.84.2`
- Leave empty to publish whatever versions are on the selected branch HEAD

## What the workflow does

1. `npm ci --ignore-scripts`
2. hydrate model data + `npm run build` + `npm run check` (+ `npm test` unless skipped)
3. upgrade npm CLI (OIDC trusted publish requirement)
4. `node scripts/publish.mjs --dry-run` then `node scripts/publish.mjs`
5. verify each public package version is on the registry

Already-published versions are skipped (idempotent).

## Local publish (fallback)

If Actions is not ready yet:

```bash
npm run build
node scripts/publish.mjs --dry-run
# each package, with OTP:
cd packages/tui && npm publish --access public --otp=XXXXXX
```

Prefer fixing Trusted Publisher over using bypass-2FA tokens.

## Security checklist

- [ ] Chat/CI long-lived tokens revoked after experiments
- [ ] No `NPM_TOKEN` secret required for this workflow
- [ ] Trusted Publisher limited to `ShawnMa123/my-pi` + `publish-npm.yml` + `npm-publish` env
- [ ] Only maintainers can push tags / approve the environment
