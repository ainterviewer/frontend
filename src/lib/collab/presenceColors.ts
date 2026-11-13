// Colours for avatars and rings: dark enough for white initials, distinct
// enough side by side.
export const PRESENCE_COLORS = [
	'#0f766e', // teal
	'#b45309', // amber
	'#4338ca', // indigo
	'#be185d', // pink
	'#0369a1', // sky
	'#4d7c0f', // lime
	'#7c3aed', // violet
	'#b91c1c', // red
	'#a21caf', // fuchsia
	'#475569', // slate
	'#854d0e' // brown
];

/** The colour a user gets when no one present has taken it already. */
function preferred(id: string): number {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return Math.abs(hash) % PRESENCE_COLORS.length;
}

/**
 * A colour for each of the users present, different from each other's while
 * there are colours to go round. Every tab sees the same users, so every tab
 * settles on the same colours: in order of id, each user takes their
 * preferred colour, or the next free one after it. A user's colour only
 * changes when someone joins who comes first and wants the same one.
 */
export function settleColors(ids: Iterable<string>): Map<string, string> {
	const sorted = [...new Set(ids)].sort();
	const taken = new Set<number>();
	const colors = new Map<string, string>();
	for (const id of sorted) {
		let index = preferred(id);
		if (taken.size < PRESENCE_COLORS.length) {
			while (taken.has(index)) index = (index + 1) % PRESENCE_COLORS.length;
		}
		taken.add(index);
		colors.set(id, PRESENCE_COLORS[index]);
	}
	return colors;
}
