import type { LocalizedText } from '$lib/api/types.gen';

// Text in the editor is a `{language: text}` map. These are the primitives the
// fields and the renderers share; they mirror `ainterviewer.interview_guides.
// localized` in the library, which is what the server renders interviews with.

// The text in the first of `languages` that has any, else ''.
export function pick(text: LocalizedText | null | undefined, languages: string[]): string {
	for (const language of languages) {
		const value = text?.[language];
		if (value) return value;
	}
	return '';
}

// Untranslated: written in some language, but not in `language`.
export function isUntranslated(text: LocalizedText | null | undefined, language: string): boolean {
	if (!text || text[language]) return false;
	return Object.values(text).some(Boolean);
}

// A leaf holding `value` in `language`, or an empty one.
export function textIn(language: string, value?: string | null): LocalizedText {
	return value ? { [language]: value } : {};
}

// Trims every language's text in place, dropping what is left empty.
export function trimText(text: LocalizedText) {
	for (const [language, value] of Object.entries(text)) {
		const trimmed = (value ?? '').trim();
		if (trimmed) text[language] = trimmed;
		else delete text[language];
	}
}
