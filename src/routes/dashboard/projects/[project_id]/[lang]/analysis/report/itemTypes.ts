import type { ItemDistribution } from '$lib/api/types.gen';
import { badgeForType, FREE_TEXT, STATEMENT, type ItemTypeBadge } from '$lib/survey/itemTypes';

/**
 * How a question's answer type is presented on its card.
 *
 * The badge is what a reader scanning a page of cards sorts by: which of these
 * are choices, which are numbers, which are free text. Reading a word at
 * 10px does not survive that scan, so the type is carried by an icon and a
 * hue, with the word left in place for everyone who is not scanning.
 *
 * The map itself lives in `$lib/survey/itemTypes` — the explore cards name the
 * same types, and two tables of them would drift into two vocabularies for one
 * guide. What stays here is the part that is about a *report row*: a
 * distribution knows things a bare type does not, namely that it is a
 * statement or that nobody was offered an item at all.
 */
export type { ItemTypeBadge };

export function badgeFor(item: ItemDistribution): ItemTypeBadge {
	if (item.kind === 'statement') return STATEMENT;

	// `type` is the union's discriminant but carries a default on the backend,
	// so the generated type has it optional.
	return badgeForType(item.item?.type) ?? FREE_TEXT;
}
