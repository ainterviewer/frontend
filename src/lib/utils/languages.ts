import type { ProjectLanguage } from '$lib/api';

/** The project's default language, else its first; undefined if it has none. */
export function defaultLanguage(languages: readonly ProjectLanguage[]): string | undefined {
	return (languages.find((l) => l.is_default) ?? languages[0])?.code;
}

/**
 * The language a project page should be on when the URL asks for `requested`:
 * `requested` itself if the project offers it, the offered code it names in
 * another case (`da` → `DA`), else the default. Undefined when the project
 * has no languages, as there is then nothing to send anybody to.
 */
export function offeredLanguage(
	languages: readonly ProjectLanguage[],
	requested: string
): string | undefined {
	if (languages.some((l) => l.code === requested)) return requested;
	const upper = requested.toUpperCase();
	return languages.find((l) => l.code.toUpperCase() === upper)?.code ?? defaultLanguage(languages);
}
