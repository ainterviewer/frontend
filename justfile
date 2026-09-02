set dotenv-load

export PATH := "./node_modules/.bin:" + env('PATH')
export OPENAPI_URL := env('OPENAPI_URL', 'http://localhost:8666/api/openapi.json')
export SDK_OUTPUT_PATH := "src/lib/api"

[private]
default:
    @just --list

[doc("Generate the TypeScript SDK from the running backend's OpenAPI schema:
https://fastapi.tiangolo.com/advanced/generate-clients/

Requires the backend dev server to be up. Override the source with OPENAPI_URL.
This is the only SDK generator — always run it from here, never via bunx, so the
vendored client runtime stays on the pinned @hey-api/openapi-ts in package.json.")]
[group("Frontend")]
generate-sdk:
    openapi-ts --input {{ OPENAPI_URL }} --output {{ SDK_OUTPUT_PATH }}

[doc("Compile the static fallback error page (e.g. 502) for nginx to serve when the app is down. Renders the shared ErrorPage.svelte to a self-contained HTML file in deploy/setup/nginx/.")]
[group("Frontend")]
build-error-page:
    bun run scripts/build-error-page.ts

release VERSION:
    npm version {{ VERSION }} --no-git-tag-version
    just publish

# Bump version and publish (e.g., just bump patch)
bump TYPE: && publish
    npm version {{ TYPE }} --no-git-tag-version

# Install this clone's git hooks (pre-commit + commit-msg).
[group("Frontend")]
install-hooks:
    prek install

# Internal task to sync, regenerate the changelog, commit, tag, and push
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    VERSION=$(jq -r .version package.json)

    # Sync lockfiles
    bun install

    # Prepend this release's section; --prepend needs the file to exist.
    touch CHANGELOG.md
    bunx git-cliff@2.13.1 --unreleased --tag "v${VERSION}" --prepend CHANGELOG.md

    # --only commits just these paths, leaving any other staged work in the
    # index untouched (a plain `git commit` would sweep it into the release).
    git commit --only package.json bun.lock CHANGELOG.md -m "chore(release): v${VERSION}"
    git tag -a "v${VERSION}" -m "v${VERSION}"
    git push --follow-tags

# Manually build & push the Docker image to ghcr.io (fallback for when CI is down).
# Requires GHCR_TOKEN (write:packages) and GITHUB_USERNAME (env or .env).
[group("Frontend")]
publish-docker:
    #!/usr/bin/env bash
    set -euo pipefail
    : "${GHCR_TOKEN:?set GHCR_TOKEN (PAT with write:packages)}"
    : "${GITHUB_USERNAME:?set GITHUB_USERNAME}"

    IMAGE="ghcr.io/ainterviewer/frontend"
    VERSION="$(jq -r .version package.json)"

    TAGS=(-t "${IMAGE}:v${VERSION}")
    case "${VERSION}" in
      *rc*) ;;                          # pre-release: skip 'latest'
      *) TAGS+=(-t "${IMAGE}:latest") ;;
    esac

    echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GITHUB_USERNAME}" --password-stdin

    docker buildx build "${TAGS[@]}" --push .
