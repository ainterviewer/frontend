import type { LocalizedOption, LocalizedText } from '$lib/api/types.gen';

import type { GuideQuestion, GuideSection, GuideTop } from './types';

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

// A copy with every language's text trimmed, and what is left empty dropped.
export function trimmed(text: LocalizedText): LocalizedText {
	return Object.fromEntries(
		Object.entries(text)
			.map(([language, value]) => [language, (value ?? '').trim()])
			.filter(([, value]) => value)
	);
}

// Survey items are a discriminated union; only the choice-based variants
// (radio/checkbox/likert) carry an `options` array. Returns it when present.
export function surveyItemOptions(
	item: GuideQuestion['survey_item'] | null | undefined
): LocalizedOption[] | undefined {
	return item && 'options' in item ? item.options : undefined;
}

// The fields of `LocalizedQuestion` that hold text, directly or inside them.
// Everything else on a question is shared by every language. utils.test.ts
// checks this against the generated schema, so a field the library adds has
// to be placed on one side or the other.
export const QUESTION_TEXT_FIELDS = [
	'main_question',
	'description',
	'probes',
	'alternative_main_questions',
	'survey_item',
	'image'
] as const;

// Every piece of text a question holds, in every field of QUESTION_TEXT_FIELDS.
export function questionTexts(q: GuideQuestion): LocalizedText[] {
	const texts = [q.main_question, q.description, ...q.probes];
	texts.push(...(q.alternative_main_questions ?? []));
	for (const option of surveyItemOptions(q.survey_item) ?? []) texts.push(option.text ?? {});
	if (q.survey_item?.type === 'slider') {
		texts.push(q.survey_item.min_label ?? {}, q.survey_item.max_label ?? {});
	}
	if (q.image) texts.push(q.image.description, q.image.alt, q.image.primer);
	return texts;
}

// The number of text fields written in another language but not in `language`.
export function countUntranslated(
	top: GuideTop,
	sections: GuideSection[],
	questionsMap: Record<string, GuideQuestion[]>,
	language: string
): number {
	const texts: (LocalizedText | null | undefined)[] = [
		top.framing,
		top.introduction,
		top.outro,
		top.alt_outro,
		...top.timed_messages.map((tm) => tm.message)
	];
	for (const section of sections) {
		texts.push(section.description);
		for (const q of questionsMap[section.id] ?? []) texts.push(...questionTexts(q));
	}
	return texts.filter((text) => isUntranslated(text, language)).length;
}
