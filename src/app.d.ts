// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The backend dev server's port, from BACKEND_PORT (vite.config.ts). */
	const __BACKEND_PORT__: string;

	namespace App {
		// interface Error {}
		interface Locals {
			/** The language a page's content is in, when it is not English: the
			 *  interview's. Sets `<html lang dir>` (`hooks.server.ts`). */
			contentLang?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
