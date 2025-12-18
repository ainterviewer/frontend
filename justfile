export PATH := "./node_modules/.bin:" + env_var('PATH')
export OPENAPI_PATH := "../backend/openapi.json"
export SDK_OUTPUT_PATH := "src/lib/api"

[doc("Generate TypeScript SDK from openapi.json created by FastAPI:
https://fastapi.tiangolo.com/advanced/generate-clients/")]
[group("Frontend")]
generate-sdk:
    openapi-ts --input {{ OPENAPI_PATH }}  --output {{ SDK_OUTPUT_PATH }}
