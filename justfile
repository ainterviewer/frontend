export PATH := "./node_modules/.bin:" + env('PATH')
export OPENAPI_PATH := "../backend/openapi.json"
export SDK_OUTPUT_PATH := "src/lib/api"

[private]
default:
    @just --list

[doc("Generate TypeScript SDK from openapi.json created by FastAPI:
https://fastapi.tiangolo.com/advanced/generate-clients/")]
[group("Frontend")]
generate-sdk:
    openapi-ts --input {{ OPENAPI_PATH }}  --output {{ SDK_OUTPUT_PATH }}

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

# Internal task to sync, commit, tag, and push
publish:
    #!/usr/bin/env bash
    VERSION=$(jq -r .version package.json)

    # Sync lockfiles
    bun install

    git add package.json bun.lock
    git commit -m "Release v${VERSION}"
    git tag -a "v${VERSION}" -m "Release v${VERSION}"
    git push --follow-tags
