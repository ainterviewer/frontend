import { describe, expect, it } from 'vitest';

import { PRESENCE_COLORS, settleColors } from './presenceColors';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `user-${i}`);

describe('settleColors', () => {
	it('gives everyone a different colour while there are enough', () => {
		const colors = settleColors(ids(PRESENCE_COLORS.length));
		expect(new Set(colors.values()).size).toBe(PRESENCE_COLORS.length);
	});

	it('settles the same colours whatever order the users come in', () => {
		const users = ids(6);
		expect([...settleColors(users)].sort()).toEqual([...settleColors([...users].reverse())].sort());
	});

	it('keeps a user’s colour when someone joins who comes after them', () => {
		const before = settleColors(['a', 'b']);
		const after = settleColors(['a', 'b', 'zzz']);
		expect(after.get('a')).toBe(before.get('a'));
		expect(after.get('b')).toBe(before.get('b'));
	});

	it('still gives a colour to everyone past the palette', () => {
		const colors = settleColors(ids(PRESENCE_COLORS.length + 3));
		expect(colors.size).toBe(PRESENCE_COLORS.length + 3);
		for (const color of colors.values()) expect(PRESENCE_COLORS).toContain(color);
	});
});
