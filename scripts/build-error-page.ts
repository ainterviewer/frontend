import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const tmpDir = resolve(here, '.tmp');
const outDir = resolve(projectRoot, '../deploy/setup/nginx');

await build({
	configFile: false,
	root: projectRoot,
	plugins: [svelte()],
	resolve: {
		alias: { $lib: resolve(projectRoot, 'src/lib') }
	},
	build: {
		ssr: resolve(here, 'error-page-entry.ts'),
		outDir: tmpDir,
		emptyOutDir: true,
		minify: false,
		rollupOptions: { output: { format: 'esm', entryFileNames: 'error-page-entry.mjs' } }
	},
	logLevel: 'warn'
});

const mod = (await import(
	pathToFileURL(resolve(tmpDir, 'error-page-entry.mjs')).href
)) as typeof import('./error-page-entry');

mkdirSync(outDir, { recursive: true });
for (const page of mod.errorPages) {
	const html = mod.renderErrorPage(page.props);
	const out = resolve(outDir, page.filename);
	writeFileSync(out, html);
	console.log(`wrote ${out}`);
}
