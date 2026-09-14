/**
 * How a survey item's answer type is named and marked, wherever the type is
 * shown to a reader rather than to the code.
 *
 * The wire carries the type as its bare identifier — `radio`, `datetime` — and
 * that is the right spelling for a discriminant and the wrong one for a label:
 * "RADIO" names the widget the developer chose, not the thing the reader is
 * sorting by, which is *what the answer is*. So each type gets a phrase, an
 * icon and a hue here, once, and every surface that shows a type reads them
 * from this map.
 *
 * The hues are grouped by the kind of answer rather than by widget, because
 * that is the distinction the reader is making: two item types that produce
 * the same kind of answer (a slider and a number) are not worth telling apart
 * at a glance, while a choice and a number always are. They are deliberately
 * outside `chartColors`: nothing here is plotted, and a badge that shared a
 * hue with a bar would claim a relationship it does not have.
 *
 * Callers on a coloured ground — a message bubble, say — take the label and
 * the icon and supply their own ground; `tone` is for the pale-card case it
 * was drawn for.
 */
export type ItemTypeBadge = {
	label: string;
	/** Font Awesome class, matching the icon convention used across the app. */
	icon: string;
	/** Tailwind classes for the chip: background, text and border together. */
	tone: string;
};

export const CHOICE = 'bg-indigo-50 text-indigo-700 border-indigo-200';
export const NUMERIC = 'bg-amber-50 text-amber-700 border-amber-200';
export const TEMPORAL = 'bg-teal-50 text-teal-700 border-teal-200';
export const TEXT = 'bg-slate-100 text-slate-600 border-slate-200';
export const NEUTRAL = 'bg-surface-100 text-gray-500 border-gray-200';

export const BY_ITEM_TYPE: Record<string, ItemTypeBadge> = {
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
export const FREE_TEXT: ItemTypeBadge = {
	label: 'Free text',
	icon: 'fa-solid fa-align-left',
	tone: TEXT
};

/**
 * A statement is not put to the respondent as a question at all, so neither
 * the item type nor "free text" describes it.
 */
export const STATEMENT: ItemTypeBadge = {
	label: 'Statement',
	icon: 'fa-solid fa-quote-left',
	tone: NEUTRAL
};

/**
 * The badge for one item type as the API spells it.
 *
 * An item type this build does not know is still named — its own identifier,
 * which is at least the truth — just not iconified beyond the neutral chip.
 * That beats a card claiming the answer was free text when it was a click.
 */
export function badgeForType(type: string | null | undefined): ItemTypeBadge | null {
	if (!type) return null;
	return BY_ITEM_TYPE[type] ?? { label: type, icon: 'fa-solid fa-tag', tone: NEUTRAL };
}
