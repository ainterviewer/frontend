import type { ItemDistribution } from '$lib/api/types.gen';

/**
 * How a question's answer type is presented on its card.
 *
 * The badge is what a reader scanning a page of cards sorts by: which of these
 * are choices, which are numbers, which are free text. Reading a word at
 * 10px does not survive that scan, so the type is carried by an icon and a
 * hue, with the word left in place for everyone who is not scanning.
 *
 * The hues are grouped by *what the answer is* rather than by widget, because
 * that is the distinction the reader is making: two item types that produce
 * the same kind of answer (a slider and a number) are not worth telling apart
 * at a glance, while a choice and a number always are. They are deliberately
 * outside `chartColors`: nothing here is plotted, and a badge that shared a
 * hue with a bar would claim a relationship it does not have.
 */
export type ItemTypeBadge = {
	label: string;
	/** Font Awesome class, matching the icon convention used across the app. */
	icon: string;
	/** Tailwind classes for the chip: background, text and border together. */
	tone: string;
};

const CHOICE = 'bg-indigo-50 text-indigo-700 border-indigo-200';
const NUMERIC = 'bg-amber-50 text-amber-700 border-amber-200';
const TEMPORAL = 'bg-teal-50 text-teal-700 border-teal-200';
const TEXT = 'bg-slate-100 text-slate-600 border-slate-200';
const NEUTRAL = 'bg-surface-100 text-gray-500 border-gray-200';

const BY_ITEM_TYPE: Record<string, ItemTypeBadge> = {
	radio: { label: 'Single choice', icon: 'fa-solid fa-circle-dot', tone: CHOICE },
	checkbox: { label: 'Multiple choice', icon: 'fa-solid fa-square-check', tone: CHOICE },
	likert: { label: 'Likert', icon: 'fa-solid fa-signal', tone: CHOICE },
	slider: { label: 'Slider', icon: 'fa-solid fa-sliders', tone: NUMERIC },
	number: { label: 'Number', icon: 'fa-solid fa-hashtag', tone: NUMERIC },
	date: { label: 'Date', icon: 'fa-solid fa-calendar-day', tone: TEMPORAL },
	datetime: { label: 'Date & time', icon: 'fa-solid fa-calendar-days', tone: TEMPORAL },
	time: { label: 'Time', icon: 'fa-solid fa-clock', tone: TEMPORAL }
};

/** A question with no survey item was asked, and answered, in free text. */
const FREE_TEXT: ItemTypeBadge = {
	label: 'Free text',
	icon: 'fa-solid fa-align-left',
	tone: TEXT
};

/**
 * A statement is not put to the respondent as a question at all, so neither
 * the item type nor "free text" describes it.
 */
const STATEMENT: ItemTypeBadge = {
	label: 'Statement',
	icon: 'fa-solid fa-quote-left',
	tone: NEUTRAL
};

export function badgeFor(item: ItemDistribution): ItemTypeBadge {
	if (item.kind === 'statement') return STATEMENT;

	// `type` is the union's discriminant but carries a default on the backend,
	// so the generated type has it optional.
	const type = item.item?.type;
	if (!type) return FREE_TEXT;

	// An item type this build does not know is still named, just not iconified
	// beyond the neutral chip -- better than a card that claims to be free text.
	return BY_ITEM_TYPE[type] ?? { label: type, icon: 'fa-solid fa-tag', tone: NEUTRAL };
}
