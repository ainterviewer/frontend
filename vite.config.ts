import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * The backend dev server's port, from BACKEND_PORT (8666 unless set). The /api
 * proxy, the websockets (`backendWsUrl`) and the justfile's OPENAPI_URL all
 * follow it, so a worktree can run its own backend beside the main checkout's.
 */
function backendPort(mode: string): string {
	return loadEnv(mode, process.cwd(), '').BACKEND_PORT || '8666';
}

export default defineConfig(({ isSsrBuild, mode }) => ({
	define: { __BACKEND_PORT__: JSON.stringify(backendPort(mode)) },
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rolldownOptions: {
			// Strip chatter from the browser bundle, but keep `error` and `warn`
			// for when a user reports a problem. The server bundle keeps every
			// call: its `console.error` is the log. `debugger` is already gone,
			// since the client minifier drops it by default.
			treeshake: isSsrBuild
				? true
				: { manualPureFunctions: ['console.log', 'console.debug', 'console.info', 'console.trace'] }
		}
	},
	server: {
		port: 5173,
		proxy: {
			// forward /api requests to FastAPI dev server
			'/api': {
				target: `http://localhost:${backendPort(mode)}`,
				changeOrigin: true,
				secure: false
			}
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
						// The in-page name matcher behind `.element()` and `.query()` reads
						// a pseudo-element's `content` as one string and ignores CSS alt
						// text, so an icon's `"+" / ""` lands in the name as `+" / "`.
						// Vitest 5 matches names exactly by default.
						locators: { exact: false }
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
}));
