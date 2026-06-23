export default {
	output: {
		format: 'prettier',
		lint: 'eslint'
	},
	plugins: [
		{
			// The FastAPI schema has no `servers` field, so the generator would otherwise
			// fall back to the input filename ('openapi.json') as the client baseUrl, which
			// breaks browser requests. Keep baseUrl out of the generated client: the browser
			// uses relative '/api' paths (proxied by vite/nginx) and the server sets baseUrl
			// at runtime via client.setConfig() in hooks.server.ts.
			name: '@hey-api/client-fetch',
			baseUrl: false
		},
		{
			name: '@hey-api/sdk',
			operations: { strategy: 'byTags' }
		}
	]
};
