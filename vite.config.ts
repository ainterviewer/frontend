import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ isSsrBuild }) => ({
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
				target: 'http://localhost:8666',
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
